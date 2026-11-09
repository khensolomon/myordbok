// @ts-check
/**
 * Workspace: suggestions to the dictionary, by role. Loaded only when /workspace
 * is opened, and kept out of the offline precache, so readers never
 * download it.
 *
 *   ?tab=review   editors and admins: suggestions waiting for review (or by
 *                 status), each showing the sense as the dictionary has it now
 *   ?tab=mine     every member: their own suggestions, withdrawn while waiting
 *
 * Roles are enforced by the Worker; the tabs only follow them.
 */
import { h } from '../core/dom.js';
import { member } from '../core/member.js';
import { reviewEdit, workspaceEdits, workspaceSummary, withdrawEdit } from '../data/api.js';

/** @typedef {import('../data/api.js').WorkspaceEdit} WorkspaceEdit */

const FILTERS = /** @type {const} */ ([
	['pending', 'Waiting'],
	['approved', 'Approved'],
	['rejected', 'Not accepted'],
	['all', 'All'],
]);

/** @type {Record<string, string>} */
const STATUS = {
	pending: 'waiting',
	approved: 'approved',
	rejected: 'not accepted',
	exported: 'exported',
	merged: 'in the dictionary',
	conflict: 'conflict',
};

export function title() {
	return 'Workspace';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function view(ctx) {
	const me = await member({ fresh: true });
	if (!me) {
		return h(
			'section',
			{ class: 'page workspace' },
			h('h1', null, 'Workspace'),
			h('p', null, 'The workspace is where suggestions to the dictionary are made and reviewed. ', h('a', { href: '/account?return=%2Fworkspace' }, 'Sign in'), ' to open it.'),
		);
	}
	const editor = me.role === 'editor' || me.role === 'admin';
	const tab = editor && ctx.query.get('tab') !== 'mine' ? 'review' : 'mine';
	const status = FILTERS.some(([s]) => s === ctx.query.get('status')) ? /** @type {string} */ (ctx.query.get('status')) : tab === 'review' ? 'pending' : 'all';
	const counts = await workspaceSummary();

	/** @param {string} name @param {string} label @param {number | null} [n] */
	const tabLink = (name, label, n) =>
		h('a', { href: `/workspace?tab=${name}`, 'aria-current': tab === name ? 'page' : null }, label, n ? h('span', { class: 'workspace-count' }, String(n)) : null);
	const mineTotal = Object.values(counts.mine).reduce((a, b) => a + b, 0);

	const list = h('ol', { class: 'workspace-list' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'workspace-more', hidden: true }, 'Show more'));
	const empty = h('p', { class: 'notice', hidden: true }, tab === 'review' ? 'Nothing here. Suggestions waiting for review appear in this list.' : 'No suggestions yet. Use ✎ beside a meaning on any entry to suggest a change.');
	/** @type {number | undefined} */
	let before;
	const load = async () => {
		more.disabled = true;
		const page = await workspaceEdits({ status, mine: tab === 'mine', before });
		list.append(...page.edits.map((e) => item(e, tab, editor)));
		before = page.edits.at(-1)?.id;
		more.hidden = !page.more;
		more.disabled = false;
		empty.hidden = list.childElementCount > 0;
	};
	more.addEventListener('click', () => load().catch((err) => more.replaceWith(errorNote(err))));
	await load();

	return h(
		'section',
		{ class: 'page workspace' },
		h('header', { class: 'workspace-head' }, h('h1', null, 'Workspace'), h('p', { class: 'aside-quiet' }, `Signed in as ${me.name} · ${me.role === 'admin' ? 'administrator' : me.role}`)),
		h('nav', { class: 'workspace-tabs', 'aria-label': 'Workspace' }, editor ? tabLink('review', 'Review', counts.waiting) : null, tabLink('mine', 'My suggestions', tab === 'mine' ? null : mineTotal || null)),
		h(
			'nav',
			{ class: 'chips workspace-filters', 'aria-label': 'Show' },
			FILTERS.map(([s, label]) => h('a', { href: `/workspace?tab=${tab}&status=${s}`, 'aria-current': s === status ? 'true' : null }, label)),
		),
		list,
		empty,
		more,
	);
}

/**
 * One suggestion: what it changes, on which entry, by whom, and what can be
 * done with it here.
 * @param {WorkspaceEdit} e
 * @param {'review' | 'mine'} tab
 * @param {boolean} editor
 */
