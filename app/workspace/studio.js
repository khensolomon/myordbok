// @ts-check
/**
 * Studio (?s=studio&word=…), for editors: one headword with every meaning
 * open to change at once, laid out like Suggestions and Comments.
 *
 *   list       the words that have edits, newest first: all of them, those
 *              with edits no release holds yet, or those with live edits.
 *              Searching narrows the list and adds the dictionary's own
 *              words that start with the text, so any word can be opened;
 *              Enter opens the text as typed, a new word too.
 *   work area  the sheet: each meaning with its part of speech, its status
 *              or label, its text and its example; any can be changed, the
 *              meaning removed, and a new meaning added below. Save sends
 *              each change as an edit (worker/routes/contribute.js), the
 *              same edits the ✎ form makes: an admin's or owner's are live
 *              within minutes, an editor's wait for the next data release,
 *              and every one reaches the dataset through that release.
 *   details    the word in figures, and its history: every edit made to
 *              it, by whom, and where it stands.
 *
 * The sheet shows the entry as readers see it now: the build with the live
 * edits over it.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { definitionHref } from '../core/routes.js';
import { noZawgyi } from '../core/zawgyi.js';
import { editableSenses, studioWords, suggest, suggestEdit, workspaceEdits } from '../data/api.js';
import { ago, mark, num, posName, t, tn } from '../i18n/index.js';
import { atLeast } from '#shared/roles.js';
import { EDIT_TEXT_MAX } from '#shared/limits.js';
import { listBar } from './list-bar.js';

/** @typedef {import('../data/api.js').EditableSense & { wrkd: number | null, kind: string | null }} Sense */
/** @typedef {import('../data/api.js').WorkspaceEdit} Edit */
/** @typedef {import('../data/api.js').StudioWord} Word */
/** A row of the list: a word that has edits, or, while searching, a word of the dictionary that has none. @typedef {Partial<Word> & { lang: 'en' | 'my', word: string, edits: number }} Listed */
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

const SHOWS = /** @type {const} */ ([
	['edited', mark('Edited')],
	['waiting', mark('Not released')],
	['live', mark('Live')],
]);

/** @param {string} word */
const languageOf = (word) => (/[က-႟]/.test(word) ? 'my' : 'en');
/** @param {string} a @param {string} b */
const sameWord = (a, b) => (languageOf(a) === 'en' ? a.toLowerCase() === b.toLowerCase() : a === b);

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {HTMLElement} root  The workspace: data-open shows the work area on a phone.
 * @param {string} role
 */
