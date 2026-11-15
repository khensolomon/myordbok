// @ts-check
/**
 * Cutover: myordbok.com leaves the earlier site and is served by the Worker
 * myordbok-live; and the way back. Node standard library only. Dry run
 * unless --apply.
 *
 *   node scripts/cutover.js [--apply]         make cutover [APPLY=1]
 *   node scripts/cutover.js undo [--apply]    make cutover-undo [APPLY=1]
 *
 * A dry run makes every check and changes nothing. With --apply, and only
 * when no check failed:
 *
 *   1. build the live site (dist/web)
 *   2. fast-forward master to dev
 *   3. keep a copy of the DNS records of the domain (state file, outside the
 *      repository), then delete them: a Worker domain is refused while a
 *      record of that name exists
 *   4. deploy myordbok-live from this machine; when the deploy fails the
 *      records are put back at once
 *   5. wait until https://myordbok.com/api/health answers with this version
 *   6. set the GitHub variable LIVE_ENABLED to true, so that later releases
 *      (make release) deploy live by themselves
 *
 * Between steps 3 and 4 the domain has no record: readers get an error for
 * as long as the deploy takes, about half a minute.
 *
 * undo: LIVE_ENABLED back to false, the domain taken off the Worker, the
 * kept records created again. master stays where it is.
 *
 * What it needs on the machine:
 *   CUTOVER_TOKEN  a Cloudflare API token with Zone → DNS → Edit on the
 *                  domain and Account → Workers Scripts → Edit (undo takes
 *                  the domain off the Worker). Named apart from
 *                  CLOUDFLARE_API_TOKEN on purpose: wrangler would use that
 *                  one for the deploy in place of its own login.
 *   wrangler       logged in to the owning account (npx wrangler login)
 *   gh             the GitHub command line, logged in (gh auth login)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DOMAIN = 'myordbok.com';
export const BETA = 'beta.myordbok.com';
export const WORKER = 'myordbok-live';
export const SECRETS = ['GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'];
/** Record types a host name answers with; MX, TXT and the like stay untouched. */
export const ADDRESS_TYPES = ['A', 'AAAA', 'CNAME'];
const API = 'https://api.cloudflare.com/client/v4';
const ROOT = resolve(import.meta.dirname, '..');

/**
 * @typedef {(cmd: string, args: string[], show?: boolean) => string} Run
 *   Runs a program in the repository; returns its output, throws with it when it fails.
 *   With show, the output goes to the terminal as it comes.
 * @typedef {{ id: string, type: string, name: string, content: string, ttl: number, proxied: boolean, comment?: string | null }} DnsRecord
 * @typedef {{ at: string, zone: string, account: string, records: DnsRecord[] }} Kept
 * @typedef {object} Deps
 * @property {Run} run
 * @property {typeof fetch} fetch
 * @property {Record<string, string | undefined>} env
 * @property {(line: string) => void} log
 * @property {string} stateFile
 * @property {string} version         The version in package.json.
 * @property {(ms: number) => Promise<void>} sleep
 * @property {number} [waitMs]        How long step 5 waits (default five minutes).
 * @typedef {{ state: 'ok' | 'note' | 'fail', text: string }} Check
 */

/** Where the DNS records are kept between cutover and undo: outside the repository, per machine. */
export function cutoverFile() {
	const base = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
	return join(base, 'myordbok', 'cutover.json');
}

/** @type {Run} */
function run(cmd, args, show = false) {
	try {
		return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', show ? 'inherit' : 'pipe', show ? 'inherit' : 'pipe'], maxBuffer: 64 * 1024 * 1024 }) ?? '';
	} catch (err) {
		const e = /** @type {{ stdout?: string, stderr?: string, status?: number, code?: string }} */ (err);
		if (e.code === 'ENOENT') throw new Error(`${cmd} is not installed`);
		const said = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
		throw new Error(`${cmd} ${args.join(' ')} failed${e.status ? ` (exit ${e.status})` : ''}${said ? `:\n${said}` : ''}`);
	}
}

const message = (/** @type {unknown} */ err) => (err instanceof Error ? err.message : String(err));
const firstLine = (/** @type {string} */ s) => s.split('\n')[0];

