// @ts-check
/**
 * Answers worked out in the browser, shown on the definition page in place
 * of an entry and in its form: the headword is the answer, and the timeline
 * names what it is where an entry names the part of speech (number, sum,
 * shares, time, date); each reading is a line on it, with a copy button.
 * None of these asks the dictionary. What says so sits below the answer.
 */
import { dateWords, timeWords } from '#shared/query/clock.js';
import { formatGrouped, parseDecimal, toMyanmarDigits } from '#shared/query/digits.js';
import { formatNumber } from '#shared/query/math.js';
import { toEnglishWords } from '#shared/query/numeral-en.js';
import { toMyanmarWords } from '#shared/query/numeral-my.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { showValue } from './query.js';
import { t } from '../i18n/index.js';

/** @typedef {import('#shared/query/classify.js').Intent} Intent */
/** @typedef {import('../core/dom.js').Child} Child */
/** @typedef {{ value: string, what: string, lang?: string, copy?: boolean, href?: string }} Line */

const MYANMAR_DIGIT = /[၀-၉]/;

/**
 * @param {Intent} intent  Anything but a lookup.
 * @param {string} typed
 * @returns {HTMLElement}
 */
export function answer(intent, typed) {
	switch (intent.kind) {
		case 'number':
			return number(intent, typed);
		case 'math':
			return sum(intent);
		case 'shares':
			return shares(intent);
		case 'ask':
			return page('?', intent.question, [
				section(
					t('which one?'),
					intent.options.map((o) => ({ value: o.label, what: t('It can be read two ways. Which did you mean?'), href: definitionHref(o.query), copy: false })),
				),
			]);
		case 'problem':
			return page('!', typed, [section(t('no answer'), [{ value: intent.message, what: t('Check the sum and try again.'), copy: false }])]);
		case 'time':
		case 'date':
			return clock(intent.kind);
		default:
			return page('?', typed, []);
	}
}

/**
 * The answer in the entry's form, with what says how it was worked out below it.
 * @param {string} mark  Shown in the round badge.
 * @param {string} headword
 * @param {Child[]} body  The timeline's sections, and anything after them.
 * @param {string} [lang]
 */
function page(mark, headword, body, lang) {
	return h(
		'div',
		{ class: 'definition definition-answer' },
		h(
			'article',
			{ class: 'entry answer' },
			h('header', { class: 'entry-head' }, h('span', { class: 'lang-badge', 'aria-hidden': 'true' }, mark), h('h1', { class: 'headword', lang: lang ?? null }, headword)),
			body,
		),
		h(
			'aside',
			{ class: 'entry-aside', 'aria-label': t('About this answer') },
			h('section', { class: 'aside-card' }, h('h2', null, t('Worked out here')), h('p', { class: 'aside-lead' }, t('This answer was worked out on your device. Nothing was sent, and it works offline.'))),
		),
	);
}

/**
 * One section of the timeline: what the answer is, and its readings.
 * @param {string} name
 * @param {Line[]} lines
 */
function section(name, lines) {
	return h('section', { class: 'pos' }, h('h2', { class: 'pos-name' }, name), h('ul', { class: 'senses answer-lines' }, lines.map(line)));
}

/** @param {Line} l */
function line(l) {
	const value = l.href ? h('a', { href: l.href }, l.value) : l.value;
	return h(
		'li',
		{ class: 'sense answer-line' },
		h('p', { class: 'gloss answer-value', lang: l.lang ?? null }, value, l.copy === false ? null : copyButton(l.value)),
		h('p', { class: 'answer-what' }, l.what),
	);
}

/** @param {string} text */
function copyButton(text) {
	const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'answer-copy', 'aria-label': t('Copy'), title: t('Copy') }, icon(ICONS.copy, 15)));
	b.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(text);
			b.replaceChildren(icon(ICONS.check, 15));
			b.title = t('Copied');
			setTimeout(() => {
				b.replaceChildren(icon(ICONS.copy, 15));
				b.title = t('Copy');
			}, 1500);
		} catch {
			b.title = t('Copying is not allowed here');
		}
	});
	return b;
}

/**
 * A number's readings: in the other digits, in Myanmar words (each way of
 * counting when there are several), in English words.
 * @param {import('#shared/query/digits.js').Decimal} d
 * @param {boolean} myanmarDigits  Typed in Myanmar digits: the other digits are Western.
 * @returns {Line[]}
 */