export async function studioPanes(ctx, root, role) {
	const asked = ctx.query.get('show') ?? 'edited';
	const f = { show: SHOWS.some(([s]) => s === asked) ? asked : 'edited', q: (ctx.query.get('q') ?? '').normalize('NFC').trim() };
	const listPane = h('section', { class: 'ws-list', 'aria-label': t('Studio') });
	const work = h('main', { class: 'ws-main ws-studio', 'aria-label': t('Work area') }, h('p', { class: 'ws-empty' }, t('Choose a word from the list, or search for any word to open it.')));
	const inspector = h('aside', { class: 'ws-inspector', 'aria-label': t('Details') });
	const search = /** @type {HTMLInputElement} */ (h('input', { type: 'search', placeholder: t('Find or open a word'), 'aria-label': t('Find or open a word'), value: f.q, autocomplete: 'off', spellcheck: 'false' }));
	const ol = h('ol', { class: 'ws-rows' });
	const head = h('span');
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-more', hidden: true }, t('Show more')));
	/** Edited words, then, while searching, the dictionary's words that start with the text. */
	/** @type {Listed[]} */
	let items = [];
	/** @type {HTMLButtonElement[]} */
	let rows = [];
	let edited = 0;
	let current = '';

	/** The address of the list as filtered, with the word in hand. */
	const address = (/** @type {string} */ word = current) => {
		const p = new URLSearchParams({ s: 'studio' });
		if (f.show !== 'edited') p.set('show', f.show);
		if (f.q) p.set('q', f.q);
		if (word) p.set('word', word);
		return `/workspace?${p}`;
	};
	const markCurrent = () => rows.forEach((r, n) => r.setAttribute('aria-current', String(Boolean(current) && sameWord(items[n].word, current))));

	/** @param {boolean} [again] */
	const load = async (again = false) => {
		const page = await studioWords(f, again ? edited : 0);
		if (!again) {
			items = [];
			edited = 0;
		} else {
			items = items.slice(0, edited);
		}
		items.push(...page.words);
		edited = items.length;
		// Searching: any word of the dictionary can be opened, edited before or not.
		if (f.q && !page.more) {
			const found = await suggest(f.q).catch(() => null);
			const lang = languageOf(f.q);
			for (const word of found?.words ?? []) if (!items.some((w) => sameWord(w.word, word))) items.push({ lang, word, edits: 0 });
		}
		rows = items.map((w) => row(w, () => open(w.word)));
		ol.replaceChildren(...rows.map((b) => h('li', null, b)));
		if (!items.length) ol.replaceChildren(h('li', { class: 'ws-none' }, f.q ? t('No word starts with “{q}”. Press Enter to open it as a new word.', { q: f.q }) : f.show === 'edited' ? t('No word has been edited yet. Search for a word to open it.') : t('Nothing here.')));
		more.hidden = !page.more;
		head.textContent = num(page.counts[/** @type {'edited' | 'waiting' | 'live'} */ (f.show)]);
		markCurrent();
	};

	/** @param {string} word */
	const open = async (word) => {
		current = word.normalize('NFC').trim();
		if (!current) return;
		markCurrent();
		rows.find((r) => r.getAttribute('aria-current') === 'true')?.scrollIntoView({ block: 'nearest' });
		root.toggleAttribute('data-open', true);
		history.replaceState(history.state, '', address());
		const back = h('button', { type: 'button', class: 'ws-back', 'aria-label': t('Back to the list') }, icon(ICONS.back, 20));
		back.addEventListener('click', () => root.removeAttribute('data-open'));
		const crumbs = h('header', { class: 'ws-crumbs' }, back, h('span', null, t('Studio')), h('span', { 'aria-hidden': 'true' }, '›'), h('span', { class: 'ws-crumb-word', lang: languageOf(current) }, current), h('a', { href: definitionHref(current), class: 'ws-out' }, t('Open on the site ↗')));
		const body = h('div', { class: 'ws-work ws-studio-work' }, h('p', { class: 'ws-quiet' }, t('Loading the entry…')));
		work.replaceChildren(crumbs, body);
		inspector.replaceChildren();
		const opened = current;
		try {
			await sheet({
				body,
				inspector,
				word: opened,
				role,
				// Saved or discarded: the sheet again as readers see it, and the list with what changed.
				again: (kept) => Promise.all([open(opened), load().catch(() => {})]).then(() => kept && work.querySelector('.ws-studio-save')?.append(kept)),
			});
		} catch (err) {
			if (current === opened) body.replaceChildren(h('p', { class: 'account-error', role: 'alert' }, err instanceof Error ? err.message : String(err)));
		}
	};

	more.addEventListener('click', () => {
		more.disabled = true;
		load(true)
			.catch((err) => ol.append(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err))))
			.finally(() => (more.disabled = false));
	});
	let timer = 0;
	const find = () => {
		f.q = search.value.normalize('NFC').trim();
		history.replaceState(history.state, '', address());
		return load().catch((err) => ol.replaceChildren(h('li', { class: 'ws-none' }, err instanceof Error ? err.message : String(err))));
	};
	search.addEventListener('input', () => {
		clearTimeout(timer);
		timer = window.setTimeout(find, 250);
	});
	// Enter opens the text as typed: the way to a word nobody has edited, or a new one.
	search.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Enter' || !search.value.trim()) return;
		ev.preventDefault();
		clearTimeout(timer);
		find();
		open(search.value);
	});

	await load();
	listPane.append(
		...listBar({
			title: t('Studio'),
			count: head,
			groups: [{ title: t('Show'), current: f.show, fallback: 'edited', href: (s) => `/workspace?s=studio${s === 'edited' ? '' : `&show=${s}`}`, choices: SHOWS.map(([s, label]) => ({ value: s, label: t(label) })) }],
			reset: '/workspace?s=studio',
			search,
		}),
		ol,
		more,
	);
	const word = (ctx.query.get('word') ?? '').normalize('NFC').trim();
	if (word) await open(word);
	else if (items.length && matchMedia('(min-width: 761px)').matches) await open(items[0].word);
	else
		inspector.replaceChildren(h('section', { class: 'ws-box' }, h('h2', null, t('Studio')), h('p', { class: 'ws-quiet' }, t('Open a word to change its meanings, examples, parts of speech and statuses, to add a meaning or to remove one.'))));
	return [listPane, work, inspector];
}

