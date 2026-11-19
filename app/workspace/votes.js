// @ts-check
/**
 * Votes (?s=votes), for editors: what members who read Myanmar answered to
 * the spelling and meaning questions (worker/routes/help.js), to decide on.
 * Only members whose check answers show they read Myanmar are counted, and
 * "not sure" never is. A decision never changes the dictionary by itself:
 * a spelling decided labels the other spellings searched as misspellings
 * of it (as Searches does); a meaning is changed in the studio.
 *
 *   &kind=spelling|meaning  &state=ready|split|collecting|decided|set_aside  &q=…
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { addSpellingVote, decideVote, findSpellingVotes, workspaceVotes } from '../data/api.js';
import { mark, num, posName, t, tn } from '../i18n/index.js';

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
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function votesPane(ctx, ago) {
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
	const main = h('main', {
		class: 'ws-main ws-overview ws-ratings ws-votes',
		'aria-label': t('Votes'),
	});
	const head = h(
		'header',
		{ class: 'ws-ov-head' },
		h('h1', null, t('Votes')),
		h(
			'nav',
			{ class: 'ws-segments', 'aria-label': t('Kind') },
			KINDS.map(([v, text]) =>
				h(
					'a',
					{
						href: href({ kind: v, state: 'ready', q: '' }),
						'aria-current': v === f.kind ? 'true' : null,
					},
					t(text),
				),
			),
		),
	);
	const tiles = h('div', { class: 'ws-tiles' });
	const states = h('nav', { class: 'ws-segments', 'aria-label': t('Status') });
	const search = /** @type {HTMLInputElement} */ (
		h('input', {
			type: 'search',
			placeholder: t('Find a word…'),
			'aria-label': t('Find a word'),
			value: f.q,
		})
	);
	const rules = h('p', { class: 'ws-quiet' });
	const list = h('ul', { class: 'ws-rated' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	const tools = f.kind === 'spelling' ? spellingTools(() => load().catch(shout)) : '';
	const card = h(
		'section',
		{ class: 'ws-card ws-card-wide ws-rated-card' },
		h('div', { class: 'ws-rated-bar' }, states, h('label', { class: 'ws-search' }, icon(ICONS.search, 14), search)),
		rules,
		list,
		more,
	);
	let shown = 0;
	const shout = (/** @type {unknown} */ err) => list.replaceChildren(h('li', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err)));

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const page = await workspaceVotes(f, again ? shown : 0);
		const c = page.counts;
		states.replaceChildren(
			...STATES.map(([v, text]) =>
				h(
					'a',
					{
						href: href({ state: v }),
						'aria-current': v === f.state ? 'true' : null,
					},
					t(text),
					' ',
					h('span', { class: 'ws-count' }, num(c[v])),
				),
			),
		);
		tiles.replaceChildren(tile(t('Ready'), c.ready), tile(t('Split'), c.split), tile(t('Collecting'), c.collecting), tile(t('Decided'), c.decided));
		rules.textContent = t('Ready at {votes} counted votes with {share}% agreeing. Counted: members who answered {checks} check questions with {fluent}% or more right; “not sure” is left out.', {
			votes: num(page.rules.votes),
			share: num(Math.round(page.rules.share * 100)),
			checks: num(page.rules.checks),
			fluent: num(Math.round(page.rules.fluent * 100)),
		});
		if (!again) {
			list.replaceChildren();
			shown = 0;
		}
		shown += page.items.length;
		list.append(...page.items.map((item) => row(item, ago, () => load().catch(shout))));
		if (!shown) list.replaceChildren(h('li', { class: 'ws-quiet ws-rated-none' }, f.q ? t('Nothing matches.') : t('None yet.')));
		more.hidden = !page.more;
	};
	more.addEventListener('click', () => {
		more.disabled = true;
		load(true)
			.catch((err) => list.append(h('li', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))))
			.finally(() => (more.disabled = false));
	});
	let timer = 0;
	search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => {
			f.q = search.value.trim();
			history.replaceState(history.state, '', href({}));
			load().catch(shout);
		}, 250);
	});
	main.append(h('div', { class: 'ws-work' }, head, h('div', { class: 'ws-ov' }, tiles, tools, card)));
	await load();
	return main;
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
 * @param {Item} item
 * @param {(when: number, short?: boolean) => string} ago
 * @param {() => void} reload
 */
