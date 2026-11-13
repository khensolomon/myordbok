import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { MIGRATION, SAMPLE, d1, sqlite } from './helpers/d1.js';

const SITE = 'https://myordbok.test';
const hash = (t) => createHash('sha256').update(t).digest('hex');

function env() {
	const app = sqlite(MIGRATION);
	app.exec(`INSERT INTO users (id, name, email, role) VALUES (1, 'Mya', 'm@example.com', 'member'), (2, 'Ed', 'e@example.com', 'editor'), (3, 'Other', 'o@example.com', 'member');
		INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ('${hash('member')}', 1, unixepoch() + 3600), ('${hash('editor')}', 2, unixepoch() + 3600), ('${hash('other')}', 3, unixepoch() + 3600);`);
	const dict = sqlite(SAMPLE);
	return { raw: app, rawDict: dict, APP: d1(app), BETA: d1(sqlite()), LIVE: d1(dict), ASSETS: { fetch: () => new Response('') }, DICT_DB: 'live' };
}

async function call(e, path, { who, body, method } = {}) {
	const headers = { origin: SITE, 'content-type': 'application/json' };
	if (who) headers.cookie = `__Host-mo_session=${who}`;
	const init = body === undefined && method !== 'POST' ? { headers } : { method: 'POST', headers, body: JSON.stringify(body ?? {}) };
	const res = await worker.fetch(new Request(`${SITE}${path}`, init), e);
	return { status: res.status, body: await res.json() };
}

async function suggest(e, who, body) {
	return (await call(e, '/api/edits', { who, body: { lang: 'en', word: 'love', ...body } })).body.edit;
}

test('workspace: a member sees only their own; an editor sees the queue with the sense as it is now', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const mine = await suggest(e, 'member', { action: 'edit', sense_id: first.id, field: 'sense', value: 'ချစ်ခြင်း', note: 'shorter' });
	await suggest(e, 'other', { action: 'delete', sense_id: first.id });

	assert.equal((await call(e, '/api/workspace/edits')).status, 401);
	const own = (await call(e, '/api/workspace/edits?status=all', { who: 'member' })).body;
	assert.deepEqual(own.edits.map((x) => x.id), [mine.id], 'only their own, even without mine=1');
	assert.equal(own.edits[0].own, true);

	const queue = (await call(e, '/api/workspace/edits', { who: 'editor' })).body;
	assert.equal(queue.edits.length, 2);
	const item = queue.edits.find((x) => x.id === mine.id);
	assert.equal(item.author, 'Mya');
	assert.equal(item.current.sense, first.sense);
	assert.equal(item.current.type, first.type);

	assert.deepEqual((await call(e, '/api/workspace/summary', { who: 'editor' })).body, { role: 'editor', mine: {}, waiting: 2 });
	assert.deepEqual((await call(e, '/api/workspace/summary', { who: 'member' })).body, { role: 'member', mine: { pending: 1 }, waiting: null });
});

test('workspace: review once, by an editor; withdraw by the author while waiting', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const a = await suggest(e, 'member', { action: 'delete', sense_id: first.id });
	const b = await suggest(e, 'member', { action: 'add', wrte: 0, sense: 'ချစ်ခင်' });
	const c = await suggest(e, 'member', { action: 'add', wrte: 0, sense: 'နှစ်သက်' });

	assert.equal((await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'member', body: { decision: 'approve' } })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'maybe' } })).status, 400);
	const ok = await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'reject', note: 'still\\nused' } });
	assert.deepEqual(ok.body.edit, { id: a.id, status: 'rejected' });
	const row = e.raw.prepare('SELECT reviewed_by, review_note FROM dict_edits WHERE id = ?').get(a.id);
	assert.deepEqual({ ...row }, { reviewed_by: 2, review_note: 'still\\nused' });
	const again = await call(e, `/api/workspace/edits/${a.id}/review`, { who: 'editor', body: { decision: 'approve' } });
	assert.equal(again.status, 409);
	assert.match(again.body.error.message, /already rejected/);
	assert.equal((await call(e, '/api/workspace/edits/9999/review', { who: 'editor', body: { decision: 'approve' } })).status, 404);

	assert.equal((await call(e, `/api/workspace/edits/${b.id}/withdraw`, { who: 'other', method: 'POST' })).status, 403);
	assert.equal((await call(e, `/api/workspace/edits/${b.id}/withdraw`, { who: 'member', method: 'POST' })).status, 200);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM dict_edits WHERE id = ?').get(b.id).n, 0);
	await call(e, `/api/workspace/edits/${c.id}/review`, { who: 'editor', body: { decision: 'approve' } });
	assert.equal((await call(e, `/api/workspace/edits/${c.id}/withdraw`, { who: 'member', method: 'POST' })).status, 409, 'approved already');

	const approved = (await call(e, '/api/workspace/edits?status=approved', { who: 'editor' })).body.edits;
	assert.deepEqual(approved.map((x) => [x.id, x.reviewer, x.data.sense]), [[c.id, 'Ed', 'နှစ်သက်']]);
	assert.equal((await call(e, '/api/workspace/edits?status=nonsense', { who: 'editor' })).status, 400);
});

