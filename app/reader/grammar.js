// @ts-check
/**
 * Grammar: /grammar lists the topics, /grammar/<slug> shows one.
 *
 * A topic is a tree of sections (kind), each with a definition, its
 * classifications (cate, linking to the sections they name), example words
 * (word), example sentences and tables (exam). Words in single quotes in the
 * source are the ones an example is about; they are highlighted.
 * Wide screens get the contents beside the text; phones a list to open.
 */
import { AppError } from '#shared/errors.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { grammarIndex, grammarTopic } from '../data/grammar.js';

/** @typedef {import('../data/grammar.js').GrammarNode} GrammarNode */
/** @typedef {import('../data/grammar.js').GrammarTopic} GrammarTopic */
/** @typedef {import('../data/grammar.js').GrammarTopicRef} GrammarTopicRef */

/** Width from which the contents sit beside the text (matches app.css). */
const WIDE = '(min-width: 1100px)';

let currentTitle = 'Grammar';

export function title() {
	return currentTitle;
}

export async function view() {
	const slug = location.pathname.replace(/\/+$/, '').split('/')[2];
	const index = await grammarIndex();
	if (!slug) {
		currentTitle = 'Grammar';
		return indexPage(index);
	}
	try {
		const topic = await grammarTopic(decodeURIComponent(slug));
		currentTitle = `${topic.root.name} · ${topic.info.name} · Grammar`;
		return topicPage(topic, index);
	} catch (err) {
		if (!(err instanceof AppError && err.code === 'not_found')) throw err;
		currentTitle = 'Grammar';
		return h(
			'section',
			{ class: 'page' },
			h('h1', { class: 'notice-title' }, 'No such grammar topic'),
			h('p', null, h('a', { href: '/grammar' }, 'See all grammar topics')),
		);
	}
}

// ---------------------------------------------------------------- index

/** @param {import('../data/grammar.js').GrammarIndex} index */
function indexPage(index) {
	const { context } = index;
	/** @param {'pos' | 'other'} group */
	const topics = (group) => index.topics.filter((t) => t.group === group);
	return h(
		'section',
		{ class: 'grammar' },
		h('header', { class: 'g-head' }, h('h1', { lang: 'my' }, context.name), h('p', { class: 'g-lead', lang: 'my' }, quoted(context.desc))),
		context.kind.length
			? h('dl', { class: 'g-terms', lang: 'my' }, context.kind.flatMap((k) => [h('dt', null, k.name), h('dd', null, quoted(k.desc))]))
			: null,
		topicGroup('Parts of speech', 'ဝါစင်္ဂ', topics('pos')),
		topicGroup('More grammar', null, topics('other')),
		h(
			'p',
			{ class: 'g-source' },
			'From ',
			h('span', { lang: 'my' }, 'မြန်မာသဒ္ဒါ'),
			', volumes 1 and 2.',
		),
	);
}

/**
 * @param {string} name
 * @param {string | null} my
 * @param {GrammarTopicRef[]} topics
 */
function topicGroup(name, my, topics) {
	if (!topics.length) return null;
	return h(
		'section',
		{ class: 'g-group' },
		h('h2', null, name, my ? h('span', { lang: 'my' }, my) : null),
		h(
			'ul',
			{ class: 'g-topics' },
			topics.map((t) =>
				h(
					'li',
					null,
					h(
						'a',
						{ href: `/grammar/${t.slug}` },
						h('span', { class: 'g-topic-my', lang: 'my' }, t.my),
						h('span', { class: 'g-topic-en' }, t.name),
						t.desc ? h('span', { class: 'g-topic-desc', lang: 'my' }, unquote(t.desc)) : null,
					),
				),
			),
		),
	);
}

// ---------------------------------------------------------------- topic

/**
 * @param {GrammarTopic} topic
 * @param {import('../data/grammar.js').GrammarIndex} index
 */
