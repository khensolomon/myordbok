// @ts-check
/**
 * The workspace (/workspace): one place for every signed-in member, laid
 * out like a studio. A rail of sections, a list, the work area, an
 * inspector and a status bar; the sections in the rail follow the role.
 *
 *   ?s=overview      everyone, the default: figures for the role (overview.js)
 *   ?s=suggestions   editors and admins: suggestions by status
 *   ?s=searches      editors and admins: every word searched, not found first (searches.js)
 *   ?s=comments      editors and admins: comments on entries, to hide or show (comments.js)
 *   ?s=contributions everyone: the member's own suggestions
 *   ?s=offline       everyone: the dictionary kept on this device (offline.js)
 *   ?s=ratings       everyone: what the member rated; editors also the site's (ratings.js)
 *   ?s=inbox         admins: messages from the contact form (inbox.js)
 *   ?s=members       admins and owners: levels and suspending (members.js)
 *   ?s=notices       admins: site notices, scheduled ahead (notices.js)
 *   ?s=settings      admins: site settings (settings.js)
 *   ?s=account       everyone: who is signed in, linking a provider, signing
 *                    out, deleting the account; signed out, signing in.
 *                    ?return=… goes there once signed in; ?error=… comes back
 *                    from a failed sign-in.
 *   &status=…        the list's filter;  &id=…  the item open in the work area
 *
 * Choosing an item updates the work area and the address in place; the list
 * is not fetched again. J and K move through the list; A and D approve or
 * decline when the item can be reviewed. Roles are enforced by the Worker:
 * the rail only follows them. Loaded only when opened, never precached.
 */
import { getJSON } from '#platform/http.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { renderMarkup } from '../core/markup.js';
import { atLeast, seesStatistics } from '#shared/roles.js';
import { list, mark, num, posName, shortDate, t, tx } from '../i18n/index.js';
import { member, signInHref, signOut } from '../core/member.js';
import { definitionHref } from '../core/routes.js';
import { deleteAccount, lookup, reactions, reviewEdit, withdrawEdit, workspaceEdits, workspaceSummary } from '../data/api.js';
import { inboxPanes } from './inbox.js';
import { overviewPane } from './overview.js';
import { settingsPane } from './settings.js';
import { ratingsPane } from './ratings.js';
import { offlinePane } from './offline.js';
import { membersPanes } from './members.js';
import { searchesPanes } from './searches.js';
import { listBar, listResizer } from './list-bar.js';
import { commentsPanes } from './comments.js';
import { noticesPane } from './notices.js';

/** @typedef {import('../data/api.js').WorkspaceEdit} Edit */
/** @typedef {import('../core/member.js').Member} Member */
/** @typedef {'overview' | 'suggestions' | 'searches' | 'comments' | 'contributions' | 'ratings' | 'offline' | 'inbox' | 'members' | 'notices' | 'settings' | 'account'} Section */

/** Sections in rail order, and who has them. */
const SECTIONS = /** @type {const} */ ([
	{ id: 'overview', label: mark('Overview'), icon: ICONS.overview, editor: false, admin: false },
	{ id: 'suggestions', label: mark('Suggestions'), icon: ICONS.suggest, editor: true, admin: false },
	{ id: 'comments', label: mark('Comments'), icon: ICONS.comment, editor: true, admin: false },
	{ id: 'searches', label: mark('Searches'), icon: ICONS.search, editor: false, admin: false, stats: true },
	{ id: 'contributions', label: mark('Contributions'), icon: ICONS.document, editor: false, admin: false },
	{ id: 'ratings', label: mark('Ratings'), icon: ICONS.thumbUp, editor: false, admin: false },
	{ id: 'offline', label: mark('Offline copy'), icon: ICONS.download, editor: false, admin: false },
	{ id: 'inbox', label: mark('Inbox'), icon: ICONS.inbox, editor: true, admin: true },
	{ id: 'members', label: mark('Members'), icon: ICONS.members, editor: true, admin: true },
	{ id: 'notices', label: mark('Notices'), icon: ICONS.notice, editor: true, admin: true },
	{ id: 'settings', label: mark('Settings'), icon: ICONS.settings, editor: true, admin: true },
]);

const FILTERS = /** @type {const} */ ([
	['pending', mark('Waiting')],
	['approved', mark('Approved')],
	['rejected', mark('Declined')],
	['all', mark('All')],
]);

/** @type {Record<string, string>} */
const STATUS = {
	pending: mark('waiting'),
	approved: mark('approved'),
	exported: mark('approved'),
	rejected: mark('declined'),
	merged: mark('in the dictionary'),
	conflict: mark('conflict'),
};

