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
export const LINKED_LABELS = new Set(['also', 'US', 'brit', 'see', 'eg', 'compare', '=', '~', 'cf']);

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

/**
 * Split an example field into its sentences: `;` outside brackets.
 * @param {string} text
 * @returns {string[]}
 */
export function splitExamples(text) {
	/** @type {string[]} */
	const out = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '<' || c === '[' || c === '(' || c === '{') depth++;
		else if ((c === '>' || c === ']' || c === ')' || c === '}') && depth > 0) depth--;
		else if (c === ';' && depth === 0) {
			out.push(text.slice(start, i));
			start = i + 1;
		}
	}
	out.push(text.slice(start));
	return out.map((s) => s.trim()).filter(Boolean);
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
