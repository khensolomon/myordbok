// @ts-check
/**
 * Help the dictionary: after a round, a signed-in member is asked a spelling
 * or a meaning question or two (worker/routes/help.js). Not scored: there is
 * no right answer to show, and the member's answers go to editors as votes.
 * Some of the spelling questions are checks with a known answer, which decide
 * whose votes count; they look the same as the rest, so nothing here tells
 * them apart.
 */
import { h } from '../core/dom.js';
import { member } from '../core/member.js';
import { answerHelp, helpQuestions } from '../data/api.js';
import { posName, t } from '../i18n/index.js';

/** Set when the member asked not to be asked on this device. */
const OFF = 'mo:help-off';

function askedOff() {
	try {
		return localStorage.getItem(OFF) === '1';
	} catch {
		return false;
	}
}

/**
 * Asks the questions there are for `word`, one after another, in `body`;
 * calls done with how many were answered (0 when none were asked).
 * @param {{ body: HTMLElement, head: (...extra: Array<Node | string | null>) => void }} f
 * @param {string} word
 * @param {(helped: number) => void} done
 */
export async function helpAfter(f, word, done) {
	if (document.body.hasAttribute('data-help-off') || askedOff()) return done(0);
	/** @type {import('../data/api.js').HelpQuestion[]} */
	let questions = [];
	try {
		if (!(await member())) return done(0);
		questions = (await helpQuestions(word)).questions;
	} catch (err) {
		console.warn('Help questions unavailable:', err);
	}
	if (!questions.length) return done(0);
	let helped = 0;
	const show = (/** @type {number} */ i) => {
		if (i >= questions.length) return done(helped);
		const q = questions[i];
		const status = h('p', { class: 'quiz-small', role: 'status' });
		const skip = h('button', { type: 'button', class: 'quiz-quiet' }, t('Skip'));
		const never = h('button', { type: 'button', class: 'quiz-quiet' }, t('Don’t ask me these'));
		skip.addEventListener('click', () => show(i + 1));
		never.addEventListener('click', () => {
			try {
				localStorage.setItem(OFF, '1');
			} catch {
				// storage blocked: this round only
			}
			done(helped);
		});
		/** @type {Array<[string | number, string, string]>} */
		const choices =
			q.kind === 'spelling'
				? [
						...q.options.map((o, n) => /** @type {[number, string, string]} */ ([n, o, 'quiz-choice help-spelling'])),
						['many', t('More than one is right'), 'quiz-btn'],
						['unsure', t('I am not sure'), 'quiz-btn'],
					]
				: [
						['yes', t('Yes, it is right'), 'quiz-btn'],
						['no', t('No, it is wrong'), 'quiz-btn'],
						['unsure', t('I am not sure'), 'quiz-btn'],
					];
		const buttons = choices.map(([value, label, cls]) => {
			const b = /** @type {HTMLButtonElement} */ (
				h(
					'button',
					{
						type: 'button',
						class: cls,
						lang: typeof value === 'number' ? 'my' : null,
					},
					label,
				)
			);
			b.addEventListener('click', async () => {
				buttons.forEach((x) => (x.disabled = true));
				b.classList.add('is-picked');
				try {
					await answerHelp(q.id, value);
					helped++;
					status.textContent = t('Thank you.');
					setTimeout(() => show(i + 1), 700);
				} catch (err) {
					buttons.forEach((x) => (x.disabled = false));
					b.classList.remove('is-picked');
					status.textContent = err instanceof Error ? err.message : String(err);
				}
			});
			return b;
		});
		const spellings = buttons.filter((_, n) => typeof choices[n][0] === 'number');
		const others = buttons.filter((_, n) => typeof choices[n][0] !== 'number');
		f.head(
			h(
				'span',
				{ class: 'quiz-count' },
				t('{n} of {total}', {
					n: String(i + 1),
					total: String(questions.length),
				}),
			),
		);
		f.body.closest('.quiz')?.classList.add('is-helping');
		f.body.replaceChildren(
			h('p', { class: 'quiz-by' }, h('strong', null, t('Help the dictionary')), h('span', null, t('not scored'))),
			h('p', { class: 'quiz-lead' }, t('There is no wrong answer here. Your choice helps the editors decide.')),
			...(q.kind === 'spelling'
				? [
						h('p', { class: 'quiz-ask' }, t('Which spelling is right?')),
						h(
							'div',
							{
								class: 'quiz-choices',
								role: 'group',
								'aria-label': t('Choices'),
							},
							spellings,
						),
					]
				: [
						h('p', { class: 'quiz-ask' }, t('Is this a right meaning of “{word}”?', { word: q.word }), q.type ? h('em', { class: 'help-type' }, ` ${posName(q.type)}`) : null),
						h('p', { class: 'quiz-shown', lang: 'my' }, q.gloss),
					]),
			h('div', { class: 'quiz-actions' }, others),
			status,
			h('p', { class: 'quiz-small help-leave' }, skip, ' · ', never),
		);
	};
	show(0);
}
