import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { cutover, listIn, undo } from '../scripts/cutover.js';

const RECORD = { id: 'rec1', type: 'A', name: 'myordbok.com', content: '203.0.113.7', ttl: 1, proxied: true, comment: null };

/**
 * Stand-ins for everything the cutover reaches: git, npm, wrangler and gh as
 * one `run`, Cloudflare and the two sites as one `fetch`. `world` is their
 * state; `did` lists what was changed, in order.
 */
function standIn(over = {}) {
	const world = {
		records: [RECORD, { id: 'mx', type: 'MX', name: 'myordbok.com', content: 'mail.example', ttl: 1, proxied: false }],
		attached: /** @type {Array<{ id: string, hostname: string, service: string }>} */ ([]),
		variable: /** @type {string | null} */ (null),
		liveVersion: /** @type {string | null} */ (null),
		betaVersion: '1.2.3',
		release: [
			{ env: 'beta', reads: 'beta', build: 'B1' },
			{ env: 'live', reads: 'live', build: 'B1' },
		],
		secrets: ['GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'],
		dirty: '',
		deployFails: false,
		neverAnswers: false,
		...over,
	};
	/** @type {string[]} */
	const did = [];
	/** @type {string[]} */
	const said = [];
	const ok = (/** @type {unknown} */ result) => new Response(JSON.stringify({ success: true, result }), { headers: { 'content-type': 'application/json' } });

	/** @type {import('../scripts/cutover.js').Deps} */
	const deps = {
		version: '1.2.3',
		env: { CUTOVER_TOKEN: 'token' },
		stateFile: join(mkdtempSync(join(tmpdir(), 'cutover-')), 'state', 'cutover.json'),
		log: (line) => said.push(line),
		sleep: async () => {},
		waitMs: 0,
		run(cmd, args) {
			const line = `${cmd} ${args.join(' ')}`;
			if (cmd === 'git') {
				if (args[0] === 'status') return world.dirty;
				if (args[0] === 'rev-parse') return 'abc\n';
				if (args[0] === 'rev-list') return '3\n';
				if (args[0] === 'push') did.push('push master');
				return '';
			}
			if (line === 'npm test') return '';
			if (line === 'node scripts/build.js') return did.push('build'), '';
			if (line.startsWith('npx wrangler d1 execute')) return ` ⛅️ wrangler [notice]\n${JSON.stringify([{ results: world.release }], null, 2)}`;
			if (line.startsWith('npx wrangler secret list')) return JSON.stringify(world.secrets.map((name) => ({ name, type: 'secret_text' })), null, 2);
			if (line === 'npx wrangler deploy --env live') {
				assert.equal(world.records.filter((r) => r.type === 'A').length, 0, 'the record is gone before the Worker takes the domain');
				if (world.deployFails) throw new Error('npx wrangler deploy failed (exit 1):\nboom');
				did.push('deploy');
				if (!world.attached.length) world.attached.push({ id: 'dom1', hostname: 'myordbok.com', service: 'myordbok-live' });
				if (!world.neverAnswers) world.liveVersion = '1.2.3';
				return '';
			}
			if (line.startsWith('gh api')) return 'live\n';
			if (line === 'gh variable get LIVE_ENABLED') {
				if (world.variable === null) throw new Error('gh variable get LIVE_ENABLED failed (exit 1):\nvariable LIVE_ENABLED was not found');
				return `${world.variable}\n`;
			}
			if (line.startsWith('gh variable set LIVE_ENABLED --body ')) return (world.variable = args[4]), did.push(`LIVE_ENABLED=${args[4]}`), '';
			throw new Error(`The stand-in has no ${line}`);
		},
		async fetch(input, init) {
			const url = new URL(String(input));
			const method = init?.method ?? 'GET';
			if (url.hostname !== 'api.cloudflare.com') {
				const version = url.hostname === 'beta.myordbok.com' ? world.betaVersion : world.liveVersion;
				if (!version) return new Response('<html>the earlier site</html>', { headers: { 'content-type': 'text/html' } });
				return new Response(JSON.stringify({ ok: true, version, dictionary: { database: 'myordbok-live', built: 'B1' } }), { headers: { 'content-type': 'application/json' } });
			}
			assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer token');
			const path = url.pathname.replace('/client/v4', '');
			if (method === 'GET' && path === '/zones') return ok([{ id: 'zone1', account: { id: 'acct1' } }]);
			if (method === 'GET' && path === '/zones/zone1/dns_records') return ok(world.records);
			if (method === 'GET' && path === '/accounts/acct1/workers/domains') return ok(world.attached);
			const record = /^\/zones\/zone1\/dns_records\/(\w+)$/.exec(path);
			if (method === 'DELETE' && record) {
				world.records = world.records.filter((r) => r.id !== record[1]);
				did.push(`delete record ${record[1]}`);
				return ok({ id: record[1] });
			}
			if (method === 'POST' && path === '/zones/zone1/dns_records') {
				const body = JSON.parse(String(init?.body));
				world.records.push({ id: 'new1', ...body });
				did.push(`create record ${body.type} ${body.content}`);
				return ok(body);
			}
			const domain = /^\/accounts\/acct1\/workers\/domains\/(\w+)$/.exec(path);
			if (method === 'DELETE' && domain) {
				world.attached = world.attached.filter((d) => d.id !== domain[1]);
				did.push(`detach ${domain[1]}`);
				return ok(null);
			}
			return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: `no ${method} ${path}` }] }), { status: 404 });
		},
	};
	return { world, did, said, deps };
}

