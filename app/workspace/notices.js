// @ts-check
/**
 * Notices (?s=notices), for admins: the site notices, scheduled ahead
 * (worker/routes/notices.js). The list groups them by state: showing now,
 * scheduled, every year, ended. Choosing one, or New notice, opens the form
 * beside it with a preview drawn by the same code the site uses.
 *
 * Times are entered and shown in this device's time zone and kept as Unix
 * seconds; every visitor sees them in their own.
 */
import { h } from '../core/dom.js';
import { celebrationLine, noticeBar, windowText } from '../core/notices.js';
import { deleteNotice, saveNotice, workspaceNotices } from '../data/api.js';
import { mark, shortDate, t } from '../i18n/index.js';
import { LINK_MAX, TEXT_MAX } from '#shared/notices.js';

/** @typedef {import('../data/api.js').Notice} Notice */
/** @typedef {import('#shared/notices.js').NoticeKind} Kind */

/** @type {ReadonlyArray<[Kind, string, string]>} */
const KINDS = [
	['maintenance', mark('Maintenance'), mark('A bar on every page, with the time it happens in each visitor’s own time.')],
	['info', mark('Information'), mark('A bar on every page.')],
	['celebration', mark('Celebration'), mark('A line on the home page, under the logo.')],
];

/** @type {ReadonlyArray<[import('#shared/notices.js').Audience, string]>} */
const AUDIENCES = [
	['everyone', mark('Everyone')],
	['member', mark('Signed-in members')],
	['editor', mark('Editors and admins')],
];

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 * @param {(when: number, short?: boolean) => string} ago
 */
