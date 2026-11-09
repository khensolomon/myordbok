// @ts-check
/**
 * Members' contributions on an entry: likes and dislikes, and suggested
 * changes to its senses.
 *
 *   GET  /api/reactions?lang=en&word=love   counts, and the member's own
 *   POST /api/reactions                     { lang, word, value: 1 | -1 | 0 }
 *   GET  /api/senses?lang=en&word=love      senses with ids, part-of-speech
 *                                           list and the member's open
 *                                           suggestions (signed in only)
 *   POST /api/edits                         a suggestion:
 *        { lang, word, action: 'edit', sense_id, field: 'sense' | 'exam', value, note? }
 *        { lang, word, action: 'delete', sense_id, note? }
 *        { lang, word, action: 'add', wrte, sense, exam?, note? }
 *
 * Changes are never written to the dictionary: they wait in dict_edits and
 * reach it through the dataset (docs/deploy.md, Studio edits). The value an
 * edit replaces is read here from the dictionary, not taken from the
 * request, so the export can tell when the dataset has moved on. A member's
 * suggestion waits for review; an editor's or admin's own is approved.
 *
 * Writes need a session and a same-origin request (worker/index.js checks
 * Origin; worker/lib/guard.js checks Sec-Fetch-Site).
 */
import { AppError } from '../../shared/errors.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';
import { currentMember } from '../lib/session.js';

/** Longest value a suggestion may carry, in characters. */
export const MAX_VALUE = 600;
/** Suggestions a member may have waiting for review at once. */
export const MAX_PENDING = 50;
/** Fields a suggestion may change, per dictionary. */
const EDITABLE = Object.freeze(['sense', 'exam']);

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

/**
 * A value as it will travel to the dataset: one line, trimmed, bounded.
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

/**
 * @param {Request} request
 * @param {Env} env
 */
export async function reactions(request, env) {
	if (request.method === 'POST') return react(request, env);
	const url = new URL(request.url);
	const lang = language(url.searchParams.get('lang'));
	const word = headword(url.searchParams.get('word'));
	const member = await currentMember(request, env);
	const row = /** @type {{ likes: number, dislikes: number, mine: number | null }} */ (
		await env.APP.prepare(
			`SELECT coalesce(sum(value = 1), 0) AS likes, coalesce(sum(value = -1), 0) AS dislikes,
			        max(CASE WHEN user_id = ?3 THEN value END) AS mine
			 FROM reactions WHERE lang = ?1 AND word = ?2`,
		)
			.bind(lang, word, member?.id ?? 0)
			.first()
	);
	return json({ lang, word, likes: Number(row.likes), dislikes: Number(row.dislikes), mine: Number(row.mine ?? 0), signedIn: !!member }, NO_STORE);
}

/**
 * @param {Request} request
 * @param {Env} env
 */
async function react(request, env) {
	const member = await requireMember(request, env);
	const data = await body(request);
	const lang = language(/** @type {string} */ (data.lang));
	const word = headword(data.word);
	const value = data.value;
	if (value !== 1 && value !== -1 && value !== 0) throw new AppError('bad_request', 'value must be 1 (like), -1 (dislike) or 0 (neither)');
	if (value === 0) {
		await env.APP.prepare('DELETE FROM reactions WHERE user_id = ?1 AND lang = ?2 AND word = ?3').bind(member.id, lang, word).run();
	} else {
		await env.APP.prepare(
			`INSERT INTO reactions (user_id, lang, word, value) VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT (user_id, lang, word) DO UPDATE SET value = excluded.value, created_at = unixepoch()`,
		)
			.bind(member.id, lang, word, value)
			.run();
	}
	const url = new URL(request.url);
	url.search = new URLSearchParams({ lang, word }).toString();
	return reactions(new Request(url, { headers: request.headers }), env);
}

/** Senses of a headword with their ids, per dictionary. */
const SENSES = {
	en: `SELECT s.id, w.word, s.wrte, t.name AS type, s.sense, s.exam
		FROM eng_word w JOIN emd_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte
		WHERE w.word = ?1 COLLATE NOCASE ORDER BY w.word, s.wseq`,
	my: `SELECT s.id, w.word, s.wrte, t.name AS type, s.sense, s.exam
		FROM mya_word w JOIN med_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte
		WHERE w.word = ?1 ORDER BY s.wseq`,
};