/** Why a sign-in came back (worker/routes/auth.js). */
/** @type {Record<string, string>} */
const ERRORS = {
	cancelled: mark('Sign-in was cancelled.'),
	expired: mark('The sign-in took too long or was started in another tab. Please try again.'),
	provider: mark('The sign-in could not be completed. Please try again.'),
	not_configured: mark('Signing in with this provider is not available on this site yet.'),
	suspended: mark('This account is suspended.'),
	linked_elsewhere: mark('That account is already linked to another MyOrdbok account.'),
};

/** @type {Record<'google' | 'github', string>} */
const PROVIDERS = { google: 'Google', github: 'GitHub' };

/** Contributions, grouped in this order. */
const GROUPS = /** @type {const} */ ([
	[mark('Waiting'), ['pending']],
	[mark('Approved'), ['approved', 'exported']],
	[mark('In the dictionary'), ['merged']],
	[mark('Declined'), ['rejected']],
	[mark('Needs a look'), ['conflict']],
]);

export function title() {
	return t('Workspace');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const me = await member({ fresh: true });
	const back = safeReturn(ctx.query.get('return'));
	if (!me) return signedOut(back, notice(ctx.query));
	if (back) {
		// Signed in already, or just now: straight back to where it started.
		ctx.replace(back);
		return h('div');
	}
	const editor = atLeast(me.role, 'editor');
	const admin = atLeast(me.role, 'admin');
	const asked = ctx.query.get('s');
	/** @type {Section} */
	const section = asked === 'account' || asked === 'contributions' || asked === 'ratings' || asked === 'offline' ? asked : (asked === 'suggestions' || asked === 'comments') && editor ? asked : asked === 'searches' && seesStatistics(me) ? asked : (asked === 'inbox' || asked === 'settings' || asked === 'members' || asked === 'notices') && admin ? asked : 'overview';
	const [summary, health] = await Promise.all([workspaceSummary(), getJSON('/api/health').catch(() => null)]);

	const root = h('div', { class: 'ws', 'data-section': section });
	/** Sections with a list: its column can be resized on a desktop (list-bar.js). */
	const resizable = () => {
		const list = root.querySelector('.ws-list');
		if (list instanceof HTMLElement) listResizer(root, list);
	};
	const status = statusBar(health, summary, editor);
	const rail = railFor(me, editor, section, summary);
	if (section === 'account') {
		root.append(rail, accountPane(me, ctx, notice(ctx.query)), status.node);
		return root;
	}
	if (section === 'overview') {
		root.append(rail, await overviewPane(me, health), status.node);
		return root;
	}
	if (section === 'offline') {
		root.append(rail, await offlinePane(), status.node);
		return root;
	}
	if (section === 'ratings') {
		root.append(rail, await ratingsPane(ctx, seesStatistics(me), ago), status.node);
		return root;
	}
	if (section === 'comments') {
		root.append(rail, ...(await commentsPanes(ctx, root, ago)), status.node);
		resizable();
		return root;
	}
	if (section === 'searches') {
		root.append(rail, ...(await searchesPanes(ctx, root, admin)), status.node);
		resizable();
		return root;
	}
	if (section === 'members') {
		root.append(rail, ...(await membersPanes(ctx, root, ago)), status.node);
		resizable();
		return root;
	}
	if (section === 'settings') {
		root.append(rail, await settingsPane(), status.node);
		return root;
	}
	if (section === 'notices') {
		root.append(rail, await noticesPane(ctx, ago), status.node);
		return root;
	}
	if (section === 'inbox') {
		const panes = await inboxPanes(ctx, root, ago, (unread) => {
			for (const badge of rail.querySelectorAll('[data-section-badge="inbox"]')) {
				badge.textContent = num(unread);
				badge.toggleAttribute('hidden', unread === 0);
			}
		});
		root.append(rail, ...panes, status.node);
		resizable();
		return root;
	}

	const filter = FILTERS.some(([s]) => s === ctx.query.get('status')) ? /** @type {string} */ (ctx.query.get('status')) : section === 'suggestions' ? 'pending' : 'all';
	const work = h('main', { class: 'ws-main', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose an item from the list.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const listPane = h('section', { class: 'ws-list', 'aria-label': section === 'suggestions' ? t('Suggestions') : t('Contributions') });
	root.append(rail, listPane, work, inspector, status.node);
	resizable();

	/** @type {Edit[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let current = -1;
	const ol = h('ol', { class: 'ws-rows' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Filter by word or member'), 'aria-label': t('Filter the list') }));

	/** @param {number} i */
	const open = (i) => {
		if (i < 0 || i >= items.length) return;
		current = i;
		rows.forEach((r, n) => r.setAttribute('aria-current', String(n === i)));
		rows[i].scrollIntoView({ block: 'nearest' });
		const e = items[i];
		const url = new URL(location.href);
		url.searchParams.set('id', String(e.id));
		history.replaceState(history.state, '', url);
		root.toggleAttribute('data-open', true);
		status.word(e.word);
		renderItem(e, { work, inspector, editor, section, back: () => root.removeAttribute('data-open'), done: (next) => afterDecision(next) });
	};
	/**
	 * After a decision: the row shows its new status; in the Waiting list it
	 * leaves, and the next one opens.
	 * @param {Edit} changed
	 */
	const afterDecision = (changed) => {
		const i = items.findIndex((x) => x.id === changed.id);
		if (i < 0) return;
		items[i] = changed;
		if (filter === 'pending') {
			items.splice(i, 1);
			rows[i].closest('li')?.remove();
			rows.splice(i, 1);
			status.waiting(-1);
			if (items.length) open(Math.min(i, items.length - 1));
			else {
				work.replaceChildren(h('p', { class: 'ws-empty' }, t('Nothing is waiting. Well done.')));
				inspector.replaceChildren();
			}
		} else {
			rows[i].replaceWith((rows[i] = rowButton(changed, section, () => open(i))));
		}
	};

	/** @type {number | undefined} */
	let before;
	const load = async () => {
		more.disabled = true;
		const page = await workspaceEdits({ status: filter, mine: section === 'contributions', before });
		const start = items.length;
		items = items.concat(page.edits);
		before = page.edits.at(-1)?.id;
		more.hidden = !page.more;
		more.disabled = false;
		renderRows(start);
	};
	/** @param {number} from  First new item. */
	const renderRows = (from) => {
		if (section === 'contributions' && from === 0) {
			// Grouped by where each suggestion stands.
			ol.replaceChildren();
			rows = [];
			const order = GROUPS.flatMap(([label, statuses]) => {
				const group = items.filter((e) => /** @type {readonly string[]} */ (statuses).includes(e.status));
				return group.length ? [{ label, group }] : [];
			});
			items = order.flatMap((g) => g.group);
			for (const g of order) {
				ol.append(h('li', { class: 'ws-group' }, `${t(g.label)} · ${num(g.group.length)}`));
				for (const e of g.group) {
					const i = rows.length;
					const b = rowButton(e, section, () => open(i));
					rows.push(b);
					ol.append(h('li', null, b));
				}
			}
		} else {
			for (let i = from; i < items.length; i++) {
				const b = rowButton(items[i], section, () => open(i));
				rows.push(b);
				ol.append(h('li', null, b));
			}
		}
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, section === 'suggestions' ? t('Nothing here.') : t('No suggestions yet. Use ✎ beside a meaning on any entry to suggest a change.')));
	};
	more.addEventListener('click', () => load().catch((err) => more.replaceWith(errorNote(err))));
	search.addEventListener('input', () => {
		const q = search.value.trim().toLowerCase();
		rows.forEach((r, i) => {
			const e = items[i];
			/** @type {HTMLElement} */ (r.closest('li')).hidden = !!q && !`${e.word} ${e.author}`.toLowerCase().includes(q);
		});
	});

	await load();
	const count = section === 'suggestions' ? t('{n} waiting', { n: summary.waiting ?? 0 }) : num(Object.values(summary.mine).reduce((a, b) => a + b, 0));
	const statusHref = (/** @type {string} */ s) => `/workspace?s=${section}${s === 'pending' ? '' : `&status=${s}`}`;
	listPane.replaceChildren(
		...listBar(
			section === 'suggestions'
				? {
						title: t('Suggestions'),
						count,
						main: { title: t('Show'), current: filter, fallback: 'pending', href: statusHref, choices: [{ value: 'pending', label: t('Waiting') }, { value: 'all', label: t('All') }] },
						search,
						more: [{ title: t('Status'), current: filter, fallback: 'pending', href: statusHref, choices: FILTERS.map(([s, label]) => ({ value: s, label: t(label) })) }],
						reset: statusHref('pending'),
					}
				: { title: t('Contributions'), count, search },
		),
		ol,
		more,
	);

	// The item named in the address, else the first; on a phone, the list first.
	const wanted = Number(ctx.query.get('id'));
	const at = items.findIndex((e) => e.id === wanted);
	if (at >= 0) open(at);
	else if (items.length && matchMedia('(min-width: 761px)').matches) open(0);

	/** @param {KeyboardEvent} ev */
	const keys = (ev) => {
		if (!root.isConnected) return document.removeEventListener('keydown', keys);
		const target = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || target.closest('input, textarea, select, [contenteditable]')) return;
		const k = ev.key.toLowerCase();
		if (k === 'j') open(current + 1);
		else if (k === 'k') open(current - 1);
		else if (k === 'a' || k === 'd') /** @type {HTMLButtonElement | null} */ (inspector.querySelector(k === 'a' ? '[data-key="a"]' : '[data-key="d"]'))?.click();
		else return;
		ev.preventDefault();
	};
	document.addEventListener('keydown', keys);
	return root;
}

