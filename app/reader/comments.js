// @ts-check
/**
 * Comments under an entry (worker/routes/comments.js): what readers say
 * about the word, newest first, with the name of who said it. Signed-in
 * members write one in plain text and may delete their own; editors hide
 * others in the workspace. Loaded once the section comes near the screen,
 * and only with a connection: the copy on the device has no comments.
 */
import { h } from '../core/dom.js';
import { deleteComment, entryComments, postComment } from '../data/api.js';
import { num, shortDate, t } from '../i18n/index.js';

/** @typedef {import('../data/api.js').EntryComment} EntryComment */

const BODY_MAX = 1000;

/**
 * @param {'en' | 'my'} lang  The entry's language.
 * @param {string} word  The headword as the dictionary spells it.
 */
export function commentsSection(lang, word) {
	const count = h('span', { class: 'comments-count' });
	const list = h('ol', { class: 'comments-list' });
	const form = h('div', { class: 'comments-form' });
	const section = h('section', { class: 'comments', 'aria-labelledby': `comments-${lang}` }, h('h2', { id: `comments-${lang}`, class: 'comments-title' }, t('Comments'), count), form, list);

	/** @param {EntryComment[]} all */
	const showCount = (all) => (count.textContent = all.length ? ` · ${num(all.length)}` : '');
	/** @type {EntryComment[]} */
	let items = [];

	/** @param {EntryComment} c */
	const item = (c) => {
		const face = c.avatar_url ? h('img', { class: 'comment-face', src: c.avatar_url, alt: '', width: 32, height: 32, referrerpolicy: 'no-referrer', loading: 'lazy' }) : h('span', { class: 'comment-face comment-initial', 'aria-hidden': 'true' }, c.name.slice(0, 1).toUpperCase());
		const li = h(
			'li',
			{ class: 'comment' },
			face,
			h(
				'div',
				{ class: 'comment-main' },
				h('p', { class: 'comment-head' }, h('strong', null, c.name), ' ', h('time', { datetime: new Date(c.at * 1000).toISOString() }, shortDate(new Date(c.at * 1000), { year: true }))),
				h('p', { class: 'comment-body' }, c.body),
			),
		);
		if (c.own) {
			const del = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'comment-delete' }, t('Delete')));
			let sure = false;
			del.addEventListener('click', async () => {
				if (!sure) {
					sure = true;
					del.textContent = t('Delete it?');
					setTimeout(() => {
						sure = false;
						if (del.isConnected) del.textContent = t('Delete');
					}, 4000);
					return;
				}
				del.disabled = true;
				try {
					await deleteComment(c.id);
					items = items.filter((x) => x.id !== c.id);
					li.remove();
					showCount(items);
				} catch (err) {
					del.disabled = false;
					del.textContent = err instanceof Error ? err.message : String(err);
				}
			});
			li.querySelector('.comment-head')?.append(del);
		}
		return li;
	};

	/**
	 * @param {boolean} open
	 * @param {boolean} signedIn
	 */
	const writer = (open, signedIn) => {
		if (!open) return h('p', { class: 'comments-note' }, t('Comments are closed for now.'));
		if (!signedIn) {
			const back = `/workspace?s=account&return=${encodeURIComponent(location.pathname + location.search)}`;
			return h('p', { class: 'comments-note' }, h('a', { href: back }, t('Sign in')), ' ', t('to comment on this word.'));
		}
		const box = /** @type {HTMLTextAreaElement} */ (h('textarea', { class: 'comments-input', rows: 2, maxlength: BODY_MAX, placeholder: t('Add a comment: a usage, a correction, a question…'), 'aria-label': t('Your comment') }));
		const left = h('span', { class: 'comments-left' });
		const send = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'comments-send', disabled: true }, t('Post')));
		const out = h('p', { class: 'comments-result', role: 'status' });
		const update = () => {
			const n = box.value.trim().length;
			send.disabled = n < 2;
			left.textContent = n > BODY_MAX - 100 ? t('{n} left', { n: num(BODY_MAX - box.value.length) }) : '';
			box.style.height = 'auto';
			box.style.height = `${Math.min(box.scrollHeight, 320)}px`;
		};
		box.addEventListener('input', update);
		const f = h('form', { class: 'comments-write' }, box, h('div', { class: 'comments-actions' }, left, send), out);
		f.addEventListener('submit', async (e) => {
			e.preventDefault();
			send.disabled = true;
			out.textContent = '';
			try {
				const { comment } = await postComment(lang, word, box.value);
				items = [comment, ...items];
				list.prepend(item(comment));
				showCount(items);
				box.value = '';
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
			form.replaceChildren(writer(got.open, got.signedIn));
			list.replaceChildren(...items.map(item));
			showCount(items);
			if (!items.length && got.open) list.replaceChildren(h('li', { class: 'comments-empty' }, t('No comments yet.')));
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
