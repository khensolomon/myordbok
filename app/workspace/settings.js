// @ts-check
/**
 * Site settings (?s=settings), for admins: worker/lib/settings.js holds the
 * known keys, their defaults and their checks. Each one takes effect as soon
 * as it is saved, without a release: switches that start, stop or pause a
 * part of the site, and a few numbers. Grouped as the site is.
 */
import { h } from '../core/dom.js';
import { siteSettings, updateSetting } from '../data/api.js';
import { mark, shortDate, t } from '../i18n/index.js';

/**
 * @typedef {{ title: string, about: string, choices?: Array<[string, string]>, number?: { min: number, max: number, unit: string, zero?: string } }} Known
 */

const ON_OFF = /** @type {Array<[string, string]>} */ ([
	['on', mark('On')],
	['off', mark('Off')],
]);
const OPEN_CLOSED = /** @type {Array<[string, string]>} */ ([
	['on', mark('Open')],
	['off', mark('Closed')],
]);

/** @type {Array<[string, Record<string, Known>]>} */
const GROUPS = [
	[
		mark('Site'),
		{
			'site.readonly': {
				title: mark('Read-only'),
				about: mark('Pauses every change: ratings, suggestions, comments, messages and reviews. Reading, searching and signing in go on, and this setting can always be turned back. Pair it with a maintenance notice.'),
				choices: [
					['off', mark('Off')],
					['on', mark('On: read-only')],
				],
			},
		},
	],
	[
		mark('Members'),
		{
			'signup.open': {
				title: mark('New accounts'),
				about: mark('Whether signing in may create a new account. Members who have one still sign in. Close it if fake accounts appear.'),
				choices: OPEN_CLOSED,
			},
		},
	],
	[
		mark('Contributions'),
		{
			'suggestions.open': { title: mark('Suggestions'), about: mark('Whether members may suggest changes to entries.'), choices: OPEN_CLOSED },
			'ratings.open': { title: mark('Ratings'), about: mark('Whether readers may rate entries and meanings. Off hides the thumbs; ratings already given stay.'), choices: ON_OFF },
			'comments.open': {
				title: mark('Comments'),
				about: mark('Open: members comment. Closed: comments show, but no new ones. Hidden: no comments on entries at all; they are kept and come back when opened.'),
				choices: [
					['on', mark('Open')],
					['off', mark('Closed')],
					['hidden', mark('Hidden')],
				],
			},
			'comments.daily': { title: mark('Comments a day'), about: mark('Most comments one member posts in a day.'), number: { min: 1, max: 500, unit: mark('a day') } },
			'comments.newcomer': { title: mark('Comments on the first day'), about: mark('Most comments a new account posts on its first day. Spam accounts are usually new.'), number: { min: 0, max: 100, unit: mark('on day one') } },
		},
	],
	[
		mark('Contact'),
		{
			'contact.open': { title: mark('Contact form'), about: mark('Whether the contact form takes messages. Closed, it says so instead.'), choices: OPEN_CLOSED },
		},
	],
	[
		mark('Searches'),
		{
			'searches.count': { title: mark('Count searches'), about: mark('Whether each search page adds to the counts behind Searches and the home page. Nothing about who searched is kept either way.'), choices: ON_OFF },
			'searches.keep_days': {
				title: mark('Keep search counts'),
				about: mark('Counts older than this are deleted as new ones come in.'),
				number: { min: 30, max: 36500, unit: mark('days'), zero: mark('0 keeps them all') },
			},
			'home.popular': { title: mark('Searched most, on the home page'), about: mark('Whether the home page lists the words searched most this week.'), choices: ON_OFF },
			'home.popular_min': { title: mark('Searches to be listed'), about: mark('How many searches a word needs in a week before the home page lists it.'), number: { min: 1, max: 1000, unit: mark('searches') } },
		},
	],
	[
		mark('Offline'),
		{
			'offline.access': {
				title: mark('Offline definitions'),
				about: mark('Who may download the definitions and related words for offline use. Word lists are open to everyone either way.'),
				choices: [
					['members', mark('Members only')],
					['everyone', mark('Everyone')],
				],
			},
			'offline.words_auto': { title: mark('Word lists by themselves'), about: mark('Whether the word lists (about 0.6 MB) download by themselves after a first visit, for suggestions offline.'), choices: ON_OFF },
		},
	],
];

