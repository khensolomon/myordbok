// @ts-check
/**
 * Votes (?s=votes), for editors, in three columns (columns.js): what members
 * who read Myanmar answered to the spelling and meaning questions
 * (worker/routes/help.js), to decide on. A question opens with how the
 * answers split and, for a meaning, the entry as the dictionary has it now;
 * the decision is made beside it.
 * Only members whose check answers show they read Myanmar are counted, and
 * "not sure" never is. A decision never changes the dictionary by itself:
 * a spelling decided labels the other spellings searched as misspellings
 * of it (as Searches does); a meaning is changed in the studio.
 *
 *   &kind=spelling|meaning  &state=ready|split|collecting|decided|set_aside  &q=…
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { addSpellingVote, decideVote, findSpellingVotes, workspaceVotes } from '../data/api.js';
import { mark, num, posName, t, tn } from '../i18n/index.js';
import { entryMeanings, listColumns } from './columns.js';

/** @typedef {import('../data/api.js').VoteItem} Item */
/** @typedef {import('../data/api.js').VotesFilter} Filter */

const KINDS = /** @type {const} */ ([
	['spelling', mark('Spelling')],
	['meaning', mark('Meaning')],
]);
const STATES = /** @type {const} */ ([
	['ready', mark('Ready')],
	['split', mark('Split')],
	['collecting', mark('Collecting')],
	['decided', mark('Decided')],
	['set_aside', mark('Set aside')],
]);
/** @type {Record<string, string>} */
const ANSWERS = {
	many: mark('More than one is right'),
	yes: mark('Right'),
	no: mark('Wrong'),
	right: mark('Right'),
	wrong: mark('Wrong'),
};
/** @type {Record<string, string>} */
const SOURCES = {
	search: mark('searched, not found'),
	editor: mark('added by an editor'),
	review: mark('not yet reviewed'),
};

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function votesPanes(ctx, root, ago) {
	const q = ctx.query;
	/** @type {Filter} */
	const f = {
		kind: q.get('kind') === 'meaning' ? 'meaning' : 'spelling',
		state: /** @type {Filter['state']} */ (STATES.some(([v]) => v === q.get('state')) ? q.get('state') : 'ready'),
		q: (q.get('q') ?? '').trim(),
	};
	/** @param {Partial<Filter>} change */
	const href = (change) => {
		const n = { ...f, ...change };
		const p = new URLSearchParams({ s: 'votes' });
		if (n.kind !== 'spelling') p.set('kind', n.kind);
		if (n.state !== 'ready') p.set('state', n.state);
		if (n.q) p.set('q', n.q);
		return `/workspace?${p}`;
	};
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Find a word…'), 'aria-label': t('Find a word'), value: f.q }));
	/** @type {Record<Item['state'], number>} */
	let counts = { ready: 0, split: 0, collecting: 0, decided: 0, set_aside: 0 };
	let rules = '';
	const answerName = (/** @type {string} */ a) => (ANSWERS[a] ? t(ANSWERS[a]) : a);
	/** @type {() => void} */
	let reload = () => {};

	return listColumns({
		root,
		title: t('Votes'),
		choose: t('Choose a question from the list.'),
		nothing: (filtered) => (filtered ? t('Nothing matches.') : t('None yet.')),
		search,
		fetch: async (offset) => {
			const page = await workspaceVotes({ ...f, q: search.value.trim() }, offset);
			counts = page.counts;
			rules = t('Ready at {votes} counted votes with {share}% agreeing. Counted: members who answered {checks} check questions with {fluent}% or more right; “not sure” is left out.', {
				votes: num(page.rules.votes),
				share: num(Math.round(page.rules.share * 100)),
				checks: num(page.rules.checks),
				fluent: num(Math.round(page.rules.fluent * 100)),
			});
			return { items: page.items, more: page.more };
		},
		count: () => t('{n} in all', { n: num(counts[f.state]) }),
		bar: () => ({
			groups: [
				{ title: t('Kind'), current: f.kind, fallback: 'spelling', href: (v) => href({ kind: /** @type {Filter['kind']} */ (v), state: 'ready', q: '' }), choices: KINDS.map(([v, l]) => ({ value: v, label: t(l) })) },
				{ title: t('Status'), current: f.state, fallback: 'ready', href: (v) => href({ state: /** @type {Filter['state']} */ (v) }), choices: STATES.map(([v, l]) => ({ value: v, label: t(l), count: counts[v] })) },
			],
			search,
			reset: href({ state: 'ready', q: '' }),
		}),
		foot: [f.kind === 'spelling' ? spellingTools(() => reload()) : null],
		row: (item) => {
			const total = item.answers.reduce((a, x) => a + x.n, 0);
			const top = item.answers[0];
			const share = top && total ? `${num(Math.round((top.n / total) * 100))}%` : '—';
			const votes = tn('{n} counted vote', '{n} counted votes', item.votes, { n: num(item.votes) });
			return item.kind === 'spelling'
				? { word: (item.options ?? []).join(' / '), lang: 'my', aside: share, sub: top ? answerName(top.text) : t('No answers yet'), subLang: top && !ANSWERS[top.text] ? 'my' : undefined, state: votes, off: item.state === 'decided' || item.state === 'set_aside' }
				: { word: /** @type {string} */ (item.word), lang: 'en', aside: share, sub: item.gloss ?? '', subLang: 'my', state: [item.type ? posName(item.type) : '', votes].filter(Boolean).join(' · '), off: item.state === 'decided' || item.state === 'set_aside' };
		},
		ready: (list) => (reload = list.reload),
		show: (item, then) => view(item, ago, rules, then.reload),
	});
}

