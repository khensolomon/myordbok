// @ts-check
/**
 * Studio (?s=studio&word=…), for editors: one headword with every meaning
 * open to change at once. Each meaning shows its part of speech, its status
 * or label, its text and its example; any of them can be changed, the
 * meaning removed, and a new meaning added below. Save sends each change as
 * an edit (worker/routes/contribute.js), the same edits the ✎ form makes:
 * an admin's or owner's are live within minutes, an editor's wait for the
 * next data release, and every one reaches the dataset through that release.
 *
 * The sheet shows the entry as readers see it now: the build with the live
 * edits over it. Under it, the word's history: every edit made to it, by
 * whom, and where it stands.
 *
 * Without a word, the studio lists the words edited most recently.
 */
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';
import { noZawgyi } from '../core/zawgyi.js';
import { editableSenses, suggestEdit, workspaceEdits } from '../data/api.js';
import { ago, mark, num, posName, t, tn } from '../i18n/index.js';
import { atLeast } from '#shared/roles.js';

/** @typedef {import('../data/api.js').EditableSense & { wrkd: number | null, kind: string | null }} Sense */
/** @typedef {import('../data/api.js').WorkspaceEdit} Edit */
/** @typedef {{ id: number, name: string }} Named */

const STATUS = /** @type {Record<string, string>} */ ({
	pending: mark('waiting for review'),
	approved: mark('approved, in the next release'),
	exported: mark('approved, in the next release'),
	merged: mark('in the dictionary'),
	rejected: mark('declined'),
	withdrawn: mark('withdrawn'),
	conflict: mark('conflict'),
});

/** @param {string} word */
const languageOf = (word) => (/[က-႟]/.test(word) ? 'my' : 'en');
/** @param {string} word */
const studioHref = (word) => `/workspace?s=studio&word=${encodeURIComponent(word)}`;

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {string} role
 */
export async function studioPane(ctx, role) {
	const word = (ctx.query.get('word') ?? '').normalize('NFC').trim();
	const main = h('main', { class: 'ws-main ws-overview ws-studio', 'aria-label': t('Studio') });
	const input = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'ws-studio-word', name: 'word', value: word, placeholder: t('A word, English or Myanmar'), 'aria-label': t('Word to edit'), autocomplete: 'off', spellcheck: 'false' }));
	const find = h('form', { class: 'ws-studio-find', role: 'search' }, input, h('button', { type: 'submit', class: 'ws-primary' }, t('Open')));
	find.addEventListener('submit', (e) => {
		e.preventDefault();
		const next = input.value.normalize('NFC').trim();
		if (next) ctx.go(studioHref(next));
	});
	const body = h('div', { class: 'ws-studio-body' });
	main.append(h('div', { class: 'ws-work' }, h('header', { class: 'ws-ov-head ws-studio-head' }, h('h1', null, t('Studio')), find), body));

	if (!word) {
		body.append(h('p', { class: 'ws-quiet' }, t('Open a word to change its meanings, examples, parts of speech and statuses, to add a meaning or to remove one.')), await recent());
		queueMicrotask(() => input.focus());
		return main;
	}
	try {
		await sheet(body, word, role, ctx);
	} catch (err) {
		body.replaceChildren(h('p', { class: 'account-error', role: 'alert' }, err instanceof Error ? err.message : String(err)));
	}
	return main;
}

/** The words edited most recently, as a way in. */
async function recent() {
	const { edits } = await workspaceEdits({ status: 'all' });
	const words = [...new Map(edits.map((e) => [`${e.dict}:${e.word.toLowerCase()}`, e])).values()].slice(0, 16);
	if (!words.length) return h('p', { class: 'ws-quiet' }, t('No word has been edited yet.'));
	return h(
		'section',
		{ class: 'ws-card ws-studio-recent' },
		h('h2', null, t('Edited recently')),
		h('ul', null, words.map((e) => h('li', null, h('a', { href: studioHref(e.word), lang: e.dict === 'emd' ? 'en' : 'my' }, e.word), h('span', null, ago(e.created_at))))),
	);
}

