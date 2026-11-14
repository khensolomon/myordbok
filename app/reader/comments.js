// @ts-check
/**
 * Comments under an entry (worker/routes/comments.js): what readers say
 * about the word, newest first, with the name of who said it, and a mark
 * on answers from the people who edit the dictionary. Signed-in members
 * write one in plain text and may delete their own; editors hide others in
 * the workspace. Loaded once the section comes near the screen, and only
 * with a connection: the copy on the device has no comments.
 *
 * The form waits as one quiet line beside the writer's face; it opens when
 * written in, with Post and Cancel. Signed out, the same line asks to sign
 * in. A long discussion shows its newest few, then the rest on request.
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { deleteComment, entryComments, postComment } from '../data/api.js';
import { ago, num, shortDate, t } from '../i18n/index.js';
import { noZawgyi } from '../core/zawgyi.js';

/** @typedef {import('../data/api.js').EntryComment} EntryComment */

const BODY_MAX = 1000;
/** Shown before "Show all": the newest few. */
const FIRST = 5;

/**
 * A round face: the picture, or the first letter of the name.
 * @param {{ name: string, avatar_url: string | null } | null} who  Nobody: an empty face.
 */
function face(who) {
	if (who?.avatar_url) return h('img', { class: 'comment-face', src: who.avatar_url, alt: '', width: 32, height: 32, referrerpolicy: 'no-referrer', loading: 'lazy' });
	if (who) return h('span', { class: 'comment-face comment-initial', 'aria-hidden': 'true' }, who.name.slice(0, 1).toUpperCase());
	return h('span', { class: 'comment-face comment-nobody', 'aria-hidden': 'true' }, icon(ICONS.account, 18));
}

/**
 * @param {'en' | 'my'} lang  The entry's language.
 * @param {string} word  The headword as the dictionary spells it.
 */
