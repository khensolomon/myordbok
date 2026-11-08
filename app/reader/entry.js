// @ts-check
/**
 * Definition page: /definition?q=word
 *
 * What was typed is read first, in the browser (shared/query): a number, a
 * sum, the time or the date is answered here (answer.js) without asking the
 * dictionary; a question around a word ("what is love") moves to the word's
 * own address, keeping the question (asked=) to say how it was read.
 * exact=1 skips the reading and looks up the text as typed.
 *
 * Senses grouped by part of speech: an open timeline on wide screens and one
 * card per part of speech on phones (CSS decides, the markup is the same).
 * Below the senses: forms, synonyms and other related words.
 *
 * A word with no senses of its own that is a form of another (went → go)
 * shows the root's entry under a line saying so.
 *
 * A phrase that is not an entry ("king of Denmark", "big house") is read
 * from its words' entries: the Myanmar of the whole phrase,
 * made in Myanmar word order and labelled as made, then each word's sense
 * that fits, on the same timeline.
 *
 * Which of these a query is comes from one request (/api/read), so a slow
 * connection waits once.
 *
 * Words the dictionary does not have: a sentence is shown one word at a time
 * (&w=index), each fetched only when opened, so a slow connection loads one
 * small result at a time; a single word gets "did you mean", words starting
 * the same way, and a way to suggest it.
 */
import { splitExamples } from '#shared/markup.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { renderMarkup } from '../core/markup.js';
import { REPOSITORY } from '../core/config.js';
import { definitionHref } from '../core/routes.js';
import { lookup, read, remember, savingData, spelling } from '../data/api.js';
import { classify, understoodHref } from './query.js';

/** @typedef {import('#shared/types.js').EnglishResult} EnglishResult */
/** @typedef {import('#shared/types.js').MyanmarResult} MyanmarResult */

/** Roots shown in full under a form (went → go); more are listed as links. */
const ROOTS_SHOWN = 2;

/** Ids of the related-word rows a question can point to (#synonyms). */
const FOCUS_ROWS = /** @type {Record<string, string>} */ ({ Forms: 'forms', Synonyms: 'synonyms', Opposite: 'opposite' });
const NOT_LISTED = /** @type {Record<string, string>} */ ({
	forms: 'No other forms are listed for it yet.',
	synonyms: 'No similar words are listed for it yet.',
	opposite: 'No opposites are listed for it yet.',
});

/** @param {import('../core/routes.js').ViewContext} ctx */
export function title(ctx) {
	return ctx.query.get('q') ?? 'Definition';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const q = (ctx.query.get('q') ?? '').trim();
	if (!q) return h('section', { class: 'page' }, h('p', { class: 'notice' }, 'Type a word to look it up.'));
	const asked = ctx.query.get('asked');
	const at = ctx.query.get('w');

	if (ctx.query.get('exact') !== '1' && !asked && at === null) {
		const intent = classify(q);
		if (intent.kind !== 'lookup') return (await import('./answer.js')).answer(intent, q);
		if (intent.understood) {
			ctx.replace(understoodHref(intent, q));
			return h('div');
		}
	}

	// One request decides what the query is (worker/routes/read.js).
	const reading = await read(q);
	switch (reading.kind) {
		case 'entry':
			return (await result(reading.result, asked)) ?? missing(q, { close: [], starts: [] });
		case 'phrase':
			return phraseView(reading.phrase, asked);
		case 'sentence':
			// The first word came with the reading; it is not fetched again.
			if (reading.first) remember(reading.words[0].text, reading.first);
			return sentence(q, reading.words, at === null ? 0 : Number(at) || 0);
		default:
			return missing(q, reading);
	}
}

/**
 * The entry for a lookup, or null when the dictionary has nothing for it.
 * @param {import('#shared/types.js').LookupResult} data
 * @param {string | null} [asked]  The question it was read from.
 */
async function result(data, asked) {
	if (data.language === 'my') {
		if (!data.entries.length) return null;
		return withAside(
			h('article', { class: 'entry', lang: 'my' }, myanmarHead(data), understood(data.query, asked), timeline(groupByType(data.entries), 'en', data.query)),
			aside(data.query, lead(data.query, data.entries), data.entries),
		);
	}
	return english(data, asked);
}

/**
 * "Showing love for what is love", with the way back to the text as typed,
 * and a word when the part asked about (#synonyms) is not in the entry.
 * @param {string} word
 * @param {string | null | undefined} asked
 * @param {HTMLElement | null} [rel]  The entry's related words, if any.
 * @param {string[]} [notes]  How words were read ("danmark" read as "Denmark").
 */