/** One sense with its headword, to check an edit against. */
const ONE_SENSE = {
	en: 'SELECT s.id, w.word, s.sense, s.exam FROM emd_sense s JOIN eng_word w ON w.id = s.wrid WHERE s.id = ?1',
	my: 'SELECT s.id, w.word, s.sense, s.exam FROM med_sense s JOIN mya_word w ON w.id = s.wrid WHERE s.id = ?1',
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
	const [list, types] = await Promise.all([
		db.prepare(SENSES[lang]).bind(word).all(),
		db.prepare('SELECT id, name FROM type_word ORDER BY id').all(),
	]).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	const { results: mine } = await env.APP.prepare(
		`SELECT id, action, sense_id, field, old_value, new_value, data, status, note, review_note, created_at
		 FROM dict_edits WHERE user_id = ?1 AND dict = ?2 AND word = ?3 COLLATE NOCASE
		   AND status IN ('pending', 'approved', 'exported', 'rejected', 'conflict')
		 ORDER BY created_at DESC LIMIT 50`,
	)
		.bind(member.id, lang === 'en' ? 'emd' : 'med', word)
		.all();
	return json({ lang, word, senses: list.results, types: types.results, mine, role: member.role }, NO_STORE);
}

/**
 * POST /api/edits: a suggestion.
 * @param {Request} request
 * @param {Env} env
 */
export async function suggestEdit(request, env) {
	if (request.method !== 'POST') throw new AppError('bad_request', 'Suggest with POST');
	const member = await requireMember(request, env);
	const data = await body(request);
	const lang = language(/** @type {string} */ (data.lang));
	const word = headword(data.word);
	const dictName = lang === 'en' ? 'emd' : 'med';
	const note = cleanValue(data.note, 'note', { optional: true });
	const action = data.action;
	if (action !== 'edit' && action !== 'delete' && action !== 'add') throw new AppError('bad_request', 'action must be edit, delete or add');

	const editor = member.role === 'editor' || member.role === 'admin';
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
		change = { senseId: null, field: null, oldValue: null, newValue: null, data: JSON.stringify({ wrte, sense, exam }), word };
	} else {
		const senseId = Number(data.sense_id);
		if (!Number.isInteger(senseId)) throw new AppError('bad_request', 'sense_id must be a sense id');
		const row = /** @type {{ id: number, word: string, sense: string | null, exam: string | null } | null} */ (await read(ONE_SENSE[lang], senseId));
		const same = row && (lang === 'en' ? row.word.toLowerCase() === word.toLowerCase() : row.word === word);
		if (!row || !same) throw new AppError('not_found', `“${word}” has no sense ${senseId} in this dictionary`);
		if (action === 'delete') {
			change = { senseId, field: 'delete', oldValue: row.word, newValue: null, data: null, word: row.word };
		} else {
			const field = String(data.field);
			if (!EDITABLE.includes(field)) throw new AppError('bad_request', `field must be one of ${EDITABLE.join(', ')}`);
			const oldValue = /** @type {string | null} */ (row[/** @type {'sense' | 'exam'} */ (field)] ?? null);
			const newValue = cleanValue(data.value, field, { optional: field === 'exam' });
			if ((newValue ?? '') === (oldValue ?? '')) throw new AppError('bad_request', 'The suggestion is the same as the current text');
			change = { senseId, field, oldValue, newValue, data: null, word: row.word };
		}
	}

	const row = /** @type {{ id: number, status: string }} */ (
		await env.APP.prepare(
			`INSERT INTO dict_edits (user_id, dict, action, sense_id, field, old_value, new_value, word, data, source, status, note, reviewed_by, reviewed_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CASE WHEN ?13 IS NULL THEN NULL ELSE unixepoch() END)
			 RETURNING id, status`,
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
			)
			.first()
	);
	return json({ edit: row }, { status: 201, ...NO_STORE });
}
