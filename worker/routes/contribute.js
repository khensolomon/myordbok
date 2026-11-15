// @ts-check
/**
 * Members' contributions on an entry: likes and dislikes, and suggested
 * changes to its senses.
 *
 *   GET  /api/reactions?lang=en&word=love   counts and the member's own, for the
 *                                           entry and for each of its senses
 *   POST /api/reactions                     { lang, word, value: 1 | -1 | 0 }, and
 *                                           sense_id for one sense
 *
 * A sense's reactions count only while its meaning is the one they were
 * given for (sense_reactions.text_hash), so a corrected meaning starts with
 * none. The meaning is the one readers see: the build with the live edits
 * over it, so a rating given to a live correction stays with it through
 * the release.
 *   GET  /api/senses?lang=en&word=love      senses with ids, part-of-speech
 *                                           list and the member's open
 *                                           suggestions (signed in only)
 *   POST /api/edits                         a suggestion:
 *        { lang, word, action: 'edit', sense_id, field: 'sense' | 'exam', value, note? }
 *        { lang, word, action: 'edit', sense_id, field: 'wrte' | 'wrkd', value: id, note? }   editors: part of speech, status
 *        { lang, word, action: 'delete', sense_id, note? }
 *        { lang, word, action: 'add', wrte, sense, exam?, note? }
 *
 * Changes are never written to the dictionary: they wait in dict_edits and
 * reach it through the dataset (docs/deploy.md, Studio edits). The value an
 * edit replaces is read here, not taken from the request: from the
 * dictionary with the live edits over it (worker/lib/layer.js), so the
 * export can tell when the dataset has moved on, and an edit of a meaning
 * that is live follows the one before it. A member's suggestion waits for
 * review; an editor's own is approved and waits for the release; an
 * admin's or owner's own is approved and live at once.
 *
 * Writes need a session and a same-origin request (worker/index.js checks
 * Origin; worker/lib/guard.js checks Sec-Fetch-Site).
 */
import { AppError } from '../../shared/errors.js';
import { EDIT_TEXT_MAX } from '../../shared/limits.js';
import { atLeast } from '../../shared/roles.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { liveLayer, requireLayerRoom, resetLayerCache } from '../lib/layer.js';
import { getSetting, requireOn } from '../lib/settings.js';
import { currentMember } from '../lib/session.js';
import { refuseZawgyi } from '../../shared/zawgyi/index.js';

/** Longest value a suggestion may carry, in characters. */
const MAX_VALUE = EDIT_TEXT_MAX;
/** Suggestions a member may have waiting for review at once. */
export const MAX_PENDING = 50;
/** Fields a suggestion may change, per dictionary. */
const EDITABLE = Object.freeze(['sense', 'exam']);
/** What editors change besides: a sense's part of speech and its status or label, by id in these tables. */
const CLASSED = Object.freeze(/** @type {Record<string, { table: string, what: string }>} */ ({ wrte: { table: 'type_word', what: 'part of speech' }, wrkd: { table: 'type_sense', what: 'status' } }));

const NO_STORE = { headers: { 'cache-control': 'no-store' } };

/**
 * @typedef {import('./auth.js').AuthEnv & import('../lib/dict.js').DictEnv} Env
 */

/**
 * @param {string | null | undefined} lang
 * @returns {'en' | 'my'}
 */
function language(lang) {
	if (lang !== 'en' && lang !== 'my') throw new AppError('bad_request', 'lang must be "en" or "my"');
	return lang;
}

/** @param {unknown} word */
function headword(word) {
	const w = typeof word === 'string' ? word.normalize('NFC').trim() : '';
	if (!w || w.length > 100 || /[\t\r\n]/.test(w)) throw new AppError('bad_request', 'word must be a headword of up to 100 characters');
	return w;
}

const LABEL = /** @type {Record<string, string>} */ ({ sense: 'The meaning', exam: 'The example', note: 'The reason' });

/**
 * A value as it will travel to the dataset: one line, trimmed, bounded, in
 * Unicode (never Zawgyi).
 * @param {unknown} value
 * @param {string} name
 * @param {{ optional?: boolean }} [options]
 */