/**
 * @param {Edit} e
 * @param {Section} section
 * @param {() => void} onOpen
 */
function rowButton(e, section, onOpen) {
	const what = e.action === 'add' ? t('New meaning') : e.action === 'delete' ? t('Remove') : e.field === 'exam' ? t('Example') : t('Meaning');
	const by = section === 'suggestions' ? (e.own ? t('you') : e.author) : STATUS[e.status] ? t(STATUS[e.status]) : e.status;
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: 'ws-row', 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word', lang: e.dict === 'emd' ? 'en' : 'my' }, e.word), h('span', { class: 'ws-row-time' }, ago(e.created_at, true))),
			h('span', { class: 'ws-row-sub' }, `${what} · ${by}`),
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}

/**
 * The work area and inspector for one suggestion.
 * @param {Edit} e
 * @param {{ work: HTMLElement, inspector: HTMLElement, editor: boolean, section: Section, back: () => void, done: (e: Edit) => void }} o
 */
function renderItem(e, o) {
	const lang = e.dict === 'emd' ? 'en' : 'my';
	const meaningLang = lang === 'en' ? 'my' : 'en';
	const exampleLang = lang;
	const what = e.action === 'add' ? t('New meaning') : e.action === 'delete' ? t('Remove a meaning') : e.field === 'exam' ? t('Change an example') : t('Change a meaning');

	const entry = h('div', { class: 'ws-entry' }, h('p', { class: 'ws-quiet' }, t('Loading the entry…')));
	const backButton = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
	backButton.addEventListener('click', o.back);
	o.work.replaceChildren(
		h(
			'header',
			{ class: 'ws-crumbs' },
			backButton,
			h('span', { class: 'ws-crumb-word', lang }, e.word),
			h('span', { 'aria-hidden': 'true' }, '›'),
			h('span', null, what),
			h('a', { href: definitionHref(e.word), class: 'ws-out' }, t('Open on the site ↗')),
		),
		h('div', { class: 'ws-work' }, h('p', { class: 'ws-quiet' }, t('The entry as it is now, with the suggested change in place. Changed lines show the text as stored.')), entry),
	);

	// The change, as lines of a diff.
	/** @param {'del' | 'add'} kind @param {string | null} text @param {string} textLang */
	const line = (kind, text, textLang) =>
		h('div', { class: `ws-line ws-${kind}` }, h('span', { class: 'ws-sign', 'aria-label': kind === 'del' ? t('removed') : t('added') }, kind === 'del' ? '−' : '+'), h('span', { lang: textLang }, text ?? t('(none)')));
	/** @type {HTMLElement[]} */
	const change = [];
	if (e.action === 'edit') {
		const textLang = e.field === 'exam' ? exampleLang : meaningLang;
		change.push(line('del', e.old_value, textLang), line('add', e.new_value, textLang));
	} else if (e.action === 'delete') {
		change.push(line('del', e.current?.sense ?? e.old_value, meaningLang));
	} else if (e.data) {
		change.push(line('add', e.data.sense, meaningLang));
		if (e.data.exam) change.push(h('div', { class: 'ws-line ws-ctx' }, h('span', { class: 'ws-sign' }), h('span', { lang: exampleLang }, e.data.exam)));
	}

	lookup(e.word)
		.then((data) => {
			const senses = /** @type {Array<{ id?: number, type: string, sense: string, example: string | null }>} */ (data.entries);
			if (!senses.length) {
				entry.replaceChildren(...change);
				return;
			}
			/** @type {HTMLElement[]} */
			const out = [];
			let type = '';
			let n = 0;
			for (const s of senses) {
				if (s.type !== type) {
					type = s.type;
					out.push(h('div', { class: 'ws-line ws-type' }, posName(type)));
				}
				n++;
				if (s.id === e.sense_id && e.action === 'edit' && e.field === 'exam') {
					out.push(h('div', { class: 'ws-line ws-ctx' }, h('span', { class: 'ws-sign ws-n' }, num(n)), h('span', { lang: meaningLang }, renderMarkup(s.sense, { headword: e.word }))), ...change);
				} else if (s.id === e.sense_id) {
					out.push(...change);
					if (s.example && e.action === 'edit') out.push(h('div', { class: 'ws-line ws-ctx' }, h('span', { class: 'ws-sign' }), h('span', { lang: exampleLang }, renderMarkup(s.example, { headword: e.word }))));
				} else {
					out.push(h('div', { class: 'ws-line ws-dim' }, h('span', { class: 'ws-sign ws-n' }, num(n)), h('span', { lang: meaningLang }, renderMarkup(s.sense, { headword: e.word }))));
				}
			}
			if (e.action === 'add') out.push(...change);
			entry.replaceChildren(...out);
		})
		.catch(() => entry.replaceChildren(...change));

	// Inspector.
	/** @type {HTMLElement[]} */
	const parts = [
		h(
			'section',
			{ class: 'ws-box' },
			h('h2', null, t('Suggested by')),
			h('p', { class: 'ws-who' }, h('span', { class: 'ws-avatar' }, (e.own ? t('You') : e.author).slice(0, 1).toUpperCase()), h('strong', null, e.own ? t('You') : e.author)),
			e.note ? h('p', null, `“${e.note}”`) : null,
			h('p', { class: 'ws-quiet' }, e.source ? t('{when}, against build {build}', { when: ago(e.created_at), build: e.source }) : ago(e.created_at)),
		),
	];
	if (e.sense_id !== null) {
		const rated = h('span', null, '…');
		reactions(lang, e.word)
			.then((r) => {
				const c = r.senses[String(e.sense_id)];
				rated.textContent = c ? t('{up} up · {down} down', { up: c.likes, down: c.dislikes }) : t('not rated');
			})
			.catch(() => (rated.textContent = t('unavailable')));
		parts.push(h('section', { class: 'ws-box' }, h('h2', null, t('This meaning')), h('p', { class: 'ws-pair' }, h('span', null, t('Rated')), rated)));
	}
	if (e.reviewer) parts.push(h('section', { class: 'ws-box' }, h('h2', null, e.status === 'rejected' ? t('Declined') : t('Approved')), h('p', null, e.reviewed_at ? t('by {who}, {when}', { who: e.reviewer === 'you' ? t('you') : e.reviewer, when: ago(e.reviewed_at) }) : t('by {who}', { who: e.reviewer === 'you' ? t('you') : e.reviewer })), e.review_note ? h('p', null, `“${e.review_note}”`) : null));
	if (o.section === 'contributions') parts.push(progress(e.status));

	const out = h('p', { class: 'ws-result', role: 'status' });
	if (e.status === 'pending' && o.editor && !e.own && o.section === 'suggestions') {
		const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: 600, placeholder: t('Shown to {who} with the decision', { who: e.author }) }));
		const approve = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary', 'data-key': 'a' }, t('Approve')));
		const decline = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', 'data-key': 'd' }, t('Decline')));
		/** @param {'approve' | 'reject'} decision */
		const decide = async (decision) => {
			approve.disabled = decline.disabled = true;
			try {
				const { edit } = await reviewEdit(e.id, decision, note.value);
				o.done({ ...e, status: edit.status, reviewer: 'you', review_note: note.value || null, reviewed_at: Date.now() / 1000 });
			} catch (err) {
				approve.disabled = decline.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		};
		approve.addEventListener('click', () => decide('approve'));
		decline.addEventListener('click', () => decide('reject'));
		parts.push(
			h(
				'section',
				{ class: 'ws-box' },
				h('h2', null, t('Decision')),
				h('label', { class: 'ws-field' }, t('Note for {who} (optional)', { who: e.author }), note),
				h('div', { class: 'ws-buttons' }, approve, decline),
				out,
				h('p', { class: 'ws-quiet ws-keys' }, t('A approve · D decline · J K next, previous')),
			),
		);
	} else if (e.status === 'pending' && e.own) {
		const withdraw = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, t('Withdraw')));
		withdraw.addEventListener('click', async () => {
			withdraw.disabled = true;
			try {
				await withdrawEdit(e.id);
				o.done({ ...e, status: 'withdrawn' });
				out.textContent = t('Withdrawn.');
			} catch (err) {
				withdraw.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		parts.push(h('section', { class: 'ws-box' }, withdraw, h('p', { class: 'ws-quiet' }, t('Possible while it waits for review.')), out));
	}
	o.inspector.replaceChildren(...parts);
}

/**
 * Where a contribution stands, as a short track.
 * @param {string} status
 */
function progress(status) {
	const steps = [t('Suggested'), t('Reviewed'), t('In the next release'), t('In the dictionary')];
	const reached = status === 'merged' ? 4 : status === 'approved' || status === 'exported' ? 3 : status === 'rejected' ? 2 : 1;
	return h(
		'section',
		{ class: 'ws-box' },
		h('h2', null, t('Progress')),
		h(
			'ol',
			{ class: 'ws-track' },
			steps.map((s, i) => h('li', { 'data-done': i < reached ? 'true' : null }, i === 1 && status === 'rejected' ? t('Declined') : s)),
		),
	);
}

/**
 * @param {Member} me
 * @param {boolean} editor
 * @param {Section} section
 * @param {{ waiting: number | null, unread?: number }} summary
 */
function railFor(me, editor, section, summary) {
	const sections = SECTIONS.filter((s) => ('stats' in s ? seesStatistics(me) : s.admin ? atLeast(me.role, 'admin') : editor || !s.editor));
	const countOf = (/** @type {string} */ id) => (id === 'suggestions' ? (summary.waiting ?? 0) : id === 'inbox' ? (summary.unread ?? 0) : 0);
	const badge = (/** @type {string} */ id, /** @type {number} */ count) => (id === 'suggestions' || id === 'inbox' ? h('span', { class: 'ws-badge', 'data-section-badge': id, hidden: count ? null : true }, num(count)) : null);
	const items = sections.map((s) => {
		const label = t(s.label);
		const count = countOf(s.id);
		return h(
			'a',
			{ href: `/workspace?s=${s.id}`, class: 'ws-rail-item', 'aria-current': section === s.id ? 'page' : null, title: label, 'aria-label': count ? (s.id === 'inbox' ? t('{label}, {n} new', { label, n: count }) : t('{label}, {n} waiting', { label, n: count })) : label },
			icon(s.icon, 20),
			badge(s.id, count),
		);
	});
	const face = () => (me.avatar_url ? h('img', { src: me.avatar_url, alt: '', referrerpolicy: 'no-referrer' }) : me.name.slice(0, 1).toUpperCase());
	const current = section === 'account' ? t('Account') : t(SECTIONS.find((s) => s.id === section)?.label ?? 'Overview');

	// Phones: a bar at the top with the section's name, and the sections in a
	// menu from the button on the right, as the person menu on the site.
	const waiting = sections.reduce((n, s) => n + countOf(s.id), 0);
	const button = /** @type {HTMLButtonElement} */ (
		h('button', { type: 'button', class: 'ws-menu-button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'ws-menu', 'aria-label': t('Workspace sections') }, h('span', { class: 'ws-rail-face' }, face()), waiting ? h('span', { class: 'ws-menu-dot', 'aria-hidden': 'true' }) : '')
	);
	const panel = h(
		'div',
		{ class: 'ws-menu', id: 'ws-menu', hidden: true },
		h('div', { class: 'ws-menu-who' }, h('span', { class: 'ws-rail-face ws-menu-face' }, face()), h('div', null, h('strong', null, me.name), h('span', null, roleName(me.role)))),
		h(
			'nav',
			{ class: 'ws-menu-list', 'aria-label': t('Workspace') },
			sections.map((s) => h('a', { href: `/workspace?s=${s.id}`, 'aria-current': section === s.id ? 'page' : null }, icon(s.icon, 18), h('span', null, t(s.label)), badge(s.id, countOf(s.id)))),
		),
		h('nav', { class: 'ws-menu-list', 'aria-label': t('More') }, h('a', { href: '/workspace?s=account', 'aria-current': section === 'account' ? 'page' : null }, icon(ICONS.account, 18), h('span', null, t('Account'))), h('a', { href: '/' }, icon(ICONS.dictionary, 18), h('span', null, t('Back to the dictionary')))),
	);
	const setOpen = (/** @type {boolean} */ open) => {
		panel.hidden = !open;
		button.setAttribute('aria-expanded', String(open));
		if (open) /** @type {HTMLElement | null} */ (panel.querySelector('[aria-current="page"]') ?? panel.querySelector('a'))?.focus();
	};
	button.addEventListener('click', () => setOpen(panel.hidden));
	panel.addEventListener('click', (e) => {
		if (/** @type {HTMLElement} */ (e.target).closest('a')) setOpen(false);
	});
	const outside = (/** @type {PointerEvent} */ e) => {
		if (!button.isConnected) return document.removeEventListener('pointerdown', outside);
		const target = /** @type {Node} */ (e.target);
		if (!panel.hidden && !panel.contains(target) && !button.contains(target)) setOpen(false);
	};
	document.addEventListener('pointerdown', outside);
	panel.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			setOpen(false);
			button.focus();
		}
	});

	return h(
		'nav',
		{ class: 'ws-rail', 'aria-label': t('Workspace') },
		// On phones the logo and the section's name share a glass capsule; elsewhere the wrapper is invisible (display: contents).
		h('span', { class: 'ws-rail-head' }, h('a', { href: '/', class: 'ws-logo', title: 'MyOrdbok', 'aria-label': t('MyOrdbok, the public site') }, h('img', { src: '/static/icon.svg', alt: '', width: 28, height: 28 })), h('span', { class: 'ws-rail-title' }, current)),
		items,
		h('span', { class: 'ws-rail-gap' }),
		h('a', { href: '/workspace?s=account', class: 'ws-rail-face', 'aria-current': section === 'account' ? 'page' : null, title: `${me.name} · ${roleName(me.role)}`, 'aria-label': t('Account: {name}', { name: me.name }) }, face()),
		button,
		panel,
	);
}

