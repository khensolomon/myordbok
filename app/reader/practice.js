// @ts-check
/**
 * Practice, on the stage (reader/stage.js): the learner's words along the
 * bottom by stage (due, learning, learned), the rest card in the middle
 * (what is due, the streak, what comes back when) with Start, and while a
 * round plays, the question alone. Choosing a word shows its meanings and
 * when it comes back. Everything is made and kept on this device
 * (reader/quiz.js, data/quiz-store.js); signed in, the progress follows
 * the account.
 *
 *   ?stage=learning|learned   the strip's set (Due is the default)
 *   ?w=word                   the word in the card
 *   ?words=a,b,c              a round of these words (from Liked)
 */
import { dayOf, dueWords, learnedCount, makeQuestions, otherWords, reviewed, streakOf } from '#shared/quiz.js';
import { h, icon } from '../core/dom.js';
import { renderMarkup } from '../core/markup.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { lookup } from '../data/api.js';
import { clearProgress, helped, keptWithAccount, progress, quizShown, saveRound, showQuiz, syncProgress } from '../data/quiz-store.js';
import { recentSearches } from '../data/recent.js';
import { num, posName, t, tn } from '../i18n/index.js';
import { ended, keptLine, kindsHere, lookups, play, popular, thanked } from './quiz.js';
import { byStage, comingUp, findChips, practiceChips } from './stage-data.js';
import { noteCard, stage } from './stage.js';

/** Words in one round, at most. */
const ROUND = 8;

export function title() {
	return t('Practice');
}

