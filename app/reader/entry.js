// @ts-check
/**
 * Definition page: /definition?q=word; with no word, how to search (guide.js).
 *
 * What was typed is read first, in the browser (shared/query): a number, a
 * sum, the time or the date is answered here (answer.js) without asking the
 * dictionary; a question around a word ("what is love") moves to the word's
 * own address, keeping the question (asked=) to say how it was read.
 * exact=1 skips the reading and looks up the text as typed. A query typed
 * in Zawgyi that the dictionary reads in Unicode (shared/zawgyi) moves to the
 * Unicode word's address, keeping what was typed (zawgyi=) to say so.
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
import { itemsOf } from '#shared/markup.js';
import { entrySummary, summaryText } from '#shared/summary.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { renderMarkup, renderNote } from '../core/markup.js';
import { getLang, list, mark, posName, t, tn, tx } from '../i18n/index.js';
import { definitionHref } from '../core/routes.js';
import { lookup, popularWords, read, remember, savingData, spelling } from '../data/api.js';
import { entryFeedback, suggestWord } from './contribute.js';
import { commentsSection } from './comments.js';
import { pronounceButton } from './pronounce.js';
import { addRecent, removeRecent } from '../data/recent.js';
import { withoutInvisible } from '#shared/validate.js';
import { plainItem } from '#shared/quiz.js';
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
	const typed = (ctx.query.get('q') ?? '').trim();
	// Invisible characters (from a copy and paste) are taken out, and the page says so (&hidden=1).
	const q = withoutInvisible(typed).trim();
	if (typed && q !== typed) {
		removeRecent(typed);
		ctx.replace(q ? `${definitionHref(q)}&hidden=1` : '/definition');
		return h('div');
	}
	if (!q) return (await import('./guide.js')).guide();
	addRecent(q);
	const asked = ctx.query.get('asked');
	const at = ctx.query.get('w');
	const zawgyi = ctx.query.get('zawgyi');

	if (ctx.query.get('exact') !== '1' && !asked && !zawgyi && at === null) {
		const intent = classify(q);
		if (intent.kind !== 'lookup') return (await import('./answer.js')).answer(intent, q);
		if (intent.understood) {
			ctx.replace(understoodHref(intent, q));
			return h('div');
		}
	}

	// One request decides what the query is (worker/routes/read.js); offline, the device (read-offline.js).
	const reading = await read(q);
	// Typed in Zawgyi: the address, the recent searches and the box get the Unicode.
	if (reading.zawgyi && !zawgyi) {
		removeRecent(q);
		ctx.replace(`${definitionHref(reading.zawgyi.as)}&zawgyi=${encodeURIComponent(q)}`);
		return h('div');
	}
	const said = [
		...(zawgyi ? [t('Typed in Zawgyi, so searched in Unicode as “{word}”.', { word: q })] : []),
		...(ctx.query.get('hidden') === '1' ? [t('The search had an invisible character, which was taken out.')] : []),
	];
	/** A phrase, a sentence or nothing read on the device says so, as an entry does. @param {Node} node */
	const marked = (node) => {
		const note = offlineNote(reading);
		if (node instanceof HTMLElement) {
			if (said.length) node.prepend(h('p', { class: 'entry-note understood' }, said.join(' ')));
			if (note) node.prepend(note);
		}
		return node;
	};
	switch (reading.kind) {
		case 'entry': {
			// The title the Worker gave the page: the word and its first meanings (shared/summary.js).
			const about = reading.result.entries.length ? entrySummary(reading.result) : null;
			if (about) ctx.title = summaryText({ ...about, word: (reading.result.language === 'en' && reading.result.entries[0]?.word) || reading.result.query }).title;
			return (await result(reading.result, asked, said)) ?? missing(q, { close: [], starts: [] });
		}
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
 * @param {string[]} [said]  How the query was read (typed in Zawgyi).
 */
async function result(data, asked, said = []) {
	if (data.language === 'my') {
		if (!data.entries.length) return null;
		const feedback = entryFeedback('my', data.query);
		// How the query was read goes above the headword, never between it and its timeline.
		const read = understood(data.query, asked, null, said);
		const article = h('article', { class: 'entry', lang: 'my' }, entryActions(feedback), offlineNote(data), read, myanmarHead(data), timeline(groupByType(data.entries), 'en', data.query));
		feedback.wire(article, data.entries.map((e) => ({ ...e, word: data.query })), 'en');
		if (!(/** @type {{ offline?: boolean }} */ (data).offline)) article.append(commentsSection('my', data.query));
		return withAside(article, aside(feedback, lead(data.query, data.entries), data.entries, read));
	}
	return english(data, asked, said);
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
 * @param {string[]} [said]
 */
async function english(data, asked, said = []) {
	const roots = [...new Set(data.forms_of.map(([root]) => root))];
	if (!data.entries.length && !roots.length) return null;

	const extra = data.entries.length ? extras(data) : null;
	const read = understood(data.query, asked, extra?.present ?? null, said);
	/** @type {Array<HTMLElement | null>} */
	const notes = [offlineNote(data), read];
	if (data.variant_of.length) notes.push(h('p', { class: 'entry-note' }, tx('A spelling of {words}.', { words: h('span', null, wordLinks(data.variant_of)) })));
	/** What the query is a form of, not yet said beside a part of speech on the page. */
	let unsaid = data.forms_of;
	/** Senses on the page, for the summary beside it. */
	let shown = data.entries;
	let summary = lead(data.query, data.entries);
	/** @type {import('../core/dom.js').Child[]} */
	const blocks = [];

	if (data.entries.length) {
		// Forms and related words belong to the word asked for: its first spelling's timeline.
		// So does what it is a form of (loathing: -ing of loathe), under that part of
		// speech, which gets a section of its own when the word has no meanings as it.
		/** @type {Map<string, Array<[string, string]>>} */
		const asForm = new Map();
		for (const [root, pos, form] of data.forms_of) if (pos) asForm.set(pos.toLowerCase(), [...(asForm.get(pos.toLowerCase()) ?? []), [root, form]]);
		blocks.push(...bySpelling(data.entries).map(([word, senses], i) => wordBlock(word, senses, { first: i === 0, extra: i === 0 ? extra : null, asForm: i === 0 ? asForm : null })));
		unsaid = unsaid.filter(([, pos]) => !pos);
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
			// "loved: past, past participle of love" goes under the root's verb, where the reader
			// sees which meanings the word asked for takes; a part of speech the root does not
			// show keeps its line in the note above.
			/** @type {Map<string, string[]>} */
			const byPos = new Map();
			for (const [of, pos, form] of data.forms_of) if (of === root.query && pos) byPos.set(pos.toLowerCase(), [...(byPos.get(pos.toLowerCase()) ?? []), form]);
			const formOf = { word: data.query, root: root.query, byPos };
			bySpelling(root.entries).forEach(([word, senses], i) => blocks.push(wordBlock(word, senses, { first: n === 0 && i === 0, link: true, extra: i === 0 ? more : null, formOf })));
			unsaid = unsaid.filter(([of, pos]) => !(of === root.query && pos && !byPos.has(pos.toLowerCase())));
		});
	}
	if (unsaid.length) notes.push(formNote(unsaid));
	// A form shows its root's senses, so feedback is about the root (went → go).
	const word = shown[0]?.word ?? data.query;
	const feedback = entryFeedback('en', word);
	const article = h('article', { class: 'entry', lang: 'en' }, entryActions(feedback), notes, blocks);
	feedback.wire(article, shown, 'my');
	// Test yourself on the word asked for, when it has meanings of its own; its code loads on its own.
	if (data.entries.length) {
		const slot = h('div', { class: 'quiz-slot' });
		article.append(slot);
		import('./quiz.js').then(({ quizCard }) => slot.replaceChildren(quizCard(data) ?? '')).catch((err) => console.warn('Test yourself unavailable:', err));
	}
	if (!(/** @type {{ offline?: boolean }} */ (data).offline)) article.append(commentsSection('en', word));
	return withAside(article, aside(feedback, summary, shown, read));
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
 * @param {{ first?: boolean, link?: boolean, fit?: import('#shared/types.js').EnglishSense | null, fitLabel?: string, extra?: Extras | null, formOf?: FormOf | null, asForm?: Map<string, Array<[string, string]>> | null }} [options]
 *   link: the headword links to its own page; fit: the sense that fits a
 *   phrase, shown first and marked with fitLabel; extra: forms and related
 *   words, placed on this word's timeline; formOf: the word asked for, a
 *   form of this one, said under the part of speech it is a form in;
 *   asForm: what this word is a form of, by part of speech in lower case
 *   ([root, form] pairs), said under that part of speech.
 */
function wordBlock(word, senses, options = {}) {
	const { first = false, link = false, fit = null, fitLabel = '', extra = null, formOf = null, asForm = null } = options;
	const ordered = fit ? [fit, ...senses.filter((s) => s !== fit)] : senses;
	const name = link ? h('a', { href: definitionHref(word) }, word) : word;
	return h(
		'section',
		{ class: 'entry-block' },
		h('header', { class: 'entry-head' },
			h('span', { class: 'lang-badge', 'aria-label': t('English') }, 'en'),
			h(first ? 'h1' : 'h2', { class: 'headword' }, name),
			first ? pronounceButton(word, 'en') : null),
		timeline(groupByType(ordered), 'my', word, fit, fitLabel, extra, formOf, asForm),
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
 * Under 1024px, the thumb for the whole entry, at the right of the search
 * bar (main.js moves it there; app.css): pressed, the entry is in Liked.
 * @param {ReturnType<typeof entryFeedback>} feedback
 */
function entryActions(feedback) {
	return h('div', { class: 'entry-actions' }, feedback.like());
}

/**
 * @param {ReturnType<typeof entryFeedback>} feedback
 * @param {string} summary
 * @param {Array<{ type: string, kind?: string }>} senses
 * @param {HTMLElement | null} [read]  How the query was read (understood): on
 *   wide screens it moves here, first; CSS shows one of the two places.
 */
function aside(feedback, summary, senses, read) {
	const kinds = senses.map((s) => s.kind ?? 'Active');
	const drafts = kinds.filter((k) => k === 'Draft').length;
	const awaiting = kinds.filter((k) => /awaiting/i.test(k)).length;
	return h(
		'aside',
		{ class: 'entry-aside', 'aria-label': t('About this result') },
		read ? h('section', { class: 'aside-card aside-read' }, h('h2', null, t('Your search')), /** @type {HTMLElement} */ (read.cloneNode(true))) : null,
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
		pronounceButton(data.query, 'my'),
	);
}

/**
 * "went: past of go".
 * @param {EnglishResult['forms_of']} formsOf  Root, part of speech, form.
 */
function formNote(formsOf) {
	/** @type {Map<string, string[]>} */
	const byRoot = new Map();
	for (const [root, pos, form] of formsOf) {
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
 * @typedef {object} FormOf  The word asked for as a form of a root shown in its place.
 * @property {string} word  The word asked for (loved).
 * @property {string} root  The root whose meanings are shown (love).
 * @property {Map<string, string[]>} byPos  Forms by part of speech in lower case, those not yet said on the page.
 */

/**
 * Lights a line for a few seconds the first time it is on screen (app.css,
 * .is-noticed), so a reader sees it wherever on the page it stands.
 * @param {HTMLElement} line
 */
function noticed(line) {
	const seen = new IntersectionObserver((entries) => {
		if (!entries.some((e) => e.isIntersecting)) return;
		seen.disconnect();
		line.classList.add('is-noticed');
	}, { threshold: 1 });
	seen.observe(line);
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
 * @param {FormOf | null} [formOf]  The word asked for, a form of the headword; a part of speech said here leaves formOf.byPos.
 * @param {Map<string, Array<[string, string]>> | null} [asForm]  What the headword itself is a form of, by part of speech.
 */
function timeline(groups, glossLang, headword, fit = null, fitLabel = '', extra = null, formOf = null, asForm = null) {
	/** What the headword is a form of: "-ing of loathe", under that part of speech. */
	const ownForm = new Map(asForm ?? []);
	/** @param {string} pos */
	const asFormLine = (pos) => {
		const pairs = ownForm.get(pos.toLowerCase());
		if (!pairs) return null;
		ownForm.delete(pos.toLowerCase());
		/** @type {Map<string, string[]>} */
		const byRoot = new Map();
		for (const [root, form] of pairs) byRoot.set(root, [...(byRoot.get(root) ?? []), form]);
		return h(
			'p',
			{ class: 'pos-form-of pos-is-form' },
			[...byRoot].flatMap(([root, forms], i) => [i ? ' · ' : null, ...tx('{forms} of {root}', { forms: forms.join(', '), root: h('a', { href: definitionHref(root) }, root) })]),
		);
	};
	/** "loved: past, past participle of love", under the part of speech it holds for. @param {string} pos */
	const formOfLine = (pos) => {
		const forms = formOf?.byPos.get(pos.toLowerCase());
		if (!formOf || !forms) return null;
		formOf.byPos.delete(pos.toLowerCase());
		const line = h('p', { class: 'pos-form-of' }, h('b', null, formOf.word), ': ', tx('{forms} of {root}', { forms: forms.join(', '), root: formOf.root }));
		noticed(line);
		return line;
	};
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
		// Read aloud as "Forms: loves"; seen, the place beside the part of speech says as much.
		return h('p', { class: 'pos-forms', id: id || null, title: t('Forms') }, h('span', { class: 'visually-hidden' }, `${t('Forms')}: `), wordLinks(words));
	};
	/** A part of speech and, on the same line, its forms: "verb · loves, loved, loving". @param {string} pos */
	const head = (pos) => h('header', { class: 'pos-head' }, h('h2', { class: 'pos-name' }, posName(pos)), formsLine(pos));
	const sections = groups.map(([type, senses]) =>
		h(
			'section',
			{ class: 'pos' },
			head(type),
			formOfLine(type),
			asFormLine(type),
			h('ul', { class: 'senses' }, senses.map((s) => sense(s, glossLang, headword, s === fit ? fitLabel : ''))),
		),
	);
	// Forms of a part of speech that has no meanings here (a noun's plural when only the verb is defined) get a section of their own.
	for (const pos of [...forms.keys()]) sections.push(h('section', { class: 'pos pos-only-forms' }, head(pos), asFormLine(pos)));
	// A part of speech the headword is only a form in (loathing, the -ing of the verb loathe).
	for (const pos of [...ownForm.keys()]) sections.push(h('section', { class: 'pos pos-only-forms' }, head(pos), asFormLine(pos)));
	if (extra?.related.length) {
		sections.push(
			h(
				'section',
				{ class: 'pos pos-related' },
				h('h2', { class: 'pos-name' }, t('related words')),
				h('ul', { class: 'related-list' }, extra.related.map(([name, words, id]) => h('li', { id: id ?? null }, h('span', { class: 'related-name' }, t(name)), h('span', { class: 'related-words' }, wordLinks(words, extra.linked))))),
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
	const exampleLang = glossLang === 'my' ? 'en' : 'my';
	// One item a line (the dataset's " | "). Labels stand together before the
	// glosses, notes with a name follow them, then the sense in English, then
	// the examples.
	const items = itemsOf(s.sense, { languages: glossLang === 'my' });
	/** @param {Extract<import('#shared/markup.js').Item, { t: 'note' }>} it */
	const isLabel = (it) => it.value === null;
	const labels = items.flatMap((it) => (it.t === 'note' && isLabel(it) ? [renderNote(it)] : []));
	const glosses = items.flatMap((it) => (it.t === 'text' ? [h('span', { class: 'gloss-line' }, renderMarkup(it.text, { headword }))] : []));
	const notes = items.flatMap((it) => (it.t === 'note' && !isLabel(it) ? [h('span', { class: 'sense-note-line' }, renderNote(it, { headword }))] : []));
	const explained = items.flatMap((it) => (it.t === 'language' ? [h('p', { class: 'sense-explained', lang: it.lang }, it.text)] : []));
	const examples = itemsOf(s.example).map((it) =>
		it.t === 'note' ? h('p', { class: 'example example-note', lang: exampleLang }, renderNote(it, { headword })) : h('p', { class: 'example', lang: exampleLang }, renderMarkup(it.t === 'text' ? it.text : '', { headword })),
	);
	return h(
		'li',
		{ class: fitLabel ? 'sense sense-fit' : 'sense', 'data-sense-id': 'id' in s && s.id !== undefined ? String(s.id) : null },
		h('p', { class: 'gloss', lang: glossLang }, fits, kind, labels.length ? h('span', { class: 'sense-labels' }, labels) : null, glosses),
		notes.length ? h('p', { class: 'sense-notes', lang: glossLang }, notes) : null,
		explained,
		examples,
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

/**
 * Words as links, separated by commas. Every word links: a word without an
 * entry opens its no-entry page, where it can be asked for and its nearest
 * meanings are shown. With `linked`, the words not in it (no entry of their
 * own) are set apart in a lighter colour.
 * @param {string[]} words
 * @param {Set<string> | null} [linked]  Lower case.
 */
function wordLinks(words, linked = null) {
	return words.flatMap((w, i) => [i ? ', ' : null, h('a', { href: definitionHref(w), class: !linked || linked.has(w.toLowerCase()) ? null : 'word-new' }, w)]);
}

/**
 * The words of a lookup that have an entry, in lower case, or null when the
 * answer does not say (made before with_entry existed): then every word links.
 * @param {{ with_entry?: string[] }} data
 */
function entryWords(data) {
	return data.with_entry ? new Set(data.with_entry.map((w) => w.toLowerCase())) : null;
}

/**
 * @typedef {object} Extras  Forms and related words of an entry, for its timeline.
 * @property {Map<string, string[]>} forms  By part of speech, in lower case.
 * @property {Array<[string, string[], string | undefined]>} related  Name, words, id a question can point to.
 * @property {Set<string>} present  Which of forms, synonyms, opposite the entry has.
 * @property {Set<string> | null} linked  Related words with an entry of their own (entryWords).
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
	return { forms, related, present: /** @type {Set<string>} */ (present), linked: entryWords(data) };
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

/** @typedef {{ synonyms?: string[], similar: string[], broader: string[], opposite: string[], related: string[] }} Around  synonyms is absent from a reading made before it was apart from similar. */

/**
 * Nothing for `q`, said as what it most likely is:
 *
 *   - a word the dictionary knows (eng_word, mya_word) but has not defined:
 *     the word as the heading, "Recognised word · not yet defined";
 *   - not a known word, with a headword one slip away, or marked a
 *     misspelling by editors in Searches: "Did you mean …?" as the heading,
 *     with that word's meaning one press away;
 *   - not a known word and nothing close: the word, "Not a word we know yet".
 *
 * Then the nearest Myanmar meaning, the related words, words starting the
 * same way, and, unless it is a likely misspelling, a way to suggest it. An answer that does not say whether the
 * word is known (an offline reading) keeps the plain "No entry" heading.
 * Inline (a word of a sentence): a shorter version that fetches its own
 * "did you mean".
 * @param {string} q
 * @param {{ close: string[], starts: string[], around?: Around | null, nearest?: import('#shared/types.js').NearestSense[], with_entry?: string[], known?: boolean, marked?: { label: string | null, note: string | null } | null } | null} found  From the reading.
 * @param {{ inline?: boolean }} [options]
 */
async function missing(q, found, options = {}) {
	const near = found ?? { close: (await spelling(q).catch(() => ({ words: [] }))).words.filter((w) => w.toLowerCase() !== q.toLowerCase()), starts: [] };
	const close = near.close;
	const prefix = near.starts;
	/** @param {string[]} words */
	const chips = (words) => h('ul', { class: 'chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w), lang: MYANMAR_TEXT.test(w) ? 'my' : 'en' }, w))));
	if (options.inline) {
		return h(
			'section',
			{ class: 'no-result inline' },
			h('h2', { class: 'notice-title' }, t('No entry for “{word}”', { word: q })),
			close.length ? h('div', { class: 'no-result-part' }, h('p', null, t('Did you mean')), chips(close)) : null,
			!close.length ? h('p', { class: 'notice' }, t('Check the spelling, or try the root form of the word.')) : null,
		);
	}

	const around = found?.around ?? null;
	const nearest = found?.nearest ?? [];
	const linked = found ? entryWords(found) : null;
	const known = found?.known;
	const marked = found?.marked ?? null;
	// An editor's "misspelling" with a note "→ word" names the word meant.
	const meant = marked?.label === 'misspelling' ? (/^→\s*(.+)$/.exec(marked.note ?? '')?.[1]?.trim() ?? null) : null;
	const best = meant ?? (known === false && marked?.label !== 'noise' && close.length ? close[0] : null);
	const others = close.filter((w) => w !== best);

	/** @type {Node[]} */
	let head;
	if (best) {
		head = [
			h('h1', { class: 'no-result-title' }, ...tx('Did you mean {word}?', { word: h('a', { href: definitionHref(best), lang: MYANMAR_TEXT.test(best) ? 'my' : 'en' }, best) })),
			status('spell', meant ? t('Editors marked “{word}” as a misspelling.', { word: q }) : t('“{word}” is not a word we know yet.', { word: q })),
			meaningCard(best),
		];
	} else if (known === undefined) {
		head = [h('h1', { class: 'notice-title' }, t('No entry for “{word}”', { word: q }))];
	} else {
		head = [
			h('h1', { class: 'no-result-title no-result-word', lang: MYANMAR_TEXT.test(q) ? 'my' : 'en' }, q),
			known ? status('known', marked?.label === 'add' ? t('Recognised word · to be added') : t('Recognised word · not yet defined')) : status('unknown', t('Not a word we know yet')),
		];
	}
	return h(
		'section',
		{ class: 'page no-result' },
		h('header', { class: 'no-result-head' }, head),
		nearest.length ? nearestMeanings(q, nearest) : null,
		around ? aroundWords(around, linked, nearest.length === 0) : null,
		others.length ? h('div', { class: 'no-result-part' }, h('h2', { class: 'around-title' }, best ? t('Other spellings close to it') : t('Did you mean')), chips(others)) : null,
		prefix.length ? h('div', { class: 'no-result-part' }, h('h2', { class: 'around-title' }, t('Words that start like “{word}”', { word: q })), chips(prefix)) : null,
		!close.length && !prefix.length && !around && !nearest.length ? h('p', { class: 'notice' }, t('Check the spelling, or try the root form of the word.')) : null,
		// A likely misspelling is not asked for: the word meant is above.
		best ? null : noEntryAsk(q),
		keepGoing(),
	);
}

const MYANMAR_TEXT = /[\u1000-\u109f]/;

/**
 * The line under a no-entry heading that says what kind of "no entry" it is.
 * @param {'known' | 'unknown' | 'spell'} kind
 * @param {string} text
 */
function status(kind, text) {
	return h('p', { class: 'no-result-status' }, h('span', { class: `no-result-pill no-result-${kind}` }, icon(kind === 'known' ? ICONS.dictionary : kind === 'spell' ? ICONS.suggest : ICONS.info, 15), text));
}

/**
 * The word meant, with its first meaning, one press away; filled in when its lookup arrives.
 * @param {string} word
 */
function meaningCard(word) {
	const card = h('a', { class: 'no-result-meant', href: definitionHref(word) }, h('span', { class: 'no-result-meant-word', lang: MYANMAR_TEXT.test(word) ? 'my' : 'en' }, word), h('span', { class: 'no-result-meant-open' }, t('Open the entry →')));
	lookup(word)
		.then((r) => {
			const first = r.entries[0];
			if (!first) return;
			const gloss = itemsOf(first.sense).find((it) => it.t === 'text');
			const glossLang = r.language === 'en' ? 'my' : 'en';
			card.insertBefore(h('span', { class: 'no-result-meant-gloss', lang: glossLang }, h('em', null, `${posName(first.type)} `), gloss && gloss.t === 'text' ? plainItem(gloss.text, word) : ''), card.lastChild);
		})
		.catch(() => {});
	return card;
}

/** How a nearby word's meaning relates to the word asked about. */
const VIA = /** @type {Record<string, string>} */ ({
	synonym: mark('same as {word}'),
	similar: mark('similar to {word}'),
	broader: mark('a kind of {word}'),
});

/**
 * The nearest Myanmar meanings of a word that has none (lookup's nearest):
 * each said to be another word's, never shown as the word's own.
 * @param {string} q
 * @param {import('#shared/types.js').NearestSense[]} nearest
 */
function nearestMeanings(q, nearest) {
	return h(
		'div',
		{ class: 'no-result-nearest' },
		h('h2', { class: 'around-title' }, t('Nearest meaning')),
		h('p', { class: 'no-result-lead' }, t('From words close to it; “{word}” has no meaning of its own yet.', { word: q })),
		h(
			'ul',
			{ class: 'nearest-list' },
			nearest.map((n) =>
				h(
					'li',
					{ class: `nearest-item${n.exact ? '' : ' nearest-loose'}` },
					h('p', { class: 'nearest-via' }, ...tx(VIA[n.via] ?? '{word}', { word: h('a', { href: definitionHref(n.word), lang: 'en' }, n.word) }), h('em', null, ` ${posName(n.type)}`)),
					h('ol', { class: 'senses nearest-senses' }, sense({ type: n.type, sense: n.sense, example: null }, 'my', n.word)),
				),
			),
		),
	);
}

/** The lists of English words around a word that is no headword, in the order shown (as an entry's). */
const AROUND = /** @type {const} */ ([
	['synonyms', mark('Synonyms')],
	['similar', mark('Similar')],
	['broader', mark('Broader')],
	['opposite', mark('Opposite')],
	['related', mark('Related')],
]);

/**
 * The English words around a word the dictionary lacks (WordNet and Moby),
 * in full and laid out as an entry's related words: a Myanmar meaning is
 * only ever near, and the English words may be what the reader needs. Those
 * with an entry of their own link; the others are said.
 * @param {Around} around
 * @param {Set<string> | null} linked  Words with an entry (with_entry); null: all of them.
 * @param {boolean} first  Nothing above it: it says why it is there.
 */
function aroundWords(around, linked, first) {
	const rows = AROUND.filter(([key]) => around[key]?.length);
	if (!rows.length) return null;
	return h(
		'section',
		{ class: 'no-result-around' },
		h('h2', { class: 'around-title' }, t('Related words')),
		first ? h('p', { class: 'no-result-lead' }, t('No meaning yet, but these words are close to it.')) : null,
		h('ul', { class: 'related-list' }, rows.map(([key, name]) => h('li', null, h('span', { class: 'related-name' }, t(name)), h('span', { class: 'related-words', lang: 'en' }, wordLinks(around[key] ?? [], linked))))),
		h('p', { class: 'no-result-source' }, t('From WordNet and the Moby Thesaurus.')),
	);
}

/**
 * The words searched most this week, so a page with nothing on it still
 * leads somewhere. Nothing when they cannot be had.
 */
function keepGoing() {
	const box = h('div', { class: 'no-result-part no-result-more', hidden: true });
	popularWords()
		.then((p) => {
			const words = p.words.slice(0, 12);
			if (!words.length) return;
			box.append(h('h2', { class: 'around-title' }, t('Searched most this week')), h('ul', { class: 'chips' }, words.map((w) => h('li', null, h('a', { href: definitionHref(w.term), lang: /[\u1000-\u109f]/.test(w.term) ? 'my' : 'en' }, w.term)))));
			box.hidden = false;
		})
		.catch(() => {});
	return box;
}

/**
 * The card under "No entry": suggest the word with its first meaning (an
 * English word), or tell about it through the contact form (a Myanmar
 * headword needs its pronunciation, which the form here does not take).
 * @param {string} q
 */
function noEntryAsk(q) {
	const tell = h('a', { href: `/contact?kind=word&word=${encodeURIComponent(q)}&from=${encodeURIComponent(location.pathname + location.search)}` }, t('Tell us about it'));
	const myanmar = /[\u1000-\u109f]/.test(q);
	const suggest = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'aside-suggest' }, icon(ICONS.suggest, 18), t('Suggest this word')));
	suggest.addEventListener('click', () => suggestWord(q));
	return h(
		'div',
		{ class: 'aside-card no-result-ask' },
		h('h2', null, t('We don’t have it yet')),
		h('p', { class: 'aside-lead' }, t('Would you like to suggest “{word}” for the dictionary?', { word: q })),
		h('div', { class: 'aside-actions' }, myanmar ? null : suggest, tell),
		h('p', { class: 'aside-quiet' }, myanmar ? t('A Myanmar word needs its pronunciation too, so it is suggested through the contact form.') : t('Give its first meaning; an editor looks at it before it joins the dictionary.')),
	);
}
