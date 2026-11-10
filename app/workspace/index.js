// @ts-check
/**
 * The workspace (/workspace): one place for every signed-in member, laid
 * out like a studio. A rail of sections, a list, the work area, an
 * inspector and a status bar; the sections in the rail follow the role.
 *
 *   ?s=overview      everyone, the default: figures for the role (overview.js)
 *   ?s=suggestions   editors and admins: suggestions by status
 *   ?s=contributions everyone: the member's own suggestions
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
import { member, signInHref, signOut } from '../core/member.js';
import { definitionHref } from '../core/routes.js';
import { deleteAccount, lookup, reactions, reviewEdit, withdrawEdit, workspaceEdits, workspaceSummary } from '../data/api.js';
import { overviewPane } from './overview.js';

/** @typedef {import('../data/api.js').WorkspaceEdit} Edit */
/** @typedef {import('../core/member.js').Member} Member */
/** @typedef {'overview' | 'suggestions' | 'contributions' | 'account'} Section */

/** Sections in rail order, and who has them. */
const SECTIONS = /** @type {const} */ ([
	{ id: 'overview', label: 'Overview', icon: ICONS.overview, editor: false },
	{ id: 'suggestions', label: 'Suggestions', icon: ICONS.suggest, editor: true },
	{ id: 'contributions', label: 'Contributions', icon: ICONS.document, editor: false },
]);

const FILTERS = /** @type {const} */ ([
	['pending', 'Waiting'],
	['approved', 'Approved'],
	['rejected', 'Declined'],
	['all', 'All'],
]);

/** @type {Record<string, string>} */
const STATUS = {
	pending: 'waiting',
	approved: 'approved',
	exported: 'approved',
	rejected: 'declined',
	merged: 'in the dictionary',
	conflict: 'conflict',
};

/** Why a sign-in came back (worker/routes/auth.js). */
/** @type {Record<string, string>} */
const ERRORS = {
	cancelled: 'Sign-in was cancelled.',
	expired: 'The sign-in took too long or was started in another tab. Please try again.',
	provider: 'The sign-in could not be completed. Please try again.',
	not_configured: 'Signing in with this provider is not available on this site yet.',
	suspended: 'This account is suspended.',
	linked_elsewhere: 'That account is already linked to another MyOrdbok account.',
};

/** @type {Record<'google' | 'github', string>} */
const PROVIDERS = { google: 'Google', github: 'GitHub' };

/** Contributions, grouped in this order. */
const GROUPS = /** @type {const} */ ([
	['Waiting', ['pending']],
	['Approved', ['approved', 'exported']],
	['In the dictionary', ['merged']],
	['Declined', ['rejected']],
	['Needs a look', ['conflict']],
]);

