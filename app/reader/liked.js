// @ts-check
/**
 * /liked: the entries and meanings the member rated, from their own
 * ratings (GET /api/workspace/ratings?scope=mine), on the stage
 * (reader/stage.js): the words along the bottom, the chosen one's
 * meaning in the card, with its rating to change and the way to its page.
 * "Helpful" holds those rated helpful, "Not helpful" the others, newest
 * first. A meaning changed since it was rated is marked: worth reading
 * again, and rating it again counts (the old rating no longer does).
 *
 *   ?value=down   the Not helpful set
 *   ?w=emd:123    the meaning (or e:en:word, the entry) in the card
 *   ?changed=1    only those changed since rated
 */
import { reviewed } from '#shared/quiz.js';
import { h, icon } from '../core/dom.js';
import { renderMarkup } from '../core/markup.js';
import { ICONS } from '../core/icons.js';
import { member, providerLinks } from '../core/member.js';
import { definitionHref } from '../core/routes.js';
import { lookup, react, workspaceRatings } from '../data/api.js';
import { ago, posName, t } from '../i18n/index.js';
import { plainSense } from '../workspace/columns.js';
import { findChips, likedChips } from './stage-data.js';
import { NARROW, noteCard, stage } from './stage.js';

/** @typedef {import('../data/api.js').RatedSense} RatedSense */
/** @typedef {import('../data/api.js').RatedEntry} RatedEntry */

