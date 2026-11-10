// @ts-check
/**
 * The theme: follows the device until changed to light or dark in the
 * header menu (menu.js). Kept on this device (mo:theme) and set before the
 * first paint by the line in index.html's <head>.
 */

const THEME_KEY = 'mo:theme';
const THEMES = /** @type {const} */ (['system', 'light', 'dark']);
/** @typedef {typeof THEMES[number]} Theme */

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

/** Follows a theme chosen in another tab. */
export function followTheme() {
	window.addEventListener('storage', (e) => {
		if (e.key === THEME_KEY) setTheme(getTheme());
	});
}
