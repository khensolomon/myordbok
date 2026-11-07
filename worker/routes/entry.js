// @ts-check
/**
 * GET /api/entry/:lang/:word
 * One headword with its senses grouped by part of speech, in display order.
 */
import { AppError } from '../../shared/errors.js';
import { parseLang, wordKey } from '../../shared/validate.js';
import { json } from '../lib/http.js';

const TABLES = {
	en: { word: 'eng_word', sense: 'emd_sense' },
	my: { word: 'mya_word', sense: 'med_sense' },
};

/**
 * @param {string} langParam
 * @param {string} wordParam
 * @param {{ DB: D1Database }} env
 */
export async function entry(langParam, wordParam, env) {
	const lang = parseLang(langParam);
	const key = wordKey(decodeURIComponent(wordParam));
	const t = TABLES[lang];

	const head = await env.DB.prepare(`SELECT id, word FROM ${t.word} WHERE key = ?1 LIMIT 1`)
		.bind(key)
		.first();
	if (!head) throw new AppError('not_found', `No entry for "${key}"`);

	const { results } = await env.DB.prepare(
		`SELECT s.id, s.sense, s.exam, w.name AS pos
		 FROM ${t.sense} s JOIN word_type w ON w.id = s.wrte
		 WHERE s.wrid = ?1 AND s.deleted = 0
		 ORDER BY s.wrte, s.wseq`,
	)
		.bind(head.id)
		.all();

	/** @type {Map<string, import('../../shared/types.js').Sense[]>} */
	const groups = new Map();
	for (const r of results) {
		const name = String(r.pos);
		if (!groups.has(name)) groups.set(name, []);
		groups.get(name)?.push({ id: Number(r.id), sense: String(r.sense), exam: r.exam === null ? null : String(r.exam) });
	}

	/** @type {import('../../shared/types.js').Entry} */
	const body = {
		lang,
		word: String(head.word),
		pos: [...groups].map(([name, senses]) => ({ name, senses })),
	};
	return json(body, { cache: 300 });
}
