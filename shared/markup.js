// @ts-check
/**
 * Dataset markup, parsed into tokens. Pure: no DOM, so the worker, the app
 * and the tests share it. See the dataset's Readme, "Sense markup".
 *
 *   <word>, <a/b/c>        links, each `/` item a word
 *   [type:informal]        label with a value; [US:color], [also:a/b], [see:x] …
 *   [brit], [compound]     label without a value
 *   (~ sth <in/into> sb)   grammar pattern; may hold links
 *   (-word-)               the word the example is about, highlighted
 *   ~                      in an example: stands for the headword
 *
 * Text that only looks like markup (`[သော]`, `{1, 2}`) stays text.
 *
 * Items (the dataset's Readme, "Items and markup"): every text column holds
 * items separated by ` | `. An item that is exactly one bracket is a note,
 * not a gloss or an example: `[figurative]` a label, `[Pali:ကာရိတ + ကြိယာ]`
 * a name and its value. In an English headword's sense, `[en:…]` (a
 * two-letter lower-case name) is the sense explained in that language.
 * `;` and `,` are punctuation and never separate items.
 */

/**
 * @typedef {{ t: 'text', v: string }
 *   | { t: 'link', words: string[] }
 *   | { t: 'label', name: string, value: Token[] | null, words: string[] }
 *   | { t: 'pattern', parts: Token[] }
 *   | { t: 'mark', parts: Token[] }} Token
 * `words` on a label: the `/`-separated items of its value, for labels whose
 * value names other headwords (LINKED_LABELS).
 */

const TOKEN = /<([^<>]+)>|\[([^[\]]*)\]|\(-(.+?)-\)|\(~([^()]*)\)/g;

/** Label names whose value is one or more headwords to link to. */
export const LINKED_LABELS = new Set(['also', 'US', 'brit', 'see', 'eg', 'compare', '=', '~', 'cf', 'illus']);

/** How a label name reads. Names not listed read as themselves. */
export const LABEL_TEXT = Object.freeze({
	type: '',
	brit: 'Brit',
	esp: 'esp.',
	usu: 'usu.',
	often: 'often',
	also: 'also',
	abbr: 'abbr.',
	see: 'see',
	eg: 'e.g.',
	compare: 'compare',
	cf: 'cf.',
	'=': '=',
	'~': '',
	'': '',
});

/**
 * @param {string} s
 * @returns {string[]}
 */
function splitWords(s) {
	return s.split('/').map((w) => w.trim()).filter(Boolean);
}

/**
 * @param {string} text
 * @returns {Token[]}
 */
export function parseMarkup(text) {
	/** @type {Token[]} */
	const out = [];
	let last = 0;
	/** @param {string} v */
	const pushText = (v) => {
		if (!v) return;
		const prev = out[out.length - 1];
		if (prev?.t === 'text') prev.v += v;
		else out.push({ t: 'text', v });
	};
	for (const m of text.matchAll(TOKEN)) {
		const index = m.index ?? 0;
		pushText(text.slice(last, index));
		last = index + m[0].length;
		const [whole, link, label, mark, pattern] = m;
		if (link !== undefined) {
			out.push({ t: 'link', words: splitWords(link) });
		} else if (label !== undefined) {
			const colon = label.indexOf(':');
			if (colon >= 0) {
				const name = label.slice(0, colon).trim();
				const value = label.slice(colon + 1).trim();
				const linked = LINKED_LABELS.has(name) && !/[<>]/.test(value);
				out.push({ t: 'label', name, value: linked ? null : parseMarkup(value), words: linked ? splitWords(value) : [] });
			} else if (/^[A-Za-z][A-Za-z -]*$/.test(label)) {
				out.push({ t: 'label', name: label.trim(), value: null, words: [] });
			} else {
				pushText(whole);
			}
		} else if (mark !== undefined) {
			out.push({ t: 'mark', parts: parseMarkup(mark) });
		} else {
			out.push({ t: 'pattern', parts: parseMarkup(`~${pattern}`) });
		}
	}
	pushText(text.slice(last));
	return out;
}

/** Between the items of a field. */
export const ITEM_SEPARATOR = ' | ';

/**
 * The items of a field: split on `|`, each trimmed, empty ones left out.
 * @param {string | null | undefined} text
 * @returns {string[]}
 */
export function splitItems(text) {
	return (text ?? '')
		.split('|')
		.map((s) => s.trim())
		.filter(Boolean);
}

/** A whole item in one bracket, with a two-letter lower-case name: the sense explained in that language. */
const LANGUAGE_ITEM = /^\[([a-z]{2}):([^[\]]*)\]$/;
/** A whole item in one bracket: a note. */
const NOTE_ITEM = /^\[([^[\]]*)\]$/;

/**
 * @typedef {{ t: 'text', text: string }
 *   | { t: 'note', name: string, value: string | null }
 *   | { t: 'language', lang: string, text: string }} Item
 * text: a gloss (in a sense) or an example (in exam), with inline markup.
 * note: `[label]` (value null) or `[name:value]`.
 * language: `[en:…]`, only in an English headword's sense.
 */