export async function noticesPane(ctx, ago) {
	const main = h('main', { class: 'ws-main ws-overview ws-notices', 'aria-label': t('Notices') });
	const list = h('div', { class: 'ws-notice-list' });
	const editor = h('section', { class: 'ws-card ws-notice-editor', 'aria-label': t('Notice') });
	const fresh = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary ws-new' }, t('New notice')));
	main.append(
		h(
			'div',
			{ class: 'ws-work' },
			h('header', { class: 'ws-ov-head ws-notices-head' }, h('h1', null, t('Notices')), h('span', null, t('Maintenance, news and days to celebrate, scheduled ahead.')), fresh),
			h('div', { class: 'ws-notices-grid' }, list, editor),
		),
	);

	/** @type {Notice[]} */
	let notices = [];
	let now = 0;

	const load = async () => {
		({ notices, now } = await workspaceNotices());
		drawList();
	};

	/**
	 * @param {number | null} id
	 * @param {boolean} [reveal]  On a narrow work area the form sits below the list: bring it into view.
	 */
	const choose = (id, reveal = false) => {
		const url = new URL(location.href);
		if (id) url.searchParams.set('id', String(id));
		else url.searchParams.delete('id');
		history.replaceState(history.state, '', url);
		for (const b of list.querySelectorAll('[data-id]')) b.setAttribute('aria-current', String(Number(/** @type {HTMLElement} */ (b).dataset.id) === id));
		editor.replaceChildren(...form(notices.find((n) => n.id === id) ?? null, ago, async (saved) => {
			await load();
			choose(saved);
		}));
		if (reveal && editor.getBoundingClientRect().top > list.getBoundingClientRect().top + 40) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	const drawList = () => {
		/** @type {Array<[string, Notice[]]>} */
		const groups = [
			[t('Showing now'), notices.filter((n) => n.next && n.next.shows <= now)],
			[t('Scheduled'), notices.filter((n) => !n.yearly && n.next && n.next.shows > now)],
			[t('Every year'), notices.filter((n) => n.yearly && n.next && n.next.shows > now)],
			[t('Ended'), notices.filter((n) => !n.next)],
		];
		const shown = groups.filter(([, g]) => g.length);
		list.replaceChildren(
			...(shown.length
				? shown.map(([title, g]) => h('section', { class: 'ws-card ws-notice-group' }, h('h2', null, title), h('ul', { class: 'ws-notice-rows' }, g.map((n) => h('li', null, row(n, now, () => choose(n.id, true)))))))
				: [h('div', { class: 'ws-card ws-notice-empty' }, h('p', null, t('No notices yet.')), h('p', { class: 'ws-quiet' }, t('A notice tells readers about maintenance, news, or a day to celebrate. Schedule it once; it shows and goes by itself.')))]),
		);
	};

	fresh.addEventListener('click', () => choose(null, true));
	await load();
	const asked = Number(ctx.query.get('id'));
	choose(notices.some((n) => n.id === asked) ? asked : null);
	return main;
}

/**
 * @param {Notice} n
 * @param {number} now
 * @param {() => void} onOpen
 */
function row(n, now, onOpen) {
	const text = n.text_en ?? n.text_my ?? '';
	const when = n.next ?? { starts: n.starts_at, ends: n.ends_at };
	const live = n.next && n.next.shows <= now;
	const b = h(
		'button',
		{ type: 'button', class: 'ws-notice-row', 'data-id': String(n.id), 'aria-current': 'false' },
		h('span', { class: `ws-notice-dot ws-notice-dot-${n.kind}`, 'aria-hidden': 'true' }),
		h('span', { class: 'ws-notice-main' }, h('span', { class: 'ws-notice-text', lang: n.text_en ? 'en' : 'my' }, text), h('span', { class: 'ws-notice-meta' }, t(kindName(n.kind)), ' · ', windowText(when.starts, when.ends), n.yearly ? ` · ${t('every year')}` : '', n.audience !== 'everyone' ? ` · ${t(audienceName(n.audience))}` : '')),
		live ? h('span', { class: 'ws-notice-live' }, t('Live')) : '',
	);
	b.addEventListener('click', onOpen);
	return b;
}

/** @param {Kind} kind */
const kindName = (kind) => /** @type {[Kind, string, string]} */ (KINDS.find(([k]) => k === kind))[1];
/** @param {import('#shared/notices.js').Audience} a */
const audienceName = (a) => /** @type {[string, string]} */ (AUDIENCES.find(([k]) => k === a))[1];

/** A Date as a datetime-local input wants it, in this device's time. @param {number | null} at */
function toInput(at) {
	if (!at) return '';
	const d = new Date(at * 1000);
	const p = (/** @type {number} */ x) => String(x).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** @param {string} value  From a datetime-local input. */
function fromInput(value) {
	return value ? Math.floor(new Date(value).getTime() / 1000) : null;
}

/**
 * The form for one notice, a new one when null.
 * @param {Notice | null} n
 * @param {(when: number, short?: boolean) => string} ago
 * @param {(id: number | null) => Promise<void>} done  After a save (its id) or a delete (null).
 * @returns {Node[]}
 */
function form(n, ago, done) {
	const hour = 3600;
	const start = n?.starts_at ?? Math.ceil(Date.now() / 1000 / hour) * hour + hour;
	/** @type {Kind} */
	let kind = n?.kind ?? 'maintenance';

	const kindButtons = KINDS.map(([k, label]) => {
		const b = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-kind', 'aria-pressed': String(k === kind) }, h('span', { class: `ws-notice-dot ws-notice-dot-${k}`, 'aria-hidden': 'true' }), t(label)));
		b.addEventListener('click', () => {
			kind = k;
			kindButtons.forEach((x, i) => x.setAttribute('aria-pressed', String(KINDS[i][0] === k)));
			about.textContent = t(KINDS.find(([x]) => x === k)?.[2] ?? '');
			update();
		});
		return b;
	});
	const about = h('p', { class: 'ws-quiet ws-kind-about' }, t(KINDS.find(([x]) => x === kind)?.[2] ?? ''));

	const textarea = (/** @type {string} */ lang, /** @type {string | null | undefined} */ value) =>
		/** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: TEXT_MAX, lang, placeholder: lang === 'en' ? t('In English') : t('In Myanmar') }, value ?? ''));
	const en = textarea('en', n?.text_en);
	const my = textarea('my', n?.text_my);
	const link = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'url', maxlength: LINK_MAX, placeholder: t('https://… or a page here, such as /about'), value: n?.link ?? '' }));
	const starts = /** @type {HTMLInputElement} */ (h('input', { type: 'datetime-local', value: toInput(start), required: true }));
	const ends = /** @type {HTMLInputElement} */ (h('input', { type: 'datetime-local', value: toInput(n?.ends_at ?? start + hour), required: true }));
	const announce = /** @type {HTMLInputElement} */ (h('input', { type: 'datetime-local', value: toInput(n?.announce_at ?? null) }));
	const yearly = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: n?.yearly ? true : null }));
	const audience = /** @type {HTMLSelectElement} */ (h('select', null, AUDIENCES.map(([a, label]) => h('option', { value: a, selected: (n?.audience ?? 'everyone') === a ? true : null }, t(label)))));
	const preview = h('div', { class: 'ws-preview', 'aria-hidden': 'true' });
	const out = h('p', { class: 'ws-result', role: 'status' });
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-primary' }, n ? t('Save changes') : t('Schedule notice')));
	const remove = n ? /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-link-button ws-delete-notice' }, t('Delete'))) : '';

	const draft = () => ({
		kind,
		text_en: en.value.trim() || null,
		text_my: my.value.trim() || null,
		link: link.value.trim() || null,
		audience: /** @type {import('#shared/notices.js').Audience} */ (audience.value),
		announce_at: fromInput(announce.value),
		starts_at: /** @type {number} */ (fromInput(starts.value)),
		ends_at: /** @type {number} */ (fromInput(ends.value)),
		yearly: /** @type {0 | 1} */ (yearly.checked ? 1 : 0),
	});

	const update = () => {
		const d = draft();
		const sample = { id: 0, kind, text_en: d.text_en ?? (d.text_my ? null : t('Your notice')), text_my: d.text_my, link: d.link, starts: d.starts_at ?? 0, ends: d.ends_at ?? 0, version: 0 };
		preview.replaceChildren(
			h('span', { class: 'ws-preview-label' }, kind === 'celebration' ? t('Preview, on the home page') : t('Preview, under the header')),
			kind === 'celebration' ? h('p', { class: 'home-pair home-celebration ws-preview-celebration' }, ...celebrationLine(sample, () => {})) : noticeBar(sample, () => {}),
		);
	};
	for (const input of [en, my, link, starts, ends, announce, yearly, audience]) input.addEventListener('input', update);

	const field = (/** @type {string} */ label, /** @type {Node} */ control, /** @type {string} */ hint = '') => h('label', { class: 'ws-notice-field' }, h('span', null, label), control, hint ? h('small', null, hint) : '');

	const node = h(
		'form',
		{ class: 'ws-notice-form', novalidate: true },
		h('h2', null, n ? t('Edit notice') : t('New notice')),
		h('div', { class: 'ws-kinds', role: 'group', 'aria-label': t('Kind') }, kindButtons),
		about,
		h('div', { class: 'ws-notice-pair' }, field(t('English'), en), field(t('Myanmar'), my)),
		h('p', { class: 'ws-quiet' }, t('Write one or both; readers see their interface language when there is one, otherwise the other.')),
		field(t('Link (optional)'), link),
		h('div', { class: 'ws-notice-pair' }, field(t('Starts'), starts), field(t('Ends'), ends)),
		h('div', { class: 'ws-notice-pair' }, field(t('Show from (optional)'), announce, t('To announce it ahead; otherwise it shows from the start.')), field(t('Who sees it'), audience)),
		h('label', { class: 'ws-notice-check' }, yearly, h('span', null, t('Every year on these days'), h('small', null, t('For fixed dates such as 4 January or 25 December. Lunar days move each year: schedule them one by one.')))),
		preview,
		h('div', { class: 'ws-notice-actions' }, save, remove, out),
		n ? h('p', { class: 'ws-quiet' }, n.updated_by ? t('Last changed by {who}, {when}', { who: n.updated_by, when: ago(n.updated_at) }) : t('Last changed {when}', { when: shortDate(new Date(n.updated_at * 1000), { year: true }) })) : '',
	);

	node.addEventListener('submit', async (e) => {
		e.preventDefault();
		const d = draft();
		if (!d.starts_at || !d.ends_at) {
			out.textContent = t('Choose when it starts and ends.');
			return;
		}
		save.disabled = true;
		out.textContent = t('Saving…');
		try {
			const { id } = await saveNotice(d, n?.id);
			out.textContent = t('Saved.');
			await done(id);
		} catch (err) {
			out.textContent = err instanceof Error ? err.message : String(err);
		} finally {
			save.disabled = false;
		}
	});
	if (remove && n) {
		remove.addEventListener('click', async () => {
			if (remove.dataset.sure !== '1') {
				remove.dataset.sure = '1';
				remove.textContent = t('Delete for good?');
				return;
			}
			remove.disabled = true;
			try {
				await deleteNotice(n.id);
				await done(null);
			} catch (err) {
				remove.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
	}
	update();
	return [node];
}