/**
 * Making spelling questions: from words searched and not found, or typed in.
 * @param {() => void} reload
 */
function spellingTools(reload) {
	const find = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, t('Find in searches')));
	const say = h('span', { class: 'ws-quiet', role: 'status' });
	const field = /** @type {HTMLInputElement} */ (
		h('input', {
			type: 'text',
			lang: 'my',
			placeholder: t('Spellings to ask about, separated by commas'),
			'aria-label': t('Spellings to ask about'),
		})
	);
	const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-secondary' }, t('Ask')));
	find.addEventListener('click', async () => {
		find.disabled = true;
		try {
			const r = await findSpellingVotes();
			say.textContent = tn('{n} question added from {looked} words searched.', '{n} questions added from {looked} words searched.', r.added, { n: num(r.added), looked: num(r.looked) });
			reload();
		} catch (err) {
			say.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			find.disabled = false;
		}
	});
	const form = /** @type {HTMLFormElement} */ (h('form', { class: 'ws-votes-add' }, field, add));
	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		const options = field.value
			.split(/[,၊]/)
			.map((s) => s.normalize('NFC').trim())
			.filter(Boolean);
		add.disabled = true;
		try {
			await addSpellingVote(options);
			field.value = '';
			say.textContent = t('Added. Members are asked it from now on.');
			reload();
		} catch (err) {
			say.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			add.disabled = false;
		}
	});
	return h(
		'section',
		{ class: 'ws-card ws-card-wide ws-votes-tools' },
		h('p', { class: 'ws-quiet' }, t('Spelling questions come from Myanmar words searched at least twice and not found, against dictionary words one slip away; or from spellings typed here.')),
		h('div', { class: 'ws-votes-tools-row' }, find, form),
		say,
	);
}

/**
 * A question opened: how the answers split, and the decision beside it.
 * @param {Item} item
 * @param {(when: number, short?: boolean) => string} ago
 * @param {string} rules  How votes are counted.
 * @param {() => void} reload  The list again, after a decision.
 * @returns {import('./columns.js').ItemView}
 */
