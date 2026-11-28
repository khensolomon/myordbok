// @ts-check
/**
 * The guide's markdown, read into passages: the units the index scores and
 * the workspace shows. A passage is a heading's text up to the next
 * heading, cut further where it is long: a bullet with a bold lead
 * ("- **Deep links.** …") is a passage of its own, named by its lead; a
 * long run of paragraphs is cut at paragraph ends near PASSAGE_WORDS.
 * A fenced code block stays whole with the passage it is in; a table's
 * rows become its sentences.
 *
 * The output holds plain text only: markup read here is not shown again,
 * the workspace renders the passage's own markdown (render()).
 */

/** Where a long passage is cut, in words; a bullet or a table row is never split. */
export const PASSAGE_WORDS = 120;

/**
 * @typedef {object} Passage
 * @property {string} id  file#n, stable for one text of the file.
 * @property {string} file  docs/… path, as the manifest names it.
 * @property {string[]} path  The headings above it, the file's title first.
 * @property {string} title  The nearest heading, or a bullet's bold lead.
 * @property {string} markdown  The passage as written, for showing.
 * @property {string[]} sentences  Plain text, one per sentence, bullet or table row.
 * @property {string} code  The text of its code spans and blocks, for the index.
 * @property {number} line  The first line, 1-based, in the file.
 */

/**
 * @param {string} file
 * @param {string} text
 * @returns {Passage[]}
 */
export function passages(file, text) {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	/** @type {Passage[]} */
	const out = [];
	/** @type {string[]} */
	const heads = [];
	/** The passage being gathered. */
	let buf = /** @type {string[]} */ ([]);
	let bufLine = 1;
	let title = '';
	let fence = false;
	let n = 0;

	const flush = () => {
		const md = buf.join('\n').trim();
		buf = [];
		if (!md) return;
		const { sentences, code } = plain(md);
		if (!sentences.length && !code) return;
		out.push({ id: `${file}#${n++}`, file, path: [...heads], title: title || heads.at(-1) || file, markdown: md, sentences, code, line: bufLine });
	};

	let words = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (/^\s*(>\s*)?(```|~~~)/.test(line)) fence = !fence;
		const head = !fence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
		if (head) {
			flush();
			const level = head[1].length;
			heads.length = Math.max(0, level - 1);
			heads[level - 1] = inlinePlain(head[2]);
			title = '';
			words = 0;
			bufLine = i + 2;
			continue;
		}
		const lead = !fence && /^\s*[-*]\s+\*\*(.+?)\*\*\s*/.exec(line);
		if (lead) {
			flush();
			title = inlinePlain(lead[1]).replace(/[.:]$/, '');
			bufLine = i + 1;
			words = 0;
		} else if (!fence && line.trim() === '' && words >= PASSAGE_WORDS && !/^\s*[-*]|\|/.test(lines[i + 1] ?? '')) {
			// A paragraph end in a long run: cut here, the heading's name kept.
			flush();
			title = title && !/^\s*[-*]\s+\*\*/.test(buf[0] ?? '') ? title : '';
			bufLine = i + 2;
			words = 0;
		} else if (!fence && /^\s*[-*]\s+/.test(line) && title && !/^\s+/.test(line) && buf.length && !/^\s*[-*]\s+\*\*/.test(line)) {
			// A plain bullet after a bold-led one at the same level: its own passage, named by the heading.
			flush();
			title = '';
			bufLine = i + 1;
			words = 0;
		}
		if (!buf.length) bufLine = i + 1;
		buf.push(line);
		words += line.split(/\s+/).filter(Boolean).length;
	}
	flush();
	return out;
}

/**
 * Plain sentences and code text of a passage's markdown.
 * @param {string} md
 */
function plain(md) {
	/** @type {string[]} */
	const sentences = [];
	/** @type {string[]} */
	const code = [];
	// Quoted lines read as plain ones; a callout's tag ([!NOTE]) says nothing.
	const blocks = md
		.replace(/^(\s*)>\s?/gm, '$1')
		.replace(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gm, '')
		.split(/^\s*(?:```|~~~).*$/m);
	blocks.forEach((block, i) => {
		if (i % 2 === 1) {
			code.push(block.trim());
			return;
		}
		for (const para of block.split(/\n\s*\n/)) {
			const rows = para.split('\n').filter((l) => l.trim());
			if (!rows.length) continue;
			if (rows.every((l) => /^\s*\|/.test(l) || /\|/.test(l))) {
				// A table: each row a sentence, the separator row dropped.
				for (const row of rows) {
					if (/^\s*\|?\s*:?-{2,}/.test(row)) continue;
					const cells = row.split('|').map((c) => inlinePlain(c, code)).filter(Boolean);
					if (cells.length) sentences.push(cells.join(' | '));
				}
				continue;
			}
			if (rows.every((l) => /^\s*([-*]|\d+[.)])\s+/.test(l) || /^\s{2,}/.test(l))) {
				// A list: each item one sentence, its wrapped lines joined.
				let item = '';
				for (const l of rows) {
					if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
						if (item) sentences.push(...split(inlinePlain(item, code)));
						item = l.replace(/^\s*([-*]|\d+[.)])\s+/, '');
					} else item += ` ${l.trim()}`;
				}
				if (item) sentences.push(...split(inlinePlain(item, code)));
				continue;
			}
			sentences.push(...split(inlinePlain(rows.join(' '), code)));
		}
	});
	return { sentences: sentences.filter((s) => s.length > 1), code: code.join('\n') };
}