test('workspace: pages of 30, newest first', async () => {
	const e = env();
	e.raw.exec("INSERT INTO dict_edits (user_id, dict, action, word, data) SELECT 1, 'emd', 'add', 'love', '{\"wrte\":0,\"sense\":\"x\"}' FROM (WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 35) SELECT i FROM n)");
	const one = (await call(e, '/api/workspace/edits', { who: 'editor' })).body;
	assert.equal(one.edits.length, 30);
	assert.equal(one.more, true);
	const two = (await call(e, `/api/workspace/edits?before=${one.edits.at(-1).id}`, { who: 'editor' })).body;
	assert.equal(two.edits.length, 5);
	assert.equal(two.more, false);
	assert.ok(one.edits[0].id > one.edits[1].id);
});

/** A ctx that keeps the waitUntil promises so a test can wait for them. */
function context() {
	const waiting = [];
	return { ctx: { waitUntil: (p) => waiting.push(p), passThroughOnException() {} }, settle: () => Promise.all(waiting) };
}

async function search(e, q) {
	const { ctx, settle } = context();
	const res = await worker.fetch(new Request(`${SITE}/api/read?q=${encodeURIComponent(q)}`), e, ctx);
	await settle();
	return res.status;
}

test('searches are counted per word and day, found or not, with nothing about who searched', async () => {
	const e = env();
	assert.equal(await search(e, 'love'), 200);
	await search(e, 'Love');
	await search(e, 'qwxzk');
	await search(e, 'x'.repeat(61));
	const counted = e.raw.prepare('SELECT lang, term, found, hits FROM search_counts ORDER BY term').all().map((r) => ({ ...r }));
	assert.deepEqual(counted, [
		{ lang: 'en', term: 'love', found: 1, hits: 2 },
		{ lang: 'en', term: 'qwxzk', found: 0, hits: 1 },
	]);
	assert.deepEqual(
		e.raw.prepare("SELECT name FROM pragma_table_info('search_counts')").all().map((r) => r.name),
		['day', 'lang', 'term', 'found', 'hits'],
	);
});

test('overview: a member sees their own figures; an editor sees the board', async () => {
	const e = env();
	await search(e, 'love');
	await search(e, 'qwxzk');
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', sense_id: first.id, value: -1 } });
	await suggest(e, 'member', { action: 'delete', sense_id: first.id });

	assert.equal((await call(e, '/api/workspace/overview')).status, 401);
	e.raw.prepare("INSERT INTO build_stats (build, stats, created_at) VALUES ('older', ?1, 1), ('sample', ?2, 2)").run(JSON.stringify({ build: 'older', en: { senses: 1 } }), JSON.stringify({ build: 'sample', en: { senses: 2 } }));
	const member = (await call(e, '/api/workspace/overview', { who: 'member' })).body;
	// A member sees their own figures, and as a member the dictionary's and the community's.
	assert.deepEqual(member.own, { suggestions: { pending: 1 }, ratings: 1, rated: { entries: 0, senses: 1 } });
	assert.deepEqual([member.dictionary.build, member.dictionary.stats.en.senses, member.dictionary.previous.build], ['sample', 2, 'older']);
	assert.equal(member.searches.today, 2);
	assert.deepEqual(member.community, { members: 3, accepted: 0, merged: 0, ratings: 1 });
	assert.equal(member.suggestions, undefined, 'the review queue is for editors');

	const board = (await call(e, '/api/workspace/overview', { who: 'editor' })).body;
	assert.equal(board.searches.today, 2);
	assert.deepEqual(board.searches.top, [{ lang: 'en', term: 'love', hits: 1 }]);
	assert.deepEqual(board.searches.wanted, [{ lang: 'en', term: 'qwxzk', hits: 1 }]);
	assert.equal(board.searches.daily.length, 1);
	assert.equal(board.searches.daily[0].missed, 1);
	assert.deepEqual(board.suggestions, { pending: 1 });
	assert.deepEqual(board.members, { roles: { member: 2, editor: 1 }, joinedWeek: 3 });
	assert.equal(board.disliked.length, 1);
	assert.equal(board.disliked[0].sense, first.sense);
	assert.equal(board.disliked[0].down, 1);
});

test('deleting an account: confirmed by email; reviewed work stays as a former member', async () => {
	const e = env();
	const [first] = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	const waiting = await suggest(e, 'member', { action: 'delete', sense_id: first.id });
	const reviewed = await suggest(e, 'member', { action: 'add', wrte: 0, sense: 'ချစ်ခင်' });
	await call(e, `/api/workspace/edits/${reviewed.id}/review`, { who: 'editor', body: { decision: 'approve' } });
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', sense_id: first.id, value: 1 } });

	assert.equal((await call(e, '/api/workspace/account/delete', { who: 'member', body: { confirm: 'wrong@example.com' } })).status, 400);
	const gone = await worker.fetch(
		new Request(`${SITE}/api/workspace/account/delete`, {
			method: 'POST',
			headers: { origin: SITE, 'content-type': 'application/json', cookie: '__Host-mo_session=member' },
			body: JSON.stringify({ confirm: 'M@Example.com' }),
		}),
		e,
	);
	assert.equal(gone.status, 200);
	assert.match(gone.headers.get('set-cookie') ?? '', /__Host-mo_session=;/);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM users WHERE id = 1').get().n, 0);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM sense_reactions').get().n, 0);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM sessions WHERE user_id = 1').get().n, 0);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM dict_edits WHERE id = ?').get(waiting.id).n, 0);
	assert.equal(e.raw.prepare('SELECT user_id FROM dict_edits WHERE id = ?').get(reviewed.id).user_id, 0);
	assert.equal((await call(e, '/api/workspace/summary', { who: 'member' })).status, 401);

	e.raw.exec("UPDATE users SET role = 'owner' WHERE id = 2");
	assert.equal((await call(e, '/api/workspace/account/delete', { who: 'editor', body: { confirm: 'e@example.com' } })).status, 409, 'the only owner stays');
});

