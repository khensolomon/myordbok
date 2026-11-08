// @ts-check
/**
 * Answers worked out in the browser, shown on the definition page in place
 * of an entry: a number read in words, a sum, shares of a total, a question
 * back when a sum can be read two ways, the time and the date. None of these
 * asks the dictionary.
 */
import { dateWords, timeWords } from '#shared/query/clock.js';
import { formatGrouped, parseDecimal, toMyanmarDigits } from '#shared/query/digits.js';
import { formatNumber } from '#shared/query/math.js';
import { toEnglishWords } from '#shared/query/numeral-en.js';
import { toMyanmarWords } from '#shared/query/numeral-my.js';
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { showValue } from './query.js';

/** @typedef {import('#shared/query/classify.js').Intent} Intent */

/**
 * @param {Intent} intent  Anything but a lookup.
 * @param {string} typed
 * @returns {HTMLElement}
 */
export function answer(intent, typed) {
	switch (intent.kind) {
		case 'number':
			return page(number(intent, typed));
		case 'math':
			return page(sum(intent));
		case 'shares':
			return page(shares(intent));
		case 'ask':
			return page([
				head('?', intent.question),
				h('p', { class: 'answer-lead' }, 'It can be read two ways. Which did you mean?'),
				h('ul', { class: 'chips answer-options' }, intent.options.map((o) => h('li', null, h('a', { href: definitionHref(o.query) }, o.label)))),
			]);
		case 'problem':
			return page([head('!', 'No answer'), h('p', { class: 'answer-lead' }, intent.message), h('p', { class: 'notice' }, 'Check the sum and try again.')]);
		case 'time':
		case 'date':
			return page(clock(intent.kind));
		default:
			return page([head('?', typed)]);
	}
}

/** @param {import('../core/dom.js').Child | import('../core/dom.js').Child[]} body */
function page(body) {
	return h(
		'div',
		{ class: 'definition' },
		h('article', { class: 'entry answer' }, body),
		h(
			'aside',
			{ class: 'entry-aside', 'aria-label': 'About this answer' },
			h('section', { class: 'aside-card' }, h('h2', null, 'Worked out here'), h('p', { class: 'aside-lead' }, 'This answer was worked out on your device. Nothing was sent, and it works offline.')),
		),
	);
}

/**
 * @param {string} mark  Shown in the round badge.
 * @param {string} text
 * @param {string} [lang]
 */
function head(mark, text, lang) {
	return h('header', { class: 'entry-head' }, h('span', { class: 'lang-badge', 'aria-hidden': 'true' }, mark), h('h1', { class: 'headword', lang }, text));
}

/** @param {Array<[string, import('../core/dom.js').Child | import('../core/dom.js').Child[]]>} rows */
function rows(rows) {
	return h('dl', { class: 'related answer-rows' }, rows.flatMap(([name, value]) => [h('dt', null, name), h('dd', null, value)]));
}

/**
 * @param {Extract<Intent, { kind: 'number' }>} intent
 * @param {string} typed
 */
function number(intent, typed) {
	const d = /** @type {import('#shared/query/digits.js').Decimal} */ (parseDecimal(intent.value));
	const grouped = formatGrouped(d);
	/** @type {Array<[string, import('../core/dom.js').Child | import('../core/dom.js').Child[]]>} */
	const list = [['Myanmar digits', h('span', { lang: 'my' }, toMyanmarDigits(grouped))]];
	try {
		const readings = toMyanmarWords(d);
		list.push(['In Myanmar', readings.map((r) => h('p', { class: 'answer-reading', lang: 'my' }, r.text, readings.length > 1 && r.scale ? h('span', { class: 'answer-scale' }, ` by ${r.scale}`) : null))]);
	} catch {
		// too long to read in words
	}
	try {
		list.push(['In English', toEnglishWords(d)]);
	} catch {
		// beyond the named English scales
	}
	return [
		head('#', grouped),
		rows(list),
		// Typed as words ("one hundred"), the words may also be an entry.
		intent.source !== 'digits' ? h('p', { class: 'answer-escape' }, h('a', { href: `${definitionHref(typed)}&exact=1` }, `Look up “${typed}” in the dictionary`)) : null,
	];
}

/** @param {Extract<Intent, { kind: 'math' }>} intent */
function sum(intent) {
	const shown = showValue(intent.value, intent.percent);
	const whole = Number.isInteger(intent.value) && Math.abs(intent.value) < 1e15;
	return [
		head('=', shown),
		h('p', { class: 'answer-lead' }, `${intent.expression} = ${shown}`, intent.note ? h('span', { class: 'notice' }, ` (${intent.note})`) : null),
		rows([
			['Myanmar digits', h('span', { lang: 'my' }, toMyanmarDigits(shown.replace('−', '-')))],
			...(whole ? /** @type {Array<[string, import('../core/dom.js').Child]>} */ ([['In words', h('a', { href: definitionHref(String(intent.value)) }, `Read ${formatNumber(intent.value)} in words`)]]) : []),
		]),
	];
}

/** @param {Extract<Intent, { kind: 'shares' }>} intent */
function shares(intent) {
	return [
		head('%', `Shares of ${formatNumber(intent.total)}`),
		h('table', { class: 'answer-table' },
			h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Number'), h('th', { scope: 'col' }, 'Share'))),
			h('tbody', null, intent.numbers.map((n, i) => h('tr', null, h('td', null, formatNumber(n)), h('td', null, showValue(intent.shares[i], true))))),
			h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, formatNumber(intent.total)), h('td', null, '100%')))),
	];
}

/** @param {'time' | 'date'} kind */
function clock(kind) {
	const words = () => (kind === 'time' ? timeWords(new Date()) : dateWords(new Date()));
	const first = words();
	const title = h('h1', { class: 'headword' }, first.en);
	const my = h('p', { class: 'answer-lead', lang: 'my' }, first.my);
	const node = h('div', null, h('header', { class: 'entry-head' }, h('span', { class: 'lang-badge', 'aria-hidden': 'true' }, kind === 'time' ? '◷' : '▦'), title), my, h('p', { class: 'notice' }, 'From your device’s clock.'));
	// Kept current while the page is open; stops once the page is left.
	const timer = window.setInterval(() => {
		if (!node.isConnected) return window.clearInterval(timer);
		const now = words();
		title.textContent = now.en;
		my.textContent = now.my;
	}, 10_000);
	return node;
}
