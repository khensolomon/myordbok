// @ts-check
/**
 * Help the dictionary: questions to signed-in members who read Myanmar,
 * not scored, and the votes editors decide on (migration 0018).
 *
 *   GET  /api/help/next?word=          up to two questions for after a round on `word`
 *   POST /api/help/answer               { id, answer }  answer: a choice's index, 'many' or 'unsure' (spelling);
 *                                       'yes', 'no' or 'unsure' (meaning)
 *   GET  /api/workspace/votes?kind=spelling|meaning&state=ready|collecting|split|decided|set_aside&q=&offset=   editors
 *   POST /api/workspace/votes           { options: [2 to 4 spellings] }   editors: a spelling item of their own
 *   POST /api/workspace/votes/find      editors: spelling items from Myanmar words searched and not found
 *   POST /api/workspace/votes/{id}      { decision?: text, status: decided|set_aside|collecting }   editors
 *
 * Who reads Myanmar is found by check questions, not asked: a dictionary
 * word against spellings a slip away that are not words (shared/myanmar-variants.js),
 * asked like any spelling item. A member's votes count once they answered
 * CHECKS_NEEDED of them and at least FLUENT of those right; a member below
 * that after CHECKS_NEEDED is not asked any more.
 *
 * An item is ready for a decision at READY_VOTES counted votes with one
 * answer at READY_SHARE or more; split when it has the votes and no such
 * answer. A decision never changes the dictionary by itself: a spelling
 * decided labels each other spelling searched and not found as a
 * misspelling of it (search_marks, as Searches does); a meaning decided is
 * for an editor to change in the studio.
 */
import { AppError } from '../../shared/errors.js';
import { glossesOf } from '../../shared/markup.js';
import { variable, variants } from '../../shared/myanmar-variants.js';
import { plainItem } from '../../shared/quiz.js';
import { atLeast } from '../../shared/roles.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { liveLayer } from '../lib/layer.js';
import { meaningHash } from '../lib/meaning.js';
import { currentMember } from '../lib/session.js';
import { requireOn } from '../lib/settings.js';

/** @typedef {import('../lib/dict.js').DictEnv & { APP: D1Database }} Env */
/** @typedef {import('../lib/session.js').Member} Member */

export const CHECKS_NEEDED = 3;
export const FLUENT = 0.8;
export const READY_VOTES = 5;
export const READY_SHARE = 0.8;
/** Spelling items made from searches in one go, at most. */
const FIND_MAX = 50;
/** Searches a word needs, in all, to become a spelling item. */
const FIND_HITS = 2;
const PAGE = 50;
const NO_STORE = { headers: { 'cache-control': 'no-store' } };
const OFF = 'Help the dictionary is switched off for now.';
/** Meanings not yet reviewed: Draft, and Checked: awaiting native review. */
const UNREVIEWED = new Set(['Draft', 'Checked: awaiting native review']);

/** A member's votes count: enough checks, enough of them right. SQL over help_checks c. */
const FLUENT_SQL = `(c.total >= ${CHECKS_NEEDED} AND c.correct >= c.total * ${FLUENT})`;

/** @param {Request} request */
async function body(request) {
	const data = /** @type {Record<string, unknown> | null} */ (await request.json().catch(() => null));
	if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('bad_request', 'The request body must be a JSON object');
	return data;
}

/**
 * @template T
 * @param {T[]} list
 */
function shuffled(list) {
	const out = [...list];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {string[]} parts
 */
export async function help(request, env, parts) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to help the dictionary.');
	await requireOn(env, 'help.open', OFF);
	if (request.method === 'GET' && parts.length === 2 && parts[1] === 'next') return next(request, env, member);
	if (request.method === 'POST' && parts.length === 2 && parts[1] === 'answer') return answer(request, env, member);
	throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
}

/**
 * @param {Env} env
 * @param {number} userId
 */