test('contact form: anyone may send; the hidden field drops a message; admins read the Inbox', async () => {
	const e = env();
	assert.equal((await call(e, '/api/messages', { body: { kind: 'question', body: '  Where are the fonts? ', reply_to: 'reader@example.org', page: '/about', lang: 'my' } })).status, 200);
	assert.equal((await call(e, '/api/messages', { who: 'member', body: { kind: 'word', body: 'Please add selfie.' } })).status, 200);
	assert.equal((await call(e, '/api/messages', { body: { kind: 'feedback', body: 'buy now', website: 'http://spam.example' } })).status, 200);
	assert.equal((await call(e, '/api/messages', { body: { kind: 'other', body: 'x' } })).status, 400);
	assert.equal((await call(e, '/api/messages', { body: { kind: 'feedback', body: '   ' } })).status, 400);
	assert.equal((await call(e, '/api/messages', { body: { kind: 'feedback', body: 'x', reply_to: 'not an address' } })).status, 400);
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM messages').get().n, 2);

	assert.equal((await call(e, '/api/workspace/messages', { who: 'editor' })).status, 403);
	e.raw.exec("UPDATE users SET role = 'admin' WHERE id = 2");
	const box = (await call(e, '/api/workspace/messages', { who: 'editor' })).body;
	assert.equal(box.unread, 2);
	assert.deepEqual(
		box.messages.map((m) => [m.kind, m.body, m.reply_to, m.member, m.lang]),
		[
			['word', 'Please add selfie.', null, 'Mya', 'en'],
			['question', 'Where are the fonts?', 'reader@example.org', null, 'my'],
		],
	);
	assert.equal((await call(e, `/api/workspace/messages/${box.messages[0].id}`, { who: 'editor', body: { status: 'done' } })).status, 200);
	assert.equal((await call(e, '/api/workspace/overview', { who: 'editor' })).body.unread, 1);
	assert.equal((await call(e, '/api/workspace/messages?status=done', { who: 'editor' })).body.messages.length, 1);

	// Read, replied, a note; the counts follow.
	const other = box.messages[1].id;
	assert.equal((await call(e, `/api/workspace/messages/${other}`, { who: 'editor', body: { status: 'read' } })).body.status, 'read');
	const noted = (await call(e, `/api/workspace/messages/${other}`, { who: 'editor', body: { status: 'replied', note: '  Answered by mail on Tuesday.  ' } })).body;
	assert.deepEqual([noted.status, noted.note], ['replied', 'Answered by mail on Tuesday.']);
	assert.equal((await call(e, `/api/workspace/messages/${other}`, { who: 'editor', body: { note: null } })).body.note, null);
	assert.equal((await call(e, `/api/workspace/messages/${other}`, { who: 'editor', body: { status: 'archived' } })).status, 400);
	const replied = (await call(e, '/api/workspace/messages?status=replied', { who: 'editor' })).body;
	assert.deepEqual(replied.counts, { new: 0, read: 0, replied: 1, done: 1 });
	assert.equal(replied.messages[0].handled_by, 'Ed');
	assert.equal((await call(e, '/api/workspace/messages/999', { who: 'editor', body: { status: 'done' } })).status, 404);

	// A deleted account takes its messages with it.
	await call(e, '/api/workspace/account/delete', { who: 'member', body: { confirm: 'm@example.com' } });
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM messages WHERE user_id = 1').get().n, 0);
});

