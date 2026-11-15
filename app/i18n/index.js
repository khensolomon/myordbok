// @ts-check
/**
 * The interface language: English or Myanmar. Dictionary content is never
 * translated; only the app's own words, numbers and dates.
 *
 * Interface text is written in English in the code, inside t(): the English
 * text is the key, and app/i18n/my.js gives its Myanmar. Placeholders are
 * {name}; numbers passed in are written in the language's digits.
 *
 *   t('Search a word')
 *   t('No entry for “{word}”', { word })
 *   tn('{n} suggestion', '{n} suggestions', n)  English picks by n; Myanmar has one form (the second key).
 *   mark('Waiting')                           a text kept in a table, translated later with t()
 *
 * A text missing from my.js is an error, not a quiet switch to English;
 * tests/i18n.test.js checks every t() and tn() in the app against my.js.
 *
 * Choice: kept on this device (mo:lang); without one, Myanmar when the
 * device's languages put Myanmar first, else English. The line in
 * index.html's <head> sets <html lang> before the first paint; setLang()
 * reloads the page so every view is built again in the new language.
 *
 * While MYANMAR_OPEN is false the Myanmar interface is paused for review:
 * every reader gets English, whatever the device or an earlier choice says,
 * and the menu offers no language. A reviewer opens any page with ?ui=my,
 * which turns Myanmar on for that device (mo:lang-review) until ?ui=en or
 * English is picked in the menu.
 */

/**
 * Whether the Myanmar interface is offered to readers. To open it: true
 * here, and `open=true` in the line in app/index.html's <head>
 * (tests/i18n.test.js holds the two together).
 */
export const MYANMAR_OPEN = false;

const KEY = 'mo:lang';
const REVIEW_KEY = 'mo:lang-review';
/** The address word a reviewer turns the paused language on and off with. */
export const REVIEW_PARAM = 'ui';
export const LANGS = /** @type {const} */ (['en', 'my']);
/** @typedef {typeof LANGS[number]} Lang */

/** @type {Lang} */
let lang = 'en';
/** @type {Record<string, string> | null} */
let catalog = null;

/** @returns {Lang} The language chosen on this device, or the device's own. */
export function chosenLang() {
	if (!MYANMAR_OPEN) return reviewing() ? 'my' : 'en';
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === 'en' || saved === 'my') return saved;
	} catch {
		// storage blocked: the device's language decides
	}
	return deviceLang();
}

/**
 * Whether this device reviews the paused language; ?ui=my or ?ui=en in the
 * address sets it first, and is then taken out of the address.
 */
function reviewing() {
	const url = new URL(location.href);
	const asked = url.searchParams.get(REVIEW_PARAM);
	if (asked === 'my' || asked === 'en') {
		try {
			if (asked === 'my') localStorage.setItem(REVIEW_KEY, '1');
			else localStorage.removeItem(REVIEW_KEY);
		} catch (err) {
			throw new Error(`The language could not be saved on this device: ${err instanceof Error ? err.message : String(err)}`);
		}
		url.searchParams.delete(REVIEW_PARAM);
		history.replaceState(history.state, '', url);
	}
	try {
		return localStorage.getItem(REVIEW_KEY) === '1';
	} catch {
		return false;
	}
}

/** @returns {Lang} */
export function deviceLang() {
	const first = (navigator.languages?.length ? navigator.languages : [navigator.language]).find((l) => /^(my|en)\b/i.test(l)) ?? 'en';
	return first.toLowerCase().startsWith('my') ? 'my' : 'en';
}

/** The language in use. */
export function getLang() {
	return lang;
}

/**
 * Loads the chosen language's text. Called once, before the first view.
 * @param {Lang} [which]
 */
export async function initLang(which = chosenLang()) {
	lang = which;
	catalog = which === 'my' ? (await import('./my.js')).MY : null;
	document.documentElement.lang = which;
	translateShell(document);
}

/**
 * Keeps the choice and builds the page again in it.
 * @param {Lang} next
 */