function cleanValue(value, name, options = {}) {
	if ((value === undefined || value === null || value === '') && options.optional) return null;
	if (typeof value !== 'string') throw new AppError('bad_request', `${name} must be text`);
	const v = value.normalize('NFC').replace(/[\t\r\n]+/g, ' ').trim();
	if (!v && !options.optional) throw new AppError('bad_request', `${name} cannot be empty`);
	if (v.length > MAX_VALUE) throw new AppError('bad_request', `${name} is longer than ${MAX_VALUE} characters`);
	refuseZawgyi(v, LABEL[name] ?? name);
	return v || null;
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function requireMember(request, env) {
	const member = await currentMember(request, env);
	if (!member) throw new AppError('unauthorized', 'Sign in to do this.');
	return member;
}

/** @param {Request} request */
async function body(request) {
	const data = await request.json().catch(() => null);
	if (!data || typeof data !== 'object') throw new AppError('bad_request', 'The request body must be a JSON object');
	return /** @type {Record<string, unknown>} */ (data);
}

/** @param {string} text */
async function textHash(text) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.normalize('NFC')));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @typedef {{ likes: number, dislikes: number, mine: number }} Counts
 */

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function reactions(request, env) {
	if (request.method === 'POST') return react(request, env);
	const url = new URL(request.url);
	const lang = language(url.searchParams.get('lang'));
	const word = headword(url.searchParams.get('word'));
	const [member, open] = await Promise.all([currentMember(request, env), getSetting(env, 'ratings.open')]);
	return json({ ...(await countsFor(env, lang, word, member?.id ?? null)), open: open === 'on' }, NO_STORE);
}

/**
 * The entry's counts and each sense's, for its current meaning.
 * @param {Env} env
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @param {number | null} memberId
 */