/**
 * The word's sheet, its save bar and its history.
 * @param {HTMLElement} body
 * @param {string} word
 * @param {string} role
 * @param {import('../core/routes.js').ViewContext} ctx
 */
async function sheet(body, word, role, ctx) {
	const lang = languageOf(word);
	const meaningLang = lang === 'en' ? 'my' : 'en';
	const [data, past] = await Promise.all([editableSenses(lang, word, true), workspaceEdits({ status: 'all', word, lang })]);
	const senses = /** @type {Sense[]} */ (data.senses);
	const admin = atLeast(role, 'admin');

	/** @param {Named[]} list @param {number | null} now @param {(name: string) => string} label */
	const select = (list, now, label) => {
		const s = /** @type {HTMLSelectElement} */ (h('select', null, list.map((x) => h('option', { value: String(x.id) }, label(x.name)))));
		// A value the list lacks (a NULL status) stays as it is until one is chosen.
		if (now === null || !list.some((x) => x.id === now)) s.prepend(h('option', { value: '' }, t('(none)')));
		s.value = now === null ? '' : String(now);
		return s;
	};
	/** @param {string} value @param {string} textLang @param {string} label */
	const area = (value, textLang, label) => /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: textLang, dir: 'auto', maxlength: 600, 'aria-label': label, spellcheck: 'false' }, value));

	/**
	 * @typedef {object} Row
	 * @property {Sense} sense
	 * @property {HTMLElement} node
	 * @property {HTMLSelectElement} type
	 * @property {HTMLSelectElement} kind
	 * @property {HTMLTextAreaElement} text
	 * @property {HTMLTextAreaElement} exam
	 * @property {HTMLInputElement} remove
	 */
	/** @type {Row[]} */
	const rows = senses.map((s, i) => {
		const type = select(data.types, s.wrte, posName);
		const kind = select(data.kinds, s.wrkd, (name) => name);
		const text = area(s.sense ?? '', meaningLang, t('Meaning'));
		const exam = area(s.exam ?? '', lang, t('Example'));
		const remove = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
		// Changes not in the sheet yet: waiting for review, or approved and waiting for the release.
		const waits = past.edits.filter((e) => e.sense_id === s.id && (e.status === 'pending' || ((e.status === 'approved' || e.status === 'exported') && !e.live)));
		const node = h(
			'li',
			{ class: 'ws-studio-sense' },
			h('span', { class: 'ws-studio-n' }, num(i + 1)),
			h('div', { class: 'ws-studio-fields' }, h('div', { class: 'ws-studio-classes' }, h('label', null, h('span', null, t('Part of speech')), type), h('label', null, h('span', null, t('Status')), kind), h('label', { class: 'ws-studio-remove' }, remove, t('Remove'))), h('label', null, h('span', null, t('Meaning')), text), h('label', null, h('span', null, t('Example')), exam), waits.length ? h('ul', { class: 'ws-studio-waits' }, waits.map((e) => h('li', null, `${t(STATUS[e.status] ?? e.status)}: ${what(e)}`))) : null),
		);
		return { sense: s, node, type, kind, text, exam, remove };
	});

	// A new meaning, and, for a word the dictionary lacks, the word itself.
	const newType = select(data.types, data.types[0]?.id ?? null, posName);
	const newText = area('', meaningLang, t('Meaning'));
	const newExam = area('', lang, t('Example'));
	// A new Myanmar headword needs its pronunciation, which only the dataset takes.
	const canAdd = senses.length > 0 || lang === 'en';
	// Added meanings have no place in the dictionary until a release, so the
	// sheet cannot hold them; they are listed, with where each stands.
	const added = past.edits.filter((e) => e.action === 'add' && (e.status === 'pending' || e.status === 'approved' || e.status === 'exported'));
	const adder = canAdd
		? h(
				'section',
				{ class: 'ws-card ws-studio-add' },
				h('h2', null, senses.length ? t('Add a meaning') : t('Add “{word}” with its first meaning', { word })),
				added.length ? h('ul', { class: 'ws-studio-waits ws-studio-added' }, added.map((e) => h('li', null, `${e.live && e.status !== 'pending' ? t('live now') : t(STATUS[e.status] ?? e.status)}: `, h('span', { lang: meaningLang }, e.data?.sense ?? '')))) : null,
				h('div', { class: 'ws-studio-fields' }, h('div', { class: 'ws-studio-classes' }, h('label', null, h('span', null, t('Part of speech')), newType)), h('label', null, h('span', null, t('Meaning')), newText), h('label', null, h('span', null, t('Example')), newExam)),
				h('p', { class: 'ws-quiet' }, t('A new meaning starts as a draft; its status can be changed after the release that gives it a place in the dictionary.')),
			)
		: h('p', { class: 'ws-quiet' }, t('A new Myanmar headword needs its pronunciation, so it is added in the dataset, not here.'));

	/**
	 * What differs from the entry as loaded, as edits to send.
	 * @returns {Array<{ label: string, body: Record<string, unknown>, fields: HTMLElement[] }>}
	 */
	const changes = () => {
		/** @type {Array<{ label: string, body: Record<string, unknown>, fields: HTMLElement[] }>} */
		const out = [];
		rows.forEach((r, i) => {
			const which = t('meaning {n}', { n: i + 1 });
			const base = { lang, word: r.sense.word, sense_id: r.sense.id };
			if (r.remove.checked) {
				out.push({ label: `${t('Remove')} ${which}`, body: { ...base, action: 'delete' }, fields: [] });
				return;
			}
			const text = r.text.value.trim();
			const exam = r.exam.value.trim();
			if (text !== (r.sense.sense ?? '')) out.push({ label: t('Meaning of {which}', { which }), body: { ...base, action: 'edit', field: 'sense', value: text }, fields: [r.text] });
			if (exam !== (r.sense.exam ?? '')) out.push({ label: t('Example of {which}', { which }), body: { ...base, action: 'edit', field: 'exam', value: exam }, fields: [r.exam] });
			if (r.type.value !== String(r.sense.wrte)) out.push({ label: t('Part of speech of {which}', { which }), body: { ...base, action: 'edit', field: 'wrte', value: Number(r.type.value) }, fields: [] });
			if (r.kind.value !== '' && r.kind.value !== String(r.sense.wrkd ?? '')) out.push({ label: t('Status of {which}', { which }), body: { ...base, action: 'edit', field: 'wrkd', value: Number(r.kind.value) }, fields: [] });
		});
		if (canAdd && newText.value.trim()) out.push({ label: t('New meaning'), body: { lang, word, action: 'add', wrte: Number(newType.value), sense: newText.value.trim(), exam: newExam.value.trim() }, fields: [newText, newExam] });
		return out;
	};

	const note = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 300, placeholder: t('A source or a short reason (optional)'), 'aria-label': t('Reason') }));
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary', disabled: true }, t('Save')));
	const discard = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-secondary', disabled: true }, t('Discard')));
	const out = h('ul', { class: 'ws-studio-result', role: 'status' });
	const refresh = () => {
		const n = changes().length;
		save.disabled = discard.disabled = n === 0;
		save.textContent = n ? tn('Save {n} change', 'Save {n} changes', n) : t('Save');
		for (const r of rows) {
			const s = r.sense;
			r.node.classList.toggle('is-removed', r.remove.checked);
			r.node.classList.toggle('is-changed', !r.remove.checked && (r.text.value.trim() !== (s.sense ?? '') || r.exam.value.trim() !== (s.exam ?? '') || r.type.value !== String(s.wrte) || (r.kind.value !== '' && r.kind.value !== String(s.wrkd ?? ''))));
			for (const f of [r.type, r.kind, r.text, r.exam]) f.disabled = r.remove.checked;
		}
	};
	const list = h('ol', { class: 'ws-studio-senses' }, rows.map((r) => r.node));
	const form = h('div', { class: 'ws-studio-sheet' }, list, adder);
	form.addEventListener('input', refresh);
	form.addEventListener('change', refresh);
	discard.addEventListener('click', () => ctx.replace(studioHref(word)));

	save.addEventListener('click', async () => {
		const todo = changes();
		out.replaceChildren();
		if (!(await noZawgyi(/** @type {Array<HTMLInputElement | HTMLTextAreaElement>} */ ([...todo.flatMap((c) => c.fields), note]), out))) return;
		save.disabled = discard.disabled = true;
		let failed = 0;
		// One after another: each is checked against the entry as the one before left it.
		for (const c of todo) {
			try {
				const { edit } = await suggestEdit({ ...c.body, note: note.value });
				out.append(h('li', { class: 'is-done' }, `${c.label}: ${edit.live ? t('live now') : t(STATUS[edit.status] ?? edit.status)}`));
			} catch (err) {
				failed++;
				out.append(h('li', { class: 'is-failed' }, `${c.label}: ${err instanceof Error ? err.message : String(err)}`));
			}
		}
		// What was kept shows in the reloaded sheet; what failed stays listed above it.
		const kept = out.cloneNode(true);
		body.replaceChildren();
		await sheet(body, word, role, ctx);
		if (failed || todo.length) body.querySelector('.ws-studio-save')?.append(kept);
	});

	const count = senses.length ? tn('{n} meaning', '{n} meanings', senses.length) : t('not in the dictionary yet');
	body.replaceChildren(
		h('header', { class: 'ws-studio-title' }, h('h2', { lang }, word), h('span', null, count), h('a', { href: definitionHref(word), class: 'ws-out' }, t('Open on the site ↗'))),
		h('p', { class: 'ws-quiet' }, admin ? t('The entry as readers see it now. Changes saved here are live within a few minutes, and reach the dictionary with the next release.') : t('The entry as readers see it now. Changes saved here are approved, and reach readers with the next release; an admin can make them live sooner.')),
		form,
		h('div', { class: 'ws-studio-save' }, h('div', { class: 'ws-studio-save-row' }, note, discard, save), out),
		history(past.edits),
	);
}

