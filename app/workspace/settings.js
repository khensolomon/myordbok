// @ts-check
/**
 * Site settings (?s=settings), for admins: worker/lib/settings.js holds the
 * known keys: who may download the offline definitions, and whether comments are open.
 */
import { h } from '../core/dom.js';
import { siteSettings, updateSetting } from '../data/api.js';
import { mark, shortDate, t } from '../i18n/index.js';

/** @type {Record<string, { title: string, about: string, choices: Array<[string, string]> }>} */
const KNOWN = {
	'offline.access': {
		title: mark('Offline definitions'),
		about: mark('Who may download the definitions and related words for offline use. Word lists are open to everyone either way.'),
		choices: [
			['members', mark('Members only')],
			['everyone', mark('Everyone')],
		],
	},
	'comments.open': {
		title: mark('Comments'),
		about: mark('Whether signed-in members may post new comments on entries. Comments already posted stay, and editors can still hide them.'),
		choices: [
			['on', mark('Open')],
			['off', mark('Closed')],
		],
	},
};

export async function settingsPane() {
	const main = h('main', { class: 'ws-main ws-account ws-settings', 'aria-label': t('Settings') });
	const work = h('div', { class: 'ws-work' }, h('h1', { class: 'ws-settings-title' }, t('Settings')));
	main.append(work);
	const { settings } = await siteSettings();
	for (const s of settings) {
		const known = KNOWN[s.key];
		if (!known) throw new Error(`The workspace has no form for the setting ${s.key}`);
		const note = h('p', { class: 'ws-result', role: 'status' });
		const when = h('p', { class: 'ws-quiet' }, s.updated_at ? t('Changed {date}', { date: shortDate(new Date(s.updated_at * 1000), { year: true }) }) : t('The default'));
		const choices = known.choices.map(([value, label]) => {
			const input = /** @type {HTMLInputElement} */ (h('input', { type: 'radio', name: s.key, value, checked: s.value === value ? true : null }));
			input.addEventListener('change', async () => {
				const all = /** @type {HTMLInputElement[]} */ ([...main.querySelectorAll(`input[name="${s.key}"]`)]);
				all.forEach((i) => (i.disabled = true));
				note.textContent = t('Saving…');
				try {
					await updateSetting(s.key, value);
					note.textContent = t('Saved.');
					when.textContent = t('Changed {date}', { date: shortDate(new Date(), { year: true }) });
				} catch (err) {
					note.textContent = err instanceof Error ? err.message : String(err);
					all.forEach((i) => (i.checked = i.value === s.value));
				} finally {
					all.forEach((i) => (i.disabled = false));
				}
			});
			return h('label', { class: 'ws-choice' }, input, t(label));
		});
		work.append(h('section', { class: 'ws-setting' }, h('h2', null, t(known.title)), h('p', null, t(known.about)), h('div', { class: 'ws-choices', role: 'radiogroup', 'aria-label': t(known.title) }, choices), when, note));
	}
	return main;
}
