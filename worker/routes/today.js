// @ts-check
/**
 * The word of the day, for the home page.
 *
 *   GET /api/today?day=YYYY-MM-DD   { day, word, type, gloss, example }
 *
 * The day is the reader's own (their time zone decides when it turns), so
 * it comes with the request; each day picks one reviewed meaning that has
 * an example, of a plain English word, the same for everyone that day. The
 * answer is cached a day for each day asked.
 */
import { AppError } from '../../shared/errors.js';
import { glossesOf, itemsOf } from '../../shared/markup.js';
import { plainItem } from '../../shared/quiz.js';
import { dictionary, explainDictError } from '../lib/dict.js';
import { json } from '../lib/http.js';

/** Reviewed meanings with an example, of words of 3 to 12 small letters. */
const WHERE = `FROM emd_sense s JOIN eng_word w ON w.id = s.wrid JOIN type_word t ON t.id = s.wrte JOIN type_sense k ON k.id = s.wrkd
	WHERE k.name = 'Active' AND s.exam IS NOT NULL AND s.exam <> '' AND length(w.word) BETWEEN 3 AND 12 AND w.word NOT GLOB '*[^a-z]*'`;

/**
 * A number for a day, spread so that days next to each other land far apart.
 * @param {string} day
 */
export function dayNumber(day) {
	let h = 2166136261;
	for (const c of day) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	return h;
}

/**
 * @param {URL} url
 * @param {import('../lib/dict.js').DictEnv} env
 */
export async function today(url, env) {
	const day = url.searchParams.get('day') ?? '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError('bad_request', 'day must be a date as YYYY-MM-DD');
	const { dict, db } = await dictionary(env);
	const fail = (/** @type {unknown} */ err) => {
		throw explainDictError(err, dict, env);
	};
	const count = /** @type {{ n: number }} */ (await db.prepare(`SELECT count(*) AS n ${WHERE}`).first().catch(fail));
	if (!count.n) return json({ day, word: null }, { cache: 3600 });
	const row = /** @type {{ word: string, type: string, sense: string, exam: string } | null} */ (
		await db
			.prepare(`SELECT w.word, t.name AS type, s.sense, s.exam ${WHERE} ORDER BY s.id LIMIT 1 OFFSET ?1`)
			.bind(dayNumber(day) % Number(count.n))
			.first()
			.catch(fail)
	);
	if (!row) return json({ day, word: null }, { cache: 3600 });
	const gloss = glossesOf(row.sense).map((g) => plainItem(g)).find(Boolean) ?? '';
	const example =
		itemsOf(row.exam)
			.flatMap((it) => (it.t === 'text' ? [it.text] : []))
			.filter((t) => !/^<[^<>]*\/[^<>]*>$/.test(t.trim()))
			.map((t) => plainItem(t, row.word))
			.find(Boolean) ?? null;
	return json({ day, word: row.word, type: row.type, gloss, example }, { cache: 86400 });
}
