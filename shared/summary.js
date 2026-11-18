// @ts-check
/**
 * An entry in one sentence, for the page a search engine or a link preview
 * reads before any script runs (worker/routes/page.js):
 *
 *   “love” in Myanmar (noun, verb): ချစ်ခြင်း, ချစ်ခင်မှု, ချစ်သူ, ချစ်သည်, အလွန်နှစ်သက်သည်
 *
 * Enough to say what the page is about, and no more: the parts of speech
 * are named once, and the meanings follow as one run of words, the first
 * two of each part, without labels, examples, order within a part or any
 * mark of where one meaning ends. The entry itself comes from the API, to
 * the app's own pages only (worker/lib/guard.js).
 */
import { glossesOf, parseMarkup } from './markup.js';

/** Meanings read from each part of speech. */
export const SUMMARY_SENSES = 2;
/** Words or short phrases in the sentence, at most. */
export const SUMMARY_GLOSSES = 12;
/** The sentence's meanings, in characters, at most. */
export const SUMMARY_LENGTH = 240;

/**
 * A meaning as plain words: links read as their words, labels, grammar
 * patterns and bracketed notes left out.
 * @param {import('./markup.js').Token[]} tokens
 * @returns {string}
 */
function words(tokens) {
	return tokens.map((tk) => (tk.t === 'text' ? tk.v : tk.t === 'link' ? tk.words.join('/') : tk.t === 'mark' ? words(tk.parts) : '')).join('');
}

/**
 * @param {import('./types.js').LookupResult} result  With entries.
 * @returns {{ word: string, into: 'Myanmar' | 'English', parts: string[], glosses: string[] } | null}
 *   null when no meaning has plain words to show.
 */
export function entrySummary(result) {
	/** @type {Map<string, string[]>} */
	const byPart = new Map();
	for (const e of result.entries) {
		const list = byPart.get(e.type) ?? [];
		if (!byPart.has(e.type)) byPart.set(e.type, list);
		if (list.length < SUMMARY_SENSES && e.sense) list.push(e.sense);
	}
	/** @type {string[]} */
	const glosses = [];
	let length = 0;
	for (const sense of [...byPart.values()].flat()) {
		// Glosses only: a note (a label, an origin) or the sense in English is not a meaning in the other language.
		for (const part of glossesOf(sense)) {
			const gloss = words(parseMarkup(part)).replace(/\s+/g, ' ').trim();
			if (!gloss || glosses.includes(gloss)) continue;
			if (glosses.length >= SUMMARY_GLOSSES || length + gloss.length > SUMMARY_LENGTH) break;
			glosses.push(gloss);
			length += gloss.length;
		}
	}
	if (!glosses.length) return null;
	return { word: result.query, into: result.language === 'my' ? 'English' : 'Myanmar', parts: [...byPart.keys()].map((p) => p.toLowerCase()), glosses };
}

/**
 * The sentence, and a shorter line for the page's title.
 * @param {NonNullable<ReturnType<typeof entrySummary>>} s
 * @returns {{ title: string, sentence: string }}
 */
export function summaryText(s) {
	return {
		title: `${s.word}: ${s.glosses.slice(0, 3).join(', ')}`,
		sentence: `“${s.word}” in ${s.into} (${s.parts.join(', ')}): ${s.glosses.join(', ')}`,
	};
}
