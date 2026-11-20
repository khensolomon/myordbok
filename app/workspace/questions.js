// @ts-check
/**
 * Questions (?s=questions), for editors, in three columns (columns.js): what
 * readers said is wrong with a Test yourself question, and the questions
 * they often get wrong (worker/routes/quiz.js). Both point at an entry to
 * look at: an unclear or wrong meaning, a choice that is right too, a
 * misspelling. A question opens as the reader saw it, with the entry as the
 * dictionary has it now; a report is set done, or looked at again, beside it.
 *
 *   &view=reports|missed  &status=new|done|all (reports)  &order=wrong|answers (missed)  &q=…
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { setQuestionReport, workspaceQuestions } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';
import { entryMeanings, fact, listColumns } from './columns.js';

/** @typedef {import('../data/api.js').QuestionsFilter} Filter */
/** @typedef {import('../data/api.js').QuestionReport} Report */
/** @typedef {import('../data/api.js').MissedQuestion} Missed */

const VIEWS = /** @type {const} */ ([
	['reports', mark('Reported')],
	['missed', mark('Often missed')],
]);
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
 * The language a choice of this kind of question is written in.
 * @param {string} kind
 */
const choiceLang = (kind) => (kind === 'en-my' || kind === 'sense' ? 'my' : 'en');

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function questionsPanes(ctx, root, ago) {
	const q = ctx.query;
	/** @type {Filter} */
	const f = {
		view: q.get('view') === 'missed' ? 'missed' : 'reports',
		status: /** @type {Filter['status']} */ (STATUSES.some(([v]) => v === q.get('status')) ? q.get('status') : 'new'),
		order: q.get('order') === 'answers' ? 'answers' : 'wrong',
		q: (q.get('q') ?? '').trim(),
	};
	const reports = f.view === 'reports';
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
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Word starts with…'), 'aria-label': t('Find a word'), value: f.q }));
	/** @type {{ new: number, done: number, missed: number }} */
	let counts = { new: 0, done: 0, missed: 0 };

	return listColumns(
		/** @type {import('./columns.js').Columns<Report | Missed>} */ ({
			root,
			title: t('Questions'),
			choose: t('Choose a question from the list.'),
			nothing: (filtered) => (filtered ? t('Nothing matches.') : t('None yet.')),
			search,
			fetch: async (/** @type {number} */ offset) => {
				const page = await workspaceQuestions({ ...f, q: search.value.trim() }, offset);
				counts = page.counts;
				return { items: page.items, more: page.more };
			},
			count: () => t('{n} in all', { n: num(reports ? (f.status === 'all' ? counts.new + counts.done : counts[f.status]) : counts.missed) }),
			bar: () => ({
				groups: [
					{ title: t('Show'), current: f.view, fallback: 'reports', href: (/** @type {string} */ v) => href({ view: /** @type {Filter['view']} */ (v), q: '' }), choices: VIEWS.map(([v, l]) => ({ value: v, label: t(l), count: v === 'missed' ? counts.missed : counts.new })) },
					reports
						? { title: t('Status'), current: f.status, fallback: 'new', href: (/** @type {string} */ v) => href({ status: /** @type {Filter['status']} */ (v) }), choices: STATUSES.map(([v, l]) => ({ value: v, label: t(l) })) }
						: { title: t('Order'), current: f.order, fallback: 'wrong', href: (/** @type {string} */ v) => href({ order: /** @type {Filter['order']} */ (v) }), choices: ORDERS.map(([v, l]) => ({ value: v, label: t(l) })) },
				],
				search,
				reset: href({ status: 'new', order: 'wrong', q: '' }),
			}),
			row: (/** @type {Report | Missed} */ item) => {
				if ('picks' in item) {
					const share = Math.round((item.wrong / item.answers) * 100);
					return { word: item.word, lang: 'en', aside: `${num(share)}%`, sub: t(KIND_NAMES[item.kind] ?? item.kind), state: t('{wrong} of {answers} wrong', { wrong: num(item.wrong), answers: num(item.answers) }) };
				}
				return { word: item.word, lang: 'en', tag: t(KIND_NAMES[item.kind] ?? item.kind), sub: t(REASON_NAMES[item.reason] ?? item.reason), state: [item.status === 'done' ? t('Done') : '', ago(item.at, true)].filter(Boolean).join(' · '), off: item.status === 'done' };
			},
			show: (/** @type {Report | Missed} */ item, /** @type {{ update: (item: Report | Missed) => void }} */ then) => ('picks' in item ? missed(item, ago) : reported(item, ago, then.update)),
		}),
	);
}