export function setLang(next) {
	try {
		if (!MYANMAR_OPEN) {
			// Paused: the only choice is a reviewer's, back to English or on again.
			if (next === 'my') localStorage.setItem(REVIEW_KEY, '1');
			else localStorage.removeItem(REVIEW_KEY);
		} else if (next === deviceLang()) localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, next);
	} catch (err) {
		throw new Error(`The language could not be saved on this device: ${err instanceof Error ? err.message : String(err)}`);
	}
	location.reload();
}

/**
 * @param {string} text  The English text, as written in the code.
 * @param {Record<string, string | number>} [vars]
 */
export function t(text, vars) {
	let out = text;
	if (catalog) {
		const my = catalog[text];
		if (my === undefined) throw new Error(`No Myanmar text for “${text}” in app/i18n/my.js.`);
		out = my;
	}
	return vars ? fill(out, vars) : out;
}

/**
 * A notice for pages whose text is not yet in Myanmar (about, privacy,
 * terms): shown in the Myanmar interface above the English text; nothing in
 * the English one.
 */
export function englishOnly() {
	if (lang !== 'my') return null;
	const p = document.createElement('p');
	p.className = 'notice english-only';
	p.lang = 'my';
	p.textContent = t('This page is in English for now.');
	return p;
}

/**
 * The message for an error from the server. The generic ones (connection,
 * limits, access) have Myanmar text by their code; a specific message
 * (a field that is wrong, say) is shown as the server wrote it, in English.
 * @param {string} code
 * @param {string} message
 */
export function errorText(code, message) {
	if (lang !== 'my') return message;
	const generic = /** @type {Record<string, string>} */ ({
		unavailable: mark('Could not reach MyOrdbok. Check the connection.'),
		rate_limited: mark('Too many searches in a short time. Wait a minute, then try again.'),
		forbidden: mark('Access denied.'),
		unauthorized: mark('Sign in first.'),
	})[code];
	return generic ? t(generic) : message;
}

/**
 * Marks a text kept in a table for translation; t() translates it when shown.
 * @template {string} S
 * @param {S} text
 */
export function mark(text) {
	return text;
}

/**
 * A text with a count: English chooses one or many; Myanmar has one form.
 * @param {string} one
 * @param {string} many
 * @param {number} n
 * @param {Record<string, string | number>} [vars]
 */
export function tn(one, many, n, vars = {}) {
	return t(n === 1 && !catalog ? one : many, { n, ...vars });
}

/**
 * A text with elements in it (links, emphasis): the parts in order, for h().
 * @param {string} text
 * @param {Record<string, string | number | Node>} vars
 * @returns {Array<string | Node>}
 */
export function tx(text, vars) {
	const template = catalog ? t(text) : text;
	/** @type {Array<string | Node>} */
	const out = [];
	let last = 0;
	for (const m of template.matchAll(/\{(\w+)\}/g)) {
		if (!(m[1] in vars)) throw new Error(`“${text}” needs {${m[1]}}.`);
		out.push(template.slice(last, m.index));
		const v = vars[m[1]];
		out.push(typeof v === 'number' ? num(v) : v);
		last = /** @type {number} */ (m.index) + m[0].length;
	}
	out.push(template.slice(last));
	return out.filter((p) => p !== '');
}

/**
 * Items joined as a list: "a, b and c"; in Myanmar "a၊ b နှင့် c".
 * @param {string[]} items
 */
export function list(items) {
	if (items.length < 2) return items.join('');
	const sep = lang === 'my' ? '၊ ' : ', ';
	return `${items.slice(0, -1).join(sep)}${lang === 'my' ? ' နှင့် ' : ' and '}${items.at(-1)}`;
}

/** Parts of speech as the dictionary names them (type_word), shown in the interface's language. */
const POS = {
	Noun: mark('noun'),
	Verb: mark('verb'),
	Adjective: mark('adjective'),
	Adverb: mark('adverb'),
	Preposition: mark('preposition'),
	Conjunction: mark('conjunction'),
	Pronoun: mark('pronoun'),
	Interjection: mark('interjection'),
	Abbreviation: mark('abbreviation'),
	Prefix: mark('prefix'),
	'Combining form': mark('combining form'),
	Phrase: mark('phrase'),
	Contraction: mark('contraction'),
	Punctuation: mark('punctuation'),
	Particle: mark('particle'),
	'Post-positional Marker': mark('post-positional marker'),
	Suffix: mark('suffix'),
	Acronym: mark('acronym'),
	Article: mark('article'),
	Number: mark('number'),
};