function readings(d, myanmarDigits) {
	const grouped = formatGrouped(d);
	/** @type {Line[]} */
	const out = [myanmarDigits ? { value: grouped, what: t('In Western digits') } : { value: toMyanmarDigits(grouped), what: t('Myanmar digits'), lang: 'my' }];
	try {
		const words = toMyanmarWords(d);
		for (const r of words) out.push({ value: r.text, what: words.length > 1 && r.scale ? `${t('In Myanmar')} · ${t('by {scale}', { scale: r.scale })}` : t('In Myanmar'), lang: 'my' });
	} catch {
		// too long to read in words
	}
	try {
		out.push({ value: toEnglishWords(d), what: t('In English'), lang: 'en' });
	} catch {
		// beyond the named English scales
	}
	return out;
}

/**
 * @param {Extract<Intent, { kind: 'number' }>} intent
 * @param {string} typed
 */
function number(intent, typed) {
	const d = /** @type {import('#shared/query/digits.js').Decimal} */ (parseDecimal(intent.value));
	const grouped = formatGrouped(d);
	const myanmar = MYANMAR_DIGIT.test(typed);
	return page('#', myanmar ? toMyanmarDigits(grouped) : grouped, [
		h('div', { class: 'timeline' }, section(t('number'), readings(d, myanmar))),
		// Typed as words ("one hundred"), the words may also be an entry.
		intent.source !== 'digits' ? h('p', { class: 'answer-escape' }, h('a', { href: `${definitionHref(typed)}&exact=1` }, t('Look up “{word}” in the dictionary', { word: typed }))) : null,
	], myanmar ? 'my' : undefined);
}

/** @param {Extract<Intent, { kind: 'math' }>} intent */
function sum(intent) {
	const shown = showValue(intent.value, intent.percent);
	const d = Number.isFinite(intent.value) && Math.abs(intent.value) < 1e15 && !intent.percent ? parseDecimal(String(intent.value)) : null;
	return page('=', shown, [
		h(
			'div',
			{ class: 'timeline' },
			section(t('sum'), [{ value: `${intent.expression} = ${shown}`, what: intent.note ? `${t('Worked out')} · ${intent.note}` : t('Worked out') }]),
			d ? section(t('number'), readings(d, false)) : null,
		),
	]);
}

/** @param {Extract<Intent, { kind: 'shares' }>} intent */
function shares(intent) {
	const total = formatNumber(intent.total);
	return page('%', t('Shares of {total}', { total }), [
		h(
			'div',
			{ class: 'timeline' },
			section(
				t('shares'),
				intent.numbers.map((n, i) => ({ value: `${formatNumber(n)} → ${showValue(intent.shares[i], true)}`, what: t('{part} of {total}', { part: formatNumber(n), total }) })),
			),
			section(t('total'), [{ value: total, what: '100%' }]),
		),
	]);
}

/**
 * The time and the date from the device's clock, kept current while the
 * page is open.
 * @param {'time' | 'date'} kind
 */
function clock(kind) {
	const now = () => new Date();
	const digits = (/** @type {Date} */ d) => (kind === 'time' ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }));
	/** @param {Date} d */
	const sections = (d) => {
		const time = timeWords(d);
		const date = dateWords(d);
		const timeLines = [
			{ value: time.en, what: t('In English'), lang: 'en' },
			{ value: time.my, what: t('In Myanmar'), lang: 'my' },
		];
		const dateLines = [
			{ value: date.en, what: t('In English'), lang: 'en' },
			{ value: date.my, what: t('In Myanmar'), lang: 'my' },
		];
		return kind === 'time' ? [section(t('time'), timeLines), section(t('date'), dateLines)] : [section(t('date'), dateLines), section(t('time'), timeLines)];
	};
	const first = now();
	const timeline = h('div', { class: 'timeline' }, sections(first));
	const node = page(kind === 'time' ? '◷' : '▦', digits(first), [timeline, h('p', { class: 'answer-escape notice' }, t('From your device’s clock.'))]);
	const title = /** @type {HTMLElement} */ (node.querySelector('.headword'));
	// Kept current while the page is open; stops once the page is left.
	const timer = window.setInterval(() => {
		if (!node.isConnected) return window.clearInterval(timer);
		const d = now();
		title.textContent = digits(d);
		timeline.replaceChildren(...sections(d));
	}, 10_000);
	return node;
}