test('cutover: a dry run checks everything and changes nothing', async () => {
	const { did, said, deps } = standIn();
	assert.equal(await cutover(deps, { apply: false }), 0);
	assert.deepEqual(did, []);
	assert.ok(!existsSync(deps.stateFile));
	const out = said.join('\n');
	assert.match(out, /\[ {2}ok {2}\] Domain: to keep, then delete: A 203\.0\.113\.7 \(proxied\)/);
	assert.doesNotMatch(out, /mail\.example/, 'mail records are not the cutover\'s');
	assert.match(out, /LIVE_ENABLED is not set/);
	assert.match(out, /Dry run/);
});

test('cutover: every failed check is listed and nothing is changed, with APPLY too', async () => {
	const { did, said, deps } = standIn({ dirty: ' M file', betaVersion: '1.2.2', secrets: ['GITHUB_CLIENT_SECRET'], release: [{ env: 'beta', reads: 'beta', build: 'B1' }] });
	deps.env = {};
	assert.equal(await cutover(deps, { apply: true }), 1);
	assert.deepEqual(did, []);
	const out = said.join('\n');
	for (const what of [/FAIL \] Branch: there are changes/, /FAIL \] Beta: beta\.myordbok\.com runs 1\.2\.2, this checkout is 1\.2\.3/, /FAIL \] Dictionary: no dictionary has been released to live/, /FAIL \] Sign-in secrets: myordbok-live lacks GOOGLE_CLIENT_SECRET/, /FAIL \] Domain: CUTOVER_TOKEN is not set/, /5 checks failed; nothing was changed/]) assert.match(out, what);
});

test('cutover: with APPLY the steps run in order, the records are kept first, and undo puts them back', async () => {
	const { world, did, said, deps } = standIn();
	assert.equal(await cutover(deps, { apply: true }), 0);
	assert.deepEqual(did, ['build', 'push master', 'delete record rec1', 'deploy', 'LIVE_ENABLED=true']);
	const kept = JSON.parse(readFileSync(deps.stateFile, 'utf8'));
	assert.deepEqual(kept.records, [RECORD]);
	assert.equal(world.records.length, 1, 'the mail record stays');

	// A second run finds the cutover made: it deploys again, leaves DNS and the kept copy alone.
	did.length = 0;
	assert.equal(await cutover(deps, { apply: true }), 0);
	assert.deepEqual(did, ['build', 'push master', 'deploy', 'LIVE_ENABLED=true']);
	assert.deepEqual(JSON.parse(readFileSync(deps.stateFile, 'utf8')).records, [RECORD]);

	did.length = 0;
	assert.equal(await undo(deps, { apply: false }), 0);
	assert.deepEqual(did, []);
	assert.equal(await undo(deps, { apply: true }), 0);
	assert.deepEqual(did, ['LIVE_ENABLED=false', 'detach dom1', 'create record A 203.0.113.7']);
	assert.deepEqual(world.attached, []);
	assert.partialDeepStrictEqual(world.records.at(-1), { type: 'A', name: 'myordbok.com', content: '203.0.113.7', proxied: true });

	did.length = 0;
	said.length = 0;
	assert.equal(await undo(deps, { apply: true }), 0);
	assert.deepEqual(did, [], 'a second undo has nothing to do');
	assert.match(said.join('\n'), /Nothing to undo/);
});

test('cutover: a failed deploy puts the records back at once', async () => {
	const { world, did, deps } = standIn({ deployFails: true });
	assert.equal(await cutover(deps, { apply: true }), 1);
	assert.deepEqual(did, ['build', 'push master', 'delete record rec1', 'create record A 203.0.113.7']);
	assert.equal(world.variable, null);
	assert.equal(world.records.filter((r) => r.type === 'A').length, 1);
});

test('cutover: a site that does not answer in time leaves LIVE_ENABLED alone and names the way back', async () => {
	const { world, said, deps } = standIn({ neverAnswers: true });
	assert.equal(await cutover(deps, { apply: true }), 1);
	assert.equal(world.variable, null);
	assert.match(said.join('\n'), /did not answer as version 1\.2\.3 in time[\s\S]*make cutover-undo APPLY=1/);
});

test('cutover: a later build on beta is noted, not refused; a domain on another Worker is refused', async () => {
	const later = standIn({ release: [{ env: 'beta', reads: 'beta', build: 'B2' }, { env: 'live', reads: 'live', build: 'B1' }] });
	assert.equal(await cutover(later.deps, { apply: false }), 0);
	assert.match(later.said.join('\n'), /\[ note \] Dictionary: live has the build B1; beta previews a later one, B2/);

	const other = standIn({ attached: [{ id: 'd9', hostname: 'myordbok.com', service: 'something-else' }] });
	assert.equal(await cutover(other.deps, { apply: true }), 1);
	assert.deepEqual(other.did, []);
});

test('cutover: undo without kept records says so and changes nothing', async () => {
	const { did, deps } = standIn();
	await assert.rejects(undo(deps, { apply: true }), /No kept DNS records/);
	assert.deepEqual(did, []);
});

test('listIn finds the list after wrangler\'s notices', () => {
	assert.deepEqual(listIn('▲ [WARNING] Proxy detected [x]\n\n[\n  { "a": 1 }\n]\n'), [{ a: 1 }]);
	assert.deepEqual(listIn('[]'), []);
	assert.throws(() => listIn('nothing [here]'), /No JSON list/);
});
