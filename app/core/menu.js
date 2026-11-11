// @ts-check
/**
 * The person button in the header opens one panel, pointed at it by a small
 * arrow, holding everything personal so the header and footer stay quiet:
 *
 *   signed out   sign in with Google or GitHub (back to this page)
 *   signed in    who, the role, the workspace (with what waits there), sign out
 *   everyone     interface language, theme, usage statistics, the offline
 *                copy, contact
 *
 * The offline copy: word lists arrive by themselves (app/data/offline.js);
 * the definitions are a member's to manage in the workspace. A visitor sees
 * what this device keeps and, while definitions are for members, a sign-in
 * that leads to them; when an admin opens them to everyone, one button
 * keeps them all.
 *
 * The button stays a link to /workspace for when scripts do not run. Esc,
 * a click outside or following a link closes the panel; focus returns to
 * the button.
 */
import { analyticsAvailable, getChoice, setChoice } from './consent.js';
import { h, icon } from './dom.js';
import { ICONS } from './icons.js';
import { atLeast } from '#shared/roles.js';
import { member, signInHref, signOut } from './member.js';
import { getTheme, setTheme } from './prefs.js';
import { workspaceSummary } from '../data/api.js';
import { install, installed, packsInfo, remove } from '../data/offline.js';
import { getLang, num, setLang, t } from '../i18n/index.js';

/** @typedef {import('./member.js').Member} Member */

/** @type {Record<'google' | 'github', string>} */
const PROVIDERS = { google: 'Google', github: 'GitHub' };
const DEFINITION_PACKS = ['senses-en', 'senses-my', 'related-en'];

/**
 * Turns the header's person link into the menu's button.
 * @param {HTMLAnchorElement} you
 */
export function initMenu(you) {
	const panel = h('div', { class: 'you-menu', id: 'you-menu', role: 'dialog', 'aria-label': t('Account and settings'), hidden: true });
	you.setAttribute('aria-haspopup', 'dialog');
	you.setAttribute('aria-controls', 'you-menu');
	you.setAttribute('aria-expanded', 'false');
	// In <body>, not the header: the header and the search bar each stack on their own.
	document.body.append(panel);

	const close = (/** @type {boolean} */ refocus) => {
		if (panel.hidden) return;
		panel.hidden = true;
		you.setAttribute('aria-expanded', 'false');
		if (refocus) you.focus();
	};
	const open = async () => {
		panel.hidden = false;
		you.setAttribute('aria-expanded', 'true');
		place(panel, you);
		panel.replaceChildren(h('p', { class: 'you-loading' }, t('Loading…')));
		const me = await member().catch(() => null);
		panel.replaceChildren(...(await contents(me, () => close(false))));
		place(panel, you);
		/** @type {HTMLElement | null} */ (panel.querySelector('a, button, [tabindex]'))?.focus();
	};

	you.addEventListener('click', (e) => {
		e.preventDefault();
		if (panel.hidden) open().catch((err) => panel.replaceChildren(h('p', { class: 'you-loading' }, err instanceof Error ? err.message : String(err))));
		else close(true);
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !panel.hidden) close(true);
	});
	document.addEventListener('pointerdown', (e) => {
		const target = /** @type {Node} */ (e.target);
		if (!panel.hidden && !panel.contains(target) && !you.contains(target)) close(false);
	});
	// Following a link inside closes it; the router takes over from there.
	panel.addEventListener('click', (e) => {
		if (/** @type {HTMLElement} */ (e.target).closest('a')) close(false);
	});
	// A scrollbar appearing or going away (a page change while open) moves the
	// button without a resize event; the page's width changes, so watch that.
	const follow = () => !panel.hidden && place(panel, you);
	window.addEventListener('resize', follow);
	new ResizeObserver(follow).observe(document.documentElement);
}

/**
 * Under the button, its right edge with the page's, the arrow at the button.
 * @param {HTMLElement} panel
 * @param {HTMLElement} you
 */
function place(panel, you) {
	const b = you.getBoundingClientRect();
	// A fixed box's `right` counts from the page's edge, inside any scrollbar;
	// innerWidth would include the scrollbar and push the box off the button.
	const page = document.documentElement.clientWidth;
	const width = Math.min(340, page - 24);
	const right = Math.max(12, page - b.right - 4);
	panel.style.top = `${b.bottom + 10}px`;
	panel.style.right = `${right}px`;
	panel.style.width = `${width}px`;
	panel.style.setProperty('--arrow-right', `${page - right - (b.left + b.width / 2) - 7}px`);
}