function understood(word, asked, rel, notes = []) {
	if (!asked && !notes.length) return null;
	const focus = decodeURIComponent(location.hash.slice(1));
	const name = Object.entries(FOCUS_ROWS).find(([, id]) => id === focus)?.[0];
	const absent = name && !rel?.querySelector(`#${focus}`);
	return h(
		'p',
		{ class: 'entry-note understood' },
		asked ? `Showing “${word}” for “${asked}”. ` : null,
		notes.map((n) => `${n} `),
		absent ? `${NOT_LISTED[focus]} ` : null,
		asked ? h('a', { href: `${definitionHref(asked)}&exact=1` }, `Search for “${asked}” as typed`) : null,
	);
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

/**
 * @param {EnglishResult} data
 * @param {string | null} [asked]
 */
async function english(data, asked) {
	const roots = [...new Set(data.forms_of.map(([root]) => root))];
	if (!data.entries.length && !roots.length) return null;

	const rel = data.entries.length ? related(data) : null;
	/** @type {import('../core/dom.js').Child[]} */
	const notes = [understood(data.query, asked, rel)];
	if (data.variant_of.length) notes.push(h('p', { class: 'entry-note' }, 'A spelling of ', wordLinks(data.variant_of), '.'));
	if (roots.length) notes.push(formNote(data));
	/** Senses on the page, for the summary beside it. */
	let shown = data.entries;
	let summary = lead(data.query, data.entries);
	/** @type {import('../core/dom.js').Child[]} */
	const blocks = [];

	if (data.entries.length) {
		blocks.push(...bySpelling(data.entries).map(([word, senses], i) => wordBlock(word, senses, { first: i === 0 })), rel);
	} else {
		// Only a form of other words: the roots that have senses, each a headword of its own.
		const withSenses = roots.filter((r) => (data.root_senses[r] ?? 0) > 0).slice(0, ROOTS_SHOWN);
		const results = await Promise.all(withSenses.map((r) => lookup(r)));
		const found = results.filter((r) => r.language === 'en' && r.entries.length);
		shown = found.flatMap((r) => (r.language === 'en' ? r.entries : []));
		const [rootWord, pos, form] = data.forms_of[0];
		summary = `“${data.query}” is the ${form}${pos ? ` (${pos})` : ''} of “${rootWord}”.${found.length === 1 ? ` ${lead(found[0].query, shown)}` : ''}`;
		found.forEach((root, n) => {
			if (root.language !== 'en') return;
			bySpelling(root.entries).forEach(([word, senses], i) => blocks.push(wordBlock(word, senses, { first: n === 0 && i === 0, link: true })));
			blocks.push(related(root));
		});
	}
	const word = data.entries[0]?.word ?? data.query;
	return withAside(h('article', { class: 'entry', lang: 'en' }, notes, blocks), aside(word, summary, shown));
}

/**
 * Senses grouped by the spelling they belong to, in the order found: a
 * search for "god" finds both "God" and "god", and each is its own headword.
 * @template {{ word: string }} S
 * @param {S[]} senses
 * @returns {Array<[string, S[]]>}
 */
function bySpelling(senses) {
	/** @type {Map<string, S[]>} */
	const groups = new Map();
	for (const s of senses) {
		const list = groups.get(s.word) ?? [];
		list.push(s);
		groups.set(s.word, list);
	}
	return [...groups];
}

/**
 * One headword as the dataset spells it, with its senses on the timeline.
 * The first on a page is the page's h1.
 * @param {string} word
 * @param {import('#shared/types.js').EnglishSense[]} senses
 * @param {{ first?: boolean, link?: boolean, fit?: import('#shared/types.js').EnglishSense | null, fitLabel?: string }} [options]
 *   link: the headword links to its own page; fit: the sense that fits a
 *   phrase, shown first and marked with fitLabel.
 */
function wordBlock(word, senses, options = {}) {
	const { first = false, link = false, fit = null, fitLabel = '' } = options;
	const ordered = fit ? [fit, ...senses.filter((s) => s !== fit)] : senses;
	const name = link ? h('a', { href: definitionHref(word) }, word) : word;
	return h(
		'section',
		{ class: 'entry-block' },
		h('header', { class: 'entry-head' },
			h('span', { class: 'lang-badge', 'aria-label': 'English' }, 'en'),
			h(first ? 'h1' : 'h2', { class: 'headword' }, name)),
		timeline(groupByType(ordered), 'my', word, fit, fitLabel),
	);
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
 * @param {object | null} [fit]  The sense that fits a phrase, marked.
 * @param {string} [fitLabel]
 */
function timeline(groups, glossLang, headword, fit = null, fitLabel = '') {
	return h(
		'div',
		{ class: 'timeline' },
		groups.map(([type, senses]) =>
			h(
				'section',
				{ class: 'pos' },
				h('h2', { class: 'pos-name' }, type.toLowerCase()),
				h('ul', { class: 'senses' }, senses.map((s) => sense(s, glossLang, headword, s === fit ? fitLabel : ''))),
			),
		),
	);
}

/**
 * @param {import('#shared/types.js').EnglishSense | import('#shared/types.js').MyanmarSense} s
 * @param {'en' | 'my'} glossLang
 * @param {string} headword
 * @param {string} [fitLabel]  Marks the sense that fits a phrase.
 */
function sense(s, glossLang, headword, fitLabel = '') {
	const kind = 'kind' in s ? kindBadge(s.kind) : null;
	const fits = fitLabel ? h('span', { class: 'kind kind-fit' }, fitLabel) : null;
	const etymology = 'etymology' in s && s.etymology ? h('p', { class: 'etymology' }, renderMarkup(s.etymology)) : null;
	return h(
		'li',
		{ class: fitLabel ? 'sense sense-fit' : 'sense' },
		h('p', { class: 'gloss', lang: glossLang }, fits, kind, renderMarkup(s.sense ?? '', { headword })),
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
	// "similar word of love" points at #synonyms: Similar answers it when there are no synonyms.
	const ids = { ...FOCUS_ROWS, ...(data.synonyms.length ? {} : { Similar: 'synonyms' }) };
	if (!rows.length) return null;
	return h('dl', { class: 'related' }, rows.flatMap(([name, value]) => [h('dt', { id: ids[name] }, name), h('dd', null, value)]));
}

/**
 * A phrase read from its words: each word the dataset has is a headword of
 * its own, with the sense that fits the phrase first and marked; the
 * phrase and its Myanmar reading are beside them.
 * @param {import('#shared/types.js').Phrase} read
 * @param {string | null} asked
 */
function phraseView(read, asked) {
	const words = read.parts.map((p) => p.word);
	const title = read.pattern === 'of' ? `${words[0]} of ${words.slice(1).join(' ')}` : words.join(' ');
	const notes = read.parts
		.filter((p) => p.note)
		.map((p) => (p.note === 'spelling' ? `“${p.term}” read as “${p.word}”.` : `“${p.term}” is a form of “${p.word}”.`));
	const intro = h(
		'p',
		{ class: 'entry-note understood' },
		`“${title}” is not an entry of its own; here are its words. `,
		asked ? `Read from “${asked}”. ` : null,
		notes.map((n) => `${n} `),
		asked ? h('a', { href: `${definitionHref(asked)}&exact=1` }, `Search for “${asked}” as typed`) : null,
	);
	let first = true;
	const blocks = read.parts.flatMap((p) => {
		if (!p.entries.length) {
			return h('section', { class: 'entry-block' },
				h('header', { class: 'entry-head' }, h('span', { class: 'lang-badge', 'aria-label': 'English' }, 'en'), h('h2', { class: 'headword headword-none' }, p.term)),
				h('p', { class: 'notice phrase-none' }, `The dictionary has no entry for “${p.term}”.`));
		}
		const fit = p.fit >= 0 ? p.entries[p.fit] : null;
		return bySpelling(p.entries).map(([word, senses]) => {
			const own = fit && senses.includes(fit) ? fit : null;
			const block = wordBlock(word, senses, { first, link: true, fit: own, fitLabel: own ? title : '' });
			first = false;
			return block;
		});
	});
	const side = h(
		'aside',
		{ class: 'entry-aside', 'aria-label': 'About this phrase' },
		h('section', { class: 'aside-card' },
			h('h2', null, 'The phrase'),
			h('p', { class: 'aside-phrase' }, title),
			read.myanmar ? h('p', { class: 'aside-phrase-my', lang: 'my' }, read.myanmar) : null,
			h('p', { class: 'aside-quiet' }, read.myanmar
				? `Put together from the marked meanings of ${words.map((w) => `“${w}”`).join(' and ')}, in Myanmar word order: a reading, not a checked translation.`
				: `Read from the entries for ${words.map((w) => `“${w}”`).join(' and ')}.`)),
		h('section', { class: 'aside-card' },
			h('h2', null, 'Should it be an entry?'),
			h('div', { class: 'aside-actions' },
				h('button', { type: 'button', class: 'aside-suggest', disabled: true, title: 'Suggesting needs a sign-in' }, icon(ICONS.suggest, 18), 'Suggest this phrase')),
			h('p', { class: 'aside-quiet' }, 'Suggesting needs a sign-in, which arrives soon.')),
	);
	return withAside(h('article', { class: 'entry phrase', lang: 'en' }, intro, blocks), side);
}

/**
 * A sentence, one word at a time: the words as links, the current word's
 * entry, and the next and previous words. Only the word shown is fetched; the
 * next is fetched ahead unless the reader is saving data.
 * Myanmar text arrives split into headwords; syllables no headword covers
 * are marked as such.
 * @param {string} q
 * @param {Array<{ text: string, known?: boolean }>} list
 * @param {number} index
 */
async function sentence(q, list, index) {
	const words = list.map((w) => w.text);
	const i = Math.min(Math.max(0, Math.trunc(index)), words.length - 1);
	const word = words[i];
	const at = (/** @type {number} */ n) => `${definitionHref(q)}&w=${n}`;
	const next = words[i + 1];
	if (next && list[i + 1].known !== false && !savingData()) lookup(next).catch(() => {});

	const entry = list[i].known === false
		? h('p', { class: 'notice no-result inline' }, `“${word}” is not a word in the dictionary.`)
		: ((await result(await lookup(word))) ?? (await missing(word, null, { inline: true })));
	const pager = h(
		'nav',
		{ class: 'sentence-pager', 'aria-label': 'Words of the sentence' },
		i > 0 ? h('a', { href: at(i - 1), rel: 'prev' }, `← ${words[i - 1]}`) : h('span'),
		h('span', { class: 'sentence-count' }, `${i + 1} of ${words.length}`),
		next ? h('a', { href: at(i + 1), rel: 'next' }, `${next} →`) : h('span'),
	);
	return h(
		'div',
		{ class: 'sentence' },
		h(
			'header',
			{ class: 'sentence-head' },
			h('p', { class: 'sentence-text' }, h('span', { class: 'sentence-label' }, 'Sentence'), ' ', q),
			h('ol', { class: 'chips sentence-words' }, list.map((w, n) => h('li', null, h('a', { href: at(n), 'aria-current': n === i ? 'true' : null, class: w.known === false ? 'unknown' : null, lang: /[\u1000-\u109f]/.test(w.text) ? 'my' : null }, w.text)))),
		),
		entry,
		pager,
	);
}

/**
 * Nothing for `q`: "did you mean", words starting the same way, and a way to
 * ask for it. Inline (a word of a sentence), a shorter version that fetches
 * its own "did you mean".
 * @param {string} q
 * @param {{ close: string[], starts: string[] } | null} found  From the reading.
 * @param {{ inline?: boolean }} [options]
 */
async function missing(q, found, options = {}) {
	const near = found ?? { close: (await spelling(q).catch(() => ({ words: [] }))).words.filter((w) => w.toLowerCase() !== q.toLowerCase()), starts: [] };
	const close = near.close;
	const prefix = near.starts;
	/** @param {string[]} words */
	const chips = (words) => h('ul', { class: 'chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w) }, w))));
	const issue = `${REPOSITORY}/issues/new?title=${encodeURIComponent(`Add “${q}”`)}&body=${encodeURIComponent(`The dictionary has no entry for “${q}”.\n\nMeaning, example or source:\n`)}`;

	return h(
		'section',
		{ class: options.inline ? 'no-result inline' : 'page no-result' },
		h(options.inline ? 'h2' : 'h1', { class: 'notice-title' }, `No entry for “${q}”`),
		close.length ? h('div', { class: 'no-result-part' }, h('p', null, 'Did you mean'), chips(close)) : null,
		prefix.length ? h('div', { class: 'no-result-part' }, h('p', null, `Words that start like “${q}”`), chips(prefix)) : null,
		!close.length && !prefix.length ? h('p', { class: 'notice' }, 'Check the spelling, or try the root form of the word.') : null,
		options.inline
			? null
			: h(
					'div',
					{ class: 'aside-card no-result-ask' },
					h('h2', null, 'We don’t have it yet'),
					h('p', { class: 'aside-lead' }, `Would you like to suggest “${q}” for the dictionary?`),
					h(
						'div',
						{ class: 'aside-actions' },
						h('button', { type: 'button', class: 'aside-suggest', disabled: true, title: 'Suggesting a word needs a sign-in' }, icon(ICONS.suggest, 18), 'Suggest this word'),
						h('a', { href: issue, target: '_blank', rel: 'noopener' }, 'Or tell us on GitHub'),
					),
					h('p', { class: 'aside-quiet' }, 'Suggesting in the app needs a sign-in, which arrives soon.'),
				),
	);
}
