// @ts-check
/**
 * Definition page: /definition?q=word
 * Senses grouped by part of speech: an open timeline on wide screens and one
 * card per part of speech on phones (CSS decides, the markup is the same).
 * Below the senses: forms, synonyms and other related words.
 *
 * A word with no senses of its own that is a form of another (went → go)
 * shows the root's entry under a line saying so.
 */
import { splitExamples } from '#shared/markup.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { renderMarkup } from '../core/markup.js';
import { definitionHref } from '../core/routes.js';
import { lookup, suggest } from '../data/api.js';

/** @typedef {import('#shared/types.js').EnglishResult} EnglishResult */
/** @typedef {import('#shared/types.js').MyanmarResult} MyanmarResult */

/** Roots shown in full under a form (went → go); more are listed as links. */
const ROOTS_SHOWN = 2;

/** @param {import('../core/routes.js').ViewContext} ctx */
export function title(ctx) {
	return ctx.query.get('q') ?? 'Definition';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const q = (ctx.query.get('q') ?? '').trim();
	if (!q) return h('section', { class: 'page' }, h('p', { class: 'notice' }, 'Type a word to look it up.'));

	const data = await lookup(q);
	if (data.language === 'my') {
		if (!data.entries.length) return missing(data.query);
		return withAside(
			h('article', { class: 'entry', lang: 'my' }, myanmarHead(data), timeline(groupByType(data.entries), 'en', data.query)),
			aside(data.query, lead(data.query, data.entries), data.entries),
		);
	}
	return english(data);
}

/**
 * The definition and, beside it on large screens (below it otherwise), what
 * the result holds and a place to react or suggest.
 * @param {HTMLElement} article
 * @param {HTMLElement} side
 */
function withAside(article, side) {
	return h('div', { class: 'definition' }, article, side);
}

/** @param {EnglishResult} data */
async function english(data) {
	const roots = [...new Set(data.forms_of.map(([root]) => root))];
	if (!data.entries.length && !roots.length) return missing(data.query);

	/** @type {import('../core/dom.js').Child[]} */
	const body = [];
	/** Senses on the page, for the summary beside it. */
	let shown = data.entries;
	/** @type {string} */
	let summary = lead(data.query, data.entries);
	if (data.variant_of.length) {
		body.push(h('p', { class: 'entry-note' }, 'A spelling of ', wordLinks(data.variant_of), '.'));
	}
	if (roots.length) body.push(formNote(data));

	if (data.entries.length) {
		body.push(timeline(groupByType(data.entries), 'my', data.query), related(data));
	} else {
		// Only a form of other words: show the roots that have senses.
		const withSenses = roots.filter((r) => (data.root_senses[r] ?? 0) > 0).slice(0, ROOTS_SHOWN);
		const results = await Promise.all(withSenses.map((r) => lookup(r)));
		const found = results.filter((r) => r.language === 'en' && r.entries.length);
		shown = found.flatMap((r) => (r.language === 'en' ? r.entries : []));
		const [rootWord, pos, form] = data.forms_of[0];
		summary = `“${data.query}” is the ${form}${pos ? ` (${pos})` : ''} of “${rootWord}”.${found.length === 1 ? ` ${lead(found[0].query, shown)}` : ''}`;
		for (const root of results) {
			if (root.language !== 'en' || !root.entries.length) continue;
			body.push(
				h('section', { class: 'root' },
					h('h2', { class: 'root-word' }, h('a', { href: definitionHref(root.query) }, root.query)),
					timeline(groupByType(root.entries), 'my', root.query),
					related(root)),
			);
		}
	}
	return withAside(h('article', { class: 'entry', lang: 'en' }, englishHead(data.query), body), aside(data.query, summary, shown));
}

/**
 * One sentence: how many meanings, as which parts of speech.
 * @param {string} word
 * @param {Array<{ type: string }>} senses
 */
function lead(word, senses) {
	const types = [...new Set(senses.map((s) => s.type.toLowerCase()))].map((t) => `${/^[aeiou]/.test(t) ? 'an' : 'a'} ${t}`);
	const list = types.length > 1 ? `${types.slice(0, -1).join(', ')} and ${types.at(-1)}` : types[0];
	const n = senses.length;
	return `“${word}” has ${n} meaning${n === 1 ? '' : 's'} as ${list}.`;
}