/**
 * @param {Member | null} me
 * @param {() => void} done
 */
async function contents(me, done) {
	const here = location.pathname + location.search;
	return [
		me ? account(me, done) : signIn(here),
		h('div', { class: 'you-group' }, languageRow(), themeRow(), analyticsAvailable() ? statsRow() : ''),
		await offlineRow(me, here),
		h('nav', { class: 'you-links', 'aria-label': t('More') }, h('a', { href: '/contact' }, icon(ICONS.inbox, 16), t('Contact')), me ? signOutButton(done) : ''),
	];
}

/** @param {string} here */
function signIn(here) {
	return h(
		'div',
		{ class: 'you-head' },
		h('strong', null, t('Sign in')),
		h('p', null, t('To rate meanings, suggest corrections and keep the definitions offline. Reading never needs an account.')),
		h(
			'div',
			{ class: 'you-providers' },
			(/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).map((p) => h('a', { class: 'you-provider', href: signInHref(p, here) }, t('Continue with {provider}', { provider: PROVIDERS[p] }))),
		),
	);
}

/**
 * @param {Member} me
 * @param {() => void} done
 */
function account(me, done) {
	const badge = h('span', { class: 'you-badge', hidden: true });
	const editor = atLeast(me.role, 'editor');
	if (editor) {
		workspaceSummary()
			.then((s) => {
				const n = (s.waiting ?? 0) + (s.unread ?? 0);
				badge.textContent = num(n);
				badge.title = [s.waiting ? t('{n} waiting', { n: s.waiting }) : '', s.unread ? t('{n} unread', { n: s.unread }) : ''].filter(Boolean).join(' · ');
				badge.hidden = n === 0;
			})
			.catch(() => {});
	}
	return h(
		'div',
		{ class: 'you-head you-me' },
		h(
			'div',
			{ class: 'you-who' },
			me.avatar_url ? h('img', { src: me.avatar_url, alt: '', width: 40, height: 40, referrerpolicy: 'no-referrer' }) : h('span', { class: 'you-face' }, me.name.slice(0, 1).toUpperCase()),
			h('div', null, h('strong', null, me.name), h('span', null, me.role === 'owner' ? t('Owner') : me.role === 'admin' ? t('Administrator') : me.role === 'editor' ? t('Editor') : t('Member'))),
		),
		h('a', { class: 'you-workspace', href: '/workspace', onClick: done }, icon(ICONS.overview, 18), t('Open the workspace'), badge),
	);
}

/** @param {() => void} done */
function signOutButton(done) {
	const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button' }, t('Sign out')));
	b.addEventListener('click', async () => {
		b.disabled = true;
		try {
			await signOut();
			done();
			location.assign('/');
		} catch (err) {
			b.disabled = false;
			b.title = err instanceof Error ? err.message : String(err);
		}
	});
	return b;
}

/**
 * A row of choices, one pressed.
 * @param {string} label
 * @param {Array<{ value: string, text: string | Node, lang?: string, title?: string }>} choices
 * @param {string} current
 * @param {(value: string) => void} choose
 */
function choiceRow(label, choices, current, choose) {
	const buttons = choices.map((c) =>
		h('button', { type: 'button', class: 'you-choice', 'aria-pressed': String(c.value === current), lang: c.lang ?? null, title: c.title ?? null, 'data-value': c.value }, c.text),
	);
	const group = h('div', { class: 'you-choices', role: 'group', 'aria-label': label }, buttons);
	group.addEventListener('click', (e) => {
		const b = /** @type {HTMLElement} */ (e.target).closest('button');
		if (!b || b.getAttribute('aria-pressed') === 'true') return;
		buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
		choose(/** @type {string} */ (b.dataset.value));
	});
	return h('div', { class: 'you-row' }, h('span', { class: 'you-label' }, label), group);
}

function languageRow() {
	return choiceRow(
		t('Language'),
		[
			{ value: 'en', text: 'English', lang: 'en' },
			{ value: 'my', text: 'မြန်မာ', lang: 'my' },
		],
		getLang(),
		(v) => setLang(/** @type {'en' | 'my'} */ (v)),
	);
}