export function commentsSection(lang, word) {
	const count = h('span', { class: 'comments-count' });
	const list = h('ol', { class: 'comments-list' });
	const more = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'comments-more', hidden: true }));
	const form = h('div', { class: 'comments-form' });
	const section = h('section', { class: 'comments', 'aria-labelledby': `comments-${lang}` }, h('h2', { id: `comments-${lang}`, class: 'comments-title' }, t('Comments'), count), form, list, more);

	/** @type {EntryComment[]} */
	let items = [];
	let all = false;

	/** The list, the count, and "Show all" while some are left out. */
	const show = () => {
		count.textContent = items.length ? ` · ${num(items.length)}` : '';
		const shown = all ? items : items.slice(0, FIRST);
		list.replaceChildren(...shown.map(item));
		more.hidden = shown.length === items.length;
		more.textContent = t('Show all {n} comments', { n: num(items.length) });
	};
	more.addEventListener('click', () => {
		all = true;
		show();
	});

	/** @param {EntryComment} c */
	function item(c) {
		const date = new Date(c.at * 1000);
		const head = h(
			'p',
			{ class: 'comment-head' },
			h('strong', null, c.name),
			c.editor ? h('span', { class: 'comment-editor' }, t('Editor')) : null,
			h('time', { datetime: date.toISOString(), title: shortDate(date, { year: true }) }, ago(c.at)),
		);
		const li = h('li', { class: c.editor ? 'comment comment-by-editor' : 'comment' }, face(c), h('div', { class: 'comment-main' }, head, h('p', { class: 'comment-body', dir: 'auto' }, c.body)));
		if (c.own) head.append(remover(c));
		return li;
	}

	/**
	 * Delete, asked twice: the first press asks, a second within 4 s deletes.
	 * @param {EntryComment} c
	 */
	function remover(c) {
		const del = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'comment-delete' }, t('Delete')));
		let sure = false;
		del.addEventListener('click', async () => {
			if (!sure) {
				sure = true;
				del.textContent = t('Delete it?');
				del.classList.add('is-asking');
				setTimeout(() => {
					sure = false;
					if (!del.isConnected) return;
					del.textContent = t('Delete');
					del.classList.remove('is-asking');
				}, 4000);
				return;
			}
			del.disabled = true;
			try {
				await deleteComment(c.id);
				items = items.filter((x) => x.id !== c.id);
				show();
			} catch (err) {
				del.disabled = false;
				del.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		return del;
	}

	/**
	 * @param {boolean} open
	 * @param {{ name: string, avatar_url: string | null } | null} me
	 */
	const writer = (open, me) => {
		if (!open) return h('p', { class: 'comments-note' }, t('Comments are closed for now.'));
		if (!me) {
			const back = `/workspace?s=account&return=${encodeURIComponent(location.pathname + location.search)}`;
			return h('div', { class: 'comments-compose' }, face(null), h('a', { class: 'comments-input comments-signin', href: back }, t('Sign in to add a comment')));
		}
		// Short while waiting, so it fits one line on a phone; the full hint once open.
		const idle = t('Add a comment…');
		const hint = t('Add a comment: a usage, a correction, a question…');
		const box = /** @type {HTMLTextAreaElement} */ (h('textarea', { class: 'comments-input', rows: 1, maxlength: BODY_MAX, dir: 'auto', placeholder: idle, 'aria-label': t('Your comment') }));
		const left = h('span', { class: 'comments-left' });
		const cancel = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'comments-cancel' }, t('Cancel')));
		const send = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'comments-send', disabled: true }, t('Post')));
		const out = h('p', { class: 'comments-result', role: 'status' });
		const f = h('form', { class: 'comments-compose' }, face(me), h('div', { class: 'comments-write' }, box, h('div', { class: 'comments-actions' }, left, cancel, send), out));
		/** Open while focused or holding text; the height follows the text. */
		const update = () => {
			const n = box.value.trim().length;
			send.disabled = n < 2;
			left.textContent = n > BODY_MAX - 100 ? t('{n} left', { n: num(BODY_MAX - box.value.length) }) : '';
			const open = document.activeElement === box || box.value.length > 0;
			f.classList.toggle('is-open', open);
			box.placeholder = open ? hint : idle;
			box.style.height = 'auto';
			box.style.height = `${Math.min(box.scrollHeight + 2, 320)}px`;
		};
		box.addEventListener('input', update);
		box.addEventListener('focus', update);
		// Leaving an empty box closes it; a press on Cancel or Post counts as staying.
		box.addEventListener('blur', () => setTimeout(() => f.contains(document.activeElement) || update(), 0));
		box.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit();
			if (e.key === 'Escape' && !box.value) box.blur();
		});
		cancel.addEventListener('click', () => {
			box.value = '';
			out.textContent = '';
			box.blur();
			update();
		});
		f.addEventListener('submit', async (e) => {
			e.preventDefault();
			out.textContent = '';
			if (!(await noZawgyi([box], out))) return;
			send.disabled = true;
			try {
				const { comment } = await postComment(lang, word, box.value);
				items = [comment, ...items];
				show();
				box.value = '';
				box.blur();
				update();
			} catch (err) {
				out.textContent = err instanceof Error ? err.message : String(err);
				send.disabled = false;
			}
		});
		return f;
	};

	const load = async () => {
		if (!navigator.onLine) return section.remove();
		try {
			const got = await entryComments(lang, word);
			// Hidden in Settings: no section at all.
			if (got.hidden) return section.remove();
			items = got.comments;
			form.replaceChildren(writer(got.open, got.signedIn ? (got.me ?? null) : null));
			show();
		} catch {
			// Comments are never in the way of the entry: without them, the section goes.
			section.remove();
		}
	};
	// Asked for once the section is close to the screen, not with every entry.
	const seen = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			seen.disconnect();
			load();
		},
		{ rootMargin: '400px' },
	);
	seen.observe(section);
	return section;
}