/**
 * @param {string} word
 * @param {string} summary
 * @param {Array<{ type: string, kind?: string }>} senses
 */
function aside(word, summary, senses) {
	const kinds = senses.map((s) => s.kind ?? 'Active');
	const drafts = kinds.filter((k) => k === 'Draft').length;
	const awaiting = kinds.filter((k) => /awaiting/i.test(k)).length;
	/** @param {number} n @param {string} one @param {string} many */
	const count = (n, one, many) => `${n} meaning${n === 1 ? ` ${one}` : `s ${many}`}.`;
	return h(
		'aside',
		{ class: 'entry-aside', 'aria-label': 'About this result' },
		h(
			'section',
			{ class: 'aside-card' },
			h('h2', null, 'About this entry'),
			h('p', { class: 'aside-lead' }, summary),
			awaiting || drafts
				? h(
						'ul',
						{ class: 'aside-facts' },
						awaiting ? h('li', null, kindBadge('Checked: awaiting native review'), ' ', count(awaiting, 'is checked and waits for a native speaker’s review', 'are checked and wait for a native speaker’s review')) : null,
						drafts ? h('li', null, kindBadge('Draft'), ' ', count(drafts, 'is a draft, not yet checked', 'are drafts, not yet checked')) : null,
					)
				: h('p', { class: 'aside-quiet' }, 'Every meaning here has been reviewed.'),
		),
		h(
			'section',
			{ class: 'aside-card' },
			h('h2', null, 'Is this helpful?'),
			h(
				'div',
				{ class: 'aside-actions' },
				iconButton(ICONS.like, `Like “${word}”`),
				iconButton(ICONS.dislike, `Dislike “${word}”`),
				h('button', { type: 'button', class: 'aside-suggest', disabled: true, title: 'Suggest a correction or a new meaning' }, icon(ICONS.suggest, 18), 'Suggest a correction'),
			),
			h('p', { class: 'aside-quiet' }, 'Liking, commenting and suggesting need a sign-in, which arrives soon.'),
		),
	);
}

/**
 * @param {string} paths  Icon from ICONS.
 * @param {string} label  Shown as the hint and read by screen readers.
 */
function iconButton(paths, label) {
	return h('button', { type: 'button', class: 'aside-icon', 'aria-label': label, title: label, disabled: true }, icon(paths, 20));
}

/** @param {string} word */
function englishHead(word) {
	return h(
		'header',
		{ class: 'entry-head' },
		h('span', { class: 'lang-badge', 'aria-label': 'English' }, 'en'),
		h('h1', { class: 'headword' }, word),
	);
}

/** @param {MyanmarResult} data */
function myanmarHead(data) {
	const [ipa, mlc] = data.pronunciation ?? [null, null];
	return h(
		'header',
		{ class: 'entry-head' },
		h('span', { class: 'lang-badge', 'aria-label': 'Myanmar' }, 'my'),
		h('div', null,
			h('h1', { class: 'headword' }, data.query),
			ipa || mlc
				? h('p', { class: 'pron', lang: 'en' },
					ipa ? h('span', { title: 'IPA' }, `/${ipa}/`) : null,
					mlc ? h('span', { title: 'MLC transcription' }, mlc) : null)
				: null),
	);
}

/**
 * "went: past of go".
 * @param {EnglishResult} data
 */
function formNote(data) {
	/** @type {Map<string, string[]>} */
	const byRoot = new Map();
	for (const [root, pos, form] of data.forms_of) {
		const list = byRoot.get(root) ?? [];
		list.push(`${form}${pos ? ` (${pos})` : ''}`);
		byRoot.set(root, list);
	}
	return h(
		'ul',
		{ class: 'entry-note form-of' },
		[...byRoot].map(([root, forms]) =>
			h('li', null, `${forms.join(', ')} of `, h('a', { href: definitionHref(root) }, root))),
	);
}

/**
 * @template {{ type: string }} S
 * @param {S[]} senses  In display order.
 * @returns {Array<[string, S[]]>}  Parts of speech in order of first appearance.
 */
