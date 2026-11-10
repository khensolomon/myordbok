// @ts-check
/**
 * Personal controls in the header, beside the account button:
 *
 *   theme      follows the device until changed; the button steps through
 *              device → light → dark. Kept on this device (mo:theme) and set
 *              before the first paint by the line in index.html's <head>.
 *   analytics  when analytics were declined, a small chart icon stays here;
 *              choosing it allows them, and it goes.
 */
import { analyticsAvailable, getChoice, setChoice } from './consent.js';
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';

const THEME_KEY = 'mo:theme';
const THEMES = /** @type {const} */ (['system', 'light', 'dark']);
/** @typedef {typeof THEMES[number]} Theme */

/** @type {Record<Theme, string>} */
const THEME_LABEL = {
	system: 'Theme: as the device (choose for light)',
	light: 'Theme: light (choose for dark)',
	dark: 'Theme: dark (choose to follow the device)',
};

/** @returns {Theme} */
export function getTheme() {
	try {
		const t = localStorage.getItem(THEME_KEY);
		return t === 'light' || t === 'dark' ? t : 'system';
	} catch {
		return 'system';
	}
}

/** @param {Theme} theme */
export function setTheme(theme) {
	if (theme === 'system') document.documentElement.removeAttribute('data-theme');
	else document.documentElement.dataset.theme = theme;
	try {
		if (theme === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, theme);
	} catch (err) {
		console.warn('The theme could not be saved on this device; it applies to this visit only.', err);
	}
	window.dispatchEvent(new CustomEvent('mo:theme', { detail: theme }));
}

/**
 * Puts the controls before the account button.
 * @param {HTMLElement} you  The account button.
 */
export function initPrefs(you) {
	const theme = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'pref' }));
	const showTheme = () => {
		const t = getTheme();
		theme.replaceChildren(icon(t === 'light' ? ICONS.sun : t === 'dark' ? ICONS.moon : ICONS.contrast, 19));
		theme.setAttribute('aria-label', THEME_LABEL[t]);
		theme.title = THEME_LABEL[t];
	};
	theme.addEventListener('click', () => {
		setTheme(THEMES[(THEMES.indexOf(getTheme()) + 1) % THEMES.length]);
		showTheme();
	});
	showTheme();

	const stats = /** @type {HTMLButtonElement} */ (
		h('button', { type: 'button', class: 'pref', 'aria-label': 'Usage statistics are off. Choose to allow them.', title: 'Usage statistics are off · choose to allow' }, icon(ICONS.chart, 19))
	);
	stats.addEventListener('click', () => setChoice('granted'));
	const showStats = () => (stats.hidden = !(analyticsAvailable() && getChoice() === 'denied'));
	window.addEventListener('mo:consent', showStats);
	showStats();

	// One group at the right of the header: statistics (when declined), theme, account.
	const tools = h('div', { class: 'header-tools' });
	you.replaceWith(tools);
	tools.append(stats, theme, you);
	// The theme set elsewhere (another tab) is followed here too.
	window.addEventListener('storage', (e) => {
		if (e.key !== THEME_KEY) return;
		setTheme(getTheme());
		showTheme();
	});
}
