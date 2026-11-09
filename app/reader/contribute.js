// @ts-check
/**
 * Members' part on an entry, at two levels:
 *
 *   each sense   thumbs up or down, and ✎ to suggest a change to that sense
 *                alone, in a small editor under its row
 *   the entry    thumbs up or down for the entry as a whole, and adding a
 *                meaning it is missing (the side card)
 *
 * One request (/api/reactions) brings the counts for both. Signed out, every
 * button leads to the account page and back. A member's suggestion waits for
 * an editor; an editor's own is approved and reaches the dictionary with
 * the next release.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { member } from '../core/member.js';
import { editableSenses, react, reactions, suggestEdit } from '../data/api.js';

/** @typedef {import('../data/api.js').OwnEdit} OwnEdit */
/** @typedef {{ likes: number, dislikes: number, mine: number }} Counts */
/** @typedef {{ id?: number, word?: string, sense: string, example: string | null }} RowSense */

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

/** To the account page, and back to this page after signing in. */
function signIn() {
	open(`/account?return=${encodeURIComponent(location.pathname + location.search)}`);
}

/** @param {unknown} err */
const message = (err) => (err instanceof Error ? err.message : String(err));

/**
 * A pair of thumbs with counts.
 * @param {string} what  For the labels: "this meaning", "“love”".
 * @param {(value: 1 | -1) => void} onPress
 * @param {string} size  "small" on a sense row.
 */
function thumbs(what, onPress, size) {
	const upCount = h('span', { class: 'thumb-count' });
	const downCount = h('span', { class: 'thumb-count' });
	const up = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: `thumb ${size}`, 'aria-label': `Helpful: ${what}`, title: 'Helpful', 'aria-pressed': 'false' }, icon(ICONS.thumbUp, size === 'small' ? 16 : 20), upCount));
	const down = /** @type {HTMLButtonElement} */ (
		h('button', { type: 'button', class: `thumb ${size}`, 'aria-label': `Not helpful: ${what}`, title: 'Not helpful', 'aria-pressed': 'false' }, icon(ICONS.thumbDown, size === 'small' ? 16 : 20), downCount)
	);
	up.addEventListener('click', () => onPress(1));
	down.addEventListener('click', () => onPress(-1));
	return {
		up,
		down,
		/** @param {Counts | undefined} c */
		show(c) {
			upCount.textContent = c?.likes ? String(c.likes) : '';
			downCount.textContent = c?.dislikes ? String(c.dislikes) : '';
			up.setAttribute('aria-pressed', String(c?.mine === 1));
			down.setAttribute('aria-pressed', String(c?.mine === -1));
		},
		/** @param {boolean} busy */
		busy(busy) {
			up.disabled = down.disabled = busy;
		},
	};
}

/**
 * Feedback for one entry: the side card and the actions on its sense rows,
 * sharing one request for the counts.
 * @param {'en' | 'my'} lang
 * @param {string} word  The headword as the dictionary spells it.
 */