/**
 * @param {Member} me
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement | null} alert
 */
function accountPane(me, ctx, alert) {
	const out = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, t('Sign out')));
	const note = h('p', { class: 'ws-result', role: 'status' });
	out.addEventListener('click', async () => {
		out.disabled = true;
		try {
			await signOut();
			ctx.go('/');
		} catch (err) {
			out.disabled = false;
			note.textContent = err instanceof Error ? err.message : String(err);
		}
	});
	const others = (/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).filter((p) => !me.providers.includes(p));
	return h(
		'main',
		{ class: 'ws-main ws-account', 'aria-label': t('Account') },
		h(
			'div',
			{ class: 'ws-work' },
			h('header', { class: 'ws-account-head' }, me.avatar_url ? h('img', { src: me.avatar_url, alt: '', width: 56, height: 56, referrerpolicy: 'no-referrer' }) : null, h('div', null, h('h1', null, me.name), me.email ? h('p', { class: 'ws-quiet' }, me.email) : null)),
			alert,
			h('dl', { class: 'ws-facts' }, h('dt', null, t('Role')), h('dd', null, roleName(me.role)), h('dt', null, t('Signs in with')), h('dd', null, list(me.providers.map((p) => PROVIDERS[p])) || '—')),
			others.length
				? h('p', null, tx('Also sign in with {providers}: it is linked to this account.', { providers: h('span', null, others.flatMap((p, i) => [i ? ` ${t('or')} ` : '', h('a', { href: signInHref(p, '/workspace?s=account') }, PROVIDERS[p])])) }))
				: null,
			h('p', null, h('a', { href: '/privacy' }, t('What is stored')), ' · ', h('a', { href: '/terms' }, t('Terms of Use'))),
			out,
			note,
			deletion(me, ctx),
		),
	);
}