function themeRow() {
	return choiceRow(
		t('Theme'),
		[
			{ value: 'system', text: icon(ICONS.contrast, 16), title: t('As the device') },
			{ value: 'light', text: icon(ICONS.sun, 16), title: t('Light') },
			{ value: 'dark', text: icon(ICONS.moon, 16), title: t('Dark') },
		],
		getTheme(),
		(v) => setTheme(/** @type {'system' | 'light' | 'dark'} */ (v)),
	);
}

/** Usage statistics (Google Analytics), on or off. */
function statsRow() {
	const on = getChoice() === 'granted';
	const sw = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', role: 'switch', class: 'you-switch', 'aria-checked': String(on), 'aria-label': t('Usage statistics') }));
	sw.addEventListener('click', () => {
		const next = sw.getAttribute('aria-checked') !== 'true';
		sw.setAttribute('aria-checked', String(next));
		setChoice(next ? 'granted' : 'denied');
	});
	return h('div', { class: 'you-row' }, h('span', { class: 'you-label' }, t('Usage statistics'), h('a', { class: 'you-hint', href: '/privacy' }, t('What is sent'))), sw);
}

/**
 * What this device keeps, and the way to keep more.
 * @param {Member | null} me
 * @param {string} here
 */
async function offlineRow(me, here) {
	const have = await installed().catch(() => []);
	const words = have.some((p) => p.id.startsWith('words-'));
	const defs = have.filter((p) => DEFINITION_PACKS.includes(p.id));
	const status = defs.length ? t('Definitions kept on this device') : words ? t('Word lists kept on this device') : t('Nothing kept on this device yet');
	const row = h('div', { class: 'you-group you-offline' }, h('div', { class: 'you-row' }, h('span', { class: 'you-label' }, icon(ICONS.download, 16), t('Offline')), h('span', { class: 'you-status' }, status)));
	if (me) {
		row.append(h('a', { class: 'you-action', href: '/workspace?s=offline' }, defs.length ? t('Manage the offline copy') : t('Keep the definitions offline')));
		return row;
	}
	const info = await packsInfo().catch(() => null);
	if (!info) return row;
	const packs = info.packs.filter((p) => DEFINITION_PACKS.includes(p.id));
	const size = packs.reduce((a, p) => a + p.bytes, 0);
	if (info.access === 'members') {
		row.append(
			h('p', { class: 'you-note' }, t('Members can keep every definition on the device, {size}, and look words up without a connection.', { size: megabytes(size) })),
			h('a', { class: 'you-action you-invite', href: `/workspace?s=account&return=${encodeURIComponent('/workspace?s=offline')}` }, t('Sign in to download')),
		);
		return row;
	}
	// Open to everyone: one button keeps them all; a visitor's copy is removed the same way.
	const current = defs.length === packs.length && defs.every((d) => d.build === info.build);
	const act = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'you-action' }, current ? t('Remove the definitions') : t('Keep the definitions offline ({size})', { size: megabytes(size) })));
	const bar = /** @type {HTMLProgressElement} */ (h('progress', { max: 1, value: 0, hidden: true }));
	let sure = false;
	act.addEventListener('click', async () => {
		// Removing asks twice: a click by mistake should not cost a download.
		if (current && !sure) {
			sure = true;
			act.textContent = t('Choose again to remove');
			setTimeout(() => {
				sure = false;
				if (act.isConnected && !act.disabled) act.textContent = t('Remove the definitions');
			}, 4000);
			return;
		}
		act.disabled = true;
		try {
			if (current) {
				for (const p of packs) await remove(p.id);
			} else {
				bar.hidden = false;
				let done = 0;
				for (const p of packs) {
					await install(p, info.build, (f) => (bar.value = (done + f * p.bytes) / size));
					done += p.bytes;
				}
			}
			act.textContent = current ? t('Removed.') : t('Kept on this device.');
		} catch (err) {
			act.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			bar.hidden = true;
		}
	});
	row.append(act, bar);
	return row;
}

/** @param {number} bytes */
const megabytes = (bytes) => (bytes >= 1048576 ? t('{n} MB', { n: Math.round(bytes / 104857.6) / 10 }) : t('{n} KB', { n: Math.max(1, Math.round(bytes / 1024)) }));