export function title() {
	return 'Workspace';
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
	const editor = me.role === 'editor' || me.role === 'admin';
	const asked = ctx.query.get('s');
	/** @type {Section} */
	const section = asked === 'account' || asked === 'contributions' ? asked : asked === 'suggestions' && editor ? 'suggestions' : 'overview';
	const [summary, health] = await Promise.all([workspaceSummary(), getJSON('/api/health').catch(() => null)]);

	const root = h('div', { class: 'ws', 'data-section': section });
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

	const filter = FILTERS.some(([s]) => s === ctx.query.get('status')) ? /** @type {string} */ (ctx.query.get('status')) : section === 'suggestions' ? 'pending' : 'all';
	const work = h('main', { class: 'ws-main', 'aria-label': 'Work area' }, h('p', { class: 'ws-empty' }, 'Choose an item from the list.'));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': 'Details' });
	const listPane = h('section', { class: 'ws-list', 'aria-label': section === 'suggestions' ? 'Suggestions' : 'Contributions' });
	root.append(rail, listPane, work, inspector, status.node);

	/** @type {Edit[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let current = -1;
	const ol = h('ol', { class: 'ws-rows' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, 'Show more'));
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: 'Filter by word or member', 'aria-label': 'Filter the list' }));

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
				work.replaceChildren(h('p', { class: 'ws-empty' }, 'Nothing is waiting. Well done.'));
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
				ol.append(h('li', { class: 'ws-group' }, `${g.label} · ${g.group.length}`));
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
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, section === 'suggestions' ? 'Nothing here.' : 'No suggestions yet. Use ✎ beside a meaning on any entry to suggest a change.'));
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
	const count = section === 'suggestions' ? `${summary.waiting ?? 0} waiting` : `${Object.values(summary.mine).reduce((a, b) => a + b, 0)}`;
	listPane.replaceChildren(
		h('header', { class: 'ws-list-head' }, h('h1', null, section === 'suggestions' ? 'Suggestions' : 'Contributions'), h('span', null, count)),
		section === 'suggestions'
			? h('nav', { class: 'ws-segments', 'aria-label': 'Show' }, FILTERS.map(([s, label]) => h('a', { href: `/workspace?s=${section}&status=${s}`, 'aria-current': s === filter ? 'true' : null }, label)))
			: '',
		h('label', { class: 'ws-search' }, icon(ICONS.search, 14), search),
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
		const t = /** @type {HTMLElement} */ (ev.target);
		if (ev.metaKey || ev.ctrlKey || ev.altKey || t.closest('input, textarea, select, [contenteditable]')) return;
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
	const what = e.action === 'add' ? 'New meaning' : e.action === 'delete' ? 'Remove' : e.field === 'exam' ? 'Example' : 'Meaning';
	const by = section === 'suggestions' ? (e.own ? 'you' : e.author) : STATUS[e.status] ?? e.status;
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
	const what = e.action === 'add' ? 'New meaning' : e.action === 'delete' ? 'Remove a meaning' : e.field === 'exam' ? 'Change an example' : 'Change a meaning';

	const entry = h('div', { class: 'ws-entry' }, h('p', { class: 'ws-quiet' }, 'Loading the entry…'));
	const backButton = h('button', { type: 'button', class: 'ws-back', 'aria-label': 'Back to the list' }, icon(ICONS.back, 20));
	backButton.addEventListener('click', o.back);
	o.work.replaceChildren(
		h(
			'header',
			{ class: 'ws-crumbs' },
			backButton,
			h('span', { class: 'ws-crumb-word', lang }, e.word),
			h('span', { 'aria-hidden': 'true' }, '›'),
			h('span', null, what),
			h('a', { href: definitionHref(e.word), class: 'ws-out' }, 'Open on the site ↗'),
		),
		h('div', { class: 'ws-work' }, h('p', { class: 'ws-quiet' }, 'The entry as it is now, with the suggested change in place. Changed lines show the text as stored.'), entry),
	);

	// The change, as lines of a diff.
	/** @param {'del' | 'add'} kind @param {string | null} text @param {string} textLang */
	const line = (kind, text, textLang) =>
		h('div', { class: `ws-line ws-${kind}` }, h('span', { class: 'ws-sign', 'aria-label': kind === 'del' ? 'removed' : 'added' }, kind === 'del' ? '−' : '+'), h('span', { lang: textLang }, text ?? '(none)'));
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
					out.push(h('div', { class: 'ws-line ws-type' }, type.toLowerCase()));
				}
				n++;
				if (s.id === e.sense_id && e.action === 'edit' && e.field === 'exam') {
					out.push(h('div', { class: 'ws-line ws-ctx' }, h('span', { class: 'ws-sign ws-n' }, String(n)), h('span', { lang: meaningLang }, renderMarkup(s.sense, { headword: e.word }))), ...change);
				} else if (s.id === e.sense_id) {
					out.push(...change);
					if (s.example && e.action === 'edit') out.push(h('div', { class: 'ws-line ws-ctx' }, h('span', { class: 'ws-sign' }), h('span', { lang: exampleLang }, renderMarkup(s.example, { headword: e.word }))));
				} else {
					out.push(h('div', { class: 'ws-line ws-dim' }, h('span', { class: 'ws-sign ws-n' }, String(n)), h('span', { lang: meaningLang }, renderMarkup(s.sense, { headword: e.word }))));
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
			h('h2', null, 'Suggested by'),
			h('p', { class: 'ws-who' }, h('span', { class: 'ws-avatar' }, (e.own ? 'You' : e.author).slice(0, 1).toUpperCase()), h('strong', null, e.own ? 'You' : e.author)),
			e.note ? h('p', null, `“${e.note}”`) : null,
			h('p', { class: 'ws-quiet' }, `${ago(e.created_at)}${e.source ? `, against build ${e.source}` : ''}`),
		),
	];
	if (e.sense_id !== null) {
		const rated = h('span', null, '…');
		reactions(lang, e.word)
			.then((r) => {
				const c = r.senses[String(e.sense_id)];
				rated.textContent = c ? `${c.likes} up · ${c.dislikes} down` : 'not rated';
			})
			.catch(() => (rated.textContent = 'unavailable'));
		parts.push(h('section', { class: 'ws-box' }, h('h2', null, 'This meaning'), h('p', { class: 'ws-pair' }, h('span', null, 'Rated'), rated)));
	}
	if (e.reviewer) parts.push(h('section', { class: 'ws-box' }, h('h2', null, e.status === 'rejected' ? 'Declined' : 'Approved'), h('p', null, `by ${e.reviewer}${e.reviewed_at ? `, ${ago(e.reviewed_at)}` : ''}`), e.review_note ? h('p', null, `“${e.review_note}”`) : null));
	if (o.section === 'contributions') parts.push(progress(e.status));

	const out = h('p', { class: 'ws-result', role: 'status' });
	if (e.status === 'pending' && o.editor && !e.own && o.section === 'suggestions') {
		const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: 600, placeholder: `Shown to ${e.author} with the decision` }));
		const approve = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary', 'data-key': 'a' }, 'Approve'));
		const decline = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', 'data-key': 'd' }, 'Decline'));
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
				h('h2', null, 'Decision'),
				h('label', { class: 'ws-field' }, `Note for ${e.author} (optional)`, note),
				h('div', { class: 'ws-buttons' }, approve, decline),
				out,
				h('p', { class: 'ws-quiet ws-keys' }, 'A approve · D decline · J K next, previous'),
			),
		);
	} else if (e.status === 'pending' && e.own) {
		const withdraw = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, 'Withdraw'));
		withdraw.addEventListener('click', async () => {
			withdraw.disabled = true;
			try {
				await withdrawEdit(e.id);
				o.done({ ...e, status: 'withdrawn' });
				out.textContent = 'Withdrawn.';
			} catch (err) {
				withdraw.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		parts.push(h('section', { class: 'ws-box' }, withdraw, h('p', { class: 'ws-quiet' }, 'Possible while it waits for review.'), out));
	}
	o.inspector.replaceChildren(...parts);
}

/**
 * Where a contribution stands, as a short track.
 * @param {string} status
 */
function progress(status) {
	const steps = ['Suggested', 'Reviewed', 'In the next release', 'In the dictionary'];
	const reached = status === 'merged' ? 4 : status === 'approved' || status === 'exported' ? 3 : status === 'rejected' ? 2 : 1;
	return h(
		'section',
		{ class: 'ws-box' },
		h('h2', null, 'Progress'),
		h(
			'ol',
			{ class: 'ws-track' },
			steps.map((s, i) => h('li', { 'data-done': i < reached ? 'true' : null }, i === 1 && status === 'rejected' ? 'Declined' : s)),
		),
	);
}

/**
 * @param {Member} me
 * @param {boolean} editor
 * @param {Section} section
 * @param {{ waiting: number | null }} summary
 */
function railFor(me, editor, section, summary) {
	const items = SECTIONS.filter((s) => editor || !s.editor).map((s) =>
		h(
			'a',
			{ href: `/workspace?s=${s.id}`, class: 'ws-rail-item', 'aria-current': section === s.id ? 'page' : null, title: s.label, 'aria-label': s.id === 'suggestions' && summary.waiting ? `${s.label}, ${summary.waiting} waiting` : s.label },
			icon(s.icon, 20),
			s.id === 'suggestions' && summary.waiting ? h('span', { class: 'ws-badge' }, String(summary.waiting)) : null,
		),
	);
	const face = me.avatar_url ? h('img', { src: me.avatar_url, alt: '', referrerpolicy: 'no-referrer' }) : me.name.slice(0, 1).toUpperCase();
	return h(
		'nav',
		{ class: 'ws-rail', 'aria-label': 'Workspace' },
		h('a', { href: '/', class: 'ws-logo', title: 'MyOrdbok', 'aria-label': 'MyOrdbok, the public site' }, h('img', { src: '/static/icon.svg', alt: '', width: 28, height: 28 })),
		items,
		h('span', { class: 'ws-rail-gap' }),
		h('a', { href: '/workspace?s=account', class: 'ws-rail-face', 'aria-current': section === 'account' ? 'page' : null, title: `${me.name} · ${roleName(me.role)}`, 'aria-label': `Account: ${me.name}` }, face),
	);
}

/**
 * @param {Member} me
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement | null} alert
 */
function accountPane(me, ctx, alert) {
	const out = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary' }, 'Sign out'));
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
		{ class: 'ws-main ws-account', 'aria-label': 'Account' },
		h(
			'div',
			{ class: 'ws-work' },
			h('header', { class: 'ws-account-head' }, me.avatar_url ? h('img', { src: me.avatar_url, alt: '', width: 56, height: 56, referrerpolicy: 'no-referrer' }) : null, h('div', null, h('h1', null, me.name), me.email ? h('p', { class: 'ws-quiet' }, me.email) : null)),
			alert,
			h('dl', { class: 'ws-facts' }, h('dt', null, 'Role'), h('dd', null, roleName(me.role)), h('dt', null, 'Signs in with'), h('dd', null, me.providers.map((p) => PROVIDERS[p]).join(' and ') || '—')),
			others.length
				? h('p', null, 'Also sign in with ', others.flatMap((p, i) => [i ? ' or ' : '', h('a', { href: signInHref(p, '/workspace?s=account') }, PROVIDERS[p])]), ': it is linked to this account.')
				: null,
			h('p', null, h('a', { href: '/privacy' }, 'What is stored'), ' · ', h('a', { href: '/terms' }, 'Terms of Use')),
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
	const go = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-danger', disabled: true }, 'Delete the account'));
	const result = h('p', { class: 'ws-result', role: 'alert' });
	field.addEventListener('input', () => (go.disabled = field.value.trim().toLowerCase() !== expected.toLowerCase()));
	const form = h(
		'form',
		{ class: 'ws-delete' },
		h('p', { id: 'ws-delete-help' }, 'Removes the sign-ins, ratings, comments and suggestions still waiting. Suggestions already reviewed stay in the dictionary’s history as “Former member”. This cannot be undone.'),
		h('label', { class: 'ws-field' }, me.email ? `Type ${me.email} to confirm` : 'Type DELETE to confirm', field),
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
	return h('details', { class: 'ws-danger-zone' }, h('summary', null, 'Delete the account'), form);
}

/**
 * @param {{ dictionary?: { database?: string, built?: string | null } | null } | null} health
 * @param {{ waiting: number | null, mine: Record<string, number> }} summary
 * @param {boolean} editor
 */
function statusBar(health, summary, editor) {
	let waiting = summary.waiting ?? 0;
	const waitingText = h('span', null, editor ? `${waiting} waiting` : '');
	const definition = /** @type {HTMLAnchorElement} */ (h('a', { href: '/definition' }, 'Definition'));
	const db = health?.dictionary;
	const node = h(
		'footer',
		{ class: 'ws-status' },
		h('span', { class: 'ws-live' }, db ? `${db.database ?? 'dictionary'}${db.built ? ` · build ${db.built}` : ''}` : 'dictionary unavailable'),
		waitingText,
		h('span', { class: 'ws-status-gap' }),
		h('span', null, 'Site:'),
		h('a', { href: '/' }, 'Home'),
		definition,
		h('a', { href: '/grammar' }, 'Grammar'),
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
			waitingText.textContent = `${waiting} waiting`;
			const badge = node.parentElement?.querySelector('.ws-badge');
			if (badge) {
				badge.textContent = String(waiting);
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
		h('a', { href: '/', 'aria-label': 'MyOrdbok, the dictionary' }, h('img', { src: '/static/icon.svg', alt: '', width: 48, height: 48 })),
		h('h1', null, 'Sign in'),
		h('p', null, 'To rate meanings and suggest corrections or new ones. Reading and searching never need an account.'),
		alert,
		h(
			'div',
			{ class: 'ws-providers' },
			(/** @type {Array<'google' | 'github'>} */ (['google', 'github'])).map((p) => h('a', { class: 'ws-provider', href: signInHref(p, to) }, `Continue with ${PROVIDERS[p]}`)),
		),
		h('p', { class: 'ws-quiet' }, 'The same verified email through either provider is the same account. ', h('a', { href: '/privacy' }, 'Privacy'), ' · ', h('a', { href: '/terms' }, 'Terms of Use')),
		h('a', { href: '/' }, 'Back to the dictionary'),
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
	return h('p', { class: 'ws-alert', role: 'alert' }, ERRORS[error] ?? 'The sign-in could not be completed.', missing && /^[A-Z_]+$/.test(missing) ? ` (${missing} is not set.)` : null);
}

/** @param {string} role */
function roleName(role) {
	return role === 'admin' ? 'Administrator' : role === 'editor' ? 'Editor' : 'Member';
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
		if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))} m`;
		if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
		return `${Math.floor(diff / 86400)} d`;
	}
	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
	if (diff < 172800) return 'yesterday';
	return new Date(seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