test('ratings: a member sees their own, a changed meaning says so; editors see the site’s', async () => {
	const e = env();
	const senses = (await call(e, '/api/senses?lang=en&word=love', { who: 'member' })).body.senses;
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: 1 } });
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', sense_id: senses[0].id, value: -1 } });
	await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', sense_id: senses[1].id, value: 1 } });
	e.raw.prepare("UPDATE sense_reactions SET text_hash = 'old' WHERE sense_id = ?").run(senses[1].id);

	const mine = (await call(e, '/api/workspace/ratings', { who: 'member' })).body;
	assert.deepEqual(mine.counts, { senses: 2, entries: 1, up: 2, down: 1 });
	const byId = new Map(mine.items.map((r) => [r.sense_id, r]));
	assert.deepEqual([byId.get(senses[0].id).state, byId.get(senses[0].id).value, byId.get(senses[0].id).word], ['current', -1, 'love']);
	assert.equal(byId.get(senses[1].id).state, 'changed');
	assert.deepEqual((await call(e, '/api/workspace/ratings?kind=entries', { who: 'member' })).body.items.map((r) => [r.word, r.value]), [['love', 1]]);
	assert.deepEqual((await call(e, '/api/workspace/ratings?value=down', { who: 'member' })).body.items.map((r) => r.sense_id), [senses[0].id]);
	assert.equal((await call(e, '/api/workspace/ratings?q=lo', { who: 'member' })).body.items.length, 2, 'a word that starts with the search');
	assert.equal((await call(e, '/api/workspace/ratings?q=xyz', { who: 'member' })).body.items.length, 0);
	assert.equal((await call(e, '/api/workspace/ratings?kind=words', { who: 'member' })).status, 400);

	assert.equal((await call(e, '/api/workspace/ratings?scope=site', { who: 'member' })).status, 403);
	const site = (await call(e, '/api/workspace/ratings?scope=site', { who: 'editor' })).body;
	assert.deepEqual(site.items.map((s) => [s.sense_id, s.down]), [[senses[0].id, 1]], 'not helpful most, by default');
	assert.deepEqual((await call(e, '/api/workspace/ratings?scope=site&kind=entries&order=up', { who: 'editor' })).body.items.map((r) => [r.word, r.up, r.down]), [['love', 1, 0]]);
	assert.equal((await call(e, '/api/workspace/ratings?scope=site&order=up', { who: 'editor' })).body.items.length, 0, 'the changed meaning’s rating no longer counts');
});

test('members: an owner gives any level, an admin only member and editor; the site keeps an owner', async () => {
	const e = env();
	// Mya (1) member, Ed (2) owner, Other (3) member; Ed makes Other an admin.
	e.raw.exec("UPDATE users SET role = 'owner' WHERE id = 2");
	assert.equal((await call(e, '/api/workspace/members', { who: 'member' })).status, 403);
	const list = (await call(e, '/api/workspace/members?q=MYA', { who: 'editor' })).body;
	assert.deepEqual(list.members.map((m) => [m.name, m.role, m.may.roles.length]), [['Mya', 'member', 4]]);

	const made = (await call(e, '/api/workspace/members/3', { who: 'editor', body: { role: 'admin' } })).body.member;
	assert.equal(made.role, 'admin');
	assert.deepEqual(made.history.map((h) => [h.role, h.by]), [['admin', 'Ed']]);

	// The admin (Other) may make Mya an editor, not an admin, and cannot touch the owner or themselves.
	assert.equal((await call(e, '/api/workspace/members/1', { who: 'other', body: { role: 'editor' } })).body.member.role, 'editor');
	assert.equal((await call(e, '/api/workspace/members/1', { who: 'other', body: { role: 'admin' } })).status, 403);
	assert.equal((await call(e, '/api/workspace/members/2', { who: 'other', body: { role: 'member' } })).status, 403);
	assert.equal((await call(e, '/api/workspace/members/3', { who: 'other', body: { role: 'owner' } })).status, 403);
	assert.deepEqual((await call(e, '/api/workspace/members/2', { who: 'other' })).body.member.may, { roles: [], suspend: false });

	// Suspending signs the member out everywhere.
	assert.equal((await call(e, '/api/workspace/members/1', { who: 'other', body: { status: 'suspended' } })).body.member.status, 'suspended');
	assert.equal((await call(e, '/api/workspace/summary', { who: 'member' })).status, 401);

	// The last owner stays: Ed cannot hand it away by being demoted, nor demote himself.
	assert.equal((await call(e, '/api/workspace/members/2', { who: 'editor', body: { role: 'admin' } })).status, 403);
	assert.equal((await call(e, '/api/workspace/members/3', { who: 'editor', body: { role: 'owner' } })).body.member.role, 'owner');
	assert.equal((await call(e, '/api/workspace/members/2', { who: 'other', body: { role: 'admin' } })).body.member.role, 'admin', 'with two owners, one may step another down');
	assert.equal((await call(e, '/api/workspace/members/3', { who: 'editor', body: { role: 'member' } })).status, 403, 'an admin cannot touch an owner');
});

test('popular: found words of the last week searched at least three times, nothing rarer', async () => {
	const e = env();
	const today = new Date().toISOString().slice(0, 10);
	const old = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
	e.raw.exec(`INSERT INTO search_counts (day, lang, term, found, hits) VALUES
		('${today}', 'en', 'love', 1, 5), ('${today}', 'en', 'rare', 1, 2), ('${today}', 'en', 'qwxzk', 0, 9),
		('${old}', 'en', 'stale', 1, 50), ('${today}', 'my', 'ချစ်', 1, 3)`);
	const res = await call(e, '/api/popular');
	assert.equal(res.status, 200);
	assert.deepEqual(res.body.words, [{ lang: 'en', term: 'love' }, { lang: 'my', term: 'ချစ်' }]);
});