/**
 * Deleting the account, behind a typed confirmation.
 * @param {Member} me
 * @param {import('../core/routes.js').ViewContext} ctx
 */
function deletion(me, ctx) {
	const expected = me.email ?? 'DELETE';
	const field = /** @type {HTMLInputElement} */ (h('input', { type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'ws-delete-help' }));
	const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-danger', disabled: true }, t('Delete the account')));
	const result = h('p', { class: 'ws-result', role: 'alert' });
	field.addEventListener('input', () => (go.disabled = field.value.trim().toLowerCase() !== expected.toLowerCase()));
	const form = h(
		'form',
		{ class: 'ws-delete' },
		h('p', { id: 'ws-delete-help' }, t('Removes the sign-ins, ratings, comments and suggestions still waiting. Suggestions already reviewed stay in the dictionary’s history as “Former member”. This cannot be undone.')),
		h('label', { class: 'ws-field' }, t('Type {text} to confirm', { text: expected }), field),
		go,
		result,
	);
	form.addEventListener('submit', async (ev) => {
		ev.preventDefault();
		go.disabled = true;
		try {
			await deleteAccount(field.value.trim());
			await member({ fresh: true });
			ctx.go('/');
		} catch (err) {
			go.disabled = false;
			result.textContent = err instanceof Error ? err.message : String(err);
		}
	});
	return h('details', { class: 'ws-danger-zone' }, h('summary', null, t('Delete the account')), form);
}

