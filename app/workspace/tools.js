// @ts-check
/**
 * The workspace's Tools (admins): a form for each tool command, built from
 * their one description (shared/commands.js), that builds the command line
 * to run on GitHub (Actions → Run, Command). The workspace holds no key to
 * GitHub or to the stores: GitHub signs the person in and checks that they
 * may run the workflow, then checks the line word by word itself.
 *
 * Group, then task, then the action, if the task has several; then only
 * that command's fields; Check only or Do it for a command that changes
 * something. The line is the same the Run workflow and `make run` read
 * (line() and parse(), shared), so what is shown here is what will run.
 * The pane is in English, as the commands are.
 */
import { h } from '../core/dom.js';
import { COMMANDS, line, parse } from '#shared/commands.js';

/** @typedef {import('#shared/commands.js').Command} Command */
/** @typedef {import('#shared/commands.js').Values} Values */

const RUN_WORKFLOW = 'https://github.com/khensolomon/myordbok/actions/workflows/run.yml';
const GROUP_NAMES = /** @type {Record<string, string>} */ ({ google: 'Google Play', apple: 'App Store' });
const KEY = 'mo:tools';

/** A short name for the run, for finding it on GitHub. */
const runId = () => Math.random().toString(36).slice(2, 7);

/** @param {string} word */
const cap = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/** The last command chosen here, by its words (per device). */
function remembered() {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? 'null');
	} catch {
		return null;
	}
}

