// @ts-check
/**
 * "Test yourself" on a word page, and the rounds of the practice page.
 *
 * Questions are made on the device from the word's reviewed meanings and a
 * few other words' (shared/quiz.js); nothing is sent, and progress is kept
 * in this browser (data/quiz-store.js). The other words are fetched only
 * when the reader starts, so a page view costs no extra lookups.
 */
import { dayOf, dueWords, learnedCount, makeQuestions, otherWords, streakOf } from '#shared/quiz.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { getChoice } from '../core/consent.js';
import { lookup, popularWords, reportQuestion, sendQuizAnswers } from '../data/api.js';
import { recentSearches } from '../data/recent.js';
import { helpAfter } from './help.js';
import { keptWithAccount, progress, quizShown, saveRound, showQuiz } from '../data/quiz-store.js';
import { getLang, mark, num, t, tn } from '../i18n/index.js';

/** @typedef {import('#shared/quiz.js').Question} Question */
/** @typedef {import('#shared/types.js').EnglishResult} EnglishResult */
/** @typedef {{ question: Question, right: boolean, chosen: string }} Answer */
/**
 * @typedef {object} Frame  A round's place on the page, laid out like a comment: the heading above, a bubble beside the MyOrdbok mark.
 * @property {HTMLElement} section
 * @property {HTMLElement} body  Inside the bubble.
 * @property {(...extra: Array<Node | string | null>) => void} head  The heading: the label, then extra (count, steps, a control).
 * @property {(folded: boolean) => void} fold  Folded: the heading alone.
 */

/** Other words looked up for one word's questions, at most. */
const OTHERS_FETCHED = 6;

/** The forms a gap's choices are, in the interface language. */
const FORM_NAMES = /** @type {Record<string, string>} */ ({
	base: mark('plain form'),
	'third person': mark('third person'),
	past: mark('past'),
	'past participle': mark('past participle'),
	'-ing': mark('-ing form'),
});

/**
 * English results for words, the failed and the Myanmar left out.
 * @param {string[]} words
 * @returns {Promise<EnglishResult[]>}
 */
export async function lookups(words) {
	const settled = await Promise.allSettled(words.map((w) => lookup(w)));
	return settled.flatMap((s) => (s.status === 'fulfilled' && s.value.language === 'en' && s.value.entries.length ? [s.value] : []));
}

/** Words searched most this week, or none when unavailable. */
export async function popular() {
	try {
		return (await popularWords()).words.filter((w) => w.lang === 'en').map((w) => w.term);
	} catch {
		return [];
	}
}

/**
 * The card under a word's meanings, or null when the word has no reviewed
 * meaning to ask about. Hidden on this device, only its heading shows,
 * with the way to show it again.
 * @param {EnglishResult} data
 * @returns {HTMLElement | null}
 */
export function quizCard(data) {
	if (!data.entries.some((s) => s.kind === 'Active')) return null;
	const word = data.entries[0].word;
	const f = frame();

	const folded = () => {
		const show = h('button', { type: 'button', class: 'quiz-quiet' }, t('Show'));
		show.addEventListener('click', () => {
			showQuiz(true);
			intro();
		});
		f.fold(true);
		f.head(h('span', { class: 'quiz-head-end' }, show));
	};
	const intro = () => {
		f.fold(false);
		const start = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-btn quiz-primary' }, t('Start')));
		const hide = h('button', { type: 'button', class: 'quiz-quiet' }, t('Hide'));
		const due = dueWords(progress(), dayOf()).filter((w) => w !== word.toLowerCase()).length;
		f.head(h('span', { class: 'quiz-head-end' }, hide));
		f.body.replaceChildren(
			by(t('from its reviewed meanings')),
			h('p', { class: 'quiz-lead' }, t('How well do you know “{word}”? A few quick questions.', { word })),
			h('div', { class: 'quiz-actions' }, start, due ? h('a', { class: 'quiz-btn', href: '/practice' }, tn('Practise {n} word due', 'Practise {n} words due', due, { n: num(due) })) : null),
		);
		hide.addEventListener('click', () => {
			showQuiz(false);
			folded();
		});
		start.addEventListener('click', async () => {
			start.disabled = true;
			start.textContent = t('Making questions…');
			const questions = await questionsFor(data).catch((err) => {
				console.warn('Questions could not be made:', err);
				return [];
			});
			if (!questions.length) {
				f.head();
				f.body.replaceChildren(h('p', { class: 'quiz-lead' }, t('There are not enough reviewed meanings around “{word}” to make questions yet.', { word })));
				return;
			}
			play(f, questions, (answers, helped) => {
				const right = answers.every((a) => a.right);
				const today = dayOf();
				const saved = saveRound(word, right, today);
				const days = saved.words[word.toLowerCase()].due - today;
				ended(f, answers, [right && days > 1 ? tn('“{word}” comes back in {n} day.', '“{word}” comes back in {n} days.', days, { word, n: num(days) }) : t('“{word}” comes back tomorrow.', { word }), ...thanked(helped)], intro);
			});
		});
	};
	if (quizShown()) intro();
	else folded();
	return f.section;
}