test('notices: admins schedule them; each visitor gets those in effect for them', async () => {
	const e = env();
	const now = Math.floor(Date.now() / 1000);
	const notice = { kind: 'maintenance', text_en: 'Sign-in pauses for ten minutes', starts_at: now - 60, ends_at: now + 3600 };
	assert.equal((await call(e, '/api/workspace/notices', { who: 'editor', body: notice })).status, 403, 'editors do not manage notices');
	e.raw.exec("UPDATE users SET role = 'admin' WHERE id = 2");
	const made = (await call(e, '/api/workspace/notices', { who: 'editor', body: notice })).body;
	assert.ok(made.id);
	await call(e, '/api/workspace/notices', { who: 'editor', body: { ...notice, kind: 'info', text_en: 'For editors', audience: 'editor' } });
	await call(e, '/api/workspace/notices', { who: 'editor', body: { ...notice, kind: 'celebration', text_en: 'Later', starts_at: now + 7200, ends_at: now + 9000 } });
	assert.equal((await call(e, '/api/workspace/notices', { who: 'editor', body: { ...notice, ends_at: notice.starts_at } })).status, 400);

	const open = (await call(e, '/api/notices')).body.notices;
	assert.deepEqual(open.map((n) => n.text_en), ['Sign-in pauses for ten minutes'], 'visitors: in effect and for everyone');
	assert.deepEqual((await call(e, '/api/notices?for=me', { who: 'member' })).body.notices.map((n) => n.text_en), ['Sign-in pauses for ten minutes']);
	assert.deepEqual((await call(e, '/api/notices?for=me', { who: 'editor' })).body.notices.map((n) => n.text_en).sort(), ['For editors', 'Sign-in pauses for ten minutes']);

	const all = (await call(e, '/api/workspace/notices', { who: 'editor' })).body.notices;
	assert.equal(all.length, 3);
	assert.equal(all.find((n) => n.id === made.id).updated_by, 'Ed');

	assert.equal((await call(e, `/api/workspace/notices/${made.id}`, { who: 'editor', body: { ...notice, text_en: 'Changed' } })).status, 200);
	assert.equal((await call(e, `/api/workspace/notices/${made.id}/delete`, { who: 'editor', method: 'POST' })).status, 200);
	assert.equal((await call(e, `/api/workspace/notices/${made.id}/delete`, { who: 'editor', method: 'POST' })).status, 404);
	assert.deepEqual((await call(e, '/api/notices')).body.notices, []);
});

test('notices: an announced maintenance shows before its window, with the window', async () => {
	const e = env();
	e.raw.exec("UPDATE users SET role = 'admin' WHERE id = 2");
	const now = Math.floor(Date.now() / 1000);
	const body = { kind: 'maintenance', text_en: 'Sign-in pauses', announce_at: now - 60, starts_at: now + 86400, ends_at: now + 90000 };
	assert.equal((await call(e, '/api/workspace/notices', { who: 'editor', body })).status, 200);
	const [n] = (await call(e, '/api/notices')).body.notices;
	assert.equal(n.starts, body.starts_at);
	assert.equal(n.ends, body.ends_at);
});

test('plain http goes to https before anything else, sign-in included; localhost stays on http', async () => {
	const e = env();
	const res = await worker.fetch(new Request('http://beta.myordbok.test/api/auth/google/start?return=/workspace'), e);
	assert.equal(res.status, 308);
	assert.equal(res.headers.get('location'), 'https://beta.myordbok.test/api/auth/google/start?return=/workspace');
	const local = await worker.fetch(new Request('http://localhost:8787/api/health'), e);
	assert.notEqual(local.status, 308);
});

test('stats: the figures of the build the site reads, for anyone; null before any are kept', async () => {
	const e = env();
	assert.deepEqual((await call(e, '/api/stats')).body, { stats: null });
	const side = { headwords: 19, senses: 24, examples: 13, forms: 12, synsets: 3, pronunciations: 5, awaiting: 1 };
	e.raw.prepare("INSERT INTO build_stats (build, stats, created_at) VALUES ('sample', ?1, 2)").run(JSON.stringify({ build: 'sample', en: side, my: side }));
	const { stats } = (await call(e, '/api/stats')).body;
	assert.deepEqual(stats, { build: 'sample', en: { headwords: 19, senses: 24, examples: 13, forms: 12, synsets: 3 }, my: { headwords: 19, senses: 24, examples: 13, pronunciations: 5 } });
});

test('usage: offline check-ins and pack downloads are counted per day, without words or devices; editors see them', async () => {
	const e = env();
	assert.equal((await call(e, '/api/usage', { body: { packs: ['senses-en', 'related-en'], lookups: 7 } })).status, 200);
	assert.equal((await call(e, '/api/usage', { body: { packs: ['senses-en'], lookups: 0 } })).status, 200);
	assert.equal((await call(e, '/api/usage', { body: { packs: [], lookups: 2 } })).status, 200, 'a device that removed its packs still reports its tally');
	assert.equal((await call(e, '/api/usage', { body: { packs: ['words-en'] } })).status, 400, 'word lists are not definitions');
	assert.equal((await call(e, '/api/usage', { body: { packs: ['senses-en', 'senses-en'] } })).status, 400);
	assert.equal((await call(e, '/api/usage', { body: { lookups: 5001 } })).status, 400);
	assert.equal((await call(e, '/api/usage', { body: { lookups: 1.5 } })).status, 400);
	const counts = Object.fromEntries(e.raw.prepare('SELECT name, n FROM usage_counts').all().map((r) => [r.name, r.n]));
	assert.deepEqual(counts, { 'offline.devices': 2, 'offline.devices.senses-en': 2, 'offline.devices.related-en': 1, 'offline.lookups': 9 });

	const usage = (await call(e, '/api/workspace/overview', { who: 'editor' })).body.usage;
	assert.equal(usage.find((u) => u.name === 'offline.lookups').n, 9);
	assert.equal((await call(e, '/api/workspace/overview', { who: 'member' })).body.usage, undefined, 'members do not see it');
});

