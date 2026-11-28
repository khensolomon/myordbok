// @ts-check
/**
 * Workspace › Guide: the repository's docs, as the release shipped them,
 * indexed on this device (core/guide.js, shared/guide/) and asked in plain
 * words. Everything shown is the guide's own text: an answer is its best
 * sentences, each with the passage it is from; a question it does not
 * cover says so, and can be sent to the Inbox for an answer to be written
 * (docs/guide-answers.md).
 *
 *   /workspace?s=guide                 the files, and the field
 *   /workspace?s=guide&q=how+do+i…     asked
 *   /workspace?s=guide&p=docs/x.md#3   a passage open
 */
import { ask, codeAfter } from '#shared/guide/ask.js';
import { render } from '#shared/guide/markdown.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { loadGuide } from '../core/guide.js';
import { sendMessage } from '../data/api.js';

const REPO = 'https://github.com/khensolomon/myordbok/blob/dev/';

/**
 * @param {import('../core/routes.js').ViewContext} ctx
 */
export function guidePane(ctx) {
	const status = h('div', { class: 'guide-status', role: 'status' }, 'Reading the guide…');
	const again = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'guide-index' }, icon(ICONS.history, 16), 'Index again'));
	const field = /** @type {HTMLInputElement} */ (h('input', { type: 'search', class: 'guide-ask', placeholder: 'Ask the guide, or type a few words…', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Ask the guide', value: ctx.query.get('q') ?? '' }));
	const answer = h('section', { class: 'guide-answer', 'aria-live': 'polite', hidden: true });
	const files = h('nav', { class: 'guide-files', 'aria-label': 'Files' });
	const reader = h('article', { class: 'guide-reader' }, h('p', { class: 'ws-quiet' }, 'Pick a file, or ask.'));
	const problem = h('p', { class: 'guide-problem', role: 'alert', hidden: true });

	/** @type {import('../core/guide.js').Guide | null} */
	let guide = null;
	/** @type {string | null} */
	let openFile = null;

	const fail = (/** @type {unknown} */ err) => {
		problem.textContent = err instanceof Error ? err.message : String(err);
		problem.hidden = false;
		status.textContent = 'The guide could not be read.';
		again.disabled = false;
	};

	/** Reads (or re-reads) the guide, then shows what the address asks for. */
	const start = async (fresh = false) => {
		again.disabled = true;
		problem.hidden = true;
		status.textContent = fresh ? 'Fetching the guide again…' : 'Reading the guide…';
		try {
			guide = await loadGuide({ fresh });
		} catch (err) {
			fail(err);
			return;
		}
		again.disabled = false;
		const { index, manifest, indexedAt, fetched } = guide;
		const when = new Date(indexedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		status.replaceChildren(
			h('b', null, `Indexed ${when}`),
			h('span', null, `${manifest.files.length} files · ${index.passages.length} passages · ${index.size.words.toLocaleString()} words · release ${manifest.release}`),
			h('small', null, fetched ? `${fetched} ${fetched === 1 ? 'file' : 'files'} fetched, the rest from this device` : 'all from this device’s copy'),
		);
		listFiles();
		const p = ctx.query.get('p');
		const q = ctx.query.get('q');
		if (q) askNow(q);
		else if (p) openPassage(p);
	};

	/** The files, each with how many passages; a count of matches while a question is open. */
	const listFiles = (/** @type {Map<string, number>} */ matches = new Map()) => {
		if (!guide) return;
		/** @type {Map<string, number>} */
		const counts = new Map();
		for (const p of guide.index.passages) counts.set(p.file, (counts.get(p.file) ?? 0) + 1);
		files.replaceChildren(
			h(
				'ul',
				null,
				[...counts].map(([file, n]) =>
					h(
						'li',
						null,
						h(
							'a',
							{ href: `/workspace?s=guide&p=${encodeURIComponent(`${file}#0`)}`, class: file === openFile ? 'is-open' : null, 'aria-current': file === openFile ? 'true' : null },
							h('span', null, file.replace(/^docs\//, '')),
							h('small', null, matches.size ? `${matches.get(file) ?? 0} of ${n}` : String(n)),
						),
					),
				),
			),
		);
	};

	/**
	 * A passage shown whole, under its headings, with the file's other
	 * passages after it so the page reads on; the words of a question lit.
	 * @param {string} id
	 * @param {string[]} [lit]  Terms to mark (stems).
	 * @param {boolean} [scroll]  Bring the passage into view (not when an answer is above it).
	 */
	const openPassage = (id, lit = [], scroll = true) => {
		if (!guide) return;
		const { passages } = guide.index;
		const at = passages.findIndex((p) => p.id === id);
		if (at < 0) {
			reader.replaceChildren(h('p', { class: 'ws-quiet' }, `No passage ${id} in this release of the guide.`));
			return;
		}
		const first = passages[at];
		openFile = first.file;
		listFiles();
		const ofFile = passages.filter((p) => p.file === first.file);
		reader.replaceChildren(
			h(
				'header',
				{ class: 'guide-reader-head' },
				h('span', { class: 'guide-crumb' }, first.path.join(' › ')),
				h('a', { class: 'guide-github', href: `${REPO}${first.file}#L${first.line}`, target: '_blank', rel: 'noopener' }, 'On GitHub'),
			),
			...ofFile.map((p) => {
				const el = h('section', { class: 'guide-passage', id: anchor(p.id), 'data-lit': p.id === id ? '' : null });
				el.innerHTML = render(p.markdown);
				if (lit.length) mark(el, lit);
				return el;
			}),
		);
		if (scroll) requestAnimationFrame(() => document.getElementById(anchor(id))?.scrollIntoView({ block: 'start' }));
	};

	/**
	 * A question asked: the answer card, then the nearest passages; the
	 * file list counts the matches.
	 * @param {string} text
	 */
	const askNow = (text) => {
		if (!guide) return;
		const { index } = guide;
		const reply = ask(index, text);
		/** @type {Map<string, number>} */
		const perFile = new Map();
		for (const { passage } of reply.passages) perFile.set(index.passages[passage].file, (perFile.get(index.passages[passage].file) ?? 0) + 1);
		listFiles(perFile);
		answer.hidden = false;
		const send = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'guide-send' }, 'Send to Inbox'));
		const sent = h('span', { class: 'ws-quiet', role: 'status' });
		send.addEventListener('click', async () => {
			send.disabled = true;
			try {
				await sendMessage({ kind: 'question', body: `Guide: ${text}`, page: '/workspace?s=guide', lang: 'en' });
				sent.textContent = 'Sent. An answer written into the guide is found first next time.';
			} catch (err) {
				send.disabled = false;
				sent.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		const nearest = reply.passages.length
			? h(
					'ol',
					{ class: 'guide-nearest' },
					reply.passages.map(({ passage, coverage }) => {
						const p = index.passages[passage];
						return h('li', null, h('a', { href: `/workspace?s=guide&p=${encodeURIComponent(p.id)}&q=${encodeURIComponent(text)}` }, h('b', null, p.title), h('small', null, `${p.file.replace(/^docs\//, '')} · ${p.path.slice(1).join(' › ') || p.path[0]}`)), h('i', { class: 'guide-coverage', title: 'How much of the question this passage covers' }, `${Math.round(coverage * 100)}%`));
					}),
				)
			: h('p', { class: 'ws-quiet' }, 'Nothing in the guide has these words.');
		if (!reply.question.terms.length) {
			answer.replaceChildren(h('p', { class: 'ws-quiet' }, 'Ask with a few words that name the thing: a page, a command, a file.'));
			return;
		}
		if (!reply.answered) {
			answer.replaceChildren(
				h('div', { class: 'guide-card guide-none' }, h('p', null, h('b', null, 'The guide does not cover this.'), ' The nearest passages are below; nothing is made up to fill the gap.'), h('p', { class: 'guide-actions' }, send, sent)),
				h('h3', null, 'Nearest passages'),
				nearest,
			);
			return;
		}
		answer.replaceChildren(
			h(
				'div',
				{ class: 'guide-card' },
				...reply.answers.map((a, i) => {
					const p = index.passages[a.passage];
					const open = `/workspace?s=guide&p=${encodeURIComponent(p.id)}&q=${encodeURIComponent(text)}`;
					return h(
						'div',
						{ class: 'guide-from' },
						h('a', { class: 'guide-from-title', href: open }, h('span', { class: 'guide-cite' }, String(i + 1)), h('b', null, p.title), h('small', null, p.file.replace(/^docs\//, ''))),
						h(
							'ul',
							{ class: 'guide-sentences' },
							a.sentences.map((s) => {
								const code = codeAfter(p, s);
								return h('li', null, p.sentences[s], code ? h('pre', null, h('code', null, code)) : null);
							}),
						),
					);
				}),
				h('p', { class: 'guide-actions' }, h('span', { class: 'ws-quiet' }, `${reply.answers.reduce((n, a) => n + a.sentences.length, 0)} sentences from ${reply.answers.length} ${reply.answers.length === 1 ? 'passage' : 'passages'}, read on this device.`), send, sent),
			),
			h('h3', null, 'Nearest passages'),
			nearest,
		);
		const p = ctx.query.get('p');
		if (p) openPassage(p, reply.question.terms);
		else openPassage(index.passages[reply.answers[0].passage].id, reply.question.terms, false);
	};

	field.addEventListener('keydown', (e) => {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const text = field.value.trim();
		ctx.go(text ? `/workspace?s=guide&q=${encodeURIComponent(text)}` : '/workspace?s=guide');
	});
	again.addEventListener('click', () => start(true));
	start();

	return h(
		'main',
		{ class: 'ws-main ws-account ws-settings ws-guide', 'aria-label': 'Guide', lang: 'en' },
		h(
			'div',
			{ class: 'ws-work ws-settings-page guide-page' },
			h(
				'header',
				{ class: 'ws-settings-head guide-head' },
				h('div', null, h('h1', null, 'Guide'), h('p', null, 'The repository’s docs, as the release brought them: read here, asked in plain words, and found from the search box. Indexed and answered on this device; nothing is sent anywhere.')),
				h('div', { class: 'guide-index-box' }, status, again),
			),
			problem,
			h('div', { class: 'guide-field' }, icon(ICONS.search, 18), field),
			answer,
			h('div', { class: 'guide-grid' }, files, reader),
		),
	);
}

/** @param {string} id */
function anchor(id) {
	return `g-${id.replace(/[^a-z0-9]+/gi, '-')}`;
}

/**
 * Marks the words of a question in a shown passage: text nodes only,
 * stems matched at word starts.
 * @param {HTMLElement} root
 * @param {string[]} stems
 */
function mark(root, stems) {
	const words = stems.filter((s) => /^[a-z0-9]{3,}/.test(s));
	if (!words.length) return;
	const re = new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})[a-z]*`, 'gi');
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('pre, code, a') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
	/** @type {Text[]} */
	const nodes = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(/** @type {Text} */ (n));
	for (const node of nodes) {
		const text = node.data;
		if (!re.test(text)) continue;
		re.lastIndex = 0;
		const frag = document.createDocumentFragment();
		let last = 0;
		for (const m of text.matchAll(re)) {
			const at = m.index ?? 0;
			frag.append(text.slice(last, at), h('mark', null, m[0]));
			last = at + m[0].length;
		}
		frag.append(text.slice(last));
		node.replaceWith(frag);
	}
}