/**
 * Up to three questions on a word, with other words fetched for the wrong choices.
 * @param {EnglishResult} data
 */
async function questionsFor(data) {
	const near = otherWords(data, recentSearches());
	let others = await lookups(near.slice(0, OTHERS_FETCHED));
	// Too few with meanings of their own: the week's popular words fill in.
	if (others.length < 4) {
		const more = otherWords(data, await popular()).filter((w) => !near.slice(0, OTHERS_FETCHED).includes(w));
		others = [...others, ...(await lookups(more.slice(0, OTHERS_FETCHED)))];
	}
	return makeQuestions(data, others);
}

/**
 * An empty round: the heading like Comments' and a bubble from MyOrdbok.
 * @returns {Frame}
 */
export function frame() {
	const heading = h('h2', { class: 'quiz-title' });
	const body = h('div', { class: 'quiz-bubble' });
	const row = h('div', { class: 'quiz-row' }, h('span', { class: 'quiz-avatar', 'aria-hidden': 'true' }, icon(ICONS.practice, 16)), body);
	const section = h('section', { class: 'quiz', 'aria-label': t('Test yourself') }, heading, row);
	const head = (/** @type {Array<Node | string | null>} */ ...extra) => heading.replaceChildren(h('span', null, t('Test yourself')), ...extra);
	head();
	const fold = (/** @type {boolean} */ folded) => {
		row.hidden = folded;
		section.classList.toggle('is-folded', folded);
	};
	return { section, body, head, fold };
}

/**
 * Who asks, as a comment names its author.
 * @param {string} [about]
 */
function by(about = '') {
	return h('p', { class: 'quiz-by' }, h('strong', null, 'MyOrdbok'), about ? h('span', null, about) : null);
}

/**
 * The bars of a round: done right, done wrong, now, still to come.
 * @param {Array<'is-right' | 'is-wrong' | 'is-now' | ''>} states
 */
function steps(states) {
	return h('span', { class: 'quiz-steps', 'aria-hidden': 'true' }, states.map((c) => h('span', { class: c })));
}

/**
 * Plays questions one after another in `host`, then calls done.
 * @param {Frame} f
 * @param {Question[]} questions
 * @param {(answers: Answer[], helped: number) => void} done  helped: questions answered to help the dictionary after the round.
 */