/**
 * @param {{ dictionary?: { database?: string, built?: string | null } | null } | null} health
 * @param {{ waiting: number | null, mine: Record<string, number> }} summary
 * @param {boolean} editor
 */
function statusBar(health, summary, editor) {
	let waiting = summary.waiting ?? 0;
	const waitingText = h('span', null, editor ? t('{n} waiting', { n: waiting }) : '');
	const definition = /** @type {HTMLAnchorElement} */ (h('a', { href: '/definition' }, t('Definition')));
	const db = health?.dictionary;
	const node = h(
		'footer',
		{ class: 'ws-status' },
		h('span', { class: 'ws-live' }, db ? `${db.database ?? t('dictionary')}${db.built ? ` · ${t('build {build}', { build: db.built })}` : ''}` : t('dictionary unavailable')),
		waitingText,
		h('span', { class: 'ws-status-gap' }),
		h('span', null, t('Site:')),
		h('a', { href: '/' }, t('Home')),
		definition,
		h('a', { href: '/grammar' }, t('Grammar')),
	);
	return {
		node,
		/** @param {string} word  The Definition link opens the word in hand. */
		word(word) {
			definition.href = definitionHref(word);
		},
		/** @param {number} by */
		waiting(by) {
			waiting = Math.max(0, waiting + by);
			if (!editor) return;
			waitingText.textContent = t('{n} waiting', { n: waiting });
			for (const badge of node.parentElement?.querySelectorAll('[data-section-badge="suggestions"]') ?? []) {
				badge.textContent = num(waiting);
				badge.toggleAttribute('hidden', waiting === 0);
			}
		},
	};
}

