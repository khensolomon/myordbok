// @ts-check
/**
 * The commands MyOrdbok's tools run, described once: the workspace builds
 * its forms and the command line from this list (Tools), the Run workflow
 * and `make run` check a command line against it (scripts/run.js), and each
 * command says where it runs and which secrets it gets. A new tool is a new
 * entry here; nothing else has to learn it.
 *
 * A command line is words, then fields, then at most --apply:
 *
 *   google release promote --from alpha --to production --rollout 20 --notes "…" --apply
 *
 * Words name the command (group, task, action). A field is --name value,
 * a value with spaces in quotes ("…" or '…', a backslash escaping the next
 * character). A trailing "#run <id>" names the run for the workspace.
 * Anything not in the command's description stops the line, with what
 * would have been understood: nothing runs on a guess.
 *
 * Each command:
 *   words     the words that name it
 *   title     what it does, for forms and lists
 *   runs      linux (a script on GitHub's Ubuntu), build (the App workflow,
 *             on the machines a build needs)
 *   secrets   the only secrets its run is given
 *   changes   true: without --apply it only shows what would change
 *   fields    name → { type: choice | int | number | text, choices?, names?
 *             (a choice as forms show it), min?, max?, default?, required?,
 *             label, help? }
 *   argv      (fields, apply) → the script and its arguments (runs: linux)
 *   build     (fields, apply) → the App workflow's inputs (runs: build)
 *   summary   (fields, apply) → the run's title
 */

/**
 * @typedef {'choice' | 'int' | 'number' | 'text'} FieldType
 * @typedef {{ type: FieldType, label: string, help?: string, choices?: readonly string[], names?: Readonly<Record<string, string>>, min?: number, max?: number, default?: string | number, required?: boolean }} Field
 * @typedef {Record<string, string | number>} Values
 * @typedef {object} Command
 * @property {readonly string[]} words
 * @property {string} title
 * @property {'linux' | 'build'} runs
 * @property {readonly string[]} secrets
 * @property {boolean} changes
 * @property {Readonly<Record<string, Field>>} fields
 * @property {(v: Values, apply: boolean) => string[]} [argv]
 * @property {(v: Values, apply: boolean) => Record<string, string | boolean>} [build]
 * @property {(v: Values, apply: boolean) => string} summary
 */

const PLAY = ['GOOGLE_PLAY_ACCOUNT'];
const APPLE = ['APPLE_API_ISSUER', 'APPLE_API_KEY', 'APPLE_API_KEY_P8'];
const TRACKS = /** @type {const} */ (['alpha', 'internal', 'beta', 'production']);
const TRACK_NAMES = /** @type {Record<string, string>} */ ({ alpha: 'closed testing', internal: 'internal', beta: 'open testing', production: 'production' });
/** The tracks as a form shows them: Play's word, then its name in the Console. */
const TRACK_LABELS = Object.freeze({ alpha: 'alpha · closed testing', internal: 'internal testing', beta: 'beta · open testing', production: 'production' });
const SERVERS = /** @type {const} */ (['live', 'beta']);

/** @param {boolean} apply */
const mode = (apply) => (apply ? '' : ' (check only)');
/** @param {Values} v */
const share = (v) => (Number(v.rollout ?? 100) < 100 ? `, ${v.rollout} %` : '');

