// @ts-check
/**
 * Definition page: /definition?q=word; with no word, how to search (guide.js).
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
import { getLang, list, mark, posName, t, tn, tx } from '../i18n/index.js';
import { definitionHref } from '../core/routes.js';
import { lookup, read, remember, savingData, spelling } from '../data/api.js';
import { entryFeedback } from './contribute.js';
import { commentsSection } from './comments.js';
import { addRecent } from '../data/recent.js';
import { classify, understoodHref } from './query.js';

/** @typedef {import('#shared/types.js').EnglishResult} EnglishResult */
/** @typedef {import('#shared/types.js').MyanmarResult} MyanmarResult */

/** Roots shown in full under a form (went → go); more are listed as links. */
const ROOTS_SHOWN = 2;

/** Ids of the related-word rows a question can point to (#synonyms). */
const FOCUS_ROWS = /** @type {Record<string, string>} */ ({ Forms: 'forms', Synonyms: 'synonyms', Opposite: 'opposite' });
const NOT_LISTED = /** @type {Record<string, string>} */ ({
	forms: mark('No other forms are listed for it yet.'),
	synonyms: mark('No similar words are listed for it yet.'),
	opposite: mark('No opposites are listed for it yet.'),
});

/** @param {import('../core/routes.js').ViewContext} ctx */
export function title(ctx) {
	return ctx.query.get('q')?.trim() || t('How to search');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const q = (ctx.query.get('q') ?? '').trim();
	if (!q) return (await import('./guide.js')).guide();
	addRecent(q);
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

	// One request decides what the query is (worker/routes/read.js); offline, the device (read-offline.js).
	const reading = await read(q);
	/** A phrase, a sentence or nothing read on the device says so, as an entry does. @param {Node} node */
	const marked = (node) => {
		const note = offlineNote(reading);
		if (note && node instanceof HTMLElement) node.prepend(note);
		return node;
	};
	switch (reading.kind) {
		case 'entry':
			return (await result(reading.result, asked)) ?? missing(q, { close: [], starts: [] });
		case 'phrase':
			return marked(phraseView(reading.phrase, asked));
		case 'sentence':
			// The first word came with the reading; it is not fetched again.
			if (reading.first) remember(reading.words[0].text, reading.first);
			return marked(await sentence(q, reading.words, at === null ? 0 : Number(at) || 0));
		default:
			return marked(await missing(q, reading));
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
		const feedback = entryFeedback('my', data.query);
		const article = h('article', { class: 'entry', lang: 'my' }, offlineNote(data), myanmarHead(data), understood(data.query, asked), timeline(groupByType(data.entries), 'en', data.query));
		feedback.wire(article, data.entries.map((e) => ({ ...e, word: data.query })), 'en');
		if (!(/** @type {{ offline?: boolean }} */ (data).offline)) article.append(commentsSection('my', data.query));
		return withAside(article, aside(feedback, lead(data.query, data.entries), data.entries));
	}
	return english(data, asked);
}

/**
 * Said when an answer comes from the copy on this device, not the server.
 * @param {object} result  A lookup result; offline.js marks those from the device.
 */
function offlineNote(result) {
	const data = /** @type {{ offline?: boolean, build?: string }} */ (result);
	if (!data.offline) return null;
	return h('p', { class: 'entry-note offline-note', role: 'status' }, t('No connection: this is the copy on this device (build {build}).', { build: data.build ?? '?' }), ' ', h('a', { href: '/workspace?s=offline' }, t('Offline copy')));
}

/**
 * "Showing love for what is love", with the way back to the text as typed,
 * and a word when the part asked about (#synonyms) is not in the entry.
 * @param {string} word
 * @param {string | null | undefined} asked
 * @param {Set<string> | null} [present]  The parts a question can point to that the entry has (forms, synonyms, opposite).
 * @param {string[]} [notes]  How words were read ("danmark" read as "Denmark").
 */