/**
 * Signing in, for the workspace and every "sign in" link on the site.
 * @param {string | null} back  Where to go once signed in.
 * @param {HTMLElement | null} alert
 */
function signedOut(back, alert) {
	const to = back ?? '/workspace';
	return h(
		'div',
		{ class: 'ws-signin' },
		h('a', { href: '/', 'aria-label': t('MyOrdbok, the dictionary') }, h('img', { src: '/static/icon.svg', alt: '', width: 48, height: 48 })),
		h('h1', null, t('Sign in')),
		h('p', null, t('To rate meanings and suggest corrections or new ones. Reading and searching never need an account.')),
		alert,
		h(
			'div',
			{ class: 'ws-providers' },
			(/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).map((p) => h('a', { class: 'ws-provider', href: signInHref(p, to) }, t('Continue with {provider}', { provider: PROVIDERS[p] }))),
		),
		h('p', { class: 'ws-quiet' }, t('The same verified email through either provider is the same account.'), ' ', h('a', { href: '/privacy' }, t('Privacy')), ' · ', h('a', { href: '/terms' }, t('Terms of Use'))),
		h('a', { href: '/' }, t('Back to the dictionary')),
	);
}

/**
 * A path on this site to come back to after signing in, never another site,
 * nor the workspace itself.
 * @param {string | null} value
 */