/**
 * A part of speech's name; one the table does not know is the dictionary's own, lower-cased.
 * @param {string} type
 */
export function posName(type) {
	const lower = type.toLowerCase();
	const known = Object.entries(POS).find(([name]) => name.toLowerCase() === lower)?.[1];
	return known ? t(known) : lower;
}

const MY_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
const grouped = new Intl.NumberFormat('en-GB');

/**
 * A number for the interface: grouped, in Myanmar digits when the interface is Myanmar.
 * @param {number} n
 */
export function num(n) {
	return digits(grouped.format(n));
}

/**
 * Western digits in `text` written as Myanmar digits, when the interface is Myanmar.
 * @param {string} text
 */
export function digits(text) {
	return lang === 'my' ? text.replace(/[0-9]/g, (d) => MY_DIGITS[Number(d)]) : text;
}

/** Month names, January first. */
const MONTHS = {
	en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
	my: ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'ဩဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'],
};

/**
 * "12 Oct" or "၁၂ အောက်တိုဘာ"; with the year when asked.
 * @param {Date} date
 * @param {{ year?: boolean, utc?: boolean }} [options]
 */
export function shortDate(date, options = {}) {
	const day = options.utc ? date.getUTCDate() : date.getDate();
	const month = options.utc ? date.getUTCMonth() : date.getMonth();
	const year = options.utc ? date.getUTCFullYear() : date.getFullYear();
	return digits(`${day} ${MONTHS[lang][month]}${options.year ? ` ${year}` : ''}`);
}

/**
 * How long ago: "just now", "5 min ago", "2 h ago", "yesterday", "3 days ago"
 * within a week, the date after that; short: "5 m", "2 h", "3 d".
 * @param {number} seconds  Unix time.
 * @param {boolean} [short]
 */
export function ago(seconds, short = false) {
	const diff = Date.now() / 1000 - seconds;
	if (short) {
		if (diff < 3600) return t('{n} m', { n: Math.max(1, Math.floor(diff / 60)) });
		if (diff < 86400) return t('{n} h', { n: Math.floor(diff / 3600) });
		return t('{n} d', { n: Math.floor(diff / 86400) });
	}
	if (diff < 60) return t('just now');
	if (diff < 3600) return t('{n} min ago', { n: Math.floor(diff / 60) });
	if (diff < 86400) return t('{n} h ago', { n: Math.floor(diff / 3600) });
	if (diff < 172800) return t('yesterday');
	if (diff < 7 * 86400) return t('{n} days ago', { n: Math.floor(diff / 86400) });
	return shortDate(new Date(seconds * 1000), { year: true });
}

/**
 * @param {string} text
 * @param {Record<string, string | number>} vars
 */
function fill(text, vars) {
	return text.replace(/\{(\w+)\}/g, (whole, name) => {
		if (!(name in vars)) throw new Error(`“${text}” needs {${name}}.`);
		const v = vars[name];
		return typeof v === 'number' ? num(v) : v;
	});
}

/**
 * The page shell's own words (index.html): elements marked data-t take the
 * text of their content; data-t-label names the text for aria-label and title.
 * @param {ParentNode} root
 */
function translateShell(root) {
	if (!catalog) return;
	for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(/** @type {string} */ (el.textContent).trim());
	for (const el of root.querySelectorAll('[data-t-label]')) {
		const text = t(/** @type {string} */ (el.getAttribute('data-t-label')));
		if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
		if (el.hasAttribute('title')) el.setAttribute('title', text);
	}
	const description = root.querySelector('meta[name="description"]');
	if (description) description.setAttribute('content', t('A comprehensive English–Myanmar dictionary that also works offline.'));
}