function row(item, ago, reload) {
	const total = item.answers.reduce((a, x) => a + x.n, 0);
	const answerName = (/** @type {string} */ a) => (ANSWERS[a] ? t(ANSWERS[a]) : a);
	const top = item.answers[0];
	const bar = h(
		'div',
		{ class: 'ws-vote-bar', 'aria-hidden': 'true' },
		item.answers.map((a, n) =>
			h('span', {
				class: n === 0 ? 'is-top' : '',
				style: `width: ${total ? (a.n / total) * 100 : 0}%`,
			}),
		),
	);
	const status = h('span', { class: 'ws-quiet', role: 'status' });
	const act = (/** @type {'decided' | 'set_aside' | 'collecting'} */ s, /** @type {string | undefined} */ decision) => async (/** @type {Event} */ ev) => {
		const b = /** @type {HTMLButtonElement} */ (ev.currentTarget);
		b.disabled = true;
		try {
			await decideVote(item.id, s, decision);
			reload();
		} catch (err) {
			b.disabled = false;
			status.textContent = err instanceof Error ? err.message : String(err);
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
	const share = top && total ? Math.round((top.n / total) * 100) : 0;
	const facts = [
		tn('{n} counted vote', '{n} counted votes', item.votes, {
			n: num(item.votes),
		}),
		item.asked > item.votes ? t('{n} answers in all', { n: num(item.asked) }) : '',
		top
			? t('{share}% {answer}', {
					share: num(share),
					answer: answerName(top.text),
				})
			: '',
		item.searched ? tn('searched {n} time, not found', 'searched {n} times, not found', item.searched, { n: num(item.searched) }) : t(SOURCES[item.source] ?? item.source),
	].filter(Boolean);
	return h(
		'li',
		{ class: 'ws-rated-row ws-vote-row' },
		h('span', { class: 'ws-thumb', 'aria-hidden': 'true' }, icon(item.kind === 'spelling' ? ICONS.document : ICONS.dictionary, 16)),
		h(
			'div',
			{ class: 'ws-rated-text' },
			item.kind === 'spelling'
				? h('span', { class: 'ws-vote-title', lang: 'my' }, (item.options ?? []).join(' / '))
				: [
						h(
							'a',
							{
								href: definitionHref(/** @type {string} */ (item.word)),
								lang: 'en',
							},
							item.word,
						),
						item.type ? h('em', null, ` ${posName(item.type)}`) : '',
						h('span', { class: 'ws-vote-title', lang: 'my' }, item.gloss),
					],
			bar,
			item.answers.length === 0
				? ''
				: h(
						'ul',
						{ class: 'ws-question-choices' },
						item.answers.map((a) =>
							h(
								'li',
								null,
								h(
									'span',
									{
										lang: item.kind === 'spelling' && !ANSWERS[a.text] ? 'my' : 'en',
									},
									answerName(a.text),
								),
								h('small', null, num(a.n)),
							),
						),
					),
			h('span', { class: 'ws-sense ws-quiet' }, facts.join(' · ')),
			item.decision ? h('span', { class: 'ws-flag' }, t('Decided: {answer}', { answer: answerName(item.decision) })) : '',
			h(
				'div',
				{ class: 'ws-vote-actions' },
				...actions,
				item.kind === 'meaning'
					? h(
							'a',
							{
								class: 'ws-link-button',
								href: `/workspace?s=studio&word=${encodeURIComponent(/** @type {string} */ (item.word))}`,
							},
							t('Open in the studio'),
						)
					: '',
			),
			status,
		),
		h('span', { class: 'ws-rated-time' }, ago(item.at, true)),
	);
}

/**
 * @param {string} label
 * @param {number} value
 */
function tile(label, value) {
	return h('div', { class: 'ws-tile' }, h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, ''));
}
