// @ts-check
/**
 * GET /api/pronunciation?q=love&tl=en: a word spoken, as MP3.
 *
 * The sound is Google Translate's, asked for by the Worker so the reader's
 * browser talks to this site alone. That address is not a documented
 * service: it may refuse, change or end without notice, and a refusal is
 * passed on as "unavailable", never hidden.
 *
 * Kept small on purpose, since the Worker fetches on a visitor's word:
 * only q and tl are taken, tl is "en" or "my", q is one short line, and the
 * route counts against the stricter rate limit. An answer is the same for
 * everyone, so it is kept at the edge and in the browser for a month
 * (worker/lib/guard.js): each word is asked of Google once per location.
 */
import { AppError } from '../../shared/errors.js';

const SOURCE = 'https://translate.google.com/translate_tts';
/** Longest text spoken: a headword or a short phrase. */
export const SPOKEN_MAX = 80;
export const SPOKEN_LANGS = ['en', 'my'];
const KEEP_SECONDS = 30 * 86_400;

/**
 * @param {URL} url
 * @param {typeof fetch} [fetcher]
 */
export async function pronunciation(url, fetcher = fetch) {
	// Any other parameter would make a second address for the same sound, each kept apart at the edge.
	const extra = [...url.searchParams.keys()].filter((k) => k !== 'q' && k !== 'tl');
	if (extra.length || url.searchParams.getAll('q').length !== 1 || url.searchParams.getAll('tl').length !== 1) {
		throw new AppError('bad_request', 'The pronunciation takes q (the word) and tl (en or my), once each, and nothing else.');
	}
	const tl = url.searchParams.get('tl') ?? '';
	if (!SPOKEN_LANGS.includes(tl)) throw new AppError('bad_request', `tl is "${tl}"; it is en or my.`);
	const q = url.searchParams.get('q') ?? '';
	if (!q || q !== q.trim() || /\s{2,}|[\u0000-\u001f\u007f]/.test(q)) throw new AppError('bad_request', 'q is the word as written: no line breaks, no spaces around it or doubled.');
	if ([...q].length > SPOKEN_MAX) throw new AppError('bad_request', `Only ${SPOKEN_MAX} characters are spoken.`);

	const source = `${SOURCE}?ie=UTF-8&q=${encodeURIComponent(q)}&tl=${tl}&client=tw-ob`;
	/** @type {Response} */
	let res;
	try {
		res = await fetcher(source, { headers: { accept: 'audio/mpeg' } });
	} catch (err) {
		console.error(JSON.stringify({ event: 'pronunciation_failed', tl, error: String(err) }));
		throw new AppError('unavailable', 'The pronunciation service could not be reached. Try again in a moment.');
	}
	const type = res.headers.get('content-type') ?? '';
	if (!res.ok || !type.startsWith('audio/')) {
		console.error(JSON.stringify({ event: 'pronunciation_refused', tl, status: res.status, type }));
		throw new AppError('unavailable', 'The pronunciation service did not answer with a sound. Try again later.');
	}
	return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': `public, max-age=${KEEP_SECONDS}, immutable` } });
}