/**
 * A reported question: as the reader saw it, the right answer and what they
 * picked marked, then what they said; set done beside it.
 * @param {Report} r
 * @param {(when: number, short?: boolean) => string} ago
 * @param {(r: Report) => void} update
 * @returns {import('./columns.js').ItemView}
 */
function reported(r, ago, update) {
	const toggle = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: r.status === 'new' ? 'ws-primary' : 'ws-secondary' }, r.status === 'new' ? t('Set done') : t('Look again')));
	const out = h('p', { class: 'ws-result', role: 'status' });
	toggle.addEventListener('click', async () => {
		toggle.disabled = true;
		const next = r.status === 'new' ? 'done' : 'new';
		try {
			await setQuestionReport(r.id, next);
			update({ ...r, status: next });
		} catch (err) {
			toggle.disabled = false;
			out.textContent = err instanceof Error ? err.message : String(err);
		}
	});
	return {
		name: r.word,
		lang: 'en',
		main: [
			h('header', { class: 'ws-item-head' }, h('h1', { lang: 'en' }, r.word), h('em', null, t(KIND_NAMES[r.kind] ?? r.kind))),
			h(
				'section',
				{ class: 'ws-question' },
				h('p', { class: 'ws-question-prompt', lang: r.kind === 'my-en' ? 'my' : 'en' }, r.prompt),
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
				r.kind === 'type' && r.chosen && !r.choices.includes(r.chosen) ? h('p', { class: 'ws-quiet' }, t('Typed:'), ' ', h('b', { lang: 'en' }, r.chosen)) : null,
			),
			h(
				'section',
				{ class: 'ws-question-said' },
				h('h2', null, t(REASON_NAMES[r.reason] ?? r.reason)),
				r.note ? h('blockquote', null, r.note) : null,
				h('p', { class: 'ws-quiet' }, r.member ? t('From {name}', { name: r.member }) : t('From a visitor'), ` · ${ago(r.at)}`),
			),
			entryMeanings(r.word),
		],
		side: [
			h(
				'section',
				{ class: 'ws-box ws-item-side-act' },
				h('h2', null, t('Status')),
				h('p', null, r.status === 'new' ? t('To look at') : t('Done')),
				toggle,
				out,
				h('p', { class: 'ws-quiet' }, t('What readers said is wrong with a question, as it was shown to them. Fix the entry if it needs it, then set the report done.')),
			),
			links(r.word),
		],
	};
}

/**
 * A question often missed: how often, and the wrong choices picked most.
 * @param {Missed} m
 * @param {(when: number, short?: boolean) => string} ago
 * @returns {import('./columns.js').ItemView}
 */
function missed(m, ago) {
	const lang = choiceLang(m.kind);
	const most = Math.max(m.answers - m.wrong, ...m.picks.map((p) => p.n), 1);
	const line = (/** @type {string} */ text, /** @type {number} */ n, right = false) =>
		h(
			'li',
			{ class: right ? 'is-right' : null },
			h('span', { class: 'ws-pick-text', lang }, text),
			h('span', { class: 'ws-pick-bar', 'aria-hidden': 'true' }, h('span', { style: `width: ${(n / most) * 100}%` })),
			h('small', null, num(n)),
		);
	return {
		name: m.word,
		lang: 'en',
		main: [
			h('header', { class: 'ws-item-head' }, h('h1', { lang: 'en' }, m.word), h('em', null, t(KIND_NAMES[m.kind] ?? m.kind))),
			h('section', { class: 'ws-question' }, h('h2', null, t('Answers')), h('ul', { class: 'ws-picks' }, line(m.answer, m.answers - m.wrong, true), ...m.picks.map((p) => line(p.text, p.n)))),
			entryMeanings(m.word),
		],
		side: [
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Answers')),
				h('dl', { class: 'ws-facts ws-facts-side' }, ...fact(t('Answered'), m.answers), ...fact(t('Wrong'), m.wrong), ...fact(t('Missed'), `${num(Math.round((m.wrong / m.answers) * 100))}%`), ...fact(t('Last answered'), ago(m.at))),
				h('p', { class: 'ws-quiet' }, t('Questions answered at least 3 times and missed at least once, counted only from readers who allowed usage statistics. A wrong choice picked often may be a meaning the word is missing.')),
			),
			links(m.word),
		],
	};
}

/**
 * The entry, on the site and in the studio.
 * @param {string} word
 */
function links(word) {
	return h(
		'section',
		{ class: 'ws-box ws-links' },
		h('h2', null, t('Entry')),
		h('a', { href: definitionHref(word) }, t('Open the entry')),
		h('a', { href: `/workspace?s=studio&word=${encodeURIComponent(word)}` }, t('Open in the studio')),
	);
}