async function standing(env, userId) {
	const c = /** @type {{ correct: number, total: number } | null} */ (await env.APP.prepare('SELECT correct, total FROM help_checks WHERE user_id = ?1').bind(userId).first());
	const total = c?.total ?? 0;
	const correct = c?.correct ?? 0;
	return {
		total,
		correct,
		checking: total < CHECKS_NEEDED,
		fluent: total >= CHECKS_NEEDED && correct >= total * FLUENT,
	};
}

/**
 * Up to two questions: a check while the member has too few (and now and
 * then after), and an item they have not answered: a meaning of the word
 * not yet reviewed first, else a spelling.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function next(request, env, member) {
	const word = (new URL(request.url).searchParams.get('word') ?? '').normalize('NFC').trim();
	if (word.length > 100) throw new AppError('bad_request', 'word is longer than 100 characters');
	const me = await standing(env, member.id);
	if (!me.checking && !me.fluent) return json({ questions: [] }, NO_STORE);
	const db = env.APP;
	await db.prepare('DELETE FROM help_asked WHERE created_at < unixepoch() - 86400 OR (user_id = ?1 AND created_at < unixepoch() - 3600)').bind(member.id).run();

	/** @type {Array<Record<string, unknown>>} */
	const questions = [];
	if (me.checking || Math.random() < 0.25) {
		const check = await checkQuestion(env);
		if (check) {
			const row = /** @type {{ id: number }} */ (
				await db.prepare('INSERT INTO help_asked (user_id, options, answer) VALUES (?1, ?2, ?3) RETURNING id').bind(member.id, JSON.stringify(check.options), check.answer).first()
			);
			questions.push({ id: row.id, kind: 'spelling', options: check.options });
		}
	}
	const item = (word && (await meaningItem(env, member, word))) || (await spellingItem(env, member));
	if (item) {
		const options = item.kind === 'spelling' ? shuffled(/** @type {string[]} */ (JSON.parse(String(item.options)))) : null;
		const row = /** @type {{ id: number }} */ (
			await db
				.prepare('INSERT INTO help_asked (user_id, item_id, options) VALUES (?1, ?2, ?3) RETURNING id')
				.bind(member.id, item.id, options && JSON.stringify(options))
				.first()
		);
		questions.push(
			item.kind === 'spelling'
				? { id: row.id, kind: 'spelling', options }
				: {
						id: row.id,
						kind: 'meaning',
						word: item.word,
						type: item.type,
						gloss: item.gloss,
					},
		);
	}
	// A check and an item look alike; their order says nothing either.
	return json({ questions: shuffled(questions) }, NO_STORE);
}

/**
 * A dictionary word and two spellings a slip away that are not words.
 * @param {Env} env
 * @returns {Promise<{ answer: string, options: string[] } | null>}
 */
async function checkQuestion(env) {
	const { dict, db } = await dictionary(env);
	const fail = (/** @type {unknown} */ err) => {
		throw explainDictError(err, dict, env);
	};
	// From a random place in the word list; from its start when that place is near the end.
	const pick = async (/** @type {string} */ sql) => (await db.prepare(sql).all().catch(fail)).results.map((r) => String(r.word)).filter((w) => variable(w) && [...w].length >= 3);
	const words = [
		...shuffled(await pick('SELECT word FROM mya_word WHERE id >= (SELECT abs(random()) % (max(id) + 1) FROM mya_word) ORDER BY id LIMIT 30')),
		...shuffled(await pick('SELECT word FROM mya_word ORDER BY id LIMIT 30')),
	];
	for (const w of words) {
		const near = variants(w);
		if (near.length < 2) continue;
		const { results: real } = await db.prepare('SELECT word FROM mya_word WHERE word IN (SELECT value FROM json_each(?1))').bind(JSON.stringify(near)).all().catch(fail);
		const taken = new Set(real.map((r) => String(r.word)));
		const fake = shuffled(near.filter((v) => !taken.has(v))).slice(0, 2);
		if (fake.length === 2) return { answer: w, options: shuffled([w, ...fake]) };
	}
	return null;
}