function safeReturn(value) {
	if (!value || !/^\/(?!\/)[^\\\s]*$/.test(value) || value.startsWith('/api/')) return null;
	return value.startsWith('/workspace') || value.startsWith('/account') ? null : value;
}

/**
 * The notice for ?error=… (and ?missing=… naming the setting).
 * @param {URLSearchParams} query
 */
function notice(query) {
	const error = query.get('error');
	if (!error) return null;
	const missing = query.get('missing');
	return h('p', { class: 'ws-alert', role: 'alert' }, ERRORS[error] ? t(ERRORS[error]) : t('The sign-in could not be completed.'), missing && /^[A-Z_]+$/.test(missing) ? ` ${t('({name} is not set.)', { name: missing })}` : null);
}

/** @param {string} role */
function roleName(role) {
	return role === 'owner' ? t('Owner') : role === 'admin' ? t('Administrator') : role === 'editor' ? t('Editor') : t('Member');
}

/** @param {unknown} err */
function errorNote(err) {
	return h('p', { class: 'ws-result', role: 'alert' }, err instanceof Error ? err.message : String(err));
}

/**
 * "5 min ago", "yesterday", or the date; short: "5 m", "2 h", "3 d".
 * @param {number} seconds  Unix time.
 * @param {boolean} [short]
 */
function ago(seconds, short = false) {
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
	return shortDate(new Date(seconds * 1000), { year: true });
}
