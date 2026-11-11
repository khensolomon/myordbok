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
import { fitLinks } from './list-bar.js';

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

/** @typedef {{ key: string, value: unknown, fallback: unknown, updated_at: number | null }} Setting */

export async function settingsPane() {
	const main = h('main', { class: 'ws-main ws-account ws-settings', 'aria-label': t('Settings') });
	const { settings } = await siteSettings();
	const byKey = new Map(settings.map((s) => [s.key, /** @type {Setting} */ (s)]));
	const known = new Set(GROUPS.flatMap(([, g]) => Object.keys(g)));
	const missing = settings.filter((s) => !known.has(s.key)).map((s) => s.key);
	if (missing.length) throw new Error(`The workspace has no form for the setting ${missing.join(', ')}`);

	// A warning on top while the site is read-only: easy to forget once set.
	const banner = h('p', { class: 'ws-settings-banner', role: 'status', hidden: byKey.get('site.readonly')?.value !== 'on' }, t('The site is read-only: nobody can rate, suggest, comment or send messages until it is turned off below.'));
	const onChange = (/** @type {string} */ key, /** @type {unknown} */ value) => {
		if (key === 'site.readonly') banner.hidden = value !== 'on';
	};
	const jump = fitLinks(h(
		'nav',
		{ class: 'ws-settings-jump', 'aria-label': t('Groups') },
		GROUPS.map(([group]) => h('a', { href: `#set-${group.toLowerCase()}` }, t(group))),
	));
	const cards = GROUPS.map(([group, items]) =>
		h(
			'section',
			{ class: 'ws-settings-card', id: `set-${group.toLowerCase()}`, 'aria-labelledby': `set-${group.toLowerCase()}-h` },
			h('h2', { id: `set-${group.toLowerCase()}-h` }, t(group)),
			Object.entries(items).map(([key, k]) => {
				const s = byKey.get(key);
				if (!s) throw new Error(`The site has no setting ${key}`);
				return row(s, k, onChange);
			}),
		),
	);
	main.append(
		h(
			'div',
			{ class: 'ws-work ws-settings-page' },
			h('header', { class: 'ws-settings-head' }, h('h1', null, t('Settings')), h('p', null, t('Each change takes effect at once, for everyone; no release needed. A dot marks a setting that is not at its default.'))),
			banner,
			jump,
			cards,
		),
	);
	// Jumping to a group scrolls the work area, not the page.
	jump.addEventListener('click', (e) => {
		const a = /** @type {HTMLElement} */ (e.target).closest('a');
		if (!a || a.closest('.ws-more-panel')) return;
		e.preventDefault();
		main.querySelector(/** @type {string} */ (a.getAttribute('href')))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});
	return main;
}

/**
 * One setting: what it is and does on the left, its control on the right.
 * @param {Setting} s
 * @param {Known} k
 * @param {(key: string, value: unknown) => void} onChange
 */
function row(s, k, onChange) {
	const note = h('span', { class: 'ws-set-note', role: 'status' });
	const when = h('span', { class: 'ws-set-when' }, s.updated_at ? t('Changed {date}', { date: shortDate(new Date(s.updated_at * 1000), { year: true }) }) : t('The default'));
	const dot = h('span', { class: 'ws-set-dot', title: t('Not the default'), hidden: s.value === s.fallback });
	/** Saves a value; the control shows it once the site has it. @param {unknown} v @param {() => void} undo */
	const save = async (v, undo) => {
		note.textContent = t('Saving…');
		note.className = 'ws-set-note';
		try {
			await updateSetting(s.key, v);
			s.value = v;
			note.textContent = t('Saved');
			note.classList.add('ws-set-ok');
			when.textContent = t('Changed {date}', { date: shortDate(new Date(), { year: true }) });
			dot.hidden = v === s.fallback;
			onChange(s.key, v);
			setTimeout(() => note.textContent === t('Saved') && (note.textContent = ''), 2500);
		} catch (err) {
			note.textContent = err instanceof Error ? err.message : String(err);
			note.classList.add('ws-set-error');
			undo();
		}
	};
	const control = k.number ? numberControl(s, k, save) : toggleable(k) ? toggleControl(s, k, save) : choiceControl(s, k, save);
	return h(
		'div',
		{ class: 'ws-set' },
		h('div', { class: 'ws-set-text' }, h('h3', null, dot, t(k.title)), h('p', null, t(k.about), k.number?.zero ? ` ${t(k.number.zero)}.` : ''), h('p', { class: 'ws-set-meta' }, when, note)),
		h('div', { class: 'ws-set-control' }, control),
	);
}

