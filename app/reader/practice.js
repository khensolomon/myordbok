// @ts-check
/**
 * Practice: the words due today and the words looked up lately, one
 * question each. Everything is made and kept on this device (reader/quiz.js).
 */
import { dayOf, dueWords, learnedCount, makeQuestions, otherWords, streakOf } from '#shared/quiz.js';
import { h } from '../core/dom.js';
import { recentSearches } from '../data/recent.js';
import { clearProgress, progress, quizShown, saveRound, showQuiz } from '../data/quiz-store.js';
import { num, t, tn } from '../i18n/index.js';
import { ended, frame, lookups, play, popular, thanked } from './quiz.js';

/** Words in one round, at most. */
const ROUND = 8;

export function title() {
	return t('Practice');
}

export function view() {
	const f = frame();
	const page = h(
		'article',
		{ class: 'page prose practice' },
		h('h1', null, t('Practice')),
		h('p', { class: 'page-lead' }, t('The words you look up come back here. A word answered right waits longer each time: a day, then 3, 7 and 21 days. One answered wrong comes back the next day.')),
		h('p', { class: 'practice-paused notice' }, t('Practice is paused for now.')),
		f.section,
		settings(),
	);
	start(f);
	return page;
}

/** English words of the kind a dictionary page has. @param {string} w */
const english = (w) => /^[A-Za-z][A-Za-z' -]*$/.test(w);

/**
 * The words of the next round: due ones first, then recent searches not
 * yet practised.
 */
function roundWords() {
	const p = progress();
	const due = dueWords(p, dayOf());
	const fresh = recentSearches().filter((w) => english(w) && !p.words[w.toLowerCase()]);
	return [...new Set([...due, ...fresh.map((w) => w.toLowerCase())])].slice(0, ROUND);
}

/** @param {import('./quiz.js').Frame} f */
function start(f) {
	const p = progress();
	const today = dayOf();
	const words = roundWords();
	const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-btn quiz-primary' }, tn('Start: {n} word', 'Start: {n} words', words.length, { n: num(words.length) })));
	f.head();
	f.body.replaceChildren(
		h(
			'div',
			{ class: 'quiz-tiles quiz-tiles-three' },
			h('div', { class: 'quiz-tile' }, h('strong', null, num(dueWords(p, today).length)), h('span', null, t('due today'))),
			h('div', { class: 'quiz-tile' }, h('strong', null, num(streakOf(p, today))), h('span', null, tn('day in a row', 'days in a row', streakOf(p, today)))),
			h('div', { class: 'quiz-tile' }, h('strong', null, num(learnedCount(p))), h('span', null, t('words learned'))),
		),
		words.length ? h('div', { class: 'quiz-actions' }, go) : h('p', { class: 'quiz-lead' }, Object.keys(p.words).length ? t('Nothing due today. Words come back on their day; new words you look up join them.') : t('Nothing to practise yet. Look up a few English words; they come back here.')),
	);
	go.addEventListener('click', async () => {
		go.disabled = true;
		go.textContent = t('Making questions…');
		const round = await questions(words).catch((err) => {
			console.warn('Questions could not be made:', err);
			return [];
		});
		if (!round.length) {
			f.body.replaceChildren(h('p', { class: 'quiz-lead' }, t('These words have too few reviewed meanings to make questions yet.')));
			return;
		}
		play(f, round, (answers, helped) => {
			const today = dayOf();
			const lines = answers.map((a) => {
				const saved = saveRound(a.question.word, a.right, today);
				const days = saved.words[a.question.word.toLowerCase()].due - today;
				return a.right && days > 1 ? tn('“{word}” comes back in {n} day.', '“{word}” comes back in {n} days.', days, { word: a.question.word, n: num(days) }) : t('“{word}” comes back tomorrow.', { word: a.question.word });
			});
			ended(f, answers, [...lines, ...thanked(helped)], () => start(f));
		});
	});
}

/**
 * One question a word, taking turns between the kinds; the round's other
 * words, and the week's popular ones when they are few, give the wrong choices.
 * @param {string[]} words
 */
async function questions(words) {
	let found = await lookups(words);
	if (found.length < 5) found = [...found, ...(await lookups((await popular()).filter((w) => !words.includes(w.toLowerCase())).slice(0, 6)))];
	const byWord = new Map(found.map((r) => [r.query.toLowerCase(), r]));
	/** @type {Array<import('#shared/quiz.js').Question['kind']>} */
	const kinds = ['en-my', 'my-en', 'gap'];
	return words.flatMap((w, i) => {
		const target = byWord.get(w);
		if (!target) return [];
		const near = otherWords(target, found.map((r) => r.query));
		const others = near.map((n) => byWord.get(n.toLowerCase())).filter((r) => r !== undefined);
		// The turn's kind first, then any other the word can make.
		const order = [kinds[i % kinds.length], ...kinds.filter((k) => k !== kinds[i % kinds.length])];
		for (const kind of order) {
			const [q] = makeQuestions(target, others, { kinds: [kind] });
			if (q) return [q];
		}
		return [];
	});
}

/** Whether word pages offer questions here, and forgetting the progress. */
function settings() {
	const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: quizShown() }));
	box.addEventListener('change', () => showQuiz(box.checked));
	const forget = h('button', { type: 'button', class: 'quiz-quiet' }, t('Forget my progress'));
	let armed = false;
	forget.addEventListener('click', () => {
		if (!armed) {
			armed = true;
			forget.textContent = t('Press again to forget every word and the streak');
			return;
		}
		clearProgress();
		forget.textContent = t('Forgotten.');
		/** @type {HTMLButtonElement} */ (forget).disabled = true;
	});
	return h(
		'section',
		{ class: 'practice-settings' },
		h('label', { class: 'practice-toggle' }, box, t('Offer “Test yourself” on word pages')),
		h('p', { class: 'quiz-small' }, forget),
	);
}