function topicPage(topic, index) {
	/** Section ids by name, so classifications can link to their sections. */
	const ids = new Map();
	collectIds(topic, '', ids);

	const at = index.topics.findIndex((t) => t.slug === topic.slug);
	const prev = index.topics[at - 1];
	const next = index.topics[at + 1];
	const sections = topic.kind ?? [];

	return h(
		'div',
		{ class: 'g-layout' },
		h(
			'article',
			{ class: 'grammar g-topic' },
			h(
				'header',
				{ class: 'g-head g-head-topic' },
				backButton(),
				h('div', null, h('h1', { lang: 'my' }, topic.root.name), h('p', { class: 'g-en' }, topic.info.name)),
			),
			sections.length > 1 ? contents(sections, ids, false) : null,
			h('div', { class: 'g-body', lang: 'my' }, node(topic, 0, '', ids)),
			topic.english?.length ? english(topic.english) : null,
			h(
				'nav',
				{ class: 'g-pager', 'aria-label': 'Grammar topics' },
				prev ? h('a', { class: 'g-prev', href: `/grammar/${prev.slug}` }, h('small', null, 'Previous'), h('span', { lang: 'my' }, prev.my), h('em', null, prev.name)) : h('span'),
				next ? h('a', { class: 'g-next', href: `/grammar/${next.slug}` }, h('small', null, 'Next'), h('span', { lang: 'my' }, next.my), h('em', null, next.name)) : h('span'),
			),
		),
		sections.length > 1 ? contents(sections, ids, true) : null,
	);
}

/**
 * Back to the list of topics. When this page was opened from that list, it
 * goes back in history, so the list returns scrolled to where it was left;
 * otherwise (a link from elsewhere, or opened directly) it opens the list.
 */
function backButton() {
	const fromList = history.state?.from === '/grammar';
	return h(
		'a',
		{
			class: 'g-back',
			href: '/grammar',
			title: 'All grammar topics',
			'aria-label': 'All grammar topics',
			onClick: (/** @type {MouseEvent} */ e) => {
				if (!fromList || e.metaKey || e.ctrlKey || e.shiftKey) return;
				e.preventDefault();
				e.stopPropagation();
				history.back();
			},
		},
		icon(ICONS.back, 22),
	);
}

/**
 * The contents: beside the text on wide screens (`side`), above it otherwise.
 * @param {GrammarNode[]} sections
 * @param {Map<string, string>} ids
 * @param {boolean} side
 */
function contents(sections, ids, side) {
	return h(
		'nav',
		{ class: side ? 'g-toc g-toc-side' : 'g-toc g-toc-top', 'aria-label': 'On this page' },
		h(
			'details',
			{ open: side || matchMedia(WIDE).matches },
			h('summary', null, 'On this page'),
			h('ol', { lang: 'my' }, sections.map((s) => h('li', null, h('a', { href: `#${ids.get(s.root.name)}` }, s.root.name)))),
		),
	);
}

/**
 * @param {GrammarNode} n
 * @param {string} path
 * @param {Map<string, string>} ids
 */
function collectIds(n, path, ids) {
	(n.kind ?? []).forEach((k, i) => {
		const p = path ? `${path}-${i + 1}` : String(i + 1);
		if (!ids.has(k.root.name)) ids.set(k.root.name, `s-${p}`);
		collectIds(k, p, ids);
	});
}

/**
 * One section and the sections inside it.
 * @param {GrammarNode} n
 * @param {number} depth  0 is the topic itself (its title is the page's h1).
 * @param {string} path
 * @param {Map<string, string>} ids
 * @returns {HTMLElement}
 */