export function toolsPane() {
	const groups = [...new Set(COMMANDS.map((c) => c.words[0]))];
	const last = remembered();
	/** @type {Command} */
	let command = COMMANDS.find((c) => c.words.join(' ') === last) ?? COMMANDS[0];
	/** @type {Values} */
	let values = {};
	let apply = false;
	let run = runId();

	const choose = h('div', { class: 'tools-choose' });
	const fields = h('div', { class: 'tools-fields' });
	const modes = h('div', { class: 'tools-modes', role: 'radiogroup', 'aria-label': 'Run as' });
	const code = h('pre', { class: 'tools-line', 'aria-live': 'polite' });
	const problem = h('p', { class: 'tools-problem', role: 'alert' });
	const copy = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'tools-copy' }, 'Copy'));
	const copyGh = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'tools-copy-gh' }, 'Copy as gh'));
	const copied = h('span', { class: 'tools-copied', role: 'status' });

	/**
	 * A row of choices, one pressed.
	 * @param {string} label
	 * @param {string[]} options
	 * @param {string} current
	 * @param {(word: string) => string} name
	 * @param {(word: string) => void} pick
	 */
	const row = (label, options, current, name, pick) =>
		h(
			'div',
			{ class: 'tools-row' },
			h('span', { class: 'tools-label' }, label),
			h(
				'div',
				{ class: 'tools-chips', role: 'group', 'aria-label': label },
				options.map((o) => {
					const b = h('button', { type: 'button', class: 'tools-chip', 'aria-pressed': String(o === current) }, name(o));
					b.addEventListener('click', () => pick(o));
					return b;
				}),
			),
		);

	/** The first command whose words start so. @param {string[]} words */
	const first = (words) => /** @type {Command} */ (COMMANDS.find((c) => words.every((w, i) => c.words[i] === w)));

	const draw = () => {
		const [g, task, action] = command.words;
		const tasks = [...new Set(COMMANDS.filter((c) => c.words[0] === g).map((c) => c.words[1]))];
		const actions = COMMANDS.filter((c) => c.words[0] === g && c.words[1] === task && c.words.length > 2).map((c) => c.words[2]);
		choose.replaceChildren(
			row('Store', groups, g, (w) => GROUP_NAMES[w] ?? cap(w), (w) => select(first([w]))),
			row('Task', tasks, task, cap, (w) => select(first([g, w]))),
			...(actions.length ? [row(cap(task), actions, action, cap, (w) => select(first([g, task, w])))] : []),
			h('p', { class: 'tools-about' }, command.title),
		);
		fields.replaceChildren(...Object.entries(command.fields).map(([name, f]) => field(name, f)));
		modes.hidden = !command.changes;
		modes.replaceChildren(
			...[
				[false, 'Check only', 'Shows what would change; changes nothing'],
				[true, 'Do it', 'Makes the change'],
			].map(([on, title, about]) => {
				const b = h('button', { type: 'button', role: 'radio', class: 'tools-mode', 'aria-checked': String(apply === on) }, h('b', null, String(title)), h('span', null, String(about)));
				b.addEventListener('click', () => {
					apply = Boolean(on);
					draw();
				});
				return b;
			}),
		);
		show();
	};

	/** @param {Command} next */
	const select = (next) => {
		command = next;
		values = {};
		apply = false;
		run = runId();
		try {
			localStorage.setItem(KEY, JSON.stringify(next.words.join(' ')));
		} catch {
			// Not remembered on this device: the first command next time.
		}
		draw();
	};

	/**
	 * One field, as its description says.
	 * @param {string} name
	 * @param {import('#shared/commands.js').Field} f
	 */
	const field = (name, f) => {
		const id = `tools-${name}`;
		const value = values[name] ?? f.default ?? '';
		/** @type {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} */
		let input;
		if (f.choices) input = /** @type {HTMLSelectElement} */ (h('select', { id }, f.choices.map((c) => h('option', { value: c, selected: String(value) === c }, f.names?.[c] ?? c))));
		else if (f.type === 'text' && (f.max ?? 0) > 80) input = /** @type {HTMLTextAreaElement} */ (h('textarea', { id, rows: 2, maxlength: f.max }, String(value)));
		else
			input = /** @type {HTMLInputElement} */ (
				h('input', { id, type: f.type === 'text' ? 'text' : 'number', value: String(value), ...(f.min !== undefined ? { min: f.min } : {}), ...(f.max !== undefined ? { max: f.max } : {}), ...(f.type === 'int' ? { step: 1 } : {}), ...(f.type === 'text' && f.max ? { maxlength: f.max } : {}) })
			);
		input.addEventListener('input', () => {
			const raw = input.value;
			if (raw === '') delete values[name];
			else values[name] = f.type === 'int' || f.type === 'number' ? Number(raw) : raw;
			show();
		});
		return h('label', { class: 'tools-field', for: id }, h('span', null, f.label, f.required ? h('em', null, ' needed') : ''), input, f.help ? h('small', null, f.help) : '');
	};

	/** The line, checked as the Run workflow will check it. */
	const show = () => {
		const text = line(command, values, apply, run);
		code.textContent = text;
		try {
			const parsed = parse(text);
			problem.textContent = '';
			code.title = parsed.summary;
			copy.disabled = copyGh.disabled = false;
		} catch (err) {
			problem.textContent = err instanceof Error ? err.message : String(err);
			copy.disabled = copyGh.disabled = true;
		}
		copied.textContent = '';
	};

	/** @param {string} text @param {string} said */
	const toClipboard = async (text, said) => {
		try {
			await navigator.clipboard.writeText(text);
			copied.textContent = said;
		} catch {
			copied.textContent = 'Not copied: select the line and copy it';
		}
	};
	copy.addEventListener('click', () => toClipboard(code.textContent ?? '', `Copied (run ${run})`));
	copyGh.addEventListener('click', () => toClipboard(`gh workflow run run.yml -R khensolomon/myordbok -f command='${(code.textContent ?? '').replace(/'/g, `'\\''`)}'`, 'Copied as a gh command'));

	draw();
	return h(
		'main',
		{ class: 'ws-main ws-account ws-settings ws-tools', 'aria-label': 'Tools', lang: 'en' },
		h(
			'div',
			{ class: 'ws-work ws-settings-page tools-page' },
			h('header', { class: 'ws-settings-head' }, h('h1', null, 'Tools'), h('p', null, 'Builds the command; GitHub runs it, under your GitHub sign-in. This page holds no key to GitHub or the stores.')),
			h(
				'div',
				{ class: 'tools-grid' },
				h('section', { class: 'tools-card', 'aria-label': 'The command' }, choose, fields, modes),
				h(
					'section',
					{ class: 'tools-card tools-out', 'aria-label': 'The command line' },
					h('span', { class: 'tools-label' }, 'The command'),
					code,
					problem,
					h('div', { class: 'tools-actions' }, copy, h('a', { class: 'tools-open', href: RUN_WORKFLOW, target: '_blank', rel: 'noopener' }, 'Open GitHub ↗')),
					h('div', { class: 'tools-more' }, copyGh, copied),
					h(
						'ol',
						{ class: 'tools-steps' },
						h('li', null, 'Copy the command'),
						h('li', null, 'On GitHub: ', h('b', null, 'Run workflow'), ', paste it into ', h('b', null, 'Command'), ', run'),
						h('li', null, 'The run is titled by the command; its summary says what was done'),
					),
				),
			),
		),
	);
}