export function play(f, questions, done) {
	/** @type {Answer[]} */
	const answers = [];
	const show = (/** @type {number} */ i) => {
		const q = questions[i];
		const bars = steps(questions.map((_, n) => (n < i ? (answers[n].right ? 'is-right' : 'is-wrong') : n === i ? 'is-now' : '')));
		const feedback = h('div', { class: 'quiz-feedback', role: 'status' });
		const next = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-btn quiz-primary', hidden: true }, i + 1 < questions.length ? t('Next question') : t('See how you did')));
		const buttons = q.choices.map((c) =>
			/** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-choice', lang: q.kind === 'en-my' ? 'my' : 'en' }, h('span', { class: 'quiz-choice-text' }, c.text))),
		);
		buttons.forEach((b, n) =>
			b.addEventListener('click', () => {
				const chosen = q.choices[n];
				answers.push({ question: q, right: chosen.right, chosen: chosen.text });
				buttons.forEach((other, m) => {
					const c = q.choices[m];
					other.disabled = true;
					other.classList.add(c.right ? 'is-right' : m === n ? 'is-wrong' : 'is-other');
					const note = c.word && q.kind === 'en-my' ? c.word : c.note ? (q.kind === 'gap' ? c.note.split(', ').map((f) => t(FORM_NAMES[f] ?? f)).join(', ') : c.note) : '';
					const said = c.right ? t('Right') : m === n ? t('Your answer') : '';
					if (note || said) other.append(h('span', { class: 'quiz-choice-note', lang: q.kind === 'my-en' ? 'my' : 'en' }, [said, note].filter(Boolean).join(' · ')));
				});
				feedback.replaceChildren(...explain(q, chosen.right).filter((n) => n !== null));
				next.hidden = false;
				next.focus();
			}),
		);
		next.addEventListener('click', () => {
			if (i + 1 < questions.length) return show(i + 1);
			count(answers);
			next.disabled = true;
			helpAfter(f, q.word, (helped) => done(answers, helped));
		});
		f.head(h('span', { class: 'quiz-count' }, t('{n} of {total}', { n: num(i + 1), total: num(questions.length) })), bars);
		f.body.replaceChildren(
			by(),
			...prompt(q),
			h('div', { class: 'quiz-choices', role: 'group', 'aria-label': t('Choices') }, buttons),
			feedback,
			h('div', { class: 'quiz-actions' }, next),
			reportLink(q, () => answers[i]?.chosen ?? null),
		);
		// The question, not a choice, takes focus: a choice focused first would look picked.
		const ask = /** @type {HTMLElement | null} */ (f.body.querySelector('.quiz-ask'));
		ask?.setAttribute('tabindex', '-1');
		ask?.focus({ preventScroll: true });
	};
	show(0);
}

/**
 * A round's answers counted on the server, by question and choice, only for
 * a reader who allowed usage statistics; nothing else about them goes.
 * @param {Answer[]} answers
 */
function count(answers) {
	if (getChoice() !== 'granted' || !answers.length) return;
	sendQuizAnswers(answers.map((a) => ({ kind: a.question.kind, word: a.question.word, answer: rightOf(a.question), chosen: a.chosen }))).catch((err) => console.warn('Answers not counted:', err));
}

/** @param {Question} q */
const rightOf = (q) => q.choices.find((c) => c.right)?.text ?? '';

/**
 * The question as a line of text, as a report keeps it.
 * @param {Question} q
 */
function asked(q) {
	return q.kind === 'gap' ? `${q.before}___${q.after}` : q.prompt;
}

/** What can be wrong with a question, in the order offered. */
const REASONS = /** @type {const} */ ([
	['answer', mark('The right answer is wrong')],
	['choices', mark('More than one choice is right')],
	['spelling', mark('A spelling is wrong')],
	['other', mark('Something else')],
]);

/**
 * "Something wrong with this question?": a short form that sends the
 * question as it was shown, for editors to look at.
 * @param {Question} q
 * @param {() => string | null} chosen  What the reader picked, if they answered.
 */
function reportLink(q, chosen) {
	const wrap = h('div', { class: 'quiz-report' });
	const open = h('button', { type: 'button', class: 'quiz-quiet' }, t('Something wrong with this question?'));
	open.addEventListener('click', () => {
		const name = `quiz-reason-${Math.random().toString(36).slice(2, 8)}`;
		const radios = REASONS.map(([value, label]) => {
			const input = /** @type {HTMLInputElement} */ (h('input', { type: 'radio', name, value }));
			return h('label', { class: 'quiz-report-reason' }, input, t(label));
		});
		const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: 500, placeholder: t('What is wrong? (optional)'), 'aria-label': t('Note') }));
		const error = h('p', { class: 'quiz-report-error', role: 'alert', hidden: true });
		const send = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'quiz-btn quiz-primary' }, t('Send')));
		const cancel = h('button', { type: 'button', class: 'quiz-btn' }, t('Cancel'));
		const form = /** @type {HTMLFormElement} */ (
			h(
				'form',
				{ class: 'quiz-report-form' },
				h('fieldset', null, h('legend', null, t('What is wrong with it?')), radios),
				note,
				error,
				h('div', { class: 'quiz-actions' }, send, cancel),
			)
		);
		cancel.addEventListener('click', () => wrap.replaceChildren(open));
		form.addEventListener('submit', async (ev) => {
			ev.preventDefault();
			const picked = /** @type {HTMLInputElement | null} */ (form.querySelector('input[type=radio]:checked'));
			const said = note.value.trim();
			const fail = (/** @type {string} */ message) => {
				error.textContent = message;
				error.hidden = false;
			};
			if (!picked) return fail(t('Choose what is wrong.'));
			if (picked.value === 'other' && !said) return fail(t('Say what is wrong in the note.'));
			send.disabled = true;
			try {
				await reportQuestion({
					kind: q.kind,
					word: q.word,
					prompt: asked(q),
					answer: rightOf(q),
					choices: q.choices.map((c) => c.text),
					chosen: chosen(),
					reason: /** @type {typeof REASONS[number][0]} */ (picked.value),
					note: said || null,
					lang: getLang() === 'my' ? 'my' : 'en',
				});
				wrap.replaceChildren(h('p', { class: 'quiz-small', role: 'status' }, t('Thank you. Editors will look at this question.')));
			} catch (err) {
				send.disabled = false;
				fail(err instanceof Error ? err.message : String(err));
			}
		});
		wrap.replaceChildren(form);
		/** @type {HTMLInputElement} */ (radios[0].querySelector('input')).focus();
	});
	wrap.append(open);
	return wrap;
}