/**
 * One edit in a line: what it changes, from what to what.
 * @param {Edit} e
 */
function what(e) {
	if (e.action === 'add') return `${t('New meaning')}: ${e.data?.sense ?? ''}`;
	if (e.action === 'delete') return t('Remove a meaning');
	if (e.field === 'wrte') return `${t('Part of speech')}: ${posName(e.old_name ?? '')} → ${posName(e.new_name ?? '')}`;
	if (e.field === 'wrkd') return `${t('Status')}: ${e.old_name ?? t('(none)')} → ${e.new_name ?? ''}`;
	return `${e.field === 'exam' ? t('Example') : t('Meaning')}: ${e.old_value ?? t('(none)')} → ${e.new_value ?? t('(none)')}`;
}

/**
 * Every edit made to the word, newest first.
 * @param {Edit[]} edits
 */
function history(edits) {
	if (!edits.length) return h('section', { class: 'ws-card ws-studio-history' }, h('h2', null, t('History')), h('p', { class: 'ws-quiet' }, t('No edit has been made to this word.')));
	return h(
		'section',
		{ class: 'ws-card ws-studio-history' },
		h('h2', null, t('History')),
		h(
			'ul',
			null,
			edits.map((e) => {
				const live = e.live && (e.status === 'approved' || e.status === 'exported');
				return h('li', null, h('span', { class: `suggest-status status-${e.status}` }, live ? t('live now') : t(STATUS[e.status] ?? e.status)), h('span', { class: 'ws-studio-what', dir: 'auto' }, what(e)), h('span', { class: 'ws-studio-who' }, `${e.own ? t('you') : e.author} · ${ago(e.created_at)}`));
			}),
		),
	);
}
