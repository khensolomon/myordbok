// @ts-check
/**
 * Questions (?s=questions), for editors: what readers said is wrong with a
 * Test yourself question, and the questions they often get wrong
 * (worker/routes/quiz.js). Both point at an entry to look at: an unclear or
 * wrong meaning, a choice that is right too, a misspelling.
 *
 *   &view=reports|missed  &status=new|done|all (reports)  &order=wrong|answers (missed)  &q=…
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { setQuestionReport, workspaceQuestions } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').QuestionsFilter} Filter */
/** @typedef {import('../data/api.js').QuestionReport} Report */
/** @typedef {import('../data/api.js').MissedQuestion} Missed */

const STATUSES = /** @type {const} */ ([
	['new', mark('To look at')],
	['done', mark('Done')],
	['all', mark('All')],
]);
const ORDERS = /** @type {const} */ ([
	['wrong', mark('Most missed')],
	['answers', mark('Most answered')],
]);
/** @type {Record<string, string>} */
const KIND_NAMES = {
	'en-my': mark('English → Myanmar'),
	'my-en': mark('Myanmar → English'),
	gap: mark('Fill the gap'),
	listen: mark('Listen'),
	type: mark('Type the word'),
	sense: mark('Which meaning'),
};
/** @type {Record<string, string>} */
const REASON_NAMES = {
	answer: mark('The right answer is wrong'),
	choices: mark('More than one choice is right'),
	spelling: mark('A spelling is wrong'),
	other: mark('Something else'),
};

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function questionsPane(ctx, ago) {
	const q = ctx.query;
	/** @type {Filter} */
	const f = {
		view: q.get('view') === 'missed' ? 'missed' : 'reports',
		status: /** @type {Filter['status']} */ (STATUSES.some(([v]) => v === q.get('status')) ? q.get('status') : 'new'),
		order: q.get('order') === 'answers' ? 'answers' : 'wrong',
		q: (q.get('q') ?? '').trim(),
	};
	/** @param {Partial<Filter>} change */
	const href = (change) => {
		const n = { ...f, ...change };
		const p = new URLSearchParams({ s: 'questions' });
		if (n.view === 'missed') p.set('view', 'missed');
		if (n.view === 'reports' && n.status !== 'new') p.set('status', n.status);
		if (n.view === 'missed' && n.order !== 'wrong') p.set('order', n.order);
		if (n.q) p.set('q', n.q);
		return `/workspace?${p}`;
	};
	const segments = (/** @type {string} */ label, /** @type {ReadonlyArray<readonly [string, string]>} */ options, /** @type {string} */ now, /** @type {(v: any) => Partial<Filter>} */ change) =>
		h('nav', { class: 'ws-segments', 'aria-label': label }, options.map(([v, text]) => h('a', { href: href(change(v)), 'aria-current': v === now ? 'true' : null }, t(text))));

	const main = h('main', { class: 'ws-main ws-overview ws-ratings ws-questions', 'aria-label': t('Questions') });
	const reports = f.view === 'reports';
	const head = h(
		'header',
		{ class: 'ws-ov-head' },
		h('h1', null, t('Questions')),
		h(
			'nav',
			{ class: 'ws-segments', 'aria-label': t('Show') },
			h('a', { href: href({ view: 'reports', q: '' }), 'aria-current': reports ? 'true' : null }, t('Reported')),
			h('a', { href: href({ view: 'missed', q: '' }), 'aria-current': reports ? null : 'true' }, t('Often missed')),
		),
	);
	const tiles = h('div', { class: 'ws-tiles' });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Word starts with…'), 'aria-label': t('Find a word'), value: f.q }));
	const list = h('ul', { class: 'ws-rated' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	const card = h(
		'section',
		{ class: 'ws-card ws-card-wide ws-rated-card' },
		h(
			'div',
			{ class: 'ws-rated-bar' },
			reports ? segments(t('Status'), STATUSES, f.status, (v) => ({ status: v })) : segments(t('Order'), ORDERS, f.order, (v) => ({ order: v })),
			h('label', { class: 'ws-search' }, icon(ICONS.search, 14), search),
		),
		h(
			'p',
			{ class: 'ws-quiet' },
			reports
				? t('What readers said is wrong with a question, as it was shown to them. Fix the entry if it needs it, then set the report done.')
				: t('Questions answered at least 3 times and missed at least once, counted only from readers who allowed usage statistics. A wrong choice picked often may be a meaning the word is missing.'),
		),
		list,
		more,
	);
	let shown = 0;

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const page = await workspaceQuestions(f, again ? shown : 0);
		const c = page.counts;
		tiles.replaceChildren(tile(t('To look at'), c.new), tile(t('Done'), c.done), tile(t('Often missed'), c.missed));
		if (!again) {
			list.replaceChildren();
			shown = 0;
		}
		shown += page.items.length;
		list.append(...page.items.map((r) => (reports ? reportRow(/** @type {Report} */ (r), ago) : missedRow(/** @type {Missed} */ (r), ago))));
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
			load().catch((err) => list.replaceChildren(h('li', { class: 'ws-quiet' }, err instanceof Error ? err.message : String(err))));
		}, 250);
	});

	main.append(h('div', { class: 'ws-work' }, head, h('div', { class: 'ws-ov' }, tiles, card)));
	await load();
	return main;
}