function view(item, ago, rules, reload) {
	const total = item.answers.reduce((a, x) => a + x.n, 0);
	const answerName = (/** @type {string} */ a) => (ANSWERS[a] ? t(ANSWERS[a]) : a);
	const top = item.answers[0];
	const most = Math.max(1, ...item.answers.map((a) => a.n));
	const out = h('p', { class: 'ws-result', role: 'status' });
	const act = (/** @type {'decided' | 'set_aside' | 'collecting'} */ s, /** @type {string | undefined} */ decision) => async (/** @type {Event} */ ev) => {
		const b = /** @type {HTMLButtonElement} */ (ev.currentTarget);
		b.disabled = true;
		try {
			await decideVote(item.id, s, decision);
			reload();
		} catch (err) {
			b.disabled = false;
			out.textContent = err instanceof Error ? err.message : String(err);
		}
	};
	const button = (/** @type {string} */ label, /** @type {(ev: Event) => void} */ onClick, primary = false) => {
		const b = h('button', { type: 'button', class: primary ? 'ws-primary' : 'ws-secondary' }, label);
		b.addEventListener('click', onClick);
		return b;
	};
	/** @type {Node[]} */
	let actions;
	if (item.state === 'decided' || item.state === 'set_aside') {
		actions = [button(t('Ask again'), act('collecting'))];
	} else if (item.kind === 'spelling') {
		actions = [
			...(item.options ?? []).map((o) => button(t('{word} is right', { word: o }), act('decided', o), top?.text === o)),
			button(t('More than one is right'), act('decided', 'many'), top?.text === 'many'),
			button(t('Set aside'), act('set_aside')),
		];
	} else {
		actions = [button(t('Right'), act('decided', 'right'), top?.text === 'yes'), button(t('Wrong'), act('decided', 'wrong'), top?.text === 'no'), button(t('Set aside'), act('set_aside'))];
	}
	const facts = [
		tn('{n} counted vote', '{n} counted votes', item.votes, { n: num(item.votes) }),
		item.asked > item.votes ? t('{n} answers in all', { n: num(item.asked) }) : '',
		item.searched ? tn('searched {n} time, not found', 'searched {n} times, not found', item.searched, { n: num(item.searched) }) : t(SOURCES[item.source] ?? item.source),
		ago(item.at),
	].filter(Boolean);
	const name = item.kind === 'spelling' ? (item.options ?? []).join(' / ') : /** @type {string} */ (item.word);
	return {
		name,
		lang: item.kind === 'spelling' ? 'my' : 'en',
		main: [
			h(
				'header',
				{ class: 'ws-item-head' },
				h('h1', { lang: item.kind === 'spelling' ? 'my' : 'en' }, name),
				h('em', null, item.kind === 'spelling' ? t('Spelling') : [t('Meaning'), item.type ? ` · ${posName(item.type)}` : '']),
			),
			item.kind === 'meaning' ? h('p', { class: 'ws-item-sense', lang: 'my' }, item.gloss) : null,
			h(
				'section',
				{ class: 'ws-question' },
				h('h2', null, t('Answers')),
				item.answers.length
					? h(
							'ul',
							{ class: 'ws-picks' },
							item.answers.map((a, n) =>
								h(
									'li',
									{ class: n === 0 ? 'is-right' : null },
									h('span', { class: 'ws-pick-text', lang: item.kind === 'spelling' && !ANSWERS[a.text] ? 'my' : null }, answerName(a.text)),
									h('span', { class: 'ws-pick-bar', 'aria-hidden': 'true' }, h('span', { style: `width: ${(a.n / most) * 100}%` })),
									h('small', null, total ? `${num(a.n)} · ${num(Math.round((a.n / total) * 100))}%` : num(a.n)),
								),
							),
						)
					: h('p', { class: 'ws-quiet' }, t('No answers yet')),
				h('p', { class: 'ws-quiet' }, facts.join(' · ')),
			),
			item.kind === 'meaning' && item.word ? entryMeanings(item.word, { id: item.sense_id, type: item.type }) : null,
		],
		side: [
			h(
				'section',
				{ class: 'ws-box ws-item-side-act' },
				h('h2', null, t('Decision')),
				item.decision ? h('p', null, t('Decided: {answer}', { answer: answerName(item.decision) })) : null,
				h('div', { class: 'ws-vote-actions' }, ...actions),
				out,
				h('p', { class: 'ws-quiet' }, item.kind === 'spelling' ? t('Deciding a spelling labels the other spellings searched as misspellings of it, as Searches does.') : t('A decision changes nothing by itself: the meaning is changed in the studio.')),
			),
			item.kind === 'meaning' && item.word
				? h(
						'section',
						{ class: 'ws-box ws-links' },
						h('h2', null, t('Entry')),
						h('a', { href: definitionHref(item.word) }, t('Open the entry')),
						h('a', { href: `/workspace?s=studio&word=${encodeURIComponent(item.word)}` }, t('Open in the studio')),
					)
				: null,
			h('section', { class: 'ws-box' }, h('h2', null, t('How votes count')), h('p', { class: 'ws-quiet' }, rules)),
		],
	};
}
