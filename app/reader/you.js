// @ts-check
/**
 * /you: everything personal, one tab of the navigation (index.html):
 *
 *   signed out   sign in with Google, GitHub or Apple (back to this page)
 *   signed in    who, the role, the workspace (with what waits there), sign out
 *   this device  the offline copy, theme, interface language, usage statistics
 *   MyOrdbok     grammar, fonts, about, contact, privacy, terms, support
 *
 * The offline copy: word lists arrive by themselves (app/data/offline.js);
 * the definitions are a member's to manage at /offline. A visitor sees what
 * this device keeps and, while definitions are for members, a sign-in that
 * leads to them; when an admin opens them to everyone, one button keeps
 * them all.
 */
import { analyticsAvailable, getChoice, setChoice } from '../core/consent.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { member, providerLinks, signOut } from '../core/member.js';
import { getTheme, setTheme } from '../core/prefs.js';
import { workspaceSummary } from '../data/api.js';
import { install, installed, packsInfo, remove } from '../data/offline.js';
import { MYANMAR_OPEN, getLang, num, setLang, t } from '../i18n/index.js';

/** @typedef {import('../core/member.js').Member} Member */

const DEFINITION_PACKS = ['senses-en', 'senses-my', 'related-en'];

export function title() {
	return t('You');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const me = await member().catch(() => null);
	// Sent here to sign in (rating a meaning): back there afterwards.
	const asked = ctx.query.get('return');
	const back = asked && /^\/(?!\/)[^\\\s]*$/.test(asked) && !asked.startsWith('/api/') ? asked : '/you';
	return h(
		'section',
		{ class: 'page you-page' },
		h('h1', { class: 'large-title' }, t('You')),
		me ? account(me) : signIn(back),
		h('h2', { class: 'you-section' }, t('This device')),
		await offlineRow(me),
		h('div', { class: 'you-group' }, themeRow(), languageRow(), analyticsAvailable() ? statsRow() : ''),
		h('h2', { class: 'you-section' }, 'MyOrdbok'),
		h(
			'nav',
			{ class: 'you-group you-links', 'aria-label': 'MyOrdbok' },
			link('/grammar', ICONS.grammar, t('Grammar')),
			link('/myanmar-fonts', ICONS.document, t('Myanmar fonts')),
			link('/about', ICONS.info, t('About')),
			link('/contact', ICONS.inbox, t('Contact')),
			link('/privacy', ICONS.document, t('Privacy')),
			link('/terms', ICONS.document, t('Terms of Use')),
			h('a', { href: '/support', 'data-store-hidden': '' }, icon(ICONS.like, 18), h('span', null, t('Support MyOrdbok')), icon(ICONS.chevron, 14)),
		),
		h('p', { class: 'you-copy' }, '© MyOrdbok'),
	);
}

/**
 * A row of the links list.
 * @param {string} href
 * @param {string} glyph
 * @param {string} text
 */
function link(href, glyph, text) {
	return h('a', { href }, icon(glyph, 18), h('span', null, text), icon(ICONS.chevron, 14));
}

/** @param {string} here */
function signIn(here) {
	return h(
		'div',
		{ class: 'you-head' },
		h('strong', null, t('Sign in')),
		h('p', null, t('To rate meanings, suggest corrections and keep the definitions offline. Reading never needs an account.')),
		providerLinks('you-provider', here),
	);
}

/** @param {Member} me */
function account(me) {
	const badge = h('span', { class: 'you-badge', hidden: true });
	// What waits in the workspace: for a member, answers to their own messages;
	// for editors and admins also suggestions to review and unread messages.
	workspaceSummary()
		.then((s) => {
			// An admin's own answers show in the Inbox they already count.
			const answers = s.unread === undefined ? s.answers : 0;
			const n = (s.waiting ?? 0) + (s.unread ?? 0) + answers;
			badge.textContent = num(n);
			badge.title = [s.waiting ? t('{n} waiting', { n: s.waiting }) : '', s.unread ? t('{n} unread', { n: s.unread }) : '', answers ? t('{n} new answers', { n: answers }) : ''].filter(Boolean).join(' · ');
			badge.hidden = n === 0;
		})
		.catch(() => {});
	return h(
		'div',
		{ class: 'you-head you-me' },
		h(
			'div',
			{ class: 'you-who' },
			me.avatar_url ? h('img', { src: me.avatar_url, alt: '', width: 40, height: 40, referrerpolicy: 'no-referrer' }) : h('span', { class: 'you-face' }, me.name.slice(0, 1).toUpperCase()),
			h('div', null, h('strong', null, me.name), h('span', null, me.role === 'owner' ? t('Owner') : me.role === 'admin' ? t('Administrator') : me.role === 'editor' ? t('Editor') : t('Member'))),
			// Beside the account it ends, not among the page links, where it had no room.
			signOutButton(),
		),
		h('a', { class: 'you-workspace', href: '/workspace' }, icon(ICONS.overview, 18), t('Open the workspace'), badge),
	);
}

function signOutButton() {
	const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'you-signout' }, t('Sign out')));
	b.addEventListener('click', async () => {
		b.disabled = true;
		try {
			await signOut();
			location.assign('/you');
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

/** The language choice; while Myanmar is paused, only a reviewer in Myanmar has one (app/i18n/index.js). */
function languageRow() {
	if (!MYANMAR_OPEN && getLang() !== 'my') return null;
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
 */
async function offlineRow(me) {
	const have = await installed().catch(() => []);
	const words = have.some((p) => p.id.startsWith('words-'));
	const defs = have.filter((p) => DEFINITION_PACKS.includes(p.id));
	const status = defs.length ? t('Definitions kept on this device') : words ? t('Word lists kept on this device') : t('Nothing kept on this device yet');
	const row = h('div', { class: 'you-group you-offline' }, h('div', { class: 'you-row' }, h('span', { class: 'you-label' }, icon(ICONS.download, 16), t('Offline')), h('span', { class: 'you-status' }, status)));
	if (me) {
		row.append(h('a', { class: 'you-action', href: '/offline' }, defs.length ? t('Manage the offline copy') : t('Keep the definitions offline')));
		return row;
	}
	const info = await packsInfo().catch(() => null);
	if (!info) return row;
	const packs = info.packs.filter((p) => DEFINITION_PACKS.includes(p.id));
	const size = packs.reduce((a, p) => a + p.bytes, 0);
	if (info.access === 'members') {
		row.append(
			h('p', { class: 'you-note' }, t('Members can keep every definition on the device, {size}, and look words up without a connection.', { size: megabytes(size) })),
			h('p', { class: 'you-note' }, t('Sign in above to download.')),
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