/**
 * A meaning of the word not yet reviewed and not answered by the member,
 * made into an item the first time it is asked.
 * @param {Env} env
 * @param {Member} member
 * @param {string} word
 */
async function meaningItem(env, member, word) {
	const { dict, db } = await dictionary(env);
	const { results } = await db
		.prepare(
			`SELECT s.id, w.word, t.name AS type, k.name AS kind, s.sense
			 FROM eng_word w JOIN emd_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd
			 WHERE w.word = ?1 COLLATE NOCASE ORDER BY s.wseq`,
		)
		.bind(word)
		.all()
		.catch((err) => {
			throw explainDictError(err, dict, env);
		});
	const layer = await liveLayer(env);
	const senses = /** @type {Array<{ id: number, word: string, type: string, kind: string | null, sense: string }>} */ (layer.senses('emd', /** @type {any[]} */ (results)));
	for (const s of senses.filter((x) => UNREVIEWED.has(String(x.kind)))) {
		const glosses = glossesOf(s.sense)
			.map((g) => plainItem(g))
			.filter(Boolean);
		if (!glosses.length) continue;
		const hash = await meaningHash(s.sense);
		const key = `meaning:emd:${s.id}:${hash}`;
		await env.APP.prepare("INSERT INTO help_items (kind, key, word, type, sense_id, text_hash, gloss, source) VALUES ('meaning', ?1, ?2, ?3, ?4, ?5, ?6, 'review') ON CONFLICT (key) DO NOTHING")
			.bind(key, s.word, s.type, s.id, hash, glosses.join(' | ').slice(0, 600))
			.run();
		const item = await env.APP.prepare(
			"SELECT i.* FROM help_items i WHERE i.key = ?1 AND i.status = 'collecting' AND NOT EXISTS (SELECT 1 FROM help_votes v WHERE v.item_id = i.id AND v.user_id = ?2)",
		)
			.bind(key, member.id)
			.first();
		if (item) return item;
	}
	return null;
}

/**
 * A spelling item still collecting that the member has not answered, those
 * with the fewest votes first.
 * @param {Env} env
 * @param {Member} member
 */
async function spellingItem(env, member) {
	return env.APP.prepare(
		`SELECT i.* FROM help_items i
		 WHERE i.kind = 'spelling' AND i.status = 'collecting' AND NOT EXISTS (SELECT 1 FROM help_votes v WHERE v.item_id = i.id AND v.user_id = ?1)
		 ORDER BY (SELECT count(*) FROM help_votes v WHERE v.item_id = i.id), random() LIMIT 1`,
	)
		.bind(member.id)
		.first();
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function answer(request, env, member) {
	const data = await body(request);
	if (!Number.isInteger(data.id)) throw new AppError('bad_request', 'id must be a whole number');
	const db = env.APP;
	const asked = /** @type {{ id: number, item_id: number | null, options: string | null, answer: string | null, kind: string | null } | null} */ (
		await db
			.prepare('SELECT a.id, a.item_id, a.options, a.answer, i.kind FROM help_asked a LEFT JOIN help_items i ON i.id = a.item_id WHERE a.id = ?1 AND a.user_id = ?2')
			.bind(data.id, member.id)
			.first()
	);
	if (!asked) throw new AppError('not_found', 'That question is no longer open. Answer the next one.');
	const options = asked.options ? /** @type {string[]} */ (JSON.parse(asked.options)) : null;
	const kind = asked.item_id === null ? 'spelling' : String(asked.kind);
	/** @type {string} */
	let value;
	if (kind === 'meaning') {
		if (!['yes', 'no', 'unsure'].includes(/** @type {string} */ (data.answer))) throw new AppError('bad_request', 'answer must be yes, no or unsure');
		value = String(data.answer);
	} else if (data.answer === 'many' || data.answer === 'unsure') {
		value = data.answer;
	} else {
		if (!Number.isInteger(data.answer) || !options || /** @type {number} */ (data.answer) < 0 || /** @type {number} */ (data.answer) >= options.length) {
			throw new AppError('bad_request', 'answer must be the index of a choice, many or unsure');
		}
		value = options[/** @type {number} */ (data.answer)];
	}
	const done = db.prepare('DELETE FROM help_asked WHERE id = ?1').bind(asked.id);
	if (asked.item_id === null) {
		// A check: graded only when a spelling was chosen.
		const graded = value !== 'many' && value !== 'unsure';
		const correct = graded && value === asked.answer ? 1 : 0;
		await db.batch([
			done,
			...(graded
				? [db.prepare('INSERT INTO help_checks (user_id, correct, total) VALUES (?1, ?2, 1) ON CONFLICT (user_id) DO UPDATE SET correct = correct + ?2, total = total + 1').bind(member.id, correct)]
				: []),
		]);
	} else {
		await db.batch([
			done,
			db
				.prepare('INSERT INTO help_votes (item_id, user_id, answer) VALUES (?1, ?2, ?3) ON CONFLICT (item_id, user_id) DO UPDATE SET answer = ?3, created_at = unixepoch()')
				.bind(asked.item_id, member.id, value),
		]);
	}
	return json({ ok: true }, NO_STORE);
}

/** @param {string} s */
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The workspace's Votes.
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string | undefined} id
 */
