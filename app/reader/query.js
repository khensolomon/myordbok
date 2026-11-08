// @ts-check
/**
 * Where a typed query goes, and the one-line answer the search box shows
 * while it is typed. Both come from the query core (shared/query) in the
 * browser, before anything is fetched.
 */
import { classify } from '#shared/query/classify.js';
import { dateWords, timeWords } from '#shared/query/clock.js';
import { formatGrouped, parseDecimal } from '#shared/query/digits.js';
import { formatNumber } from '#shared/query/math.js';
import { toMyanmarWords } from '#shared/query/numeral-my.js';
import { definitionHref } from '../core/routes.js';

/** @typedef {import('#shared/query/classify.js').Intent} Intent */

export { classify };

/**
 * The page for a word read out of a question: the word's own address, with
 * the question kept (asked=) so the page can say how it was read, and the
 * part asked about as the place to scroll to (#synonyms).
 * @param {Extract<Intent, { kind: 'lookup' }>} intent
 * @param {string} typed
 */
export function understoodHref(intent, typed) {
	return `${definitionHref(intent.word)}&asked=${encodeURIComponent(typed.trim())}${intent.focus ? `#${intent.focus}` : ''}`;
}

/**
 * Where submitting `typed` goes.
 * @param {string} typed
 */
export function hrefFor(typed) {
	const intent = classify(typed);
	if (intent.kind === 'lookup' && intent.understood) return understoodHref(intent, typed);
	return definitionHref(typed.trim());
}

/**
 * A number or sum's value as shown: grouped, with a percent sign when it is one.
 * @param {number} value
 * @param {boolean} [percent]
 */
export function showValue(value, percent) {
	return `${formatNumber(value)}${percent ? '%' : ''}`;
}

/**
 * One line for the search box, or null when the query is a word to look up.
 * @param {Intent} intent
 * @returns {{ label: string, value: string } | null}
 */
export function preview(intent) {
	switch (intent.kind) {
		case 'number': {
			const d = parseDecimal(intent.value);
			if (!d) return null;
			let words = '';
			try {
				words = toMyanmarWords(d)[0].text;
			} catch {
				// beyond the readings; the digits still show
			}
			return { label: formatGrouped(d), value: words };
		}
		case 'math':
			return { label: `${intent.expression} =`, value: showValue(intent.value, intent.percent) };
		case 'shares':
			return { label: `Shares of ${formatNumber(intent.total)}`, value: intent.shares.map((s) => showValue(s, true)).join(', ') };
		case 'problem':
			return { label: 'No answer', value: intent.message };
		case 'time':
			return { label: 'The time', value: timeWords(new Date()).en };
		case 'date':
			return { label: 'Today', value: dateWords(new Date()).en };
		default:
			return null;
	}
}
