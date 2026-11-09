// @ts-check
/**
 * Members' part on an entry: like or dislike it, and suggest a change to
 * its meanings. Signed out, the same buttons lead to the account page and
 * back to the word.
 *
 * Suggestions open a panel listing the headword's meanings as the dataset
 * holds them (with ids, from /api/senses), each editable, plus a new one.
 * A member's suggestion waits for an editor; an editor's own is approved and
 * reaches the dictionary with the next release.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { member } from '../core/member.js';
import { editableSenses, react, reactions, suggestEdit } from '../data/api.js';

/** @typedef {import('../data/api.js').EditableSense} EditableSense */
/** @typedef {import('../data/api.js').OwnEdit} OwnEdit */

/** @type {Record<string, string>} */
const STATUS = {
	pending: 'waiting for review',
	approved: 'approved, in the next release',
	exported: 'approved, in the next release',
	rejected: 'not accepted',
	conflict: 'the entry changed first; please look again',
};

/**
 * Opens a path in the app, through the router.
 * @param {string} path
 */
function open(path) {
	const a = h('a', { href: path, hidden: true });
	document.body.append(a);
	a.click();
	a.remove();
}

/** Back to this page after signing in. */
function signIn() {
	open(`/account?return=${encodeURIComponent(location.pathname + location.search)}`);
}

/**
 * The "Is this helpful?" card: likes, dislikes and suggesting.
 * @param {'en' | 'my'} lang
 * @param {string} word  The headword as the dictionary spells it.
 */
export function feedbackCard(lang, word) {
	const likeCount = h('span', { class: 'aside-count' });
	const dislikeCount = h('span', { class: 'aside-count' });
	const like = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'aside-icon', 'aria-label': `Like “${word}”`, title: 'Like', 'aria-pressed': 'false' }, icon(ICONS.like, 20), likeCount));
	const dislike = /** @type {HTMLButtonElement} */ (
		h('button', { type: 'button', class: 'aside-icon', 'aria-label': `Dislike “${word}”`, title: 'Dislike', 'aria-pressed': 'false' }, icon(ICONS.dislike, 20), dislikeCount)
	);
	const suggest = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'aside-suggest' }, icon(ICONS.suggest, 18), 'Suggest a change'));
	const note = h('p', { class: 'aside-quiet' });

	/** @type {import('../data/api.js').Reactions | null} */
	let state = null;
	/** @param {import('../data/api.js').Reactions} r */
	const show = (r) => {
		state = r;
		likeCount.textContent = r.likes ? String(r.likes) : '';
		dislikeCount.textContent = r.dislikes ? String(r.dislikes) : '';
		like.setAttribute('aria-pressed', String(r.mine === 1));
		dislike.setAttribute('aria-pressed', String(r.mine === -1));
		note.textContent = r.signedIn ? '' : 'Sign in to like an entry or suggest a change.';
	};
	/** @param {1 | -1} value */
	const toggle = async (value) => {
		if (!state?.signedIn) return signIn();
		like.disabled = dislike.disabled = true;
		try {
			show(await react(lang, word, state.mine === value ? 0 : value));
		} catch (err) {
			note.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			like.disabled = dislike.disabled = false;
		}
	};
	like.addEventListener('click', () => toggle(1));
	dislike.addEventListener('click', () => toggle(-1));
	suggest.addEventListener('click', async () => {
		if (!(await member().catch(() => null))) return signIn();
		openSuggestions(lang, word);
	});
	reactions(lang, word).then(show, (err) => {
		note.textContent = `Likes are unavailable: ${err instanceof Error ? err.message : String(err)}`;
	});

	return h('section', { class: 'aside-card' }, h('h2', null, 'Is this helpful?'), h('div', { class: 'aside-actions' }, like, dislike, suggest), note);
}

/**
 * The suggestion panel for a headword.
 * @param {'en' | 'my'} lang
 * @param {string} word
 */
async function openSuggestions(lang, word) {
	const body = h('div', { class: 'suggest-body' }, h('p', { class: 'notice' }, 'Loading the meanings…'));
	const close = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-close', 'aria-label': 'Close' }, icon(ICONS.close, 20)));
	const dialog = /** @type {HTMLDialogElement} */ (
		h('dialog', { class: 'suggest', 'aria-label': `Suggest a change to “${word}”` }, h('header', { class: 'suggest-head' }, h('h2', null, `Suggest a change to “${word}”`), close), body)
	);
	close.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => dialog.remove());
	document.body.append(dialog);
	dialog.showModal();

	try {
		const data = await editableSenses(lang, word);
		body.replaceChildren(...panel(lang, word, data));
	} catch (err) {
		body.replaceChildren(h('p', { class: 'account-error', role: 'alert' }, err instanceof Error ? err.message : String(err)));
	}
}

/**
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @param {Awaited<ReturnType<typeof editableSenses>>} data
 */