/**
 * What one item is.
 * @param {string} item  Trimmed.
 * @param {{ languages?: boolean }} [opts]  languages: the field may hold
 *   language items (an English headword's sense).
 * @returns {Item}
 */
export function itemOf(item, opts = {}) {
	const language = opts.languages ? LANGUAGE_ITEM.exec(item) : null;
	if (language) return { t: 'language', lang: language[1], text: language[2].trim() };
	const note = NOTE_ITEM.exec(item);
	if (!note) return { t: 'text', text: item };
	const inner = note[1];
	const colon = inner.indexOf(':');
	if (colon < 0) return { t: 'note', name: inner.trim(), value: null };
	return { t: 'note', name: inner.slice(0, colon).trim(), value: inner.slice(colon + 1).trim() };
}

/**
 * A field read as items.
 * @param {string | null | undefined} text
 * @param {{ languages?: boolean }} [opts]
 * @returns {Item[]}
 */
export function itemsOf(text, opts = {}) {
	return splitItems(text).map((item) => itemOf(item, opts));
}

/**
 * The glosses of a sense, its notes and language items left out.
 * @param {string | null | undefined} sense
 * @returns {string[]}
 */
export function glossesOf(sense) {
	return itemsOf(sense, { languages: true }).flatMap((it) => (it.t === 'text' ? [it.text] : []));
}

/**
 * A field shown for editing, one item a line, and back.
 * @param {string | null | undefined} text
 */
export function itemsToLines(text) {
	return splitItems(text).join('\n');
}

/** @param {string} lines */
export function linesToItems(lines) {
	return lines
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean)
		.join(ITEM_SEPARATOR);
}

/**
 * What the dataset's build would reject in a field, as one sentence, or null
 * (scripts/db_build.py, check_items and check_markup): items separated by
 * " | " with nothing empty, square brackets balanced and never nested, no
 * ";" between the glosses of a sense, and in an English headword's sense
 * the language items last, once each. The closed lists of tag names stay
 * the dataset's to check.
 * @param {string} text
 * @param {{ field: 'sense' | 'exam', dict: 'emd' | 'med' }} where
 * @returns {string | null}
 */
export function itemsProblem(text, where) {
	const open = text.split('[').length - 1;
	if (open !== text.split(']').length - 1 || /\[[^\]]*\[/.test(text)) return 'Square brackets must come in pairs and never inside each other.';
	if (text.includes('|')) {
		const parts = text.split('|');
		if (parts.some((p) => !p.trim()) || parts.map((p) => p.trim()).join(ITEM_SEPARATOR) !== text) return 'Items are separated by " | ", with one space each side and nothing empty between.';
	}
	// ";" outside brackets: punctuation inside an English example, never between glosses.
	if (!(where.dict === 'emd' && where.field === 'exam')) {
		let depth = 0;
		for (const c of text) {
			if (c === '(' || c === '[' || c === '<') depth++;
			else if ((c === ')' || c === ']' || c === '>') && depth > 0) depth--;
			else if (c === ';' && depth === 0) return where.field === 'sense' ? 'Meanings are separated by " | " (one a line), not by ";".' : 'Examples are separated by " | " (one a line), not by ";".';
		}
	}
	const items = itemsOf(text, { languages: where.dict === 'emd' && where.field === 'sense' });
	const languages = items.filter((it) => it.t === 'language');
	if (languages.length) {
		const first = items.findIndex((it) => it.t === 'language');
		if (items.slice(first).some((it) => it.t !== 'language')) return 'The explanation in English, [en:…], comes after the meanings.';
		if (new Set(languages.map((it) => /** @type {{ lang: string }} */ (it).lang)).size !== languages.length) return 'One explanation per language.';
		if (first === 0) return 'A meaning comes before its explanation in English.';
	}
	return null;
}

/**
 * Plain reading of the markup, for titles and tests.
 * @param {Token[]} tokens
 * @param {string} [headword]  Replaces `~` when given.
 * @returns {string}
 */
export function plainText(tokens, headword) {
	return tokens
		.map((tk) => {
			switch (tk.t) {
				case 'text':
					return headword === undefined ? tk.v : tk.v.replaceAll('~', headword);
				case 'link':
					return tk.words.join('/');
				case 'mark':
					return plainText(tk.parts, headword);
				case 'pattern':
					return `(${plainText(tk.parts, headword)})`;
				case 'label': {
					const name = labelName(tk.name);
					const value = tk.value ? plainText(tk.value, headword) : tk.words.join(', ');
					return `[${[name, value].filter(Boolean).join(' ')}]`;
				}
			}
		})
		.join('');
}

/**
 * @param {string} name
 * @returns {string}
 */
export function labelName(name) {
	return Object.hasOwn(LABEL_TEXT, name) ? LABEL_TEXT[/** @type {keyof LABEL_TEXT} */ (name)] : name;
}