/**
 * @param {Listed} w
 * @param {() => void} onOpen
 */
function row(w, onOpen) {
	const state = !w.edits
		? t('in the dictionary')
		: [w.pending ? t('{n} waiting for review', { n: num(w.pending) }) : '', w.waiting ? t('{n} for the release', { n: num(w.waiting) }) : ''].filter(Boolean).join(' · ');
	const b = /** @type {HTMLButtonElement} */ (
		h(
			'button',
			{ type: 'button', class: 'ws-row', 'aria-current': 'false' },
			h('span', { class: 'ws-row-top' }, h('span', { class: 'ws-row-word', lang: w.lang }, w.word), w.edits && w.at ? h('span', { class: 'ws-row-time' }, ago(w.at, true)) : null),
			h('span', { class: 'ws-row-sub' }, w.edits ? tn('{n} edit', '{n} edits', w.edits) : t('No edits'), w.edits && w.live ? h('span', { class: 'ws-row-live' }, t('{n} live', { n: num(w.live) })) : null),
			state && w.edits ? h('span', { class: 'ws-row-state' }, state) : null,
		)
	);
	b.addEventListener('click', onOpen);
	return b;
}

/**
 * The word's sheet with its save bar, and its figures and history beside it.
 * @param {object} o
 * @param {HTMLElement} o.body
 * @param {HTMLElement} o.inspector
 * @param {string} o.word
 * @param {string} o.role
 * @param {(kept?: Node) => unknown} o.again  Show the word anew; kept: what the save said, shown under the new sheet.
 */