/** @type {readonly Command[]} */
export const COMMANDS = Object.freeze([
	// Google Play
	{
		words: ['google', 'status'],
		title: 'What every Play track holds',
		runs: 'linux',
		secrets: PLAY,
		changes: false,
		fields: {},
		argv: () => ['scripts/play-release.js', 'status'],
		summary: () => 'Google · status',
	},
	{
		words: ['google', 'build', 'apk'],
		title: 'A test APK to install on a phone',
		runs: 'build',
		secrets: [],
		changes: false,
		fields: { server: { type: 'choice', choices: SERVERS, default: 'live', label: 'Server it asks' } },
		build: (v) => ({ build: 'test-apk', server: String(v.server) }),
		summary: (v) => `Google · build ▸ test APK (${v.server})`,
	},
	{
		words: ['google', 'build', 'bundle'],
		title: 'The Play bundle, onto a track',
		runs: 'build',
		secrets: [],
		changes: true,
		fields: {
			track: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'alpha', label: 'Track' },
			rollout: { type: 'number', min: 1, max: 100, default: 100, label: 'Rollout, % of users', help: 'Below 100: offered to that share first' },
			notes: { type: 'text', max: 500, label: 'Release notes', help: 'Empty: "MyOrdbok <version>"' },
		},
		build: (v, apply) => ({ build: 'play-aab', server: 'live', track: String(v.track), rollout: String(v.rollout), notes: String(v.notes ?? ''), upload: apply }),
		summary: (v, apply) => `Google · build ▸ bundle to ${TRACK_NAMES[String(v.track)]}${share(v)}${apply ? '' : ' (built, not sent)'}`,
	},
	{
		words: ['google', 'release', 'promote'],
		title: 'A tested release onto another track',
		runs: 'linux',
		secrets: PLAY,
		changes: true,
		fields: {
			from: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'alpha', label: 'From' },
			to: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'production', label: 'To' },
			code: { type: 'int', min: 1, label: 'Version code', help: 'Empty: the newest on "From"' },
			rollout: { type: 'number', min: 1, max: 100, default: 100, label: 'Rollout, % of users' },
			notes: { type: 'text', max: 500, label: 'Release notes', help: 'Empty: the release keeps its own' },
		},
		argv: (v, apply) => ['scripts/play-release.js', 'promote', '--from', String(v.from), '--to', String(v.to), ...(v.code ? ['--code', String(v.code)] : []), '--rollout', String(v.rollout), ...(v.notes ? ['--notes', String(v.notes)] : []), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Google · release ▸ promote ${TRACK_NAMES[String(v.from)]} → ${TRACK_NAMES[String(v.to)]}${v.code ? ` (${v.code})` : ''}${share(v)}${mode(apply)}`,
	},
	{
		words: ['google', 'release', 'rollout'],
		title: 'Widen a staged rollout (100 completes it)',
		runs: 'linux',
		secrets: PLAY,
		changes: true,
		fields: {
			track: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'production', label: 'Track' },
			rollout: { type: 'number', min: 1, max: 100, required: true, label: 'Rollout, % of users' },
		},
		argv: (v, apply) => ['scripts/play-release.js', 'rollout', '--track', String(v.track), '--rollout', String(v.rollout), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Google · release ▸ rollout on ${TRACK_NAMES[String(v.track)]} to ${v.rollout} %${mode(apply)}`,
	},
	{
		words: ['google', 'release', 'halt'],
		title: 'Stop a staged rollout where it is',
		runs: 'linux',
		secrets: PLAY,
		changes: true,
		fields: { track: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'production', label: 'Track' } },
		argv: (v, apply) => ['scripts/play-release.js', 'halt', '--track', String(v.track), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Google · release ▸ halt on ${TRACK_NAMES[String(v.track)]}${mode(apply)}`,
	},
	{
		words: ['google', 'release', 'resume'],
		title: 'Resume a halted rollout',
		runs: 'linux',
		secrets: PLAY,
		changes: true,
		fields: { track: { type: 'choice', choices: TRACKS, names: TRACK_LABELS, default: 'production', label: 'Track' } },
		argv: (v, apply) => ['scripts/play-release.js', 'resume', '--track', String(v.track), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Google · release ▸ resume on ${TRACK_NAMES[String(v.track)]}${mode(apply)}`,
	},
	{
		words: ['google', 'listing'],
		title: 'The store listing from store/play/',
		runs: 'linux',
		secrets: PLAY,
		changes: true,
		fields: {
			part: { type: 'choice', choices: ['all', 'texts', 'screenshots', 'icon', 'feature'], default: 'all', label: 'What to send' },
			language: { type: 'text', max: 10, default: 'all', label: 'Language', help: 'all, or a code such as en-US' },
		},
		argv: (v, apply) => ['scripts/play-listing.js', '--only', String(v.part), '--language', String(v.language), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Google · listing ▸ ${v.part}${v.language !== 'all' ? ` (${v.language})` : ''}${mode(apply)}`,
	},
	// App Store
	{
		words: ['apple', 'status'],
		title: 'Versions, builds and in-app purchases',
		runs: 'linux',
		secrets: APPLE,
		changes: false,
		fields: {},
		argv: () => ['scripts/app-store.js', 'status'],
		summary: () => 'Apple · status',
	},
	{
		words: ['apple', 'build', 'testflight'],
		title: 'The iOS app, to TestFlight',
		runs: 'build',
		secrets: [],
		changes: false,
		fields: { server: { type: 'choice', choices: SERVERS, default: 'live', label: 'Server it asks' } },
		build: (v) => ({ build: 'ios-testflight', server: String(v.server) }),
		summary: (v) => `Apple · build ▸ TestFlight (${v.server})`,
	},
	{
		words: ['apple', 'listing'],
		title: 'The version being prepared, from store/app-store/',
		runs: 'linux',
		secrets: APPLE,
		changes: true,
		fields: { part: { type: 'choice', choices: ['all', 'texts', 'screenshots'], default: 'all', label: 'What to send' } },
		argv: (v, apply) => ['scripts/app-store.js', 'listing', '--only', String(v.part), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Apple · listing ▸ ${v.part}${mode(apply)}`,
	},
	{
		words: ['apple', 'review', 'build'],
		title: 'Choose the build for the version being prepared',
		runs: 'linux',
		secrets: APPLE,
		changes: true,
		fields: { build: { type: 'int', min: 1, label: 'Build number', help: 'Empty: the newest processed' } },
		argv: (v, apply) => ['scripts/app-store.js', 'build', ...(v.build ? ['--build', String(v.build)] : []), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Apple · review ▸ choose build ${v.build || 'newest'}${mode(apply)}`,
	},
	{
		words: ['apple', 'review', 'submit'],
		title: 'Send the version for review',
		runs: 'linux',
		secrets: APPLE,
		changes: true,
		fields: { release: { type: 'choice', choices: ['manual', 'after-approval'], default: 'manual', label: 'Once approved', help: 'manual: you release it' } },
		argv: (v, apply) => ['scripts/app-store.js', 'submit', '--release', String(v.release), ...(apply ? ['--apply'] : [])],
		summary: (v, apply) => `Apple · review ▸ submit, released ${v.release === 'manual' ? 'by hand' : 'when approved'}${mode(apply)}`,
	},
	{
		words: ['apple', 'release'],
		title: 'Release the approved version',
		runs: 'linux',
		secrets: APPLE,
		changes: true,
		fields: {},
		argv: (_v, apply) => ['scripts/app-store.js', 'release', ...(apply ? ['--apply'] : [])],
		summary: (_v, apply) => `Apple · release ▸ the approved version${mode(apply)}`,
	},
]);

/** Every secret any command may be given: the Run workflow hands each run only its own. */
export const SECRETS = Object.freeze([...new Set(COMMANDS.flatMap((c) => c.secrets))].sort());

/**
 * @typedef {object} Parsed
 * @property {Command} command
 * @property {Values} values  Every field, defaults filled in.
 * @property {boolean} apply
 * @property {string | null} run  The workspace's name for the run (#run …).
 * @property {string} summary
 */

/**
 * A command line in words: quotes keep spaces, a backslash escapes.
 * @param {string} line
 * @returns {{ words: string[], run: string | null }}
 */
export function split(line) {
	/** @type {string[]} */
	const words = [];
	let run = null;
	const text = line.replace(/\s+#run\s+([a-z0-9]{3,12})\s*$/i, (_m, id) => {
		run = id.toLowerCase();
		return '';
	});
	let word = '';
	let quote = '';
	let started = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '\\' && i + 1 < text.length) {
			word += text[++i];
			started = true;
		} else if (quote) {
			if (c === quote) quote = '';
			else word += c;
		} else if (c === '"' || c === "'") {
			quote = c;
			started = true;
		} else if (/\s/.test(c)) {
			if (started) words.push(word);
			word = '';
			started = false;
		} else {
			word += c;
			started = true;
		}
	}
	if (quote) throw new Error(`A quote (${quote}) is not closed`);
	if (started) words.push(word);
	return { words, run };
}

/**
 * Checks a command line against the list: the command, then each field.
 * Throws a message saying what was expected; never guesses.
 * @param {string} line
 * @returns {Parsed}
 */
export function parse(line) {
	if (line.length > 2000) throw new Error('The command is longer than 2000 characters');
	const { words, run } = split(line.trim());
	const plain = words.findIndex((w) => w.startsWith('--'));
	const named = plain === -1 ? words : words.slice(0, plain);
	const command = COMMANDS.find((c) => c.words.length === named.length && c.words.every((w, i) => w === named[i]));
	if (!command) {
		const shorter = COMMANDS.find((c) => c.words.length < named.length && c.words.every((w, i) => w === named[i]));
		if (shorter) throw new Error(`"${named[shorter.words.length]}" stands alone after "${shorter.words.join(' ')}": fields are --name value`);
		const known = COMMANDS.filter((c) => named.every((w, i) => c.words[i] === w)).map((c) => c.words.join(' '));
		const next = named.length ? `"${named.join(' ')}" is not a command.` : 'No command given.';
		throw new Error(`${next} ${known.length ? `Did you mean: ${known.join(' | ')}` : `Commands: ${COMMANDS.map((c) => c.words.join(' ')).join(' | ')}`}`);
	}
	const rest = plain === -1 ? [] : words.slice(plain);
	/** @type {Values} */
	const values = {};
	let apply = false;
	for (let i = 0; i < rest.length; i++) {
		const flag = rest[i];
		if (!flag.startsWith('--')) throw new Error(`"${flag}" stands alone: fields are --name value`);
		const name = flag.slice(2);
		if (name === 'apply') {
			if (!command.changes) throw new Error(`"${command.words.join(' ')}" changes nothing: --apply has no place in it`);
			apply = true;
			continue;
		}
		const field = command.fields[name];
		if (!field) throw new Error(`"${command.words.join(' ')}" has no --${name}. Its fields: ${Object.keys(command.fields).map((f) => `--${f}`).join(', ') || 'none'}${command.changes ? ', --apply' : ''}`);
		if (name in values) throw new Error(`--${name} is given twice`);
		if (i + 1 >= rest.length) throw new Error(`--${name} has no value`);
		values[name] = check(name, field, rest[++i]);
	}
	for (const [name, field] of Object.entries(command.fields)) {
		if (name in values) continue;
		if (field.required) throw new Error(`--${name} is needed: ${field.label}`);
		if (field.default !== undefined) values[name] = field.default;
	}
	return { command, values, apply, run, summary: command.summary(values, apply) };
}

/**
 * One field's value, as its description allows.
 * @param {string} name
 * @param {Field} field
 * @param {string} raw
 * @returns {string | number}
 */
function check(name, field, raw) {
	if (field.type === 'choice') {
		if (!field.choices?.includes(raw)) throw new Error(`--${name} "${raw}" is not one of ${field.choices?.join(', ')}`);
		return raw;
	}
	if (field.type === 'int' || field.type === 'number') {
		const n = Number(raw);
		if (raw === '' || !Number.isFinite(n) || (field.type === 'int' && !Number.isInteger(n))) throw new Error(`--${name} "${raw}" is not a ${field.type === 'int' ? 'whole number' : 'number'}`);
		if (field.min !== undefined && n < field.min) throw new Error(`--${name} is at least ${field.min}`);
		if (field.max !== undefined && n > field.max) throw new Error(`--${name} is at most ${field.max}`);
		return n;
	}
	if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw)) throw new Error(`--${name} holds control characters`);
	if (field.max !== undefined && raw.length > field.max) throw new Error(`--${name} is longer than ${field.max} characters`);
	return raw;
}

/**
 * The command line for a command and its values, as the workspace builds
 * it: only fields that differ from their defaults, quoted when needed.
 * @param {Command} command
 * @param {Values} values
 * @param {boolean} apply
 * @param {string} [run]
 */
export function line(command, values, apply, run) {
	const quote = (/** @type {string} */ s) => (/^[\w.,:/@%+=-]+$/.test(s) ? s : `"${s.replace(/["\\]/g, (c) => `\\${c}`)}"`);
	const parts = [...command.words];
	for (const [name, field] of Object.entries(command.fields)) {
		const v = values[name];
		if (v === undefined || v === '' || String(v) === String(field.default ?? '')) continue;
		parts.push(`--${name}`, quote(String(v)));
	}
	if (apply && command.changes) parts.push('--apply');
	if (run) parts.push(`#run ${run}`);
	return parts.join(' ');
}