async function countsFor(env, lang, word, memberId) {
	const row = /** @type {{ likes: number, dislikes: number, mine: number | null }} */ (
		await env.APP.prepare(
			`SELECT coalesce(sum(value = 1), 0) AS likes, coalesce(sum(value = -1), 0) AS dislikes,
			        max(CASE WHEN user_id = ?3 THEN value END) AS mine
			 FROM reactions WHERE lang = ?1 AND word = ?2`,
		)
			.bind(lang, word, memberId ?? 0)
			.first()
	);
	const { dict, db } = await dictionary(env);
	const { results: list } = await db
		.prepare(SENSES[lang])
		.bind(word)
		.all()
		.catch((err) => {
			throw explainDictError(err, dict, env);
		});
	const shown = (await liveLayer(env)).senses(lang === 'en' ? 'emd' : 'med', /** @type {any[]} */ (list));
	const pairs = await Promise.all(shown.map(async (s) => [Number(s.id), await textHash(String(s.sense ?? ''))]));
	/** @type {Record<string, Counts>} */
	const senses = {};
	if (pairs.length) {
		const { results } = await env.APP.prepare(
			`SELECT r.sense_id, coalesce(sum(r.value = 1), 0) AS likes, coalesce(sum(r.value = -1), 0) AS dislikes,
			        max(CASE WHEN r.user_id = ?3 THEN r.value END) AS mine
			 FROM sense_reactions r JOIN json_each(?2) j
			   ON r.sense_id = json_extract(j.value, '$[0]') AND r.text_hash = json_extract(j.value, '$[1]')
			 WHERE r.dict = ?1 GROUP BY r.sense_id`,
		)
			.bind(lang === 'en' ? 'emd' : 'med', JSON.stringify(pairs), memberId ?? 0)
			.all();
		for (const r of results) senses[String(r.sense_id)] = { likes: Number(r.likes), dislikes: Number(r.dislikes), mine: Number(r.mine ?? 0) };
	}
	return { lang, word, likes: Number(row.likes), dislikes: Number(row.dislikes), mine: Number(row.mine ?? 0), senses, signedIn: memberId !== null };
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function react(request, env) {
	const member = await requireMember(request, env);
	await requireOn(env, 'ratings.open', 'Rating is paused for now.');
	const data = await body(request);
	const lang = language(/** @type {string} */ (data.lang));
	const word = headword(data.word);
	const value = data.value;
	if (value !== 1 && value !== -1 && value !== 0) throw new AppError('bad_request', 'value must be 1 (like), -1 (dislike) or 0 (neither)');
	const dictName = lang === 'en' ? 'emd' : 'med';

	if (data.sense_id !== undefined) {
		const senseId = Number(data.sense_id);
		if (!Number.isInteger(senseId)) throw new AppError('bad_request', 'sense_id must be a sense id');
		const { dict, db } = await dictionary(env);
		const stored = /** @type {{ id: number, word: string, sense: string | null, exam: string | null } | null} */ (
			await db
				.prepare(ONE_SENSE[lang])
				.bind(senseId)
				.first()
				.catch((err) => {
					throw explainDictError(err, dict, env);
				})
		);
		// The meaning rated is the one readers see.
		const [row] = stored ? (await liveLayer(env)).senses(dictName, [stored]) : [];
		if (!row || !sameWord(lang, row.word, word)) throw new AppError('not_found', `“${word}” has no sense ${senseId} in this dictionary`);
		if (value === 0) {
			await env.APP.prepare('DELETE FROM sense_reactions WHERE user_id = ?1 AND dict = ?2 AND sense_id = ?3').bind(member.id, dictName, senseId).run();
		} else {
			await env.APP.prepare(
				`INSERT INTO sense_reactions (user_id, dict, sense_id, text_hash, value) VALUES (?1, ?2, ?3, ?4, ?5)
				 ON CONFLICT (user_id, dict, sense_id) DO UPDATE SET text_hash = excluded.text_hash, value = excluded.value, created_at = unixepoch()`,
			)
				.bind(member.id, dictName, senseId, await textHash(String(row.sense ?? '')), value)
				.run();
		}
	} else if (value === 0) {
		await env.APP.prepare('DELETE FROM reactions WHERE user_id = ?1 AND lang = ?2 AND word = ?3').bind(member.id, lang, word).run();
	} else {
		await env.APP.prepare(
			`INSERT INTO reactions (user_id, lang, word, value) VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT (user_id, lang, word) DO UPDATE SET value = excluded.value, created_at = unixepoch()`,
		)
			.bind(member.id, lang, word, value)
			.run();
	}
	return json(await countsFor(env, lang, word, member.id), NO_STORE);
}

/**
 * Whether a sense's headword is the word asked about: any spelling for
 * English (God, god), exact for Myanmar.
 * @param {'en' | 'my'} lang
 * @param {string} found
 * @param {string} asked
 */
function sameWord(lang, found, asked) {
	return lang === 'en' ? found.toLowerCase() === asked.toLowerCase() : found === asked;
}

/** Senses of a headword with their ids, per dictionary. */
const SENSES = {
	en: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam
		FROM eng_word w JOIN emd_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd
		WHERE w.word = ?1 COLLATE NOCASE ORDER BY w.word, s.wseq`,
	my: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam
		FROM mya_word w JOIN med_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd
		WHERE w.word = ?1 ORDER BY s.wseq`,
};

/** One sense with its headword, to check an edit against. */
const ONE_SENSE = {
	en: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam
		FROM emd_sense s JOIN eng_word w ON w.id = s.wrid LEFT JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd WHERE s.id = ?1`,
	my: `SELECT s.id, w.word, s.wrte, t.name AS type, s.wrkd, k.name AS kind, s.sense, s.exam
		FROM med_sense s JOIN mya_word w ON w.id = s.wrid LEFT JOIN type_word t ON t.id = s.wrte LEFT JOIN type_sense k ON k.id = s.wrkd WHERE s.id = ?1`,
};

/**
 * GET /api/senses: what a suggestion is made against.
 * @param {Request} request
 * @param {Env} env
 */
export async function senses(request, env) {
	const member = await requireMember(request, env);
	const url = new URL(request.url);
	const lang = language(url.searchParams.get('lang'));
	const word = headword(url.searchParams.get('word'));
	const { dict, db } = await dictionary(env);
	const [list, types, kinds] = await Promise.all([
		db.prepare(SENSES[lang]).bind(word).all(),
		db.prepare('SELECT id, name FROM type_word ORDER BY id').all(),
		db.prepare('SELECT id, name FROM type_sense ORDER BY id').all(),
	]).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	const { results: mine } = await env.APP.prepare(
		`SELECT id, action, sense_id, field, old_value, new_value, data, status, note, review_note, created_at, live_at IS NOT NULL AS live
		 FROM dict_edits WHERE user_id = ?1 AND dict = ?2 AND word = ?3 COLLATE NOCASE
		   AND status IN ('pending', 'approved', 'exported', 'rejected', 'conflict')
		 ORDER BY created_at DESC LIMIT 50`,
	)
		.bind(member.id, lang === 'en' ? 'emd' : 'med', word)
		.all();
	// The studio asks again right after saving: an editor reads the layer
	// anew, not this isolate's copy from before the save.
	if (url.searchParams.get('fresh') === '1' && atLeast(member.role, 'editor')) resetLayerCache();
	const layer = await liveLayer(env);
	const shown = layer.senses(lang === 'en' ? 'emd' : 'med', /** @type {any[]} */ (list.results));
	return json({ lang, word, senses: shown, types: types.results, kinds: kinds.results, mine: mine.map((m) => ({ ...m, live: Boolean(m.live) })), role: member.role }, NO_STORE);
}

/**
 * POST /api/edits: a suggestion.
 * @param {Request} request
 * @param {Env} env
 */
export async function suggestEdit(request, env) {
	if (request.method !== 'POST') throw new AppError('bad_request', 'Suggest with POST');
	const member = await requireMember(request, env);
	await requireOn(env, 'suggestions.open', 'Suggestions are paused for now.');
	const data = await body(request);
	const lang = language(/** @type {string} */ (data.lang));
	const word = headword(data.word);
	const dictName = lang === 'en' ? 'emd' : 'med';
	const note = cleanValue(data.note, 'note', { optional: true });
	const action = data.action;
	if (action !== 'edit' && action !== 'delete' && action !== 'add') throw new AppError('bad_request', 'action must be edit, delete or add');

	const editor = atLeast(member.role, 'editor');
	if (!editor) {
		const waiting = /** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM dict_edits WHERE user_id = ?1 AND status = 'pending'").bind(member.id).first());
		if (Number(waiting.n) >= MAX_PENDING) throw new AppError('rate_limited', `You have ${MAX_PENDING} suggestions waiting for review. New ones can be made once some are reviewed.`);
	}

	const { dict, db } = await dictionary(env);
	const read = (/** @type {string} */ sql, /** @type {unknown[]} */ ...args) =>
		db
			.prepare(sql)
			.bind(...args)
			.first()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
	const built = /** @type {{ value: string } | null} */ (await read("SELECT value FROM meta WHERE key = 'built'"));

	/** @type {{ senseId: number | null, field: string | null, oldValue: string | null, newValue: string | null, data: string | null, word: string }} */
	let change;
	if (action === 'add') {
		const wrte = Number(data.wrte);
		if (!Number.isInteger(wrte) || !(await read('SELECT id FROM type_word WHERE id = ?1', wrte))) throw new AppError('bad_request', 'wrte must be a part of speech id');
		const sense = cleanValue(data.sense, 'sense');
		const exam = cleanValue(data.exam, 'exam', { optional: true });
		// The same meaning twice would be twice in the dataset: not one the entry has, nor one already suggested.
		const { results: has } = await db
			.prepare(SENSES[lang])
			.bind(word)
			.all()
			.catch((err) => {
				throw explainDictError(err, dict, env);
			});
		if (has.some((r) => r.wrte === wrte && r.sense === sense)) throw new AppError('bad_request', 'The entry has this meaning already');
		const twice = /** @type {{ id: number } | null} */ (
			await env.APP.prepare(
				`SELECT id FROM dict_edits WHERE dict = ?1 AND action = 'add' AND word = ?2 COLLATE NOCASE AND status IN ('pending', 'approved', 'exported')
				   AND json_extract(data, '$.wrte') = ?3 AND json_extract(data, '$.sense') = ?4 LIMIT 1`,
			)
				.bind(dictName, word, wrte, sense)
				.first()
		);
		if (twice) throw new AppError('conflict', `This meaning is suggested already (suggestion ${twice.id}).`);
		change = { senseId: null, field: null, oldValue: null, newValue: null, data: JSON.stringify({ wrte, sense, exam }), word };
	} else {
		const senseId = Number(data.sense_id);
		if (!Number.isInteger(senseId)) throw new AppError('bad_request', 'sense_id must be a sense id');
		const stored = /** @type {{ id: number, word: string, wrte: number, wrkd: number | null, sense: string | null, exam: string | null } | null} */ (await read(ONE_SENSE[lang], senseId));
		// As readers see it now: a live edit may have changed or deleted it.
		const [row] = stored ? (await liveLayer(env)).senses(dictName, [stored]) : [];
		if (!row || !sameWord(lang, row.word, word)) throw new AppError('not_found', `“${word}” has no sense ${senseId} in this dictionary`);
		// An approved change that is not live is not in what readers see, so a
		// new one would be made against text about to change, and the release
		// would find the two in conflict.
		const field = action === 'delete' ? null : String(data.field);
		const waits = /** @type {{ id: number } | null} */ (
			await env.APP.prepare(
				`SELECT id FROM dict_edits WHERE dict = ?1 AND sense_id = ?2 AND status IN ('approved', 'exported') AND live_at IS NULL
				   AND (action = 'delete' OR ?3 IS NULL OR field = ?3) ORDER BY id LIMIT 1`,
			)
				.bind(dictName, senseId, field)
				.first()
		);
		if (waits) {
			throw new AppError('conflict', `A change to this meaning is approved and waits for the next release (suggestion ${waits.id}). It can be changed again once an admin makes that one live, or after the release.`);
		}
		if (action === 'delete') {
			change = { senseId, field: 'delete', oldValue: row.word, newValue: null, data: null, word: row.word };
		} else if (field && Object.hasOwn(CLASSED, field)) {
			// Part of speech and status: an editor's to change, by id.
			const { table, what } = CLASSED[field];
			if (!editor) throw new AppError('forbidden', `Only editors change the ${what} of a meaning.`);
			const id = Number(data.value);
			if (!Number.isInteger(id) || !(await read(`SELECT id FROM ${table} WHERE id = ?1`, id))) throw new AppError('bad_request', `value must be a ${what} id`);
			const now = row[/** @type {'wrte' | 'wrkd'} */ (field)];
			if (now === id) throw new AppError('bad_request', `The meaning has this ${what} already`);
			change = { senseId, field, oldValue: now === null || now === undefined ? null : String(now), newValue: String(id), data: null, word: row.word };
		} else {
			if (!field || !EDITABLE.includes(field)) throw new AppError('bad_request', `field must be one of ${[...EDITABLE, ...Object.keys(CLASSED)].join(', ')}`);
			const oldValue = /** @type {string | null} */ (row[/** @type {'sense' | 'exam'} */ (field)] ?? null);
			const newValue = cleanValue(data.value, field, { optional: field === 'exam' });
			if ((newValue ?? '') === (oldValue ?? '')) throw new AppError('bad_request', 'The suggestion is the same as the current text');
			change = { senseId, field, oldValue, newValue, data: null, word: row.word };
		}
	}

	// An admin's or owner's own change is live at once; an editor's waits for the release.
	const live = atLeast(member.role, 'admin');
	if (live) await requireLayerRoom(env);
	const row = /** @type {{ id: number, status: string, live: number }} */ (
		await env.APP.prepare(
			`INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word, data, source, status, note, reviewed_by, reviewed_at, live_by, live_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CASE WHEN ?13 IS NULL THEN NULL ELSE unixepoch() END, ?14, CASE WHEN ?14 IS NULL THEN NULL ELSE unixepoch() END)
			 RETURNING id, status, live_at IS NOT NULL AS live`,
		)
			.bind(
				member.id,
				dictName,
				action,
				change.senseId,
				change.field,
				change.oldValue,
				change.newValue,
				change.word,
				change.data,
				built?.value ?? null,
				editor ? 'approved' : 'pending',
				note,
				editor ? member.id : null,
				live ? member.id : null,
			)
			.first()
	);
	if (live) resetLayerCache();
	return json({ edit: { ...row, live: Boolean(row.live) } }, { status: 201, ...NO_STORE });
}