async function sheet(o) {
	const { body, word } = o;
	const lang = languageOf(word);
	const meaningLang = lang === 'en' ? 'my' : 'en';
	const [data, past] = await Promise.all([editableSenses(lang, word, true), workspaceEdits({ status: 'all', word, lang })]);
	const senses = /** @type {Sense[]} */ (data.senses);
	const admin = atLeast(o.role, 'admin');

	/** @param {Named[]} list @param {number | null} now @param {(name: string) => string} label */
	const select = (list, now, label) => {
		const s = /** @type {HTMLSelectElement} */ (h('select', null, list.map((x) => h('option', { value: String(x.id) }, label(x.name)))));
		// A value the list lacks (a NULL status) stays as it is until one is chosen.
		if (now === null || !list.some((x) => x.id === now)) s.prepend(h('option', { value: '' }, t('(none)')));
		s.value = now === null ? '' : String(now);
		return s;
	};
	/** @param {string} value @param {string} textLang @param {string} label */
	const area = (value, textLang, label) => /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, lang: textLang, dir: 'auto', maxlength: EDIT_TEXT_MAX, 'aria-label': label, spellcheck: 'false' }, value));

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
			h(
				'div',
				{ class: 'ws-studio-fields' },
				h('div', { class: 'ws-studio-classes' }, h('label', null, h('span', null, t('Part of speech')), type), h('label', null, h('span', null, t('Status')), kind), h('label', { class: 'ws-studio-remove' }, remove, t('Remove'))),
				h('label', null, h('span', null, t('Meaning')), text),
				h('label', null, h('span', null, t('Example')), exam),
				waits.length ? h('ul', { class: 'ws-studio-waits' }, waits.map((e) => h('li', null, `${t(STATUS[e.status] ?? e.status)}: ${what(e)}`))) : null,
			),
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
				{ class: 'ws-studio-add' },
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

	const note = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: EDIT_TEXT_MAX, placeholder: t('A source or a short reason (optional)'), 'aria-label': t('Reason') }));
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
	const form = h('div', { class: 'ws-studio-sheet' }, h('ol', { class: 'ws-studio-senses' }, rows.map((r) => r.node)), adder);
	form.addEventListener('input', refresh);
	form.addEventListener('change', refresh);
	discard.addEventListener('click', () => o.again());

	save.addEventListener('click', async () => {
		const todo = changes();
		out.replaceChildren();
		if (!(await noZawgyi(/** @type {Array<HTMLInputElement | HTMLTextAreaElement>} */ ([...todo.flatMap((c) => c.fields), note]), out))) return;
		save.disabled = discard.disabled = true;
		// One after another: each is checked against the entry as the one before left it.
		for (const c of todo) {
			try {
				const { edit } = await suggestEdit({ ...c.body, note: note.value });
				out.append(h('li', { class: 'is-done' }, `${c.label}: ${edit.live ? t('live now') : t(STATUS[edit.status] ?? edit.status)}`));
			} catch (err) {
				out.append(h('li', { class: 'is-failed' }, `${c.label}: ${err instanceof Error ? err.message : String(err)}`));
			}
		}
		// What was kept shows in the sheet read anew; what each change came to stays listed under it.
		o.again(out);
	});

	const count = senses.length ? tn('{n} meaning', '{n} meanings', senses.length) : t('not in the dictionary yet');
	body.replaceChildren(
		h('header', { class: 'ws-studio-title' }, h('h2', { lang }, word), h('span', null, count)),
		h('p', { class: 'ws-quiet' }, admin ? t('The entry as readers see it now. Changes saved here are live within a few minutes, and reach the dictionary with the next release.') : t('The entry as readers see it now. Changes saved here are approved, and reach readers with the next release; an admin can make them live sooner.')),
		form,
		h('div', { class: 'ws-studio-save' }, h('div', { class: 'ws-studio-save-row' }, note, discard, save), out),
	);

	const live = past.edits.filter((e) => e.live && (e.status === 'approved' || e.status === 'exported')).length;
	const waiting = past.edits.filter((e) => e.status === 'pending').length;
	o.inspector.replaceChildren(
		h(
			'section',
			{ class: 'ws-box' },
			h('h2', null, t('This word')),
			h('dl', { class: 'ws-facts' }, h('dt', null, t('Meanings')), h('dd', null, num(senses.length)), h('dt', null, t('Edits')), h('dd', null, num(past.edits.length)), h('dt', null, t('Live')), h('dd', null, num(live)), h('dt', null, t('Waiting')), h('dd', null, num(waiting))),
		),
		historyBox(past.edits),
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
function historyBox(edits) {
	if (!edits.length) return h('section', { class: 'ws-box ws-studio-history' }, h('h2', null, t('History')), h('p', { class: 'ws-quiet' }, t('No edit has been made to this word.')));
	return h(
		'section',
		{ class: 'ws-box ws-studio-history' },
		h('h2', null, t('History')),
		h(
			'ul',
			null,
			edits.map((e) => {
				const live = e.live && (e.status === 'approved' || e.status === 'exported');
				return h('li', null, h('span', { class: 'ws-studio-what', dir: 'auto' }, what(e)), h('span', { class: 'ws-studio-who' }, h('span', { class: `suggest-status status-${e.status}` }, live ? t('live now') : t(STATUS[e.status] ?? e.status)), ` · ${e.own ? t('you') : e.author} · ${ago(e.created_at)}`));
			}),
		),
	);
}
