// @ts-check
/**
 * Today, on the home page: the word of the day (the same for everyone that
 * day, worker/routes/today.js), with a way to test oneself on it and to
 * share it; and this reader's daily round, the words due in Practice.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { wordOfTheDay } from '../data/api.js';
import { progress } from '../data/quiz-store.js';
import { num, posName, t, tn } from '../i18n/index.js';
import { dayOf, dueWords, streakOf } from '#shared/quiz.js';

/** The reader's date, YYYY-MM-DD, in their own time zone. */
function localDay() {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** The Today section; it fills in when the word arrives, and stays empty offline. */
export function todaySection() {
	const box = h('section', { class: 'home-today', 'aria-label': t('Today') });
	const round = dailyRound();
	wordOfTheDay(localDay())
		.then((w) => {
			if (!w.word) return;
			box.prepend(wordCard(w.word, w.type ?? '', w.gloss ?? '', w.example ?? null));
		})
		.catch((err) => console.warn('No word of the day:', err));
	if (round) box.append(round);
	return box;
}

/**
 * @param {string} word
 * @param {string} type
 * @param {string} gloss
 * @param {string | null} example
 */
function wordCard(word, type, gloss, example) {
	const share = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-btn' }, icon(ICONS.copy, 16), t('Share')));
	const said = h('span', { class: 'quiz-small', role: 'status' });
	share.addEventListener('click', async () => {
		const url = new URL(definitionHref(word), location.origin).href;
		const text = `${word}: ${gloss}`;
		try {
			if (navigator.share) await navigator.share({ title: t('Word of the day: {word}', { word }), text, url });
			else {
				await navigator.clipboard.writeText(`${text}\n${url}`);
				said.textContent = t('Link copied.');
			}
		} catch (err) {
			// Closing the share sheet is not a failure.
			if (!(err instanceof DOMException && err.name === 'AbortError')) said.textContent = t('Could not share it from here.');
		}
	});
	return h(
		'article',
		{ class: 'home-today-word' },
		h('p', { class: 'home-today-eyebrow' }, t('Word of the day')),
		h('p', { class: 'home-today-head' }, h('a', { href: definitionHref(word), lang: 'en' }, word), type ? h('em', null, ` ${posName(type)}`) : null),
		gloss ? h('p', { class: 'home-today-gloss', lang: 'my' }, gloss) : null,
		example ? h('p', { class: 'home-today-example', lang: 'en' }, example) : null,
		h('div', { class: 'quiz-actions' }, h('a', { class: 'quiz-btn quiz-primary', href: `${definitionHref(word)}#test` }, t('Test yourself on it')), share),
		said,
	);
}

/** The daily round: words due today in Practice, or the streak; nothing before a first round. */
function dailyRound() {
	const p = progress();
	if (!Object.keys(p.words).length) return null;
	const today = dayOf();
	const due = dueWords(p, today).length;
	const streak = streakOf(p, today);
	return h(
		'div',
		{ class: 'home-today-round' },
		h('span', { class: 'home-today-round-icon', 'aria-hidden': 'true' }, icon(ICONS.practice, 16)),
		h('p', null, due ? tn('Your daily round: {n} word due.', 'Your daily round: {n} words due.', due, { n: num(due) }) : t('Nothing due today.'), streak ? ` ${tn('{n} day in a row.', '{n} days in a row.', streak, { n: num(streak) })}` : ''),
		due ? h('a', { class: 'quiz-btn quiz-primary', href: '/practice' }, t('Practise')) : h('a', { href: '/practice' }, t('Practice')),
	);
}