export async function votes(request, env, member, id) {
	if (!atLeast(member.role, 'editor')) throw new AppError('forbidden', 'Votes are for editors.');
	if (request.method === 'POST' && id === undefined) return addItem(request, env, member);
	if (request.method === 'POST' && id === 'find') return findItems(env, member);
	if (request.method === 'POST' && id !== undefined) return decide(request, env, member, id);
	if (request.method !== 'GET' || id !== undefined) throw new AppError('not_found', `No API route for ${request.method} ${new URL(request.url).pathname}`);
	const p = new URL(request.url).searchParams;
	const kind = p.get('kind') ?? 'spelling';
	if (kind !== 'spelling' && kind !== 'meaning') throw new AppError('bad_request', 'kind must be spelling or meaning');
	const state = p.get('state') ?? 'ready';
	if (!['ready', 'collecting', 'split', 'decided', 'set_aside'].includes(state)) throw new AppError('bad_request', 'state must be ready, collecting, split, decided or set_aside');
	const offset = Number(p.get('offset') ?? 0);
	if (!Number.isInteger(offset) || offset < 0) throw new AppError('bad_request', 'offset must be a whole number, 0 or more');
	const q = (p.get('q') ?? '').normalize('NFC').trim();
	if (q.length > 60) throw new AppError('bad_request', 'q is longer than 60 characters');

	// Every item of the kind with its counted votes; the states are worked out from them.
	const { results } = await env.APP.prepare(
		`WITH counted AS (
		   SELECT v.item_id, v.answer, count(*) AS n FROM help_votes v JOIN help_checks c ON c.user_id = v.user_id
		   WHERE ${FLUENT_SQL} AND v.answer <> 'unsure' GROUP BY v.item_id, v.answer
		 ), totals AS (
		   SELECT item_id, sum(n) AS votes, max(n) AS top, json_group_array(json_array(answer, n)) AS answers FROM counted GROUP BY item_id
		 )
		 SELECT i.id, i.kind, i.options, i.word, i.type, i.sense_id, i.gloss, i.source, i.status, i.decision, i.decided_at, i.created_at,
		        coalesce(t.votes, 0) AS votes, coalesce(t.top, 0) AS top, coalesce(t.answers, '[]') AS answers,
		        (SELECT count(*) FROM help_votes v WHERE v.item_id = i.id) AS asked,
		        (SELECT coalesce(sum(s.hits), 0) FROM search_counts s WHERE s.lang = 'my' AND s.found = 0 AND i.kind = 'spelling' AND s.term IN (SELECT value FROM json_each(i.options))) AS searched
		 FROM help_items i LEFT JOIN totals t ON t.item_id = i.id
		 WHERE i.kind = ?1 AND (?2 = '' OR i.word LIKE ?3 ESCAPE '\\' OR i.options LIKE ?4 ESCAPE '\\')
		 ORDER BY i.created_at DESC, i.id DESC`,
	)
		.bind(kind, q, `${likeEscape(q)}%`, `%${likeEscape(q)}%`)
		.all();
	const items = results.map((r) => {
		const votes = Number(r.votes);
		const top = Number(r.top);
		const status = String(r.status);
		const state = status !== 'collecting' ? status : votes < READY_VOTES ? 'collecting' : top >= votes * READY_SHARE ? 'ready' : 'split';
		const answers = /** @type {Array<[string, number]>} */ (JSON.parse(String(r.answers))).sort((a, b) => b[1] - a[1]).map(([text, n]) => ({ text, n }));
		return {
			id: Number(r.id),
			kind: r.kind,
			options: r.options ? JSON.parse(String(r.options)) : null,
			word: r.word ?? null,
			type: r.type ?? null,
			sense_id: r.sense_id ?? null,
			gloss: r.gloss ?? null,
			source: r.source,
			state,
			decision: r.decision ?? null,
			votes,
			asked: Number(r.asked),
			searched: Number(r.searched),
			answers,
			at: Number(r.created_at),
		};
	});
	const counts = Object.fromEntries(['ready', 'collecting', 'split', 'decided', 'set_aside'].map((s) => [s, items.filter((i) => i.state === s).length]));
	const shown = items.filter((i) => i.state === state);
	// Ready and split: the most votes first, so the clearest decisions come first.
	if (state === 'ready' || state === 'split') shown.sort((a, b) => b.votes - a.votes || b.searched - a.searched);
	return json(
		{
			kind,
			state,
			counts,
			items: shown.slice(offset, offset + PAGE),
			more: shown.length > offset + PAGE,
			rules: {
				checks: CHECKS_NEEDED,
				fluent: FLUENT,
				votes: READY_VOTES,
				share: READY_SHARE,
			},
		},
		NO_STORE,
	);
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function spellings(value) {
	if (!Array.isArray(value) || value.length < 2 || value.length > 4) throw new AppError('bad_request', 'options must be 2 to 4 spellings');
	const out = value.map((v, i) => {
		const s = typeof v === 'string' ? v.normalize('NFC').trim() : '';
		if (!variable(s)) throw new AppError('bad_request', `options[${i}] must be a Myanmar word of 2 to 30 letters, in Unicode`);
		return s;
	});
	if (new Set(out).size !== out.length) throw new AppError('bad_request', 'The spellings must differ');
	return out;
}

/** @param {string[]} options */
const spellingKey = (options) => `spelling:${[...options].sort().join('|')}`;

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 */
async function addItem(request, env, member) {
	const options = spellings((await body(request)).options);
	const row = await env.APP.prepare("INSERT INTO help_items (kind, key, options, source, created_by) VALUES ('spelling', ?1, ?2, 'editor', ?3) ON CONFLICT (key) DO NOTHING RETURNING id")
		.bind(spellingKey(options), JSON.stringify(options), member.id)
		.first();
	if (!row) throw new AppError('conflict', 'These spellings are already being asked.');
	return json({ id: Number(row.id) }, NO_STORE);
}

/**
 * Myanmar words searched and not found, most searched first, against the
 * dictionary words a slip away: each with at least one becomes an item.
 * @param {Env} env
 * @param {Member} member
 */
async function findItems(env, member) {
	const { results: searched } = await env.APP.prepare(
		`SELECT s.term, sum(s.hits) AS hits FROM search_counts s
		 WHERE s.lang = 'my' AND s.found = 0
		   AND NOT EXISTS (SELECT 1 FROM search_marks m WHERE m.lang = 'my' AND m.term = s.term AND m.label IN ('noise', 'add'))
		 GROUP BY s.term HAVING hits >= ?1 ORDER BY hits DESC LIMIT 500`,
	)
		.bind(FIND_HITS)
		.all();
	const { dict, db } = await dictionary(env);
	const { results: existing } = await env.APP.prepare("SELECT options FROM help_items WHERE kind = 'spelling'").all();
	const asked = new Set(existing.flatMap((r) => /** @type {string[]} */ (JSON.parse(String(r.options)))));
	let added = 0;
	for (const r of searched) {
		const term = String(r.term).normalize('NFC');
		if (added >= FIND_MAX) break;
		if (!variable(term) || asked.has(term)) continue;
		const near = variants(term);
		if (!near.length) continue;
		const { results: real } = await db
			.prepare('SELECT word FROM mya_word WHERE word IN (SELECT value FROM json_each(?1))')
			.bind(JSON.stringify(near))
			.all()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
		const words = [...new Set(real.map((w) => String(w.word)))].slice(0, 3);
		if (!words.length) continue;
		const options = [term, ...words];
		const row = await env.APP.prepare("INSERT INTO help_items (kind, key, options, source, created_by) VALUES ('spelling', ?1, ?2, 'search', ?3) ON CONFLICT (key) DO NOTHING RETURNING id")
			.bind(spellingKey(options), JSON.stringify(options), member.id)
			.first();
		if (row) {
			added++;
			for (const o of options) asked.add(o);
		}
	}
	return json({ added, looked: searched.length }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 * @param {Member} member
 * @param {string} id
 */
async function decide(request, env, member, id) {
	if (!/^\d+$/.test(id)) throw new AppError('bad_request', 'The item id must be a number');
	const data = await body(request);
	const status = data.status;
	if (status !== 'decided' && status !== 'set_aside' && status !== 'collecting') throw new AppError('bad_request', 'status must be decided, set_aside or collecting');
	const db = env.APP;
	const item = /** @type {{ id: number, kind: string, options: string | null } | null} */ (await db.prepare('SELECT id, kind, options FROM help_items WHERE id = ?1').bind(Number(id)).first());
	if (!item) throw new AppError('not_found', `No item ${id}`);
	/** @type {string | null} */
	let decision = null;
	/** @type {D1PreparedStatement[]} */
	const more = [];
	if (status === 'decided') {
		const options = item.options ? /** @type {string[]} */ (JSON.parse(item.options)) : [];
		const allowed = item.kind === 'spelling' ? [...options, 'many'] : ['right', 'wrong'];
		if (typeof data.decision !== 'string' || !allowed.includes(data.decision)) throw new AppError('bad_request', `decision must be one of ${allowed.join(', ')}`);
		decision = data.decision;
		if (item.kind === 'spelling' && decision !== 'many') {
			// Each other spelling that readers searched and did not find: a misspelling of the one decided.
			for (const wrong of options.filter((o) => o !== decision)) {
				more.push(
					db
						.prepare(
							`INSERT INTO search_marks (lang, term, label, note, marked_by) SELECT 'my', ?1, 'misspelling', ?2, ?3
							 WHERE EXISTS (SELECT 1 FROM search_counts WHERE lang = 'my' AND term = ?1 AND found = 0)
							 ON CONFLICT (lang, term) DO UPDATE SET label = 'misspelling', note = coalesce(search_marks.note, excluded.note), marked_by = excluded.marked_by, marked_at = unixepoch()`,
						)
						.bind(wrong, `→ ${decision}`, member.id),
				);
			}
		}
	}
	await db.batch([
		db
			.prepare(
				"UPDATE help_items SET status = ?1, decision = ?2, decided_by = CASE WHEN ?1 = 'collecting' THEN NULL ELSE ?3 END, decided_at = CASE WHEN ?1 = 'collecting' THEN NULL ELSE unixepoch() END WHERE id = ?4",
			)
			.bind(status, decision, member.id, item.id),
		...more,
	]);
	return json({ id: item.id, status, decision }, NO_STORE);
}