export function entryFeedback(lang, word) {
	/** @type {import('../data/api.js').Reactions & { senses: Record<string, Counts> } | null} */
	let state = null;
	/** @type {Array<() => void>} */
	const views = [];
	const note = h('p', { class: 'aside-quiet' });
	const show = (/** @type {any} */ r) => {
		state = r;
		note.textContent = r.signedIn ? '' : 'Sign in to rate an entry or a meaning, or to suggest a change.';
		for (const v of views) v();
	};
	const loaded = reactions(lang, word).then(show, (err) => {
		note.textContent = `Ratings are unavailable: ${message(err)}`;
	});

	/**
	 * @param {{ sense_id?: number, word?: string }} target
	 * @param {1 | -1} value
	 * @param {{ busy(b: boolean): void }} control
	 */
	const press = async (target, value, control) => {
		await loaded;
		if (!state?.signedIn) return signIn();
		const current = target.sense_id === undefined ? state.mine : (state.senses[String(target.sense_id)]?.mine ?? 0);
		control.busy(true);
		try {
			const next = await react(lang, target.word ?? word, current === value ? 0 : value, target.sense_id);
			// A sense of another spelling or root answers for that word; keep this entry's counts.
			if ((target.word ?? word) === word) show(next);
			else if (target.sense_id !== undefined && state) show({ ...state, senses: { ...state.senses, [String(target.sense_id)]: next.senses[String(target.sense_id)] } });
		} catch (err) {
			note.textContent = message(err);
		} finally {
			control.busy(false);
		}
	};

	return {
		/** The side card: the entry as a whole. */
		card() {
			const t = thumbs(`“${word}”`, (v) => press({}, v, t), 'large');
			views.push(() => t.show(state ?? undefined));
			const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'aside-suggest' }, icon(ICONS.suggest, 18), 'Add a missing meaning'));
			add.addEventListener('click', async () => {
				if (!(await member().catch(() => null))) return signIn();
				openAddMeaning(lang, word);
			});
			return h(
				'section',
				{ class: 'aside-card' },
				h('h2', null, 'Is this entry helpful?'),
				h('div', { class: 'aside-actions' }, t.up, t.down, add),
				h('p', { class: 'aside-quiet' }, 'Rate a single meaning, or suggest a change to it, with the buttons beside it.'),
				note,
			);
		},

		/**
		 * Actions on each sense row of `root`.
		 * @param {HTMLElement} root
		 * @param {RowSense[]} senses  As rendered, with their ids.
		 * @param {string} glossLang  Language of the meanings ("my" for English entries).
		 */
		wire(root, senses, glossLang) {
			const byId = new Map(senses.filter((s) => s.id !== undefined).map((s) => [String(s.id), s]));
			for (const row of /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('li.sense[data-sense-id]'))) {
				const s = byId.get(/** @type {string} */ (row.dataset.senseId));
				if (!s) continue;
				const id = /** @type {number} */ (s.id);
				const t = thumbs('this meaning', (v) => press({ sense_id: id, word: s.word }, v, t), 'small');
				views.push(() => t.show(state?.senses[String(id)]));
				const edit = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'thumb small sense-edit', 'aria-label': 'Suggest a change to this meaning', title: 'Suggest a change', 'aria-expanded': 'false' }, icon(ICONS.suggest, 15)));
				edit.addEventListener('click', async () => {
					if (!(await member().catch(() => null))) return signIn();
					const shown = row.querySelector('.sense-editor');
					if (shown) {
						shown.remove();
						edit.setAttribute('aria-expanded', 'false');
						return;
					}
					edit.setAttribute('aria-expanded', 'true');
					const editor = senseEditor(lang, s.word ?? word, id, s, glossLang, () => {
						editor.remove();
						edit.setAttribute('aria-expanded', 'false');
						edit.focus();
					});
					row.querySelector('.gloss')?.after(editor);
					editor.querySelector('textarea')?.focus();
				});
				row.querySelector('.gloss')?.append(h('span', { class: 'sense-tools' }, t.up, t.down, edit));
			}
		},
	};
}

/**
 * The editor under one sense row: its meaning and example, nothing else.
 * @param {'en' | 'my'} lang
 * @param {string} word
 * @param {number} id
 * @param {RowSense} s
 * @param {string} glossLang
 * @param {() => void} close
 */
function senseEditor(lang, word, id, s, glossLang, close) {
	const meaning = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: glossLang }, s.sense));
	const example = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: s.example ?? '', lang: glossLang === 'my' ? 'en' : 'my' }));
	const reason = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 600, placeholder: 'A source or a short reason helps the review' }));
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, 'Send change'));
	const remove = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, 'Suggest removing'));
	const cancel = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, 'Cancel'));
	const out = h('p', { class: 'suggest-result', role: 'status' });
	const changed = () => meaning.value.trim() !== s.sense || example.value.trim() !== (s.example ?? '');
	for (const f of [meaning, example]) f.addEventListener('input', () => (save.disabled = !changed()));

	/** @param {Array<Record<string, unknown>>} list */
	const send = async (list) => {
		for (const b of [save, remove]) b.disabled = true;
		out.className = 'suggest-result';
		out.textContent = 'Sending…';
		try {
			let status = '';
			for (const item of list) status = (await suggestEdit({ lang, word, note: reason.value, sense_id: id, ...item })).edit.status;
			out.textContent = status === 'approved' ? 'Approved. It reaches the dictionary with the next release.' : 'Sent. An editor will review it.';
			cancel.textContent = 'Close';
		} catch (err) {
			out.className = 'suggest-result suggest-failed';
			out.textContent = message(err);
			save.disabled = !changed();
			remove.disabled = false;
		}
	};
	save.addEventListener('click', () => {
		/** @type {Array<Record<string, unknown>>} */
		const list = [];
		if (meaning.value.trim() !== s.sense) list.push({ action: 'edit', field: 'sense', value: meaning.value });
		if (example.value.trim() !== (s.example ?? '')) list.push({ action: 'edit', field: 'exam', value: example.value });
		send(list);
	});
	remove.addEventListener('click', () => send([{ action: 'delete' }]));
	cancel.addEventListener('click', close);
	const editor = h(
		'div',
		{ class: 'sense-editor' },
		h('label', null, 'Meaning', meaning),
		h('label', null, 'Example', example),
		h('label', null, 'Why (optional)', reason),
		h('div', { class: 'suggest-buttons' }, save, remove, cancel),
		out,
	);
	editor.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') close();
	});
	return editor;
}

