// @ts-check
/**
 * Members (?s=members), for admins and owners: everyone signed up, found by
 * name or email, by level or as suspended. A member opens with their sign-ins,
 * contributions and the history of their level; the level and suspending are
 * changed beside it, as far as the one asking may (shared/roles.js): an owner
 * every level, an admin member and editor. Suspending signs them out
 * everywhere and asks twice.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { changeMember, workspaceMember, workspaceMembers } from '../data/api.js';
import { mark, num, t } from '../i18n/index.js';
import { listBar } from './list-bar.js';

/** @param {string} f  A filter of FILTERS. */
const memberHref = (f) => `/workspace?s=members${f ? `&show=${f}` : ''}`;

/** @typedef {import('../data/api.js').MemberRow} Row */
/** @typedef {import('../data/api.js').MemberDetail} Detail */
/** @typedef {import('#shared/roles.js').Role} Role */

/** @type {Record<Role, string>} */
const ROLE_NAME = { owner: mark('Owner'), admin: mark('Administrator'), editor: mark('Editor'), member: mark('Member') };
/** @type {Record<Role, string>} */
const ROLE_ABOUT = {
	owner: mark('Everything, and gives or takes every level.'),
	admin: mark('Inbox, settings, members; makes members editors.'),
	editor: mark('Reviews suggestions; own changes are approved at once.'),
	member: mark('Rates and suggests.'),
};
const FILTERS = /** @type {const} */ ([
	['', mark('All')],
	['owner', mark('Owners')],
	['admin', mark('Admins')],
	['editor', mark('Editors')],
	['member', mark('Members')],
	['suspended', mark('Suspended')],
]);

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function membersPanes(ctx, root, ago) {
	const asked = ctx.query.get('show') ?? '';
	const filter = FILTERS.some(([f]) => f === asked) ? asked : '';
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Members') });
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a member from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Name or email'), 'aria-label': t('Find a member'), value: ctx.query.get('q') ?? '' }));
	const ol = h('ol', { class: 'ws-rows' });
	const head = h('span');
	/** @type {Row[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];

	const load = async () => {
		const page = await workspaceMembers({ q: search.value.trim(), role: filter === 'suspended' ? '' : filter, status: filter === 'suspended' ? 'suspended' : '' });
		items = page.members;
		const total = page.counts.reduce((a, c) => a + c.n, 0);
		head.textContent = t('{n} in all', { n: total });
		rows = items.map((m, i) => row(m, ago, () => open(i)));
		ol.replaceChildren(...(rows.length ? rows.map((b) => h('li', null, b)) : [h('li', { class: 'ws-none' }, t('Nobody here.'))]));
		if (page.more) ol.append(h('li', { class: 'ws-none' }, t('Showing the newest {n}; narrow it with a name or email.', { n: items.length })));
	};

	/** @param {number} i */
	const open = async (i) => {
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		root.toggleAttribute('data-open', true);
		const { member } = await workspaceMember(items[i].id);
		show(member, i);
	};

	/**
	 * @param {Detail} m
	 * @param {number} i
	 */
	const show = (m, i) => {
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		const e = m.edits;
		work.replaceChildren(
			h('header', { class: 'ws-crumbs' }, back, h('span', null, t('Members')), h('span', { 'aria-hidden': 'true' }, '›'), h('span', null, m.name)),
			h(
				'div',
				{ class: 'ws-work ws-person' },
				h(
					'header',
					{ class: 'ws-account-head' },
					m.avatar_url ? h('img', { src: m.avatar_url, alt: '', width: 56, height: 56, referrerpolicy: 'no-referrer' }) : h('span', { class: 'you-face ws-face-big' }, m.name.slice(0, 1).toUpperCase()),
					h('div', null, h('h1', null, m.name, m.self ? h('span', { class: 'ws-you' }, t('you')) : ''), h('p', { class: 'ws-quiet' }, m.email ?? t('No email'))),
				),
				h(
					'dl',
					{ class: 'ws-facts' },
					h('dt', null, t('Level')),
					h('dd', null, t(ROLE_NAME[m.role]), m.status === 'suspended' ? h('span', { class: 'ws-flag ws-suspended' }, ` · ${t('suspended')}`) : ''),
					h('dt', null, t('Signs in with')),
					h('dd', null, m.providers.map((p) => (p === 'google' ? 'Google' : 'GitHub')).join(', ') || '—'),
					h('dt', null, t('Joined')),
					h('dd', null, ago(m.created_at)),
					h('dt', null, t('Last seen')),
					h('dd', null, m.seen_at ? ago(m.seen_at) : '—'),
					h('dt', null, t('Signed in on')),
					h('dd', null, t('{n} devices', { n: m.sessions })),
					h('dt', null, t('Offline downloads')),
					h('dd', null, t('{today} today, {total} in all', { today: num(m.offline.today), total: num(m.offline.total) })),
				),
				h(
					'div',
					{ class: 'ws-tiles' },
					tile(t('Suggestions'), Object.values(e).reduce((a, b) => a + b, 0)),
					tile(t('Waiting'), e.pending ?? 0),
					tile(t('Approved'), (e.approved ?? 0) + (e.exported ?? 0) + (e.merged ?? 0)),
					tile(t('Ratings'), m.ratings),
				),
			),
		);

		const out = h('p', { class: 'ws-result', role: 'status' });
		const apply = async (/** @type {{ role?: Role, status?: 'active' | 'suspended', insights?: boolean }} */ change) => {
			out.textContent = t('Saving…');
			try {
				const { member } = await changeMember(m.id, change);
				items[i] = member;
				rows[i].replaceWith((rows[i] = row(member, ago, () => open(i))));
				rows[i].setAttribute('aria-current', 'true');
				show(member, i);
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		};
		const levels = (/** @type {Role[]} */ (['owner', 'admin', 'editor', 'member'])).map((r) => {
			const allowed = m.may.roles.includes(r);
			const b = /** @type {HTMLButtonElement} */ (
				h('button', { type: 'button', class: 'ws-level', 'aria-pressed': String(m.role === r), disabled: !allowed && m.role !== r }, h('strong', null, t(ROLE_NAME[r])), h('span', null, t(ROLE_ABOUT[r])))
			);
			if (allowed && m.role !== r) b.addEventListener('click', () => apply({ role: r }));
			return b;
		});
		/** Shown the site's statistics: a member only; editors and above see them anyway. @param {Detail} who */
		const statistics = (who) => {
			const box = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: who.insights ? true : null }));
			box.addEventListener('change', () => apply({ insights: box.checked }));
			return h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Statistics')),
				h('label', { class: 'ws-choice' }, box, t('Can see the site’s statistics')),
				h('p', { class: 'ws-quiet' }, t('The Overview’s figures, Searches and the whole site’s ratings, read only. Nothing else changes.')),
			);
		};
		const suspended = m.status === 'suspended';
		const toggle = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: suspended ? 'ws-secondary' : 'ws-danger', hidden: !m.may.suspend }, suspended ? t('Restore the account') : t('Suspend the account')));
		let sure = false;
		toggle.addEventListener('click', () => {
			if (!suspended && !sure) {
				sure = true;
				toggle.textContent = t('Choose again to suspend');
				setTimeout(() => {
					sure = false;
					if (toggle.isConnected) toggle.textContent = t('Suspend the account');
				}, 4000);
				return;
			}
			apply({ status: suspended ? 'active' : 'suspended' });
		});
		inspector.replaceChildren(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Level')),
				h('div', { class: 'ws-levels', role: 'group', 'aria-label': t('Level') }, levels),
				m.may.roles.length ? '' : h('p', { class: 'ws-quiet' }, m.self ? t('Your own level is changed by an owner.') : t('Only an owner changes this member’s level.')),
				out,
			),
			m.may.suspend && m.role === 'member' ? statistics(m) : '',
			m.may.suspend ? h('section', { class: 'ws-box' }, h('h2', null, t('Account')), h('p', { class: 'ws-quiet' }, suspended ? t('Suspended: cannot sign in, rate or suggest.') : t('Suspending signs them out everywhere; reading stays open to them.')), toggle) : '',
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('History of the level')),
				m.history.length
					? h('ul', { class: 'ws-history' }, m.history.map((x) => h('li', null, h('strong', null, t(ROLE_NAME[/** @type {Role} */ (x.role)] ?? x.role)), ' ', h('span', null, x.by ? t('by {who}, {when}', { who: x.by, when: ago(x.at) }) : t('from the command line, {when}', { when: ago(x.at) })))))
					: h('p', { class: 'ws-quiet' }, t('Member since joining.')),
			),
		);
	};

	let timer = 0;
	search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(() => load().catch((err) => ol.replaceChildren(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err)))), 250);
	});
	listPane.append(
		...listBar({
			title: t('Members'),
			count: head,
			groups: [{ title: t('Show'), current: filter, fallback: '', href: memberHref, choices: FILTERS.map(([f, label]) => ({ value: f, label: t(label) })) }],
			search,
			reset: memberHref(''),
		}),
		ol,
	);
	await load();
	if (items.length && matchMedia('(min-width: 761px)').matches) await open(0);
	return [listPane, work, inspector];
}

/**
 * @param {Row} m
 * @param {(when: number, short?: boolean) => string} ago
 * @param {() => void} onOpen
 */
function row(m, ago, onOpen) {
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: `ws-row${m.status === 'suspended' ? ' ws-row-off' : ''}`, 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word' }, m.name), h('span', { class: `ws-role ws-role-${m.role}` }, t(ROLE_NAME[m.role]))),
			h('span', { class: 'ws-row-sub' }, m.email ?? '—'),
			h('span', { class: 'ws-row-state' }, m.status === 'suspended' ? t('suspended') : t('joined {when}', { when: ago(m.created_at) })),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}

/** @param {string} label @param {number} value */
function tile(label, value) {
	return h('div', { class: 'ws-tile' }, h('span', { class: 'ws-tile-label' }, label), h('strong', { class: 'ws-tile-value' }, num(value)), h('span', { class: 'ws-tile-sub' }, ''));
}