/** Two choices, on and off: a switch. @param {Known} k */
const toggleable = (k) => k.choices?.length === 2 && k.choices.every(([v]) => v === 'on' || v === 'off');

/**
 * @param {Setting} s
 * @param {Known} k
 * @param {(v: unknown, undo: () => void) => Promise<void>} save
 */
function toggleControl(s, k, save) {
	const label = (/** @type {string} */ v) => t(/** @type {[string, string]} */ (k.choices?.find(([c]) => c === v))[1]);
	const state = h('span', { class: 'ws-set-state' }, label(String(s.value)));
	const sw = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', role: 'switch', class: `you-switch${s.key === 'site.readonly' ? ' ws-switch-danger' : ''}`, 'aria-checked': String(s.value === 'on'), 'aria-label': t(k.title) }));
	sw.addEventListener('click', async () => {
		const before = String(s.value);
		const next = before === 'on' ? 'off' : 'on';
		sw.setAttribute('aria-checked', String(next === 'on'));
		state.textContent = label(next);
		sw.disabled = true;
		await save(next, () => {
			sw.setAttribute('aria-checked', String(before === 'on'));
			state.textContent = label(before);
		});
		sw.disabled = false;
	});
	return h('div', { class: 'ws-set-toggle' }, state, sw);
}

/**
 * @param {Setting} s
 * @param {Known} k
 * @param {(v: unknown, undo: () => void) => Promise<void>} save
 */
function choiceControl(s, k, save) {
	const buttons = /** @type {Array<[string, string]>} */ (k.choices).map(([v, text]) => {
		const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', role: 'radio', 'aria-checked': String(s.value === v) }, t(text)));
		b.addEventListener('click', async () => {
			if (s.value === v) return;
			const before = s.value;
			const pick = (/** @type {unknown} */ x) => buttons.forEach((o, i) => o.setAttribute('aria-checked', String(/** @type {any} */ (k.choices)[i][0] === x)));
			pick(v);
			buttons.forEach((o) => (o.disabled = true));
			await save(v, () => pick(before));
			buttons.forEach((o) => (o.disabled = false));
		});
		return b;
	});
	return h('div', { class: 'ws-set-choices', role: 'radiogroup', 'aria-label': t(k.title) }, buttons);
}

/**
 * A number, saved when it is left or Enter is pressed.
 * @param {Setting} s
 * @param {Known} k
 * @param {(v: unknown, undo: () => void) => Promise<void>} save
 */
function numberControl(s, k, save) {
	const n = /** @type {NonNullable<Known['number']>} */ (k.number);
	const input = /** @type {HTMLInputElement} */ (h('input', { type: 'number', inputmode: 'numeric', min: n.zero ? 0 : n.min, max: n.max, step: 1, value: String(s.value), 'aria-label': t(k.title) }));
	const commit = () => {
		if (input.value === String(s.value) || input.value === '') {
			input.value = String(s.value);
			return;
		}
		const before = String(s.value);
		save(Number(input.value), () => (input.value = before));
	};
	input.addEventListener('change', commit);
	input.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') input.blur();
		if (e.key === 'Escape') {
			input.value = String(s.value);
			input.blur();
		}
	});
	return h('label', { class: 'ws-set-number' }, input, h('span', null, t(n.unit)));
}