/** English words of the kind a dictionary page has. @param {string} w */
const english = (w) => /^[A-Za-z][A-Za-z' -]*$/.test(w);

/** @param {import('../core/routes.js').ViewContext} ctx */
export function view(ctx) {
	const filter = /** @type {'due' | 'learning' | 'learned'} */ (['learning', 'learned'].includes(ctx.query.get('stage') ?? '') ? ctx.query.get('stage') : 'due');
	const seeded = (ctx.query.get('words') ?? '').split(',').map((w) => w.trim().toLowerCase()).filter(english);
	const page = h('section', { class: 'page practice' }, h('h1', { class: 'large-title' }, t('Practice')), h('p', { class: 'practice-paused notice' }, t('Practice is paused for now.')));
	const st = stage({
		page: 'practice',
		ctx,
		onChoose: (id) => (id ? showWord(id) : rest()),
		onFind: (q) => st.setChips(findChips(byStage(allChips(), filter), q), st.chosen()),
	});
	page.append(st.root);
	let settingsOpen = false;

	/** The second line of a chip. @type {(stage: import('./stage-data.js').Chip['stage'], days: number, box: number) => string} */
	const noteOf = (stageName, days) => {
		if (stageName === 'new') return t('new');
		if (stageName === 'due') return days < 0 ? tn('due, {n} day ago', 'due, {n} days ago', -days, { n: num(-days) }) : t('due today');
		if (days === 1) return t('tomorrow');
		return t('in {n} days', { n: num(days) });
	};
	const fresh = () => {
		const p = progress();
		return [...new Set(recentSearches().filter((w) => english(w) && !p.words[w.toLowerCase()]).map((w) => w.toLowerCase()))];
	};
	const allChips = () => practiceChips(progress(), dayOf(), fresh(), noteOf);

	const tools = () => {
		const chips = allChips();
		const go = (/** @type {string | null} */ s) => {
			const url = new URL(location.href);
			s ? url.searchParams.set('stage', s) : url.searchParams.delete('stage');
			url.searchParams.delete('w');
			ctx.go(url.pathname + url.search);
		};
		/** @type {import('./stage.js').Tool[]} */
		const list = [
			{ id: 'due', icon: ICONS.calendar, label: t('Due'), pressed: filter === 'due', count: byStage(chips, 'due').length, filter: true, press: () => go(null) },
			{ id: 'learning', icon: ICONS.history, label: t('Learning'), pressed: filter === 'learning', count: byStage(chips, 'learning').length, filter: true, press: () => go('learning') },
			{ id: 'learned', icon: ICONS.check, label: t('Learned'), pressed: filter === 'learned', count: byStage(chips, 'learned').length, filter: true, press: () => go('learned') },
		];
		if (chips.length) list.push({ id: 'find', icon: ICONS.search, label: t('Find a word'), press: () => {} });
		list.push({ id: 'settings', icon: ICONS.settings, label: t('Settings'), pressed: settingsOpen, press: () => {
			settingsOpen = !settingsOpen;
			st.setPalette(tools());
			if (settingsOpen) st.card.replaceChildren(settings());
			else st.choose(st.chosen());
		} });
		return list;
	};

	const refresh = (/** @type {string | null} */ keep = st.chosen()) => {
		st.setPalette(tools());
		st.setChips(byStage(allChips(), filter), keep);
	};

	/** The words of the next round: the seeded ones, else due ones first, then recent searches not yet practised. */
	const roundWords = () => {
		if (seeded.length) return seeded.slice(0, ROUND);
		const p = progress();
		return [...new Set([...dueWords(p, dayOf()), ...fresh()])].slice(0, ROUND);
	};

	/** The rest card: what is due, how it goes, what comes back when, and Start. */
	function rest() {
		settingsOpen = false;
		const p = progress();
		const today = dayOf();
		const words = roundWords();
		const due = dueWords(p, today).length;
		const streak = streakOf(p, today);
		const learned = learnedCount(p);
		const helpedNow = helped();
		const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'quiz-btn quiz-primary stage-start' }, icon(ICONS.play, 16), ' ', seeded.length ? tn('Test these {n} words', 'Test these {n} words', words.length, { n: num(words.length) }) : tn('Start: {n} word', 'Start: {n} words', words.length, { n: num(words.length) })));
		go.addEventListener('click', () => round(go, words));
		const line = [];
		if (streak) line.push(tn('{n} day in a row', '{n} days in a row', streak, { n: num(streak) }));
		if (learned) line.push(tn('{n} word learned', '{n} words learned', learned, { n: num(learned) }));
		if (helpedNow) line.push(tn('{n} answer helped the dictionary', '{n} answers helped the dictionary', helpedNow, { n: num(helpedNow) }));
		const coming = comingUp(p, today).filter((c) => c.count);
		const big = seeded.length ? t('{n} words from Liked', { n: num(words.length) }) : due ? tn('{n} word due today', '{n} words due today', due, { n: num(due) }) : Object.keys(p.words).length ? t('Nothing due today') : t('Nothing to practise yet');
		const lead = seeded.length
			? t('One question each; a word answered right waits longer each time.')
			: due
				? t('One question each. A word answered right waits longer each time: a day, then 3, 7 and 21 days.')
				: Object.keys(p.words).length
					? t('Words come back on their day; new words you look up join them.')
					: t('Look up a few English words; they come back here, one question each.');
		st.card.replaceChildren(
			h('div', { class: 'stage-rest' },
				h('p', { class: 'stage-big' }, big),
				h('p', null, lead),
				line.length ? h('p', { class: 'stage-line ws-quiet' }, line.join(' · ')) : null,
				words.length ? h('div', { class: 'stage-buttons' }, go) : null,
				coming.length ? h('p', { class: 'stage-coming ws-quiet' }, t('Coming up: ') + coming.map((c) => (c.inDays === 1 ? tn('{n} tomorrow', '{n} tomorrow', c.count, { n: num(c.count) }) : t('{n} in {d} days', { n: num(c.count), d: num(c.inDays) }))).join(' · ')) : null,
				keptWithAccount() ? null : h('p', { class: 'stage-kept ws-quiet' }, keptLine()),
			),
		);
	}

	/**
	 * A round in the card, the stage's rest faded; the end shows the rest again.
	 * @param {HTMLButtonElement} go
	 * @param {string[]} words
	 */
	async function round(go, words) {
		go.disabled = true;
		go.textContent = t('Making questions…');
		const qs = await questions(words).catch((err) => {
			console.warn('Questions could not be made:', err);
			return [];
		});
		if (!qs.length) {
			st.card.replaceChildren(noteCard(t('Too few meanings yet'), [t('These words have too few reviewed meanings to make questions yet.')], [button(t('Back'), 'quiz-btn', () => rest())]));
			return;
		}
		// A frame of the stage: the card is the bubble, the heading its top line.
		const heading = h('div', { class: 'stage-round-head' });
		const body = h('div', { class: 'quiz-bubble stage-round-body' });
		const box = h('div', { class: 'quiz stage-round' }, heading, body);
		const f = {
			section: box,
			body,
			head: (/** @type {Array<Node | string | null>} */ ...extra) => heading.replaceChildren(...extra.filter((x) => x !== null)),
			fold() {},
		};
		st.card.replaceChildren(box);
		st.setPlaying(true);
		play(f, qs, (answers, helpedCount) => {
			const today = dayOf();
			const lines = answers.map((a) => {
				const saved = saveRound(a.question.word, a.right, today);
				const days = saved.words[a.question.word.toLowerCase()].due - today;
				return a.right && days > 1 ? tn('“{word}” comes back in {n} day.', '“{word}” comes back in {n} days.', days, { word: a.question.word, n: num(days) }) : t('“{word}” comes back tomorrow.', { word: a.question.word });
			});
			seeded.length = 0;
			if (ctx.query.has('words')) {
				const url = new URL(location.href);
				url.searchParams.delete('words');
				ctx.replace(url.pathname + url.search);
			}
			ended(f, answers, [...lines, ...thanked(helpedCount)], () => {
				st.setPlaying(false);
				refresh(null);
			});
			// The strip follows the new days while the end still shows.
			st.setPalette(tools());
		});
	}

	/** A word's card: its meanings and when it comes back. @param {string} word */
	async function showWord(word) {
		settingsOpen = false;
		const p = progress();
		const w = p.words[word];
		const today = dayOf();
		const head = h('header', { class: 'stage-card-head' }, h('h2', { lang: 'en' }, word), h('a', { class: 'stage-open', href: definitionHref(word) }, t('Open the page'), ' →'));
		const when = !w ? t('New: looked up lately, not yet practised.') : w.due <= today ? t('Due now.') + ' ' + ladder(w.box) : (w.due - today === 1 ? t('Comes back tomorrow.') : t('Comes back in {n} days.', { n: num(w.due - today) })) + ' ' + ladder(w.box);
		const list = h('div', { class: 'stage-senses' }, h('div', { class: 'stage-loading-line', role: 'status' }, t('Reading…')));
		st.card.replaceChildren(head, h('p', { class: 'stage-facts' }, when), list);
		const found = await lookup(word).catch(() => null);
		if (st.chosen() !== word) return;
		list.replaceChildren();
		if (found && found.language === 'en') {
			for (const s of reviewed(found).slice(0, 4)) list.append(h('div', { class: 'stage-sense' }, h('p', { class: 'stage-pos' }, posName(s.type)), h('p', { class: 'stage-my', lang: 'my' }, ...renderMarkup(s.glosses.join('; '), { headword: word })), s.example ? h('p', { class: 'stage-ex', lang: 'en' }, ...renderMarkup(s.example, { headword: word })) : null));
		}
		if (!list.childElementCount) list.append(h('p', { class: 'ws-quiet' }, t('No reviewed meanings yet; the question waits until there are.')));
	}

	/** Where a word stands on the ladder of days. @param {number} box */
	function ladder(box) {
		const steps = [1, 3, 7, 21];
		const n = steps[Math.min(box, steps.length - 1)];
		return tn('Next right answer: {n} day.', 'Next right answer: {n} days.', n, { n: num(n) });
	}

	/** Whether word pages offer questions here, and forgetting the progress. */
	function settings() {
		const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: quizShown() }));
		box.addEventListener('change', () => showQuiz(box.checked));
		const forget = h('button', { type: 'button', class: 'quiz-quiet' }, t('Forget my progress'));
		let armed = false;
		forget.addEventListener('click', async () => {
			if (!armed) {
				armed = true;
				forget.textContent = keptWithAccount() ? t('Press again to forget every word and the streak, on every device') : t('Press again to forget every word and the streak');
				return;
			}
			/** @type {HTMLButtonElement} */ (forget).disabled = true;
			try {
				await clearProgress();
				forget.textContent = t('Forgotten.');
				refresh(null);
			} catch (err) {
				/** @type {HTMLButtonElement} */ (forget).disabled = false;
				forget.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		return h(
			'div',
			{ class: 'stage-note practice-settings' },
			h('h2', null, t('Settings')),
			h('label', { class: 'practice-toggle' }, box, t('Offer “Test yourself” on word pages')),
			h('p', { class: 'quiz-small' }, h('span', { class: 'practice-kept' }, keptLine())),
			h('div', { class: 'stage-buttons' }, forget),
		);
	}

	refresh(ctx.query.get('w'));
	if (!st.chosen()) rest();
	// The account's words, when signed in: the stage shown again with them, unless a round plays.
	syncProgress()
		.then((signed) => {
			if (signed && st.root.dataset.playing === undefined) refresh();
		})
		.catch((err) => console.warn('Progress could not be brought from the account:', err));
	return page;
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
	const kinds = kindsHere();
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

/** @param {string} label @param {string} cls @param {() => void} press */
function button(label, cls, press) {
	const b = h('button', { type: 'button', class: cls }, label);
	b.addEventListener('click', press);
	return b;
}
