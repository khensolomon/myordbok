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
 * button leads to signing in (in the workspace) and back. A member's suggestion waits for
 * an editor; an editor's own is approved and reaches the dictionary with
 * the next release.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { atLeast } from '#shared/roles.js';
import { EDIT_TEXT_MAX } from '#shared/limits.js';
import { itemsToLines, linesToItems } from '#shared/markup.js';
import { mark, num, posName, t } from '../i18n/index.js';
import { member } from '../core/member.js';
import { editableSenses, react, reactions, suggestEdit } from '../data/api.js';
import { noZawgyi } from '../core/zawgyi.js';

/** @typedef {import('../data/api.js').OwnEdit} OwnEdit */
/** @typedef {{ likes: number, dislikes: number, mine: number }} Counts */
/** @typedef {{ id?: number, word?: string, sense: string, example: string | null }} RowSense */

/** @type {Record<string, string>} */
const STATUS = {
	pending: mark('waiting for review'),
	approved: mark('approved, in the next release'),
	exported: mark('approved, in the next release'),
	rejected: mark('not accepted'),
	conflict: mark('the entry changed first; please look again'),
};

/**
 * What a sent change says back.
 * @param {string} status
 * @param {boolean} live
 */
function sentMessage(status, live) {
	if (live) return t('Live. Readers see it within a few minutes.');
	return status === 'approved' ? t('Approved. It reaches the dictionary with the next release.') : t('Sent. An editor will review it.');
}

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

/** To signing in, and back to this page afterwards. */
function signIn() {
	open(`/you?return=${encodeURIComponent(location.pathname + location.search)}`);
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
	const up = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: `thumb ${size}`, 'aria-label': t('Helpful: {what}', { what }), title: t('Helpful'), 'aria-pressed': 'false' }, icon(ICONS.thumbUp, size === 'small' ? 16 : 20), upCount));
	const down = /** @type {HTMLButtonElement} */ (
		h('button', { type: 'button', class: `thumb ${size}`, 'aria-label': t('Not helpful: {what}', { what }), title: t('Not helpful'), 'aria-pressed': 'false' }, icon(ICONS.thumbDown, size === 'small' ? 16 : 20), downCount)
	);
	up.addEventListener('click', () => onPress(1));
	down.addEventListener('click', () => onPress(-1));
	return {
		up,
		down,
		/** @param {Counts | undefined} c */
		show(c) {
			upCount.textContent = c?.likes ? num(c.likes) : '';
			downCount.textContent = c?.dislikes ? num(c.dislikes) : '';
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
		note.textContent = r.signedIn ? '' : t('Sign in to rate an entry or a meaning, or to suggest a change.');
		for (const v of views) v();
	};
	const loaded = reactions(lang, word).then(show, (err) => {
		note.textContent = t('Ratings are unavailable: {reason}', { reason: message(err) });
	});

	/**
	 * @param {{ sense_id?: number, word?: string }} target
	 * @param {1 | -1} value
	 * @param {{ busy(b: boolean): void }} control
	 */
	const press = async (target, value, control) => {
		await loaded;
		// Ratings that did not load say so (in the card); only a known signed-out reader is sent to sign in.
		if (!state) {
			note.textContent = t('Ratings could not be loaded, so nothing was changed. Reload the page to try again.');
			return;
		}
		if (!state.signedIn) return signIn();
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
		/**
		 * One thumb for the entry as a whole, for the bar over a definition
		 * under 1024px: pressed, the entry is in Liked (/liked).
		 */
		like() {
			const pair = thumbs(`“${word}”`, (v) => press({}, v, pair), 'bar');
			views.push(() => pair.show(state ?? undefined));
			pair.up.classList.add('entry-like');
			return pair.up;
		},

		/** The side card: the entry as a whole. */
		card() {
			const pair = thumbs(`“${word}”`, (v) => press({}, v, pair), 'large');
			views.push(() => pair.show(state ?? undefined));
			const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'aside-suggest' }, icon(ICONS.suggest, 18), t('Add a missing meaning')));
			add.addEventListener('click', async () => {
				if (!(await member().catch(() => null))) return signIn();
				openAddMeaning(lang, word);
			});
			return h(
				'section',
				{ class: 'aside-card' },
				h('h2', null, t('Is this entry helpful?')),
				h('div', { class: 'aside-actions' }, pair.up, pair.down, add),
				h('p', { class: 'aside-quiet' }, t('Rate a single meaning, or suggest a change to it, with the buttons beside it.')),
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
				const pair = thumbs(t('this meaning'), (v) => press({ sense_id: id, word: s.word }, v, pair), 'small');
				views.push(() => pair.show(state?.senses[String(id)]));
				const edit = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'thumb small sense-edit', 'aria-label': t('Suggest a change to this meaning'), title: t('Suggest a change'), 'aria-expanded': 'false' }, icon(ICONS.suggest, 15)));
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
					// Under the meaning as shown: its glosses, notes and the sense in English.
					[...row.querySelectorAll(':scope > .gloss, :scope > .sense-notes, :scope > .sense-explained')].pop()?.after(editor);
					editor.querySelector('textarea')?.focus();
				});
				// Beside the last gloss, on its line.
				(row.querySelector('.gloss > .gloss-line:last-child') ?? row.querySelector('.gloss'))?.append(h('span', { class: 'sense-tools' }, pair.up, pair.down, edit));
			}
		},
	};
}