/**
 * Adding a meaning the entry lacks, and the member's suggestions for it.
 * @param {'en' | 'my'} lang
 * @param {string} word
 */
async function openAddMeaning(lang, word) {
	const body = h('div', { class: 'suggest-body' }, h('p', { class: 'notice' }, 'Loading…'));
	const close = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-close', 'aria-label': 'Close' }, icon(ICONS.close, 20)));
	const dialog = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'suggest', 'aria-label': `Add a meaning to “${word}”` }, h('header', { class: 'suggest-head' }, h('h2', null, `Add a meaning to “${word}”`), close), body));
	close.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => dialog.remove());
	document.body.append(dialog);
	dialog.showModal();
	try {
		const data = await editableSenses(lang, word);
		const glossLang = lang === 'en' ? 'my' : 'en';
		const type = /** @type {HTMLSelectElement} */ (h('select', null, data.types.map((t) => h('option', { value: String(t.id) }, t.name))));
		const noun = data.types.find((t) => t.name === 'Noun');
		if (noun) type.value = String(noun.id);
		const meaning = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: glossLang }));
		const example = /** @type {HTMLInputElement} */ (h('input', { type: 'text' }));
		const reason = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 600, placeholder: 'A source or a short reason helps the review' }));
		const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, 'Send new meaning'));
		const out = h('p', { class: 'suggest-result', role: 'status' });
		const mine = h('ul', { class: 'suggest-mine' });
		const mineHead = h('h3', null, 'Your suggestions for this word');
		/** @param {OwnEdit[]} list */
		const showMine = (list) => {
			mine.replaceChildren(...list.map((e) => h('li', null, h('span', { class: `suggest-status status-${e.status}` }, STATUS[e.status] ?? e.status), ' ', describe(e, data.senses))));
			mineHead.hidden = !list.length;
		};
		showMine(data.mine);
		meaning.addEventListener('input', () => (add.disabled = !meaning.value.trim()));
		add.addEventListener('click', async () => {
			add.disabled = true;
			out.className = 'suggest-result';
			out.textContent = 'Sending…';
			try {
				const { edit } = await suggestEdit({ lang, word, action: 'add', wrte: Number(type.value), sense: meaning.value, exam: example.value, note: reason.value });
				out.textContent = edit.status === 'approved' ? 'Approved. It reaches the dictionary with the next release.' : 'Sent. An editor will review it.';
				meaning.value = example.value = reason.value = '';
				showMine((await editableSenses(lang, word)).mine);
			} catch (err) {
				out.className = 'suggest-result suggest-failed';
				out.textContent = message(err);
				add.disabled = false;
			}
		});
		body.replaceChildren(
			h('p', { class: 'aside-quiet suggest-intro' }, data.role === 'editor' || data.role === 'admin' ? 'As an editor, your addition is approved at once and reaches the dictionary with the next release.' : 'An editor reviews each suggestion before it reaches the dictionary. To change an existing meaning, use ✎ beside it.'),
			h('label', null, 'Part of speech', type),
			h('label', null, 'Meaning', meaning),
			h('label', null, 'Example', example),
			h('label', null, 'Why (optional)', reason),
			h('div', { class: 'suggest-buttons' }, add),
			out,
			mineHead,
			mine,
		);
	} catch (err) {
		body.replaceChildren(h('p', { class: 'account-error', role: 'alert' }, message(err)));
	}
}

/**
 * One line about a suggestion, for the member's list.
 * @param {OwnEdit} e
 * @param {Array<{ id: number }>} senses
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