/** @param {Question} q */
function prompt(q) {
	switch (q.kind) {
		case 'en-my':
			return [h('p', { class: 'quiz-ask' }, t('Which one means “{word}”?', { word: q.prompt }))];
		case 'my-en':
			return [h('p', { class: 'quiz-ask' }, t('Which English word means this?')), h('p', { class: 'quiz-shown', lang: 'my' }, q.prompt)];
		case 'gap':
			return [h('p', { class: 'quiz-ask' }, t('Fill the gap')), h('p', { class: 'quiz-sentence', lang: 'en' }, q.before, h('span', { class: 'quiz-blank', 'aria-label': t('gap') }), q.after)];
	}
}

/**
 * Right or not, then the word's meaning in both languages: the Myanmar
 * glosses and, when the entry has one, its English explanation.
 * @param {Question} q
 * @param {boolean} right
 */
function explain(q, right) {
	const { glosses, explained } = q.answer;
	const answer = q.choices.find((c) => c.right)?.text ?? '';
	return [
		h('p', { class: 'quiz-verdict' }, right ? t('Right.') : t('Not quite.')),
		q.kind === 'gap' ? h('p', { class: 'quiz-said', lang: 'en' }, q.before, h('b', null, answer), q.after) : null,
		h('p', { class: 'quiz-meaning' }, h('b', { lang: 'en' }, q.word), ' ', h('span', { lang: 'my' }, glosses.slice(0, 3).join('၊ ')), explained ? h('span', { class: 'quiz-explained', lang: 'en' }, explained) : null),
	];
}

/**
 * A line for the answers that help the dictionary, if any.
 * @param {number} helped
 */
export function thanked(helped) {
	return helped ? [tn('{n} answer that helps the dictionary. Thank you.', '{n} answers that help the dictionary. Thank you.', helped, { n: num(helped) })] : [];
}

/**
 * The end of a round: the score, what comes back when, the streak and
 * words learned, and where to go next.
 * @param {Frame} f
 * @param {Answer[]} answers
 * @param {string[]} lines  What happens to the words.
 * @param {() => void} again
 */
export function ended(f, answers, lines, again) {
	f.body.closest('.quiz')?.classList.remove('is-helping');
	const today = dayOf();
	const p = progress();
	const streak = streakOf(p, today);
	const right = answers.filter((a) => a.right).length;
	const due = dueWords(p, today).length;
	const another = h('button', { type: 'button', class: 'quiz-btn' }, t('Another round'));
	another.addEventListener('click', again);
	f.head(steps(answers.map((a) => (a.right ? 'is-right' : 'is-wrong'))));
	f.body.replaceChildren(
		by(),
		h('p', { class: 'quiz-score' }, t('{right} of {total} right', { right: num(right), total: num(answers.length) })),
		h('ul', { class: 'quiz-lines' }, lines.map((l) => h('li', null, l))),
		h(
			'div',
			{ class: 'quiz-tiles' },
			h('div', { class: 'quiz-tile' }, h('strong', null, num(streak)), h('span', null, tn('day in a row', 'days in a row', streak))),
			h('div', { class: 'quiz-tile' }, h('strong', null, num(learnedCount(p))), h('span', null, t('words learned'))),
		),
		h(
			'div',
			{ class: 'quiz-actions' },
			location.pathname === '/practice' ? null : h('a', { class: 'quiz-btn quiz-primary', href: '/practice' }, due ? tn('Practise {n} word due', 'Practise {n} words due', due, { n: num(due) }) : t('Practise my recent words')),
			another,
		),
		h('p', { class: 'quiz-small' }, keptLine()),
	);
}

/** Where the progress is kept, as far as known now. */
export function keptLine() {
	return keptWithAccount() ? t('Your progress is kept with your account, on every device you sign in on.') : t('Your progress is kept on this device only. Sign in to keep it on every device.');
}