/**
 * Inline markup removed: code spans' text kept (and collected), links
 * to their text, emphasis marks dropped.
 * @param {string} s
 * @param {string[]} [code]
 */
export function inlinePlain(s, code) {
	return s
		.replace(/`([^`]*)`/g, (_, c) => {
			code?.push(c);
			return c;
		})
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
		.replace(/<\/?[a-z][^>]*>/gi, '')
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(^|\W)[*_](.*?)[*_](?=\W|$)/g, '$1$2')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Sentences of a paragraph: cut after . ! ? followed by a space and a
 * capital or a digit, so "e.g. the" and "scripts/build.js" stay whole.
 * @param {string} text
 */
export function split(text) {
	return text
		.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * A passage's markdown as HTML for the workspace: headings, paragraphs,
 * lists, tables, code blocks and spans, emphasis, links; everything else
 * escaped. Small on purpose: the guide is written plainly.
 * @param {string} md
 */
export function render(md) {
	const esc = (/** @type {string} */ s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	const inline = (/** @type {string} */ s) =>
		esc(s)
			.replace(/`([^`]*)`/g, '<code>$1</code>')
			.replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]*|#[^)\s]*|\/[^)\s]*)\)/g, '<a href="$2" rel="noopener">$1</a>')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/(\*\*|__)(.*?)\1/g, '<strong>$2</strong>')
			.replace(/(^|[\s(])[*_]([^*_]+)[*_](?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
	/** @type {string[]} */
	const out = [];
	// A run of quoted lines is a quote, rendered as markdown of its own; a
	// callout's tag ([!NOTE]) becomes its label.
	const quoted = md.split(/^((?:[ \t]*>.*(?:\n|$))+)/m);
	if (quoted.length > 1) {
		for (let i = 0; i < quoted.length; i++) {
			if (!quoted[i].trim()) continue;
			if (i % 2 === 0) {
				out.push(render(quoted[i]));
				continue;
			}
			let inner = quoted[i].replace(/^[ \t]*>[ ]?/gm, '');
			const tag = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/.exec(inner);
			if (tag) inner = inner.slice(tag[0].length);
			out.push(`<blockquote${tag ? ` class="callout callout-${tag[1].toLowerCase()}"` : ''}>${tag ? `<p class="callout-tag">${tag[1][0]}${tag[1].slice(1).toLowerCase()}</p>` : ''}${render(inner)}</blockquote>`);
		}
		return out.join('\n');
	}
	const blocks = md.split(/^\s*(?:```|~~~)(.*)$/m);
	for (let b = 0; b < blocks.length; b += 3) {
		const text = blocks[b];
		for (const para of text.split(/\n\s*\n/)) {
			const rows = para.split('\n').filter((l) => l.trim());
			if (!rows.length) continue;
			const head = rows.length === 1 && /^(#{1,6})\s+(.*)$/.exec(rows[0]);
			if (head) {
				const level = Math.min(6, head[1].length + 1);
				out.push(`<h${level}>${inline(head[2])}</h${level}>`);
				continue;
			}
			if (rows.length > 1 && rows.every((l) => /\|/.test(l))) {
				const cells = (/** @type {string} */ l) => l.replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => inline(c.trim()));
				const [first, ...rest] = rows;
				const body = rest.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l));
				out.push(`<table><thead><tr>${cells(first).map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map((l) => `<tr>${cells(l).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
				continue;
			}
			if (rows.every((l) => /^\s*([-*]|\d+[.)])\s+/.test(l) || /^\s{2,}/.test(l))) {
				const ordered = /^\s*\d+[.)]/.test(rows[0]);
				/** @type {string[]} */
				const items = [];
				for (const l of rows) {
					if (/^\s*([-*]|\d+[.)])\s+/.test(l)) items.push(l.replace(/^\s*([-*]|\d+[.)])\s+/, ''));
					else items[items.length - 1] += ` ${l.trim()}`;
				}
				const tag = ordered ? 'ol' : 'ul';
				out.push(`<${tag}>${items.map((it) => `<li>${inline(it.replace(/^\[([ x])\]\s*/, (_, c) => (c === 'x' ? '☑ ' : '☐ ')))}</li>`).join('')}</${tag}>`);
				continue;
			}
			out.push(`<p>${inline(rows.join(' '))}</p>`);
		}
		if (b + 2 < blocks.length) {
			const lang = (blocks[b + 1] ?? '').trim();
			out.push(`<pre><code${lang ? ` class="language-${esc(lang)}"` : ''}>${esc(blocks[b + 2].replace(/^\n|\n$/g, ''))}</code></pre>`);
		}
	}
	return out.join('\n');
}