function item(e, tab, editor) {
	const lang = e.dict === 'emd' ? 'en' : 'my';
	// emd: Myanmar meanings, English examples; med: the other way round.
	const meaningLang = e.dict === 'emd' ? 'my' : 'en';
	const exampleLang = e.dict === 'emd' ? 'en' : 'my';
	const valueLang = e.field === 'exam' ? exampleLang : meaningLang;
	const what = e.action === 'add' ? 'New meaning' : e.action === 'delete' ? 'Remove meaning' : e.field === 'exam' ? 'Change example' : 'Change meaning';

	/** @type {import('../core/dom.js').Child[]} */
	const body = [];
	if (e.action === 'edit') {
		const now = e.current ? (e.field === 'exam' ? e.current.exam : e.current.sense) : null;
		body.push(h('p', { class: 'workspace-old' }, h('del', { lang: valueLang }, e.old_value ?? '(none)')), h('p', { class: 'workspace-new' }, h('ins', { lang: valueLang }, e.new_value ?? '(none)')));
		if (e.status === 'pending' && (now ?? null) !== (e.old_value ?? null)) {
			body.push(h('p', { class: 'workspace-warn' }, 'The dictionary has changed since: it now reads ', h('span', { lang: valueLang }, now ?? '(none)'), '.'));
		}
		if (e.field === 'exam' && e.current?.sense) body.push(h('p', { class: 'workspace-context' }, 'Meaning: ', h('span', { lang: meaningLang }, e.current.sense)));
	} else if (e.action === 'delete') {
		body.push(e.current ? h('p', { class: 'workspace-old' }, h('del', { lang: meaningLang }, e.current.sense ?? '')) : h('p', { class: 'workspace-warn' }, 'This meaning is no longer in the dictionary.'));
	} else if (e.data) {
		body.push(h('p', { class: 'workspace-new' }, h('ins', { lang: meaningLang }, e.data.sense)));
		if (e.data.exam) body.push(h('p', { class: 'workspace-context' }, 'Example: ', h('span', { lang: exampleLang }, e.data.exam)));
	}
	if (e.current && e.action !== 'add') body.push(h('p', { class: 'workspace-context' }, `${e.current.type} · sense #${e.sense_id}`));

	const meta = h(
		'p',
		{ class: 'workspace-meta' },
		e.own ? 'You' : e.author,
		` · ${ago(e.created_at)}`,
		e.note ? h('span', { class: 'workspace-note' }, ` · “${e.note}”`) : null,
	);
	const reviewed = e.reviewer ? h('p', { class: 'workspace-meta' }, `${e.status === 'rejected' ? 'Not accepted' : 'Approved'} by ${e.reviewer}`, e.reviewed_at ? ` · ${ago(e.reviewed_at)}` : '', e.review_note ? h('span', { class: 'workspace-note' }, ` · “${e.review_note}”`) : null) : null;

	const status = h('span', { class: `suggest-status status-${e.status}` }, STATUS[e.status] ?? e.status);
	const node = h(
		'li',
		{ class: 'workspace-item' },
		h('header', { class: 'workspace-item-head' }, h('a', { href: `/definition?q=${encodeURIComponent(e.word)}`, lang, class: 'workspace-word' }, e.word), h('span', { class: 'workspace-what' }, what), status),
		body,
		meta,
		reviewed,
	);
	if (e.status !== 'pending') return node;

	const out = h('p', { class: 'suggest-result', role: 'status' });
	if (tab === 'review' && editor && !e.own) {
		const note = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 600, placeholder: 'A note for the author (optional)', class: 'workspace-note-input' }));
		const approve = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send' }, 'Approve'));
		const reject = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, 'Not accepted'));
		/** @param {'approve' | 'reject'} decision */
		const decide = async (decision) => {
			approve.disabled = reject.disabled = true;
			try {
				const { edit } = await reviewEdit(e.id, decision, note.value);
				status.className = `suggest-status status-${edit.status}`;
				status.textContent = STATUS[edit.status] ?? edit.status;
				actions.remove();
				out.textContent = decision === 'approve' ? 'Approved. It goes out with the next export.' : 'Marked as not accepted.';
			} catch (err) {
				approve.disabled = reject.disabled = false;
				out.className = 'suggest-result suggest-failed';
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		};
		approve.addEventListener('click', () => decide('approve'));
		reject.addEventListener('click', () => decide('reject'));
		const actions = h('div', { class: 'workspace-actions' }, note, h('div', { class: 'suggest-buttons' }, approve, reject));
		node.append(actions, out);
	} else if (e.own) {
		const withdraw = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, 'Withdraw'));
		withdraw.addEventListener('click', async () => {
			withdraw.disabled = true;
			try {
				await withdrawEdit(e.id);
				node.remove();
			} catch (err) {
				withdraw.disabled = false;
				out.className = 'suggest-result suggest-failed';
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		node.append(h('div', { class: 'suggest-buttons' }, withdraw), out);
	}
	return node;
}

/** @param {unknown} err */
function errorNote(err) {
	return h('p', { class: 'account-error', role: 'alert' }, err instanceof Error ? err.message : String(err));
}

/**
 * "5 minutes ago", "yesterday", or the date.
 * @param {number} seconds  Unix time.
 */
function ago(seconds) {
	const diff = Date.now() / 1000 - seconds;
	if (diff < 60) return 'just now';
	if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
	if (diff < 172800) return 'yesterday';
	return new Date(seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