/**
 * A field to edit one item a line: a meaning's glosses and notes, or its
 * examples, as the dataset's " | " parts them.
 * @param {string | null} value  As the dataset keeps it.
 * @param {string} textLang
 */
function lines(value, textLang) {
	const text = itemsToLines(value);
	return /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: Math.max(2, Math.min(6, text.split('\n').length)), lang: textLang, dir: 'auto', placeholder: t('One item a line') }, text));
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
	// One item a line (a gloss, a note, an example), joined with " | " when sent.
	const meaning = lines(s.sense, glossLang);
	const example = lines(s.example, glossLang === 'my' ? 'en' : 'my');
	const reason = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: EDIT_TEXT_MAX, placeholder: t('A source or a short reason helps the review') }));
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, t('Send change')));
	const remove = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, t('Suggest removing')));
	const cancel = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-remove' }, t('Cancel')));
	const out = h('p', { class: 'suggest-result', role: 'status' });
	const changed = () => linesToItems(meaning.value) !== s.sense || linesToItems(example.value) !== (s.example ?? '');
	for (const f of [meaning, example]) f.addEventListener('input', () => (save.disabled = !changed()));

	/** @param {Array<Record<string, unknown>>} list */
	const send = async (list) => {
		out.className = 'suggest-result';
		if (!(await noZawgyi([meaning, example, reason], out))) return;
		for (const b of [save, remove]) b.disabled = true;
		out.textContent = t('Sending…');
		try {
			let status = '';
			let live = false;
			for (const item of list) ({ status, live } = (await suggestEdit({ lang, word, note: reason.value, sense_id: id, ...item })).edit);
			out.textContent = sentMessage(status, live);
			cancel.textContent = t('Close');
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
		if (linesToItems(meaning.value) !== s.sense) list.push({ action: 'edit', field: 'sense', value: linesToItems(meaning.value) });
		if (linesToItems(example.value) !== (s.example ?? '')) list.push({ action: 'edit', field: 'exam', value: linesToItems(example.value) });
		send(list);
	});
	remove.addEventListener('click', () => send([{ action: 'delete' }]));
	cancel.addEventListener('click', close);
	const editor = h(
		'div',
		{ class: 'sense-editor' },
		h('label', null, t('Meaning'), meaning),
		h('label', null, t('Example'), example),
		h('label', null, t('Why (optional)'), reason),
		h('div', { class: 'suggest-buttons' }, save, remove, cancel),
		out,
	);
	editor.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') close();
	});
	return editor;
}

/**
 * Suggesting a word the dictionary lacks, with its first meaning: the same
 * form as adding a meaning. Signed out, it leads to signing in.
 * @param {string} word  An English word; a Myanmar headword needs its pronunciation and goes through the contact form.
 */
export async function suggestWord(word) {
	if (!(await member().catch(() => null))) return signIn();
	return openAddMeaning('en', word);
}

/**
 * Adding a meaning the entry lacks, and the member's suggestions for it.
 * @param {'en' | 'my'} lang
 * @param {string} word
 */