function panel(lang, word, data) {
	const editor = data.role === 'editor' || data.role === 'admin';
	const glossLang = lang === 'en' ? 'my' : 'en';
	const spellings = new Set(data.senses.map((s) => s.word)).size > 1;
	const reason = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 600, placeholder: 'A source or a short reason helps the review' }));
	const mineList = h('ul', { class: 'suggest-mine' });

	/** @param {OwnEdit[]} mine */
	const showMine = (mine) => {
		mineList.replaceChildren(...mine.map((e) => h('li', null, h('span', { class: `suggest-status status-${e.status}` }, STATUS[e.status] ?? e.status), ' ', describe(e, data.senses), e.review_note ? h('span', { class: 'aside-quiet' }, ` (${e.review_note})`) : null)));
		mineList.previousElementSibling?.toggleAttribute('hidden', !mine.length);
	};
	const refresh = async () => showMine((await editableSenses(lang, word)).mine);

	/**
	 * Sends suggestions one after another; reports on `out`.
	 * @param {Array<Record<string, unknown>>} list
	 * @param {HTMLElement} out
	 * @param {HTMLButtonElement[]} buttons
	 */
	const send = async (list, out, buttons) => {
		for (const b of buttons) b.disabled = true;
		out.className = 'suggest-result';
		out.textContent = 'Sending…';
		try {
			let status = '';
			for (const item of list) status = (await suggestEdit({ lang, word, note: reason.value, ...item })).edit.status;
			out.textContent = status === 'approved' ? 'Approved. It reaches the dictionary with the next release.' : 'Sent. An editor will review it.';
			await refresh();
		} catch (err) {
			out.className = 'suggest-result suggest-failed';
			out.textContent = err instanceof Error ? err.message : String(err);
			for (const b of buttons) b.disabled = false;
		}
	};

	const rows = data.senses.map((s, i) => {
		const meaning = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: glossLang }, s.sense));
		const example = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: s.exam ?? '' }));
		const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, 'Send change'));
		const remove = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, 'Suggest removing'));
		const out = h('p', { class: 'suggest-result' });
		const changed = () => meaning.value.trim() !== s.sense || example.value.trim() !== (s.exam ?? '');
		for (const f of [meaning, example]) f.addEventListener('input', () => (save.disabled = !changed()));
		save.addEventListener('click', () => {
			/** @type {Array<Record<string, unknown>>} */
			const list = [];
			if (meaning.value.trim() !== s.sense) list.push({ action: 'edit', sense_id: s.id, field: 'sense', value: meaning.value });
			if (example.value.trim() !== (s.exam ?? '')) list.push({ action: 'edit', sense_id: s.id, field: 'exam', value: example.value });
			send(list, out, [save, remove]);
		});
		remove.addEventListener('click', () => send([{ action: 'delete', sense_id: s.id }], out, [save, remove]));
		return h(
			'section',
			{ class: 'suggest-sense' },
			h('p', { class: 'suggest-label' }, `${i + 1} · ${s.type.toLowerCase()}${spellings ? ` · ${s.word}` : ''}`),
			h('label', null, 'Meaning', meaning),
			h('label', null, 'Example', example),
			h('div', { class: 'suggest-buttons' }, save, remove),
			out,
		);
	});

	const type = /** @type {HTMLSelectElement} */ (h('select', null, data.types.map((t) => h('option', { value: String(t.id) }, t.name))));
	const nouns = data.types.find((t) => t.name === 'Noun');
	if (nouns) type.value = String(nouns.id);
	const newMeaning = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: glossLang }));
	const newExample = /** @type {HTMLInputElement} */ (h('input', { type: 'text' }));
	const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, 'Send new meaning'));
	const addOut = h('p', { class: 'suggest-result' });
	newMeaning.addEventListener('input', () => (add.disabled = !newMeaning.value.trim()));
	add.addEventListener('click', () => send([{ action: 'add', wrte: Number(type.value), sense: newMeaning.value, exam: newExample.value }], addOut, [add]));

	const mineHead = h('h3', { hidden: true }, 'Your suggestions for this word');
	showMine(data.mine);
	return [
		h(
			'p',
			{ class: 'aside-quiet suggest-intro' },
			editor
				? 'As an editor, your changes are approved at once and reach the dictionary with the next release.'
				: 'An editor reviews each suggestion before it reaches the dictionary. Text in <angle brackets> links to another word.',
		),
		h('label', { class: 'suggest-reason' }, 'Why (optional)', reason),
		...rows,
		h('section', { class: 'suggest-sense suggest-new' }, h('p', { class: 'suggest-label' }, 'A new meaning'), h('label', null, 'Part of speech', type), h('label', null, 'Meaning', newMeaning), h('label', null, 'Example', newExample), h('div', { class: 'suggest-buttons' }, add), addOut),
		mineHead,
		mineList,
	];
}

/**
 * One line about a suggestion, for the member's list.
 * @param {OwnEdit} e
 * @param {EditableSense[]} senses
 */
function describe(e, senses) {
	const n = senses.findIndex((s) => s.id === e.sense_id) + 1;
	const which = n ? `meaning ${n}` : 'a meaning';
	if (e.action === 'delete') return `Remove ${which}.`;
	if (e.action === 'add') {
		try {
			return `New meaning: ${JSON.parse(e.data ?? '{}').sense ?? ''}`;
		} catch {
			return 'New meaning.';
		}
	}
	return `${e.field === 'exam' ? 'Example' : 'Meaning'} of ${which}: ${e.new_value ?? '(none)'}`;
}