function node(n, depth, path, ids) {
	const heading = depth === 0 ? null : h(depth === 1 ? 'h2' : 'h3', { class: 'g-h' }, n.root.name);
	return h(
		depth === 0 ? 'div' : 'section',
		{ class: `g-section g-depth-${depth}`, id: depth ? `s-${path}` : null },
		heading,
		n.root.desc ? h('p', { class: 'g-def' }, quoted(n.root.desc)) : null,
		n.root.note ? h('p', { class: 'g-note' }, quoted(n.root.note)) : null,
		(n.cate ?? []).map((c) =>
			h(
				'div',
				{ class: 'g-cate' },
				c.name ? h('p', { class: 'g-label' }, c.name) : null,
				c.desc ? h('p', null, quoted(c.desc)) : null,
				c.row?.length
					? h('ul', { class: 'chips' }, c.row.map((r) => h('li', null, ids.has(r) ? h('a', { href: `#${ids.get(r)}` }, r) : h('span', null, r))))
					: null,
			),
		),
		(n.word ?? []).map((w) =>
			h(
				'div',
				{ class: 'g-example' },
				h('p', { class: 'g-label' }, w.name || 'သာဓက'),
				w.row?.length ? h('ul', { class: 'g-words' }, w.row.map((r) => h('li', null, r))) : null,
				listOf(w.desc).map((d) => h('p', null, quoted(d))),
			),
		),
		(n.exam ?? []).map((e) =>
			h(
				'div',
				{ class: 'g-exam' },
				e.name && !e.form?.length ? h('p', { class: 'g-sentence' }, quoted(e.name)) : null,
				e.name && e.form?.length ? h('p', { class: 'g-label' }, e.name) : null,
				listOf(e.desc).map((d) => h('p', null, quoted(d))),
				(e.form ?? []).map((f) => formTable(f)),
			),
		),
		(n.kind ?? []).map((k, i) => node(k, depth + 1, path ? `${path}-${i + 1}` : String(i + 1), ids)),
	);
}

/**
 * An example table: column titles, then rows. A `chain` (such as "+") is
 * shown between the cells, so each row reads as a formula.
 * @param {{ title: string[], chain?: string, caption?: string, row: string[][] }} f
 */
function formTable(f) {
	const chain = f.chain?.trim();
	/** @param {string[]} cells @param {'th' | 'td'} tag */
	const line = (cells, tag) =>
		h('tr', null, cells.flatMap((c, i) => [i && chain ? h(tag, { class: 'g-chain', 'aria-hidden': 'true' }, tag === 'td' ? chain : '') : null, h(tag, null, c)]));
	return h(
		'div',
		{ class: 'g-table' },
		h('table', null, f.caption ? h('caption', null, f.caption) : null, h('thead', null, line(f.title, 'th')), h('tbody', null, f.row.map((r) => line(r, 'td')))),
	);
}

/**
 * The English parts of speech (part-of-speech topic), opened on request.
 * @param {NonNullable<GrammarTopic['english']>} blocks
 */
function english(blocks) {
	const [first, ...rest] = blocks;
	const title = first?.type === 'h1' ? first.text : 'The parts of speech in English';
	const body = first?.type === 'h1' ? rest : blocks;
	return h(
		'details',
		{ class: 'g-english', lang: 'en' },
		h('summary', null, sentenceCase(title)),
		body.map((b) =>
			b.type === 'h2' ? h('h3', null, sentenceCase(b.text)) : b.type === 'quote' ? h('p', { class: 'g-quote' }, b.text) : h('p', null, b.text),
		),
	);
}

// ---------------------------------------------------------------- text

/** @param {string | string[] | null | undefined} v */
function listOf(v) {
	return Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
}

/** @param {string} s */
function sentenceCase(s) {
	return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

/**
 * Text with the words in single quotes highlighted (the quotes dropped).
 * @param {string} text
 * @returns {Node[]}
 */
function quoted(text) {
	/** @type {Node[]} */
	const out = [];
	let last = 0;
	for (const m of text.matchAll(/'([^'\n]+)'/g)) {
		const at = m.index ?? 0;
		if (at > last) out.push(document.createTextNode(text.slice(last, at)));
		out.push(h('b', { class: 'g-q' }, m[1]));
		last = at + m[0].length;
	}
	if (last < text.length) out.push(document.createTextNode(text.slice(last)));
	return out;
}

/** @param {string} text  For summaries: the same text without the quote marks. */
function unquote(text) {
	return text.replace(/'([^'\n]+)'/g, '$1');
}