/**
 * The language a choice of this kind of question is written in.
 * @param {string} kind
 */
const choiceLang = (kind) => (kind === 'en-my' || kind === 'sense' ? 'my' : 'en');

/**
 * A reported question: as the reader saw it, the right answer and what they
 * picked marked, then what they said.
 * @param {Report} r
 * @param {(when: number, short?: boolean) => string} ago
 */
function reportRow(r, ago) {
	const toggle = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-link-button' }, r.status === 'new' ? t('Set done') : t('Look again')));
	const row = h(
		'li',
		{ class: `ws-rated-row ws-question-row${r.status === 'done' ? ' ws-question-done' : ''}` },
		h('span', { class: 'ws-thumb ws-thumb-down', 'aria-hidden': 'true' }, icon(ICONS.info, 16)),
		h(
			'div',
			{ class: 'ws-rated-text' },
			h('a', { href: definitionHref(r.word), lang: 'en' }, r.word),
			h('em', null, ` ${t(KIND_NAMES[r.kind] ?? r.kind)}`),
			h('span', { class: 'ws-question-prompt', lang: r.kind === 'my-en' ? 'my' : 'en' }, r.prompt),
			h(
				'ul',
				{ class: 'ws-question-choices' },
				r.choices.map((c) =>
					h(
						'li',
						{ class: c === r.answer ? 'is-right' : c === r.chosen ? 'is-chosen' : '' },
						h('span', { lang: choiceLang(r.kind) }, c),
						c === r.answer ? h('small', null, t('right')) : c === r.chosen ? h('small', null, t('picked')) : '',
					),
				),
			),
			h('span', { class: 'ws-flag' }, t(REASON_NAMES[r.reason] ?? r.reason)),
			r.note ? h('span', { class: 'ws-sense ws-question-note' }, `“${r.note}”`) : '',
			h('span', { class: 'ws-sense ws-quiet' }, r.member ? t('From {name}', { name: r.member }) : t('From a visitor')),
		),
		h('span', { class: 'ws-rated-time' }, ago(r.at, true)),
		toggle,
	);
	toggle.addEventListener('click', async () => {
		toggle.disabled = true;
		const next = r.status === 'new' ? 'done' : 'new';
		try {
			await setQuestionReport(r.id, next);
			r.status = next;
			row.classList.toggle('ws-question-done', next === 'done');
			toggle.textContent = next === 'new' ? t('Set done') : t('Look again');
		} catch (err) {
			toggle.title = err instanceof Error ? err.message : String(err);
		} finally {
			toggle.disabled = false;
		}
	});
	return row;
}

/**
 * A question often missed: how often, and the wrong choices picked most.
 * @param {Missed} m
 * @param {(when: number, short?: boolean) => string} ago
 */
function missedRow(m, ago) {
	const share = Math.round((m.wrong / m.answers) * 100);
	return h(
		'li',
		{ class: 'ws-rated-row ws-question-row' },
		h('span', { class: 'ws-score', title: t('{wrong} of {answers} wrong', { wrong: num(m.wrong), answers: num(m.answers) }) }, h('span', { class: 'ws-score-down' }, `${num(share)}%`)),
		h(
			'div',
			{ class: 'ws-rated-text' },
			h('a', { href: definitionHref(m.word), lang: 'en' }, m.word),
			h('em', null, ` ${t(KIND_NAMES[m.kind] ?? m.kind)}`),
			h('span', { class: 'ws-sense' }, t('Right answer:'), ' ', h('b', { lang: choiceLang(m.kind) }, m.answer), ` · ${t('{wrong} of {answers} wrong', { wrong: num(m.wrong), answers: num(m.answers) })}`),
			h(
				'span',
				{ class: 'ws-sense' },
				t('Picked instead:'),
				' ',
				...m.picks.slice(0, 4).flatMap((p, i) => [i ? ', ' : '', h('span', { lang: choiceLang(m.kind) }, p.text), ` ×${num(p.n)}`]),
			),
		),
		h('span', { class: 'ws-rated-time' }, ago(m.at, true)),
	);
}

/**
 * @param {string} label
 * @param {number} value
 */
function tile(label, value) {
	return h('div', { class: 'ws-tile' }, h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, ''));
}