export function title() {
	return t('Liked');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const value = ctx.query.get('value') === 'down' ? 'down' : 'up';
	const changedOnly = ctx.query.get('changed') === '1';
	const page = h('section', { class: 'page liked' }, h('h1', { class: 'large-title' }, t('Liked')));
	const me = await member().catch(() => null);
	const st = stage({
		page: 'liked',
		ctx,
		onChoose: (id) => showChip(id),
		onFind: (q) => {
			st.setChips(findChips(shown(), q), st.chosen() ?? undefined);
		},
	});
	page.append(st.root);
	/** @type {Array<RatedEntry | RatedSense>} */
	let items = [];
	/** @type {import('../data/api.js').RatingsCounts | null} */
	let counts = null;

	if (!me) {
		st.setPalette([]);
		st.setChips([]);
		st.card.replaceChildren(noteCard(t('Your liked meanings'), [t('Words and meanings you rate helpful are kept here, on every device you sign in on. Reading never needs an account.'), providerLinks('you-provider', '/liked')]));
		st.root.dataset.view = 'card';
		return page;
	}

	const chipsAll = () => likedChips(items, posName, { entry: t('Whole entry'), gone: t('No longer in the dictionary') });
	const shown = () => (changedOnly ? chipsAll().filter((c) => c.marked) : chipsAll());

	const tools = () => {
		const changed = chipsAll().filter((c) => c.marked).length;
		const go = (/** @type {Record<string, string | null>} */ q) => {
			const url = new URL(location.href);
			for (const [k, v] of Object.entries(q)) v === null ? url.searchParams.delete(k) : url.searchParams.set(k, v);
			url.searchParams.delete('w');
			ctx.go(url.pathname + url.search);
		};
		/** @type {import('./stage.js').Tool[]} */
		const list = [
			{ id: 'up', icon: ICONS.thumbUp, label: t('Helpful'), pressed: value === 'up', count: counts?.up, filter: true, press: () => go({ value: null }) },
			{ id: 'down', icon: ICONS.thumbDown, label: t('Not helpful'), pressed: value === 'down', count: counts?.down, filter: true, press: () => go({ value: 'down' }) },
		];
		if (changed || changedOnly) list.push({ id: 'changed', icon: ICONS.history, label: t('Changed since you rated'), pressed: changedOnly, count: changed, press: () => go({ changed: changedOnly ? null : '1' }) });
		if (items.length) list.push({ id: 'find', icon: ICONS.search, label: t('Find a word'), press: () => {} });
		const english = [...new Set(shown().filter((c) => c.lang === 'en').map((c) => c.word))];
		if (english.length >= 2) list.push({ id: 'practice', icon: ICONS.practice, label: t('Test yourself on these'), press: () => ctx.go(`/practice?words=${encodeURIComponent(english.slice(0, 8).join(','))}`) });
		return list;
	};

	const load = async () => {
		st.setPalette([]);
		st.card.replaceChildren(h('div', { class: 'stage-loading', role: 'status' }, h('i', { 'aria-hidden': 'true' }), t('Fetching your ratings…')));
		try {
			/** @type {import('../data/api.js').RatingsFilter} */
			const f = { scope: 'mine', kind: 'entries', value, order: 'new', q: '' };
			const [entries, senses] = await Promise.all([workspaceRatings(f), workspaceRatings({ ...f, kind: 'senses' })]);
			items = [.../** @type {RatedEntry[]} */ (entries.items), .../** @type {RatedSense[]} */ (senses.items)];
			counts = senses.counts; // Both kinds, before any filter.
		} catch (err) {
			st.setChips([]);
			st.card.replaceChildren(noteCard(t('Your ratings could not be fetched'), [err instanceof Error ? err.message : String(err), t('Nothing of yours is lost.')], [button(t('Try again'), 'quiz-btn quiz-primary', load)]));
			st.root.dataset.view = 'card';
			return;
		}
		st.setPalette(tools());
		if (!items.length) {
			st.setChips([]);
			st.root.dataset.view = 'card';
			st.card.replaceChildren(
				value === 'up'
					? noteCard(t('Nothing liked yet'), [t('On any word’s page, touch and hold a meaning and rate it helpful; it comes here, as it reads, with its example.')], [h('a', { class: 'quiz-btn quiz-primary', href: '/definition' }, t('Look up a word'))])
					: noteCard(t('Nothing rated not helpful'), [t('Those ratings tell editors which meanings to look at.')]),
			);
			return;
		}
		st.setChips(shown(), ctx.query.get('w') ?? undefined);
	};

	/**
	 * The card for a chip: the meaning (or the entry's meanings) as it reads
	 * now, when it was rated, whether it changed, the rating to change.
	 * @param {string | null} id
	 */
	async function showChip(id) {
		if (!id) {
			if (NARROW.matches) st.card.replaceChildren();
			else if (items.length) st.card.replaceChildren(noteCard(t('Choose a word'), [t('Its meaning shows here.')]));
			return;
		}
		const item = items.find((it) => ('lang' in it ? `e:${it.lang}:${it.word}` : `${it.dict}:${it.sense_id}`) === id);
		if (!item) return;
		const word = 'lang' in item ? item.word : (item.word ?? '');
		const lang = 'lang' in item ? item.lang : item.dict === 'med' ? 'my' : 'en';
		const mine = /** @type {HTMLElement} */ (st.card);
		const ratedAt = new Date(item.at * 1000).toLocaleDateString([], { day: 'numeric', month: 'short' });
		const facts = h('p', { class: 'stage-facts' }, h('span', null, t('Rated {how}, {when}', { how: item.value === 1 ? t('helpful') : t('not helpful'), when: ratedAt })), ' ', h('span', { class: 'ws-quiet' }, `(${ago(item.at)})`));
		const head = h('header', { class: 'stage-card-head' }, h('h2', { lang }, word || t('(removed)')), word ? h('a', { class: 'stage-open', href: definitionHref(word) }, t('Open the page'), ' →') : null);
		const thumbs = rating(item, lang, word);
		mine.replaceChildren(head, facts, h('div', { class: 'stage-loading-line', role: 'status' }, t('Reading…')), thumbs);
		if (!('lang' in item)) {
			// The rated meaning: as it reads now (the ratings route already says that), its example from the entry.
			const meaning = item.sense ? plainSense(item.sense) : '';
			const sense = h('div', { class: 'stage-sense' }, item.type ? h('p', { class: 'stage-pos' }, posName(item.type)) : null, h('p', { class: 'stage-my', lang: lang === 'en' ? 'my' : 'en' }, item.state === 'gone' ? t('No longer in the dictionary') : meaning));
			mine.replaceChildren(head, facts, sense, thumbs);
			if (item.state === 'changed') thumbs.before(h('p', { class: 'stage-was' }, t('Changed since you rated it. Read it again; rating it again counts, the old rating no longer does.')));
			if (word && lang === 'en') {
				const found = await lookup(word).catch(() => null);
				if (st.chosen() !== id) return;
				const own = found && 'entries' in found ? /** @type {import('#shared/types.js').EnglishSense[]} */ (found.entries).find((s) => s.id === item.sense_id) : null;
				if (own?.example) sense.append(h('p', { class: 'stage-ex', lang: 'en' }, ...renderMarkup(own.example, { headword: word })));
			}
			return;
		}
		// The whole entry: its reviewed meanings, read on the device.
		const found = await lookup(word).catch(() => null);
		if (st.chosen() !== id) return;
		const list = h('div', { class: 'stage-senses' });
		if (found && found.language === 'en') {
			for (const s of reviewed(found).slice(0, 6)) list.append(h('div', { class: 'stage-sense' }, h('p', { class: 'stage-pos' }, posName(s.type)), h('p', { class: 'stage-my', lang: 'my' }, ...renderMarkup(s.glosses.join('; '), { headword: word })), s.example ? h('p', { class: 'stage-ex', lang: 'en' }, ...renderMarkup(s.example, { headword: word })) : null));
		} else if (found && found.language === 'my') {
			for (const s of found.entries.slice(0, 6)) list.append(h('div', { class: 'stage-sense' }, h('p', { class: 'stage-pos' }, posName(s.type)), h('p', { class: 'stage-my' }, plainSense(s.sense))));
		} else list.append(h('p', { class: 'ws-quiet' }, t('The entry could not be read just now.')));
		mine.replaceChildren(head, facts, h('p', { class: 'stage-pos' }, t('Whole entry')), list, thumbs);
	}

	/**
	 * The two thumbs, the given one pressed; pressing sends the change and
	 * moves the chip to the other set.
	 * @param {RatedEntry | RatedSense} item
	 * @param {'en' | 'my'} lang
	 * @param {string} word
	 */
	function rating(item, lang, word) {
		const up = thumb(ICONS.thumbUp, t('Helpful'), item.value === 1);
		const down = thumb(ICONS.thumbDown, t('Not helpful'), item.value === -1);
		const note = h('span', { class: 'ws-quiet stage-rate-note', role: 'status' });
		const press = async (/** @type {1 | -1} */ v) => {
			if (!word) return;
			const next = item.value === v ? 0 : v;
			up.disabled = down.disabled = true;
			try {
				await react(lang, word, next, 'lang' in item ? undefined : item.sense_id);
				// The counts follow: out of the old set, into the new one.
				if (counts) {
					if (item.value === 1) counts.up--;
					else counts.down--;
					if (next === 1) counts.up++;
					else if (next === -1) counts.down++;
				}
				note.textContent = next === 0 ? t('Rating removed.') : next === 1 ? t('Moved to Helpful.') : t('Moved to Not helpful.');
				// This set no longer holds it: the strip moves on to the next word.
				const before = shown();
				const at = before.findIndex((c) => c.id === st.chosen());
				items = items.filter((it) => it !== item);
				const after = shown();
				st.setPalette(tools());
				st.setChips(after, NARROW.matches ? null : (after[Math.min(at, after.length - 1)]?.id ?? null));
				if (!items.length) await load();
			} catch (err) {
				note.textContent = err instanceof Error ? err.message : String(err);
			} finally {
				up.disabled = down.disabled = false;
			}
		};
		up.addEventListener('click', () => press(1));
		down.addEventListener('click', () => press(-1));
		return h('div', { class: 'stage-acts' }, up, down, note);
	}

	await load();
	return page;
}

/** @param {string} path @param {string} label @param {boolean} on */
function thumb(path, label, on) {
	return /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: `stage-thumb${on ? ' is-on' : ''}`, 'aria-pressed': String(on), 'aria-label': label, title: label }, icon(path, 16)));
}

/** @param {string} label @param {string} cls @param {() => void} press */
function button(label, cls, press) {
	const b = h('button', { type: 'button', class: cls }, label);
	b.addEventListener('click', press);
	return b;
}
