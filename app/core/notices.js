// @ts-check
/**
 * Site notices for readers (worker/routes/notices.js). Maintenance and
 * information show as a bar under the header on every page; a celebration
 * shows on the home page only, in place of the language line under the logo.
 * Closing one keeps it closed on this device until the notice is edited
 * (mo:notices-closed holds id:version).
 */
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { activeNotices } from '../data/api.js';
import { digits, getLang, shortDate, t } from '../i18n/index.js';

const CLOSED_KEY = 'mo:notices-closed';
const KEEP_CLOSED = 50;

/** @typedef {import('../data/api.js').ActiveNotice} ActiveNotice */

/** @returns {string[]} */
function closed() {
	try {
		const list = JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]');
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
}

/** @param {ActiveNotice} n */
const key = (n) => `${n.id}:${n.version}`;

/** @param {ActiveNotice} n */
function close(n) {
	try {
		localStorage.setItem(CLOSED_KEY, JSON.stringify([key(n), ...closed().filter((k) => k !== key(n))].slice(0, KEEP_CLOSED)));
	} catch {
		// Storage refused (private mode): it closes for this visit only.
	}
}

/**
 * The text in the interface language when there is one, else the other.
 * @param {ActiveNotice} n
 * @returns {[string, 'en' | 'my']}
 */
function wording(n) {
	if (getLang() === 'my') return n.text_my ? [n.text_my, 'my'] : [/** @type {string} */ (n.text_en), 'en'];
	return n.text_en ? [n.text_en, 'en'] : [/** @type {string} */ (n.text_my), 'my'];
}

/** @param {Date} d */
const clock = (d) => digits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

/**
 * "14 Nov 22:00–23:00", or across days "14 Nov 22:00 – 15 Nov 02:00", in the visitor's time.
 * @param {number} starts
 * @param {number} ends
 */
export function windowText(starts, ends) {
	const a = new Date(starts * 1000);
	const b = new Date(ends * 1000);
	return a.toDateString() === b.toDateString() ? `${shortDate(a)} ${clock(a)}–${clock(b)}` : `${shortDate(a)} ${clock(a)} – ${shortDate(b)} ${clock(b)}`;
}

/**
 * A notice's bar; also the workspace's preview.
 * @param {ActiveNotice} n
 * @param {() => void} onClose
 */
export function noticeBar(n, onClose) {
	const [text, lang] = wording(n);
	const now = Date.now() / 1000;
	const end = new Date(n.ends * 1000);
	const until = end.toDateString() === new Date().toDateString() ? clock(end) : `${shortDate(end)} ${clock(end)}`;
	const when = n.kind === 'maintenance' ? h('span', { class: 'notice-when' }, now >= n.starts ? t('Now, until {time}', { time: until }) : windowText(n.starts, n.ends)) : '';
	const shut = h('button', { type: 'button', class: 'notice-close', 'aria-label': t('Close') }, icon(ICONS.close, 16));
	const node = h(
		'div',
		{ class: `site-notice site-notice-${n.kind}`, role: 'status' },
		h('span', { class: 'notice-icon', 'aria-hidden': 'true' }, icon(n.kind === 'maintenance' ? ICONS.clock : ICONS.info, 16)),
		h('p', { class: 'notice-text' }, when, h('span', { lang }, text), n.link ? h('a', { class: 'notice-link', href: n.link }, t('More')) : ''),
		shut,
	);
	shut.addEventListener('click', () => {
		close(n);
		node.remove();
		onClose();
	});
	return node;
}

/**
 * A celebration's line and its close button; also the workspace's preview.
 * @param {ActiveNotice} n
 * @param {() => void} onClose
 */
export function celebrationLine(n, onClose) {
	const [text, lang] = wording(n);
	const shut = h('button', { type: 'button', class: 'notice-close', 'aria-label': t('Close') }, icon(ICONS.close, 14));
	shut.addEventListener('click', onClose);
	return [n.link ? h('a', { href: n.link, lang }, text) : h('span', { lang }, text), shut];
}

/**
 * @param {ActiveNotice} n
 * @param {HTMLElement} pair  The home page's language line.
 * @param {Node[]} original  Its own content, put back when the celebration closes.
 */
function celebrate(n, pair, original) {
	pair.classList.add('home-celebration');
	pair.replaceChildren(
		...celebrationLine(n, () => {
			close(n);
			pair.classList.remove('home-celebration');
			pair.replaceChildren(...original);
		}),
	);
}

/**
 * Fetches the notices in effect and shows them. Failures are logged and
 * leave the page as it is: notices are never in the way of the dictionary.
 * @param {boolean} signedIn  Notices for members or editors come only with a session.
 */
export async function showNotices(signedIn) {
	const place = document.querySelector('.site-notices');
	const pair = document.querySelector('.home-pair');
	if (!(place instanceof HTMLElement) || !(pair instanceof HTMLElement)) throw new Error('index.html is missing .site-notices or .home-pair');
	const { notices } = await activeNotices(signedIn);
	const shut = new Set(closed());
	const open = notices.filter((n) => !shut.has(key(n)));
	const bars = open.filter((n) => n.kind !== 'celebration').map((n) => noticeBar(n, () => place.toggleAttribute('hidden', !place.childElementCount)));
	place.replaceChildren(...bars);
	place.toggleAttribute('hidden', !bars.length);
	const party = open.find((n) => n.kind === 'celebration');
	if (party) celebrate(party, pair, [...pair.childNodes]);
}