function understood(word, asked, present, notes = []) {
	if (!asked && !notes.length) return null;
	const focus = decodeURIComponent(location.hash.slice(1));
	const name = Object.entries(FOCUS_ROWS).find(([, id]) => id === focus)?.[0];
	const absent = name && !present?.has(focus);
	return h(
		'p',
		{ class: 'entry-note understood' },
		asked ? `${t('Showing “{word}” for “{asked}”.', { word, asked })} ` : null,
		notes.map((n) => `${n} `),
		absent ? `${t(NOT_LISTED[focus])} ` : null,
		asked ? h('a', { href: `${definitionHref(asked)}&exact=1` }, t('Search for “{asked}” as typed', { asked })) : null,
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

	const extra = data.entries.length ? extras(data) : null;
	/** @type {import('../core/dom.js').Child[]} */
	const notes = [offlineNote(data), understood(data.query, asked, extra?.present ?? null)];
	if (data.variant_of.length) notes.push(h('p', { class: 'entry-note' }, tx('A spelling of {words}.', { words: h('span', null, wordLinks(data.variant_of)) })));
	if (roots.length) notes.push(formNote(data));
	/** Senses on the page, for the summary beside it. */
	let shown = data.entries;
	let summary = lead(data.query, data.entries);
	/** @type {import('../core/dom.js').Child[]} */
	const blocks = [];

	if (data.entries.length) {
		// Forms and related words belong to the word asked for: its first spelling's timeline.
		blocks.push(...bySpelling(data.entries).map(([word, senses], i) => wordBlock(word, senses, { first: i === 0, extra: i === 0 ? extra : null })));
	} else {
		// Only a form of other words: the roots that have senses, each a headword of its own.
		const withSenses = roots.filter((r) => (data.root_senses[r] ?? 0) > 0).slice(0, ROOTS_SHOWN);
		const results = await Promise.all(withSenses.map((r) => lookup(r)));
		const found = results.filter((r) => r.language === 'en' && r.entries.length);
		shown = found.flatMap((r) => (r.language === 'en' ? r.entries : []));
		const [rootWord, pos, form] = data.forms_of[0];
		summary = `${t('“{word}” is the {form} of “{root}”.', { word: data.query, form: `${form}${pos ? ` (${pos})` : ''}`, root: rootWord })}${found.length === 1 ? ` ${lead(found[0].query, shown)}` : ''}`;
		found.forEach((root, n) => {
			if (root.language !== 'en') return;
			const more = extras(root);
			bySpelling(root.entries).forEach(([word, senses], i) => blocks.push(wordBlock(word, senses, { first: n === 0 && i === 0, link: true, extra: i === 0 ? more : null })));
		});
	}
	// A form shows its root's senses, so feedback is about the root (went → go).
	const word = shown[0]?.word ?? data.query;
	const feedback = entryFeedback('en', word);
	const article = h('article', { class: 'entry', lang: 'en' }, notes, blocks);
	feedback.wire(article, shown, 'my');
	if (!(/** @type {{ offline?: boolean }} */ (data).offline)) article.append(commentsSection('en', word));
	return withAside(article, aside(feedback, summary, shown));
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
 * @param {{ first?: boolean, link?: boolean, fit?: import('#shared/types.js').EnglishSense | null, fitLabel?: string, extra?: Extras | null }} [options]
 *   link: the headword links to its own page; fit: the sense that fits a
 *   phrase, shown first and marked with fitLabel; extra: forms and related
 *   words, placed on this word's timeline.
 */
function wordBlock(word, senses, options = {}) {
	const { first = false, link = false, fit = null, fitLabel = '', extra = null } = options;
	const ordered = fit ? [fit, ...senses.filter((s) => s !== fit)] : senses;
	const name = link ? h('a', { href: definitionHref(word) }, word) : word;
	return h(
		'section',
		{ class: 'entry-block' },
		h('header', { class: 'entry-head' },
			h('span', { class: 'lang-badge', 'aria-label': t('English') }, 'en'),
			h(first ? 'h1' : 'h2', { class: 'headword' }, name)),
		timeline(groupByType(ordered), 'my', word, fit, fitLabel, extra),
	);
}

/**
 * One sentence: how many meanings, as which parts of speech.
 * @param {string} word
 * @param {Array<{ type: string }>} senses
 */
function lead(word, senses) {
	const names = [...new Set(senses.map((s) => posName(s.type)))];
	// English says "a noun and a verb"; Myanmar names the parts alone.
	const types = getLang() === 'en' ? names.map((n) => `${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}`) : names;
	return tn('“{word}” has {n} meaning as {types}.', '“{word}” has {n} meanings as {types}.', senses.length, { word, types: list(types) });
}

/**
 * @param {ReturnType<typeof entryFeedback>} feedback
 * @param {string} summary
 * @param {Array<{ type: string, kind?: string }>} senses
 */
function aside(feedback, summary, senses) {
	const kinds = senses.map((s) => s.kind ?? 'Active');
	const drafts = kinds.filter((k) => k === 'Draft').length;
	const awaiting = kinds.filter((k) => /awaiting/i.test(k)).length;
	return h(
		'aside',
		{ class: 'entry-aside', 'aria-label': t('About this result') },
		h(
			'section',
			{ class: 'aside-card' },
			h('h2', null, t('About this entry')),
			h('p', { class: 'aside-lead' }, summary),
			awaiting || drafts
				? h(
						'ul',
						{ class: 'aside-facts' },
						awaiting ? h('li', null, kindBadge('Checked: awaiting native review'), ' ', tn('{n} meaning is checked and waits for a native speaker’s review.', '{n} meanings are checked and wait for a native speaker’s review.', awaiting)) : null,
						drafts ? h('li', null, kindBadge('Draft'), ' ', tn('{n} meaning is a draft, not yet checked.', '{n} meanings are drafts, not yet checked.', drafts)) : null,
					)
				: h('p', { class: 'aside-quiet' }, t('Every meaning here has been reviewed.')),
		),
		feedback.card(),
	);
}


/** @param {MyanmarResult} data */
function myanmarHead(data) {
	const [ipa, mlc] = data.pronunciation ?? [null, null];
	return h(
		'header',
		{ class: 'entry-head' },
		h('span', { class: 'lang-badge', 'aria-label': t('Myanmar') }, 'my'),
		h('div', null,
			h('h1', { class: 'headword' }, data.query),
			ipa || mlc
				? h('p', { class: 'pron', lang: 'en' },
					ipa ? h('span', { title: 'IPA' }, `/${ipa}/`) : null,
					mlc ? h('span', { title: t('MLC transcription') }, mlc) : null)
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
			h('li', null, tx('{forms} of {root}', { forms: forms.join(', '), root: h('a', { href: definitionHref(root) }, root) }))),
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
 * @param {Extras | null} [extra]  Forms (each in its part of speech) and related words (a section of their own).
 */
function timeline(groups, glossLang, headword, fit = null, fitLabel = '', extra = null) {
	/** Forms not yet placed, by part of speech in lower case. */
	const forms = new Map(extra?.forms ?? []);
	let formsId = 'forms';
	/** @param {string} pos */
	const formsLine = (pos) => {
		const words = forms.get(pos.toLowerCase());
		if (!words) return null;
		forms.delete(pos.toLowerCase());
		const id = formsId;
		formsId = '';
		return h('p', { class: 'pos-forms', id: id || null }, h('span', { class: 'pos-forms-name' }, t('Forms')), ' ', wordLinks(words));
	};
	const sections = groups.map(([type, senses]) =>
		h(
			'section',
			{ class: 'pos' },
			h('h2', { class: 'pos-name' }, posName(type)),
			formsLine(type),
			h('ul', { class: 'senses' }, senses.map((s) => sense(s, glossLang, headword, s === fit ? fitLabel : ''))),
		),
	);
	// Forms of a part of speech that has no meanings here (a noun's plural when only the verb is defined) get a section of their own.
	for (const pos of [...forms.keys()]) sections.push(h('section', { class: 'pos pos-only-forms' }, h('h2', { class: 'pos-name' }, posName(pos)), formsLine(pos)));
	if (extra?.related.length) {
		sections.push(
			h(
				'section',
				{ class: 'pos pos-related' },
				h('h2', { class: 'pos-name' }, t('related words')),
				h('ul', { class: 'related-list' }, extra.related.map(([name, words, id]) => h('li', { id: id ?? null }, h('span', { class: 'related-name' }, t(name)), h('span', { class: 'related-words' }, wordLinks(words))))),
			),
		);
	}
	return h('div', { class: 'timeline' }, sections);
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
		{ class: fitLabel ? 'sense sense-fit' : 'sense', 'data-sense-id': 'id' in s && s.id !== undefined ? String(s.id) : null },
		// One line for each of the meaning's wordings, as `;` parts them.
		h('p', { class: 'gloss', lang: glossLang }, fits, kind, splitExamples(s.sense ?? '').map((part) => h('span', { class: 'gloss-line' }, renderMarkup(part, { headword })))),
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
		awaiting ? t('awaiting review') : kind === 'Draft' ? t('draft') : kind.toLowerCase(),
	);
}

/** @param {string[]} words */
function wordLinks(words) {
	return words.flatMap((w, i) => [i ? ', ' : null, h('a', { href: definitionHref(w) }, w)]);
}

/**
 * @typedef {object} Extras  Forms and related words of an entry, for its timeline.
 * @property {Map<string, string[]>} forms  By part of speech, in lower case.
 * @property {Array<[string, string[], string | undefined]>} related  Name, words, id a question can point to.
 * @property {Set<string>} present  Which of forms, synonyms, opposite the entry has.
 */

/**
 * Forms by part of speech and related words, placed on the entry's timeline:
 * each part of speech gets its own forms (noun loves; verb loves, loved,
 * loving), and the related words a section of their own.
 * @param {EnglishResult} data
 * @returns {Extras}
 */
function extras(data) {
	/** @type {Map<string, string[]>} */
	const forms = new Map();
	for (const [word, pos] of data.forms) {
		const key = pos.toLowerCase();
		const list = forms.get(key) ?? [];
		if (!list.includes(word)) list.push(word);
		forms.set(key, list);
	}
	/** @type {Array<[string, string[]]>} */
	const lists = [
		[mark('Synonyms'), data.synonyms],
		[mark('Similar'), data.similar],
		[mark('Broader'), data.broader],
		[mark('Opposite'), data.opposite],
		[mark('Related'), data.related],
	];
	// "similar word of love" points at #synonyms: Similar answers it when there are no synonyms.
	/** @type {Record<string, string>} */
	const ids = { ...FOCUS_ROWS, ...(data.synonyms.length ? {} : { Similar: 'synonyms' }) };
	/** @type {Array<[string, string[], string | undefined]>} */
	const related = lists.filter(([, words]) => words.length).map(([name, words]) => [name, words, ids[name]]);
	const present = new Set(related.map(([, , id]) => id).filter((id) => id !== undefined));
	if (forms.size) present.add('forms');
	return { forms, related, present: /** @type {Set<string>} */ (present) };
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
		.map((p) => (p.note === 'spelling' ? t('“{term}” read as “{word}”.', { term: p.term, word: p.word }) : t('“{term}” is a form of “{word}”.', { term: p.term, word: p.word })));
	const intro = h(
		'p',
		{ class: 'entry-note understood' },
		`${t('“{phrase}” is not an entry of its own; here are its words.', { phrase: title })} `,
		asked ? `${t('Read from “{asked}”.', { asked })} ` : null,
		notes.map((n) => `${n} `),
		asked ? h('a', { href: `${definitionHref(asked)}&exact=1` }, t('Search for “{asked}” as typed', { asked })) : null,
	);
	let first = true;
	const blocks = read.parts.flatMap((p) => {
		if (!p.entries.length) {
			return h('section', { class: 'entry-block' },
				h('header', { class: 'entry-head' }, h('span', { class: 'lang-badge', 'aria-label': t('English') }, 'en'), h('h2', { class: 'headword headword-none' }, p.term)),
				h('p', { class: 'notice phrase-none' }, t('The dictionary has no entry for “{term}”.', { term: p.term })));
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
		{ class: 'entry-aside', 'aria-label': t('About this phrase') },
		h('section', { class: 'aside-card' },
			h('h2', null, t('The phrase')),
			h('p', { class: 'aside-phrase' }, title),
			read.myanmar ? h('p', { class: 'aside-phrase-my', lang: 'my' }, read.myanmar) : null,
			h('p', { class: 'aside-quiet' }, read.myanmar
				? t('Put together from the marked meanings of {words}, in Myanmar word order: a reading, not a checked translation.', { words: list(words.map((w) => `“${w}”`)) })
				: t('Read from the entries for {words}.', { words: list(words.map((w) => `“${w}”`)) }))),
		h('section', { class: 'aside-card' },
			h('h2', null, t('Should it be an entry?')),
			h('div', { class: 'aside-actions' },
				h('button', { type: 'button', class: 'aside-suggest', disabled: true, title: t('Suggesting a phrase comes in a later change') }, icon(ICONS.suggest, 18), t('Suggest this phrase'))),
			h('p', { class: 'aside-quiet' }, t('Suggesting a whole phrase comes in a later change.'))),
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
		? h('p', { class: 'notice no-result inline' }, t('“{word}” is not a word in the dictionary.', { word }))
		: ((await lookup(word)
				// Offline, a word the device has no answer for is simply not there.
				.then((r) => result(r))
				.catch((err) => (/** @type {{ code?: string }} */ (err)?.code === 'unavailable' ? null : Promise.reject(err)))) ?? (await missing(word, null, { inline: true })));
	const pager = h(
		'nav',
		{ class: 'sentence-pager', 'aria-label': t('Words of the sentence') },
		i > 0 ? h('a', { href: at(i - 1), rel: 'prev' }, `← ${words[i - 1]}`) : h('span'),
		h('span', { class: 'sentence-count' }, t('{i} of {n}', { i: i + 1, n: words.length })),
		next ? h('a', { href: at(i + 1), rel: 'next' }, `${next} →`) : h('span'),
	);
	return h(
		'div',
		{ class: 'sentence' },
		h(
			'header',
			{ class: 'sentence-head' },
			h('p', { class: 'sentence-text' }, h('span', { class: 'sentence-label' }, t('Sentence')), ' ', q),
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

	return h(
		'section',
		{ class: options.inline ? 'no-result inline' : 'page no-result' },
		h(options.inline ? 'h2' : 'h1', { class: 'notice-title' }, t('No entry for “{word}”', { word: q })),
		close.length ? h('div', { class: 'no-result-part' }, h('p', null, t('Did you mean')), chips(close)) : null,
		prefix.length ? h('div', { class: 'no-result-part' }, h('p', null, t('Words that start like “{word}”', { word: q })), chips(prefix)) : null,
		!close.length && !prefix.length ? h('p', { class: 'notice' }, t('Check the spelling, or try the root form of the word.')) : null,
		options.inline
			? null
			: h(
					'div',
					{ class: 'aside-card no-result-ask' },
					h('h2', null, t('We don’t have it yet')),
					h('p', { class: 'aside-lead' }, t('Would you like to suggest “{word}” for the dictionary?', { word: q })),
					h(
						'div',
						{ class: 'aside-actions' },
						h('button', { type: 'button', class: 'aside-suggest', disabled: true, title: t('Suggesting a new word comes in a later change') }, icon(ICONS.suggest, 18), t('Suggest this word')),
						h('a', { href: `/contact?kind=word&word=${encodeURIComponent(q)}&from=${encodeURIComponent(location.pathname + location.search)}` }, t('Tell us about it')),
					),
					h('p', { class: 'aside-quiet' }, t('Suggesting a new word in the app comes in a later change.')),
				),
	);
}