async function openAddMeaning(lang, word) {
	const body = h('div', { class: 'suggest-body' }, h('p', { class: 'notice' }, t('Loading…')));
	const close = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-close', 'aria-label': t('Close') }, icon(ICONS.close, 20)));
	const dialog = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'suggest', 'aria-label': t('Add a meaning to “{word}”', { word }) }, h('header', { class: 'suggest-head' }, h('h2', null, t('Add a meaning to “{word}”', { word })), close), body));
	close.addEventListener('click', () => dialog.close());
	dialog.addEventListener('close', () => dialog.remove());
	document.body.append(dialog);
	dialog.showModal();
	try {
		const data = await editableSenses(lang, word);
		const glossLang = lang === 'en' ? 'my' : 'en';
		const type = /** @type {HTMLSelectElement} */ (h('select', null, data.types.map((ty) => h('option', { value: String(ty.id) }, posName(ty.name)))));
		const noun = data.types.find((ty) => ty.name === 'Noun');
		if (noun) type.value = String(noun.id);
		const meaning = lines('', glossLang);
		const example = lines('', lang);
		const reason = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: EDIT_TEXT_MAX, placeholder: t('A source or a short reason helps the review') }));
		const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'suggest-send', disabled: true }, t('Send new meaning')));
		const out = h('p', { class: 'suggest-result', role: 'status' });
		const mine = h('ul', { class: 'suggest-mine' });
		const mineHead = h('h3', null, t('Your suggestions for this word'));
		/** @param {OwnEdit[]} list */
		const showMine = (list) => {
			mine.replaceChildren(...list.map((e) => h('li', null, h('span', { class: `suggest-status status-${e.status}` }, e.live && (e.status === 'approved' || e.status === 'exported') ? t('live now') : STATUS[e.status] ? t(STATUS[e.status]) : e.status), ' ', describe(e, data))));
			mineHead.hidden = !list.length;
		};
		showMine(data.mine);
		meaning.addEventListener('input', () => (add.disabled = !meaning.value.trim()));
		add.addEventListener('click', async () => {
			out.className = 'suggest-result';
			if (!(await noZawgyi([meaning, example, reason], out))) return;
			add.disabled = true;
			out.textContent = t('Sending…');
			try {
				const { edit } = await suggestEdit({ lang, word, action: 'add', wrte: Number(type.value), sense: linesToItems(meaning.value), exam: linesToItems(example.value), note: reason.value });
				out.textContent = sentMessage(edit.status, edit.live);
				meaning.value = example.value = reason.value = '';
				showMine((await editableSenses(lang, word)).mine);
			} catch (err) {
				out.className = 'suggest-result suggest-failed';
				out.textContent = message(err);
				add.disabled = false;
			}
		});
		body.replaceChildren(
			h('p', { class: 'aside-quiet suggest-intro' }, atLeast(data.role, 'admin') ? t('As an admin, your addition is live at once: readers see it within a few minutes.') : atLeast(data.role, 'editor') ? t('As an editor, your addition is approved at once and reaches the dictionary with the next release.') : t('An editor reviews each suggestion before it reaches the dictionary. To change an existing meaning, use ✎ beside it.')),
			h('label', null, t('Part of speech'), type),
			h('label', null, t('Meaning'), meaning),
			h('label', null, t('Example'), example),
			h('label', null, t('Why (optional)'), reason),
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
 * @param {{ senses: Array<{ id: number }>, types: Array<{ id: number, name: string }>, kinds: Array<{ id: number, name: string }> }} data
 */
function describe(e, data) {
	const n = data.senses.findIndex((s) => s.id === e.sense_id) + 1;
	const which = n ? t('meaning {n}', { n }) : t('a meaning');
	if (e.action === 'delete') return t('Remove {which}.', { which });
	if (e.action === 'add') {
		try {
			return t('New meaning: {text}', { text: JSON.parse(e.data ?? '{}').sense ?? '' });
		} catch {
			return t('New meaning.');
		}
	}
	// Part of speech and status travel as ids.
	const named = (/** @type {Array<{ id: number, name: string }>} */ list) => list.find((x) => String(x.id) === e.new_value)?.name ?? e.new_value ?? '';
	if (e.field === 'wrte') return t('Part of speech of {which}: {value}', { which, value: posName(named(data.types)) });
	if (e.field === 'wrkd') return t('Status of {which}: {value}', { which, value: named(data.kinds) });
	const value = e.new_value ?? t('(none)');
	return e.field === 'exam' ? t('Example of {which}: {value}', { which, value }) : t('Meaning of {which}: {value}', { which, value });
}