export async function settingsPane() {
	const main = h('main', { class: 'ws-main ws-account ws-settings', 'aria-label': t('Settings') });
	const work = h('div', { class: 'ws-work' }, h('h1', { class: 'ws-settings-title' }, t('Settings')), h('p', { class: 'ws-quiet' }, t('Each change takes effect at once, for everyone; no release needed.')));
	main.append(work);
	const { settings } = await siteSettings();
	const byKey = new Map(settings.map((s) => [s.key, s]));
	const known = new Set(GROUPS.flatMap(([, g]) => Object.keys(g)));
	const missing = settings.filter((s) => !known.has(s.key)).map((s) => s.key);
	if (missing.length) throw new Error(`The workspace has no form for the setting ${missing.join(', ')}`);

	const grid = h('div', { class: 'ws-settings-grid' });
	work.append(grid);
	for (const [group, items] of GROUPS) {
		const section = h('section', { class: 'ws-settings-group' }, h('h2', { class: 'ws-block-title' }, t(group)));
		for (const [key, k] of Object.entries(items)) {
			const s = byKey.get(key);
			if (!s) throw new Error(`The site has no setting ${key}`);
			section.append(k.number ? numberSetting(s, k) : choiceSetting(s, k, main));
		}
		grid.append(section);
	}
	return main;
}

/**
 * @param {{ key: string, value: unknown, updated_at: number | null }} s
 * @param {Known} k
 * @param {HTMLElement} main
 */
function choiceSetting(s, k, main) {
	const note = h('p', { class: 'ws-result', role: 'status' });
	const when = changed(s.updated_at);
	let value = s.value;
	const choices = /** @type {Array<[string, string]>} */ (k.choices).map(([v, label]) => {
		const input = /** @type {HTMLInputElement} */ (h('input', { type: 'radio', name: s.key, value: v, checked: value === v ? true : null }));
		input.addEventListener('change', async () => {
			const all = /** @type {HTMLInputElement[]} */ ([...main.querySelectorAll(`input[name="${s.key}"]`)]);
			all.forEach((i) => (i.disabled = true));
			note.textContent = t('Saving…');
			try {
				await updateSetting(s.key, v);
				value = v;
				note.textContent = t('Saved.');
				when.textContent = t('Changed {date}', { date: shortDate(new Date(), { year: true }) });
			} catch (err) {
				note.textContent = err instanceof Error ? err.message : String(err);
				all.forEach((i) => (i.checked = i.value === value));
			} finally {
				all.forEach((i) => (i.disabled = false));
			}
		});
		return h('label', { class: 'ws-choice' }, input, t(label));
	});
	return h('section', { class: 'ws-setting' }, h('h3', null, t(k.title)), h('p', null, t(k.about)), h('div', { class: 'ws-choices', role: 'radiogroup', 'aria-label': t(k.title) }, choices), when, note);
}

/**
 * @param {{ key: string, value: unknown, updated_at: number | null }} s
 * @param {Known} k
 */
function numberSetting(s, k) {
	const n = /** @type {NonNullable<Known['number']>} */ (k.number);
	const note = h('p', { class: 'ws-result', role: 'status' });
	const when = changed(s.updated_at);
	const input = /** @type {HTMLInputElement} */ (h('input', { type: 'number', class: 'ws-days', min: n.zero ? 0 : n.min, max: n.max, step: 1, value: String(s.value), 'aria-label': t(k.title) }));
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary ws-setting-save', disabled: true }, t('Save')));
	input.addEventListener('input', () => (save.disabled = input.value === String(s.value)));
	save.addEventListener('click', async () => {
		const v = Number(input.value);
		save.disabled = true;
		note.textContent = t('Saving…');
		try {
			await updateSetting(s.key, v);
			s.value = v;
			note.textContent = t('Saved.');
			when.textContent = t('Changed {date}', { date: shortDate(new Date(), { year: true }) });
		} catch (err) {
			note.textContent = err instanceof Error ? err.message : String(err);
			save.disabled = false;
		}
	});
	return h(
		'section',
		{ class: 'ws-setting' },
		h('h3', null, t(k.title)),
		h('p', null, t(k.about), n.zero ? ` ${t(n.zero)}.` : ''),
		h('div', { class: 'ws-days-row' }, input, h('span', null, t(n.unit)), save),
		when,
		note,
	);
}

/** @param {number | null} at */
function changed(at) {
	return h('p', { class: 'ws-quiet' }, at ? t('Changed {date}', { date: shortDate(new Date(at * 1000), { year: true }) }) : t('The default'));
}