function groupByType(senses) {
	/** @type {Map<string, S[]>} */
	const groups = new Map();
	for (const s of senses) {
		const list = groups.get(s.type) ?? [];
		list.push(s);
		groups.set(s.type, list);
	}
	return [...groups];
}

/**
 * @param {Array<[string, Array<import('#shared/types.js').EnglishSense | import('#shared/types.js').MyanmarSense>]>} groups
 * @param {'en' | 'my'} glossLang  Language of the glosses.
 * @param {string} headword
 */
function timeline(groups, glossLang, headword) {
	return h(
		'div',
		{ class: 'timeline' },
		groups.map(([type, senses]) =>
			h(
				'section',
				{ class: 'pos' },
				h('h2', { class: 'pos-name' }, type.toLowerCase()),
				h('ul', { class: 'senses' }, senses.map((s) => sense(s, glossLang, headword))),
			),
		),
	);
}

/**
 * @param {import('#shared/types.js').EnglishSense | import('#shared/types.js').MyanmarSense} s
 * @param {'en' | 'my'} glossLang
 * @param {string} headword
 */
function sense(s, glossLang, headword) {
	const kind = 'kind' in s ? kindBadge(s.kind) : null;
	const etymology = 'etymology' in s && s.etymology ? h('p', { class: 'etymology' }, renderMarkup(s.etymology)) : null;
	return h(
		'li',
		{ class: 'sense' },
		h('p', { class: 'gloss', lang: glossLang }, kind, renderMarkup(s.sense ?? '', { headword })),
		s.example
			? splitExamples(s.example).map((ex) => h('p', { class: 'example', lang: glossLang === 'my' ? 'en' : 'my' }, renderMarkup(ex, { headword })))
			: null,
		etymology,
	);
}

/**
 * Anything but an active sense says what it is: a draft, a sense awaiting
 * review, or a label such as an idiom.
 * @param {string} kind
 */
function kindBadge(kind) {
	if (kind === 'Active') return null;
	const awaiting = /awaiting/i.test(kind);
	return h(
		'span',
		{ class: `kind kind-${kind === 'Draft' ? 'draft' : awaiting ? 'review' : 'label'}`, title: kind },
		awaiting ? 'awaiting review' : kind.toLowerCase(),
	);
}

/** @param {string[]} words */
function wordLinks(words) {
	return words.flatMap((w, i) => [i ? ', ' : null, h('a', { href: definitionHref(w) }, w)]);
}

/**
 * Forms and related words, as a compact list of rows.
 * @param {EnglishResult} data
 */
function related(data) {
	/** @type {Array<[string, import('../core/dom.js').Child[]]>} */
	const rows = [];
	if (data.forms.length) {
		/** @type {Map<string, string[]>} */
		const byPos = new Map();
		for (const [word, pos] of data.forms) {
			const list = byPos.get(pos) ?? [];
			if (!list.includes(word)) list.push(word);
			byPos.set(pos, list);
		}
		rows.push(['Forms', [...byPos].map(([pos, words]) => h('span', { class: 'forms' }, h('em', null, pos), ' ', wordLinks(words)))]);
	}
	/** @type {Array<[string, string[]]>} */
	const lists = [
		['Synonyms', data.synonyms],
		['Similar', data.similar],
		['Broader', data.broader],
		['Opposite', data.opposite],
		['Related', data.related],
	];
	for (const [name, words] of lists) if (words.length) rows.push([name, wordLinks(words)]);
	if (!rows.length) return null;
	return h('dl', { class: 'related' }, rows.flatMap(([name, value]) => [h('dt', null, name), h('dd', null, value)]));
}

/** @param {string} q */
async function missing(q) {
	const { words } = await suggest(q).catch(() => ({ words: /** @type {string[]} */ ([]) }));
	return h(
		'section',
		{ class: 'page' },
		h('h1', { class: 'notice-title' }, `No entry for “${q}”`),
		words.length
			? h('div', null, h('p', null, 'Words that start the same way:'), h('ul', { class: 'chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w) }, w)))))
			: h('p', null, 'Check the spelling, or try the root form of the word.'),
	);
}