test('searches: every word over a period, not found first, paged; one word day by day; CSV; for editors', async () => {
	const e = env();
	const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
	const add = e.raw.prepare('INSERT INTO search_counts (day, lang, term, found, hits) VALUES (?1, ?2, ?3, ?4, ?5)');
	add.run(day(0), 'en', 'lofe', 0, 3);
	add.run(day(1), 'en', 'lofe', 0, 2);
	add.run(day(0), 'en', 'love', 1, 9);
	add.run(day(40), 'en', 'olden', 0, 4);
	add.run(day(0), 'en', '=sum', 0, 1);
	for (let i = 0; i < 55; i++) add.run(day(2), 'my', `စကား${i}`, 0, 1);

	assert.equal((await call(e, '/api/workspace/searches', { who: 'member' })).status, 403);
	assert.equal((await call(e, '/api/workspace/searches?days=12', { who: 'editor' })).status, 400);

	const first = (await call(e, '/api/workspace/searches', { who: 'editor' })).body;
	assert.equal(first.words[0].term, 'lofe');
	assert.deepEqual([first.words[0].hits, first.words[0].days, first.words[0].found], [5, 2, false]);
	assert.ok(!first.words.some((w) => w.term === 'love' || w.term === 'olden'), 'found words and words older than 30 days are left out');
	assert.equal(first.words.length, 50);
	assert.equal(first.more, true);
	assert.deepEqual(first.counts, { words: 58, missed: 57, found: 1, hits: 70 });
	const second = (await call(e, '/api/workspace/searches?offset=50', { who: 'editor' })).body;
	assert.equal(second.words.length, 7);
	assert.equal(second.more, false);

	assert.deepEqual((await call(e, '/api/workspace/searches?show=found&days=0', { who: 'editor' })).body.words.map((w) => w.term), ['love']);
	assert.deepEqual((await call(e, '/api/workspace/searches?days=0&lang=en&q=ol', { who: 'editor' })).body.words.map((w) => w.term), ['olden']);
	// A word never found that is a headword now (the sample has "love"; "Love" searched, kept lower case).
	add.run(day(3), 'en', 'love', 0, 1);
	const now = (await call(e, '/api/workspace/searches?show=all&q=love', { who: 'editor' })).body.words[0];
	assert.equal(now.found, true, 'found on a later day counts as found');

	const one = (await call(e, '/api/workspace/searches/word?lang=en&term=lofe', { who: 'editor' })).body;
	assert.deepEqual([one.hits, one.found, one.now, one.daily.length], [5, false, false, 2]);
	assert.equal((await call(e, '/api/workspace/searches/word?lang=en&term=never', { who: 'editor' })).status, 404);

	const res = await worker.fetch(new Request(`${SITE}/api/workspace/searches?lang=en&format=csv`, { headers: { origin: SITE, cookie: '__Host-mo_session=editor' } }), e);
	assert.match(res.headers.get('content-type'), /text\/csv/);
	const csv = (await res.text()).trim().split('\r\n');
	assert.equal(csv[0], 'language,word,searches,days,first,last,found,now_in_dictionary');
	assert.ok(csv.some((l) => l.startsWith("en,'=sum,1,")), 'a leading = is defused for spreadsheets');
});

test('searches: a word never found that has become a headword says so', async () => {
	const e = env();
	const today = new Date().toISOString().slice(0, 10);
	e.raw.prepare("INSERT INTO search_counts (day, lang, term, found, hits) VALUES (?1, 'en', 'love', 0, 2), (?1, 'en', 'lofe', 0, 1)").run(today);
	const words = (await call(e, '/api/workspace/searches', { who: 'editor' })).body.words;
	assert.deepEqual(words.map((w) => [w.term, w.now]), [['love', true], ['lofe', false]]);
});