/**
 * The JSON list a wrangler command printed, whatever notices came before it.
 * @param {string} out
 * @returns {any[]}
 */
export function listIn(out) {
	const at = out.search(/^\[(?=\s*[\n{\]])/m);
	if (at < 0) throw new Error(`No JSON list in the output:\n${out.trim().slice(0, 400)}`);
	return JSON.parse(out.slice(at));
}

/**
 * The Cloudflare API with the cutover token.
 * @param {Deps} deps
 */
function cloudflare(deps) {
	const token = deps.env.CUTOVER_TOKEN;
	if (!token) throw new Error('CUTOVER_TOKEN is not set: a Cloudflare API token with Zone → DNS → Edit and Account → Workers Scripts → Edit (docs/deploy.md, Cutover)');
	/**
	 * @param {string} method
	 * @param {string} path
	 * @param {unknown} [body]
	 * @returns {Promise<any>}
	 */
	return async (method, path, body) => {
		const res = await deps.fetch(`${API}${path}`, {
			method,
			headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
		const data = /** @type {any} */ (await res.json().catch(() => null));
		if (!res.ok || !data?.success) {
			const why = data?.errors?.map((/** @type {{ code: number, message: string }} */ e) => `${e.message} (${e.code})`).join('; ') || `HTTP ${res.status}`;
			throw new Error(`Cloudflare ${method} ${path}: ${why}`);
		}
		return data.result;
	};
}

/**
 * The zone, its account, the address records of the domain and the Worker
 * the domain is on, if any.
 * @param {Deps} deps
 */
async function domainState(deps) {
	const cf = cloudflare(deps);
	const zones = await cf('GET', `/zones?name=${DOMAIN}`);
	if (zones.length !== 1) throw new Error(`The token sees ${zones.length} zones named ${DOMAIN}, expected 1`);
	const zone = String(zones[0].id);
	const account = String(zones[0].account.id);
	const all = /** @type {DnsRecord[]} */ (await cf('GET', `/zones/${zone}/dns_records?name=${DOMAIN}&per_page=100`));
	const attached = /** @type {Array<{ id: string, hostname: string, service: string }>} */ (await cf('GET', `/accounts/${account}/workers/domains?hostname=${DOMAIN}`)).filter((d) => d.hostname === DOMAIN);
	// A domain on a Worker has a record of its own, made and removed with it.
	const records = attached.length ? [] : all.filter((r) => r.name === DOMAIN && ADDRESS_TYPES.includes(r.type));
	return { cf, zone, account, records, attached };
}

/**
 * @param {Deps} deps
 * @param {string} host
 * @returns {Promise<{ ok?: boolean, version?: string, dictionary?: { database?: string, built?: string | null } | null, error?: string }>}
 */
async function health(deps, host) {
	const res = await deps.fetch(`https://${host}/api/health`, { headers: { accept: 'application/json' } });
	const type = res.headers.get('content-type') ?? '';
	if (!type.includes('json')) throw new Error(`https://${host}/api/health answered ${res.status} ${type || 'with no type'}, not this app`);
	return /** @type {any} */ (await res.json());
}

/**
 * Every check, none skipped after a failure, so one dry run shows all that is missing.
 * @param {Deps} deps
 * @returns {Promise<{ checks: Check[], state: Awaited<ReturnType<typeof domainState>> | null }>}
 */
export async function check(deps) {
	/** @type {Check[]} */
	const checks = [];
	/**
	 * @param {string} what
	 * @param {() => string | Check | Promise<string | Check>} fn  Returns what was found; throws what is wrong.
	 */
	const step = async (what, fn) => {
		try {
			const found = await fn();
			checks.push(typeof found === 'string' ? { state: 'ok', text: `${what}: ${found}` } : { ...found, text: `${what}: ${found.text}` });
		} catch (err) {
			checks.push({ state: 'fail', text: `${what}: ${message(err)}` });
		}
	};
	const git = (/** @type {string[]} */ ...args) => deps.run('git', args).trim();

	await step('Branch', () => {
		git('fetch', '--quiet', 'origin', '+refs/heads/dev:refs/remotes/origin/dev', '+refs/heads/master:refs/remotes/origin/master');
		if (git('status', '--porcelain')) throw new Error('there are changes not committed; commit or stash them');
		if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/dev')) throw new Error('check out dev and make sure it is pushed and up to date');
		try {
			git('merge-base', '--is-ancestor', 'origin/master', 'origin/dev');
		} catch {
			throw new Error('master has commits that dev lacks; merge master into dev first');
		}
		const n = git('rev-list', '--count', 'origin/master..origin/dev');
		return `dev is pushed; ${n} commit${n === '1' ? '' : 's'} go to master`;
	});

	await step('Tests', () => {
		deps.run('npm', ['test']);
		return 'pass';
	});

	await step('Beta', async () => {
		const h = await health(deps, BETA);
		if (!h.ok) throw new Error(`${BETA} is not well: ${h.error ?? 'no reason given'}`);
		if (h.version !== deps.version) throw new Error(`${BETA} runs ${h.version}, this checkout is ${deps.version}; wait for the deploy, or pull`);
		return `${BETA} runs ${h.version}, what goes live`;
	});

	await step('Dictionary', () => {
		const out = deps.run('npx', ['wrangler', 'd1', 'execute', 'myordbok-app', '--remote', '--env', 'beta', '--json', '--command', 'SELECT env, reads, build FROM dict_release']);
		const rows = /** @type {Array<{ env: string, reads: string, build: string }>} */ (listIn(out)[0].results);
		const live = rows.find((r) => r.env === 'live');
		const beta = rows.find((r) => r.env === 'beta');
		if (!live) throw new Error('no dictionary has been released to live; run make data-live APPLY=1');
		if (live.reads !== 'live') throw new Error(`live reads myordbok-${live.reads}: a promotion is under way or was cut short; run make data-live APPLY=1`);
		if (beta && beta.build !== live.build) return { state: 'note', text: `live has the build ${live.build}; beta previews a later one, ${beta.build}, which stays on beta until make data-live` };
		return `live has the build ${live.build}, the same as beta`;
	});

	await step('Sign-in secrets', () => {
		const out = deps.run('npx', ['wrangler', 'secret', 'list', '--env', 'live', '--format', 'json']);
		const names = /** @type {Array<{ name: string }>} */ (listIn(out)).map((s) => s.name);
		const missing = SECRETS.filter((s) => !names.includes(s));
		if (missing.length) throw new Error(`${WORKER} lacks ${missing.join(' and ')}; npx wrangler secret put ${missing[0]} --env live`);
		return `${SECRETS.join(' and ')} are on ${WORKER}`;
	});

	await step('GitHub', () => {
		deps.run('gh', ['api', 'repos/{owner}/{repo}/environments/live', '--jq', '.name']);
		let now = '';
		try {
			now = deps.run('gh', ['variable', 'get', 'LIVE_ENABLED']).trim();
		} catch (err) {
			// Not set yet is as good as false; anything else is a failure.
			if (!/not found|404/i.test(message(err))) throw err;
		}
		return `the environment live exists; LIVE_ENABLED is ${now ? `"${now}"` : 'not set'}`;
	});

	/** @type {Awaited<ReturnType<typeof domainState>> | null} */
	let state = null;
	await step('Domain', async () => {
		state = await domainState(deps);
		if (state.attached.length) {
			const on = state.attached[0].service;
			if (on !== WORKER) throw new Error(`${DOMAIN} is on the Worker ${on}, not ${WORKER}`);
			return { state: 'note', text: `${DOMAIN} is already on ${WORKER}: the cutover has been made; --apply deploys again and leaves DNS alone` };
		}
		if (!state.records.length) return { state: 'note', text: `${DOMAIN} has no address record; nothing to keep or delete` };
		return `to keep, then delete: ${state.records.map((r) => `${r.type} ${r.content}${r.proxied ? ' (proxied)' : ''}`).join(', ')}`;
	});

	return { checks, state };
}

/** @param {Deps} deps @param {Check[]} checks */
function report(deps, checks) {
	const sign = { ok: '  ok  ', note: ' note ', fail: ' FAIL ' };
	for (const c of checks) deps.log(`[${sign[c.state]}] ${c.text}`);
	return checks.filter((c) => c.state === 'fail').length;
}

/**
 * @param {Deps} deps
 * @param {Kept} kept
 * @param {ReturnType<typeof cloudflare>} cf
 */
async function restore(deps, kept, cf) {
	for (const r of kept.records) {
		await cf('POST', `/zones/${kept.zone}/dns_records`, { type: r.type, name: r.name, content: r.content, ttl: r.ttl, proxied: r.proxied, ...(r.comment ? { comment: r.comment } : {}) });
		deps.log(`Created again: ${r.type} ${r.name} → ${r.content}`);
	}
}

/**
 * @param {Deps} deps
 * @param {{ apply: boolean }} options
 * @returns {Promise<number>} The exit code.
 */
export async function cutover(deps, { apply }) {
	deps.log(`Cutover of ${DOMAIN} to the Worker ${WORKER}, version ${deps.version}${apply ? '' : ' (dry run)'}\n`);
	const { checks, state } = await check(deps);
	const failed = report(deps, checks);
	if (failed) {
		deps.log(`\n${failed} check${failed === 1 ? '' : 's'} failed; nothing was changed.`);
		return 1;
	}
	if (!state) throw new Error('The domain was not read');
	if (!apply) {
		deps.log(`\nDry run. Add APPLY=1 to cut over: ${DOMAIN} answers with an error for about half a minute while the Worker takes it.\nThe way back: make cutover-undo APPLY=1`);
		return 0;
	}

	deps.log('\n1. Building the live site');
	deps.run('node', ['scripts/build.js'], true);

	deps.log('2. master ← dev');
	deps.run('git', ['push', 'origin', 'refs/remotes/origin/dev:refs/heads/master'], true);

	const { cf, zone, account, records } = state;
	if (records.length) {
		// Kept before anything is deleted; an earlier copy is never written over
		// by an empty one (a second run after the records are gone).
		/** @type {Kept} */
		const kept = { at: new Date().toISOString(), zone, account, records };
		mkdirSync(dirname(deps.stateFile), { recursive: true });
		writeFileSync(deps.stateFile, `${JSON.stringify(kept, null, '\t')}\n`, { mode: 0o600 });
		deps.log(`3. DNS records kept in ${deps.stateFile}; deleting ${records.length}`);
		for (const r of records) await cf('DELETE', `/zones/${zone}/dns_records/${r.id}`);
	} else {
		deps.log('3. No DNS record to delete');
	}

	deps.log(`4. Deploying ${WORKER}`);
	try {
		deps.run('npx', ['wrangler', 'deploy', '--env', 'live'], true);
	} catch (err) {
		deps.log(`\nThe deploy failed: ${firstLine(message(err))}`);
		if (records.length) {
			deps.log('Putting the DNS records back:');
			await restore(deps, { at: '', zone, account, records }, cf);
			deps.log(`${DOMAIN} is on the earlier site again. master was moved to dev and stays there; nothing deploys from it while LIVE_ENABLED is not "true".`);
		}
		return 1;
	}

	deps.log(`5. Waiting for https://${DOMAIN}/api/health`);
	const until = Date.now() + (deps.waitMs ?? 300_000);
	let last = 'no answer yet';
	for (;;) {
		try {
			const h = await health(deps, DOMAIN);
			if (h.ok && h.version === deps.version) {
				deps.log(`   version ${h.version}, dictionary ${h.dictionary?.database} built ${h.dictionary?.built}`);
				break;
			}
			last = h.ok ? `version ${h.version}` : `not well: ${h.error}`;
		} catch (err) {
			last = firstLine(message(err));
		}
		if (Date.now() >= until) {
			deps.log(`\n${DOMAIN} did not answer as version ${deps.version} in time (last: ${last}).\nThe Worker is deployed and the domain is on it; a certificate or DNS may need a few more minutes.\nLook: https://${DOMAIN}/api/health   Logs: make logs-live   The way back: make cutover-undo APPLY=1\nLIVE_ENABLED was not changed; run make cutover APPLY=1 again once the site answers.`);
			return 1;
		}
		await deps.sleep(5000);
	}

	deps.log('6. LIVE_ENABLED = true');
	deps.run('gh', ['variable', 'set', 'LIVE_ENABLED', '--body', 'true']);

	deps.log(`\nDone: ${DOMAIN} is served by ${WORKER}.\nNext: sign in once on ${DOMAIN}; keep the earlier site running for a few weeks; give https://${DOMAIN}/sitemap.xml to Google Search Console.\nThe way back: make cutover-undo APPLY=1`);
	return 0;
}

/**
 * @param {Deps} deps
 * @param {{ apply: boolean }} options
 * @returns {Promise<number>}
 */
export async function undo(deps, { apply }) {
	deps.log(`Undo of the cutover: ${DOMAIN} back to the earlier site${apply ? '' : ' (dry run)'}\n`);
	if (!existsSync(deps.stateFile)) throw new Error(`No kept DNS records at ${deps.stateFile}: the cutover was not made from this machine. Take the domain off ${WORKER} in the dashboard (Workers → ${WORKER} → Settings → Domains & Routes) and create the record by hand.`);
	const kept = /** @type {Kept} */ (JSON.parse(readFileSync(deps.stateFile, 'utf8')));
	if (!kept.records?.length) throw new Error(`${deps.stateFile} holds no records`);
	const { cf, zone, account, records, attached } = await domainState(deps);
	if (zone !== kept.zone) throw new Error(`The kept records are of another zone (${kept.zone}) than ${DOMAIN} now (${zone})`);

	deps.log(`Kept ${kept.at}: ${kept.records.map((r) => `${r.type} ${r.content}${r.proxied ? ' (proxied)' : ''}`).join(', ')}`);
	deps.log(attached.length ? `${DOMAIN} is on the Worker ${attached.map((d) => d.service).join(', ')}` : `${DOMAIN} is on no Worker`);
	if (records.length) deps.log(`${DOMAIN} has address records now: ${records.map((r) => `${r.type} ${r.content}`).join(', ')}`);
	if (!attached.length && records.length) {
		deps.log('\nNothing to undo: the domain already answers from its own records.');
		return 0;
	}
	const foreign = attached.find((d) => d.service !== WORKER);
	if (foreign) throw new Error(`${DOMAIN} is on the Worker ${foreign.service}, not ${WORKER}; this command only takes it off ${WORKER}`);
	if (!apply) {
		deps.log(`\nDry run. Add APPLY=1 to: set LIVE_ENABLED to false, take ${DOMAIN} off ${WORKER}, create the kept records again.\nThe earlier site must still be running. Readers who opened the new site keep its service worker until the earlier site replaces it.`);
		return 0;
	}

	deps.log('\n1. LIVE_ENABLED = false');
	deps.run('gh', ['variable', 'set', 'LIVE_ENABLED', '--body', 'false']);
	deps.log(`2. Taking ${DOMAIN} off ${WORKER}`);
	for (const d of attached) await cf('DELETE', `/accounts/${account}/workers/domains/${d.id}`);
	deps.log('3. Creating the kept records again');
	await restore(deps, kept, cf);
	deps.log(`\nDone: ${DOMAIN} points at the earlier site again. The Worker ${WORKER} stays deployed, without a domain; make cutover APPLY=1 puts it back.`);
	return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const args = process.argv.slice(2);
	const unknown = args.filter((a) => a !== 'undo' && a !== '--apply');
	if (unknown.length) {
		console.error(`Unknown: ${unknown.join(' ')}\nUsage: node scripts/cutover.js [undo] [--apply]`);
		process.exit(2);
	}
	/** @type {Deps} */
	const deps = {
		run,
		fetch,
		env: process.env,
		log: (line) => console.log(line),
		stateFile: cutoverFile(),
		version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
		sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
	};
	const apply = args.includes('--apply');
	(args.includes('undo') ? undo(deps, { apply }) : cutover(deps, { apply })).then(
		(code) => process.exit(code),
		(err) => {
			console.error(message(err));
			process.exit(1);
		},
	);
}