test('statistics: an admin shows them to a member, read only; old search counts are deleted by admins', async () => {
	const e = env();
	e.raw.exec("UPDATE users SET role = 'admin' WHERE id = 2");
	const today = new Date().toISOString().slice(0, 10);
	const old = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
	e.raw.prepare("INSERT INTO search_counts (day, lang, term, found, hits) VALUES (?1, 'en', 'lofe', 0, 1), (?2, 'en', 'olden', 0, 1)").run(today, old);

	assert.equal((await call(e, '/api/workspace/searches', { who: 'member' })).status, 403);
	assert.equal((await call(e, '/api/workspace/overview', { who: 'member' })).body.insights, false);
	const changed = (await call(e, '/api/workspace/members/1', { who: 'editor', body: { insights: true } })).body.member;
	assert.equal(changed.insights, true);
	assert.equal((await call(e, '/api/workspace/members/1', { who: 'editor', body: { insights: 'yes' } })).status, 400);

	assert.equal((await call(e, '/api/workspace/searches', { who: 'member' })).status, 200);
	assert.equal((await call(e, '/api/workspace/ratings?scope=site', { who: 'member' })).status, 200);
	const overview = (await call(e, '/api/workspace/overview', { who: 'member' })).body;
	assert.deepEqual([overview.insights, Array.isArray(overview.usage), overview.suggestions, overview.members], [true, true, undefined, undefined], 'the statistics, not the review queue or the members');
	assert.equal((await call(e, '/api/workspace/edits', { who: 'member' })).body.edits.every((x) => x.own), true, 'still a member everywhere else');

	assert.equal((await call(e, '/api/workspace/searches/prune', { who: 'member', body: { days: 365 } })).status, 403);
	assert.equal((await call(e, '/api/workspace/searches/prune', { who: 'editor', body: { days: 10 } })).status, 400);
	const pruned = (await call(e, '/api/workspace/searches/prune', { who: 'editor', body: { days: 365 } })).body;
	assert.equal(pruned.deleted, 1);
	assert.deepEqual(e.raw.prepare('SELECT term FROM search_counts').all().map((r) => r.term), ['lofe']);
});

test('comments: members post plain text on an entry, delete their own; editors hide and show; admins close them', async () => {
	const e = env();
	assert.equal((await call(e, '/api/comments', { body: { lang: 'en', word: 'love', body: 'Hello' } })).status, 401);
	const posted = (await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: '  Also used for tennis:\r\n\r\n\r\n\r\nlove all.  ' } })).body.comment;
	assert.equal(posted.body, 'Also used for tennis:\n\nlove all.');
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'x' } })).status, 400);
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'xx', word: 'love', body: 'Fine text' } })).status, 400);
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'y'.repeat(1001) } })).status, 400);
	await call(e, '/api/comments', { who: 'other', body: { lang: 'en', word: 'love', body: 'Nice entry' } });

	const seen = (await call(e, '/api/comments?lang=en&word=love', { who: 'member' })).body;
	assert.deepEqual([seen.open, seen.signedIn, seen.comments.map((c) => [c.body.slice(0, 4), c.own])], [true, true, [['Nice', false], ['Also', true]]]);
	assert.equal((await call(e, '/api/comments?lang=en&word=love')).body.signedIn, false);

	// Moderation: editors only; hidden comments leave the entry.
	assert.equal((await call(e, '/api/workspace/comments', { who: 'member' })).status, 403);
	const queue = (await call(e, '/api/workspace/comments', { who: 'editor' })).body;
	assert.deepEqual(queue.counts, { visible: 2, hidden: 0, week: 2 });
	const other = queue.comments.find((c) => c.author === 'Other');
	assert.equal((await call(e, `/api/workspace/comments/${other.id}`, { who: 'editor', body: { status: 'hidden' } })).status, 200);
	assert.equal((await call(e, '/api/comments?lang=en&word=love')).body.comments.length, 1);
	assert.equal((await call(e, '/api/workspace/comments?show=hidden&q=nice', { who: 'editor' })).body.comments.length, 1);

	// Authors delete their own, nobody else's.
	assert.equal((await call(e, `/api/comments/${posted.id}/delete`, { who: 'other', method: 'POST' })).status, 404);
	assert.equal((await call(e, `/api/comments/${posted.id}/delete`, { who: 'member', method: 'POST' })).status, 200);

	// Too many in a few minutes, then closed by the setting.
	for (let i = 0; i < 5; i++) await call(e, '/api/comments', { who: 'member', body: { lang: 'my', word: 'ချစ်', body: `Comment ${i}` } });
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'my', word: 'ချစ်', body: 'One more' } })).status, 429);
	e.raw.prepare("INSERT INTO settings (key, value) VALUES ('comments.open', '\"off\"')").run();
	assert.equal((await call(e, '/api/comments', { who: 'other', body: { lang: 'en', word: 'love', body: 'Closed?' } })).status, 403);
	assert.equal((await call(e, '/api/comments?lang=en&word=love')).body.open, false);
});

test('searches: sorted by most searched, last searched, most days, or A to Z', async () => {
	const e = env();
	const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
	const add = e.raw.prepare("INSERT INTO search_counts (day, lang, term, found, hits) VALUES (?1, 'en', ?2, 0, ?3)");
	add.run(day(5), 'bbb', 9);
	add.run(day(0), 'ccc', 1);
	add.run(day(3), 'aaa', 2);
	add.run(day(4), 'aaa', 2);
	add.run(day(6), 'aaa', 1);
	const order = async (o) => (await call(e, `/api/workspace/searches?order=${o}`, { who: 'editor' })).body.words.map((w) => w.term);
	assert.deepEqual(await order('hits'), ['bbb', 'aaa', 'ccc']);
	assert.deepEqual(await order('recent'), ['ccc', 'aaa', 'bbb']);
	assert.deepEqual(await order('days'), ['aaa', 'bbb', 'ccc']);
	assert.deepEqual(await order('az'), ['aaa', 'bbb', 'ccc']);
	assert.equal((await call(e, '/api/workspace/searches?order=random', { who: 'editor' })).status, 400);
});

test('settings: switches pause parts of the site at once, and numbers set the limits', async () => {
	const e = env();
	e.raw.exec("UPDATE users SET role = 'admin' WHERE id = 2; UPDATE users SET created_at = unixepoch() - 864000");
	const set = async (key, value) => assert.equal((await call(e, '/api/workspace/settings', { who: 'editor', body: { key, value } })).status, 200, key);
	const site = async () => (await call(e, '/api/site')).body;
	const { support_lines, ...switches } = await site();
	assert.deepEqual(switches, { readonly: false, comments: 'on', contact: true, ratings: true, suggestions: true, support_ask: true });
	assert.ok(support_lines.length >= 1 && support_lines.every((l) => l.en));

	// Read-only: writes wait, the setting itself can be changed back.
	await set('site.readonly', 'on');
	assert.equal((await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: 1 } })).status, 403);
	await set('site.readonly', 'off');
	assert.equal((await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: 1 } })).status, 200);

	await set('ratings.open', 'off');
	assert.equal((await call(e, '/api/reactions', { who: 'member', body: { lang: 'en', word: 'love', value: -1 } })).status, 403);
	assert.equal((await call(e, '/api/reactions?lang=en&word=love')).body.open, false);
	await set('suggestions.open', 'off');
	assert.equal((await call(e, '/api/edits', { who: 'member', body: { lang: 'en', word: 'love', action: 'add', wrte: 0, sense: 'ချစ်' } })).status, 403);
	await set('contact.open', 'off');
	assert.equal((await call(e, '/api/messages', { body: { kind: 'feedback', body: 'Hello there', lang: 'en' } })).status, 403);

	// Comments: a day's limit, no text twice, a smaller one for new accounts, hidden altogether.
	await set('comments.daily', 2);
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'First one' } })).status, 200);
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'First one' } })).status, 409, 'the same text twice');
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'Second one' } })).status, 200);
	assert.equal((await call(e, '/api/comments', { who: 'member', body: { lang: 'en', word: 'love', body: 'Third one' } })).status, 429);
	e.raw.exec('UPDATE users SET created_at = unixepoch() WHERE id = 3');
	await set('comments.newcomer', 0);
	assert.equal((await call(e, '/api/comments', { who: 'other', body: { lang: 'en', word: 'love', body: 'New here' } })).status, 429);
	await set('comments.open', 'hidden');
	assert.deepEqual((await call(e, '/api/comments?lang=en&word=love')).body.comments, []);
	assert.equal((await site()).comments, 'hidden');
	assert.equal((await call(e, '/api/workspace/settings', { who: 'editor', body: { key: 'comments.daily', value: 0 } })).status, 400);
	assert.equal((await call(e, '/api/workspace/settings', { who: 'editor', body: { key: 'searches.keep_days', value: 10 } })).status, 400, 'at least 30 days, or 0');
	await set('searches.keep_days', 0);
});

test('settings: new accounts paused, searches not counted, the home list off or stricter', async () => {
	const e = env();
	const { memberFor } = await import('../worker/routes/auth.js');
	const { countSearch } = await import('../worker/lib/counts.js');
	const { popular } = await import('../worker/routes/popular.js');
	const put = (key, value) => e.raw.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)').run(key, JSON.stringify(value));

	put('signup.open', 'off');
	await assert.rejects(memberFor(e, 'github', { id: 'new-1', name: 'New', email: 'new@example.com', avatar: null }, null), /new accounts are paused/);
	const known = await memberFor(e, 'google', { id: 'g-mya', name: 'Mya', email: 'm@example.com', avatar: null }, null);
	assert.ok(known, 'a member with an account still signs in');

	const read = (q) => new Response(JSON.stringify({ q, kind: 'entry' }));
	put('searches.count', 'off');
	await countSearch(e, read('love'));
	assert.equal(e.raw.prepare('SELECT count(*) AS n FROM search_counts').get().n, 0);
	put('searches.count', 'on');
	for (let i = 0; i < 2; i++) await countSearch(e, read('love'));
	const words = async () => (await (await popular(e)).json()).words.map((w) => w.term);
	put('home.popular_min', 2);
	assert.deepEqual(await words(), ['love']);
	put('home.popular_min', 3);
	assert.deepEqual(await words(), []);
	put('home.popular_min', 1);
	put('home.popular', 'off');
	assert.deepEqual(await words(), []);
});

test('settings: every setting the Worker knows has a row on the Settings page', async () => {
	const { SETTINGS } = await import('../worker/lib/settings.js');
	const { readFileSync } = await import('node:fs');
	const page = readFileSync(new URL('../app/workspace/settings.js', import.meta.url), 'utf8');
	const missing = Object.keys(SETTINGS).filter((key) => !page.includes(`'${key}':`));
	assert.deepEqual(missing, [], 'add a row (or a where: link) in app/workspace/settings.js');
});
