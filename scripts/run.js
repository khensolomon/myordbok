#!/usr/bin/env node
// @ts-check
/**
 * Runs one of MyOrdbok's tool commands (shared/commands.js), as the Run
 * workflow does with the line pasted into its Command box, or by hand:
 *
 *   node scripts/run.js list                 every command, with its fields
 *   node scripts/run.js plan "<line>"        checks the line; says where it
 *                                            runs (written to GITHUB_OUTPUT
 *                                            in a workflow)
 *   node scripts/run.js "<line>"             runs it (commands that run on
 *                                            linux; a build goes through the
 *                                            App workflow)
 *
 * The line is checked word by word before anything starts; anything not in
 * the command's description stops it. The command's script gets only the
 * secrets the command names (and PATH, HOME): no other secret reaches it.
 * In a workflow, the run's title and its output go to the step summary.
 */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { COMMANDS, parse } from '../shared/commands.js';

/** @param {string} message @returns {never} */
function fail(message) {
	console.error(`run: ${message}`);
	summary(`### Stopped\n\n${message}`);
	process.exit(1);
}

/** @param {string} text */
function summary(text) {
	if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

/** @param {Record<string, string>} pairs */
function output(pairs) {
	if (!process.env.GITHUB_OUTPUT) return;
	for (const [k, v] of Object.entries(pairs)) {
		const mark = `EOF_${Math.random().toString(36).slice(2)}`;
		appendFileSync(process.env.GITHUB_OUTPUT, `${k}<<${mark}\n${v}\n${mark}\n`);
	}
}

const [first, second] = process.argv.slice(2);

if (first === 'list') {
	for (const c of COMMANDS) {
		const fields = Object.entries(c.fields).map(([n, f]) => `--${n} ${f.choices ? f.choices.join('|') : f.type}${f.default !== undefined ? ` (${f.default})` : ''}${f.required ? ' (needed)' : ''}`);
		console.log(`${c.words.join(' ')}${fields.length ? ` ${fields.join(' ')}` : ''}${c.changes ? ' [--apply]' : ''}\n    ${c.title}; on ${c.runs}${c.secrets.length ? `; secrets ${c.secrets.join(', ')}` : ''}`);
	}
	process.exit(0);
}

const planning = first === 'plan';
const text = planning ? second : first;
if (!text) fail('usage: node scripts/run.js list | plan "<command>" | "<command>"');

/** @type {import('../shared/commands.js').Parsed} */
let parsed;
try {
	parsed = parse(text);
} catch (err) {
	fail(err instanceof Error ? err.message : String(err));
}
const { command, values, apply, run } = parsed;

if (planning) {
	const build = command.build ? command.build(values, apply) : {};
	console.log(`${parsed.summary}\n  runs on ${command.runs}${command.secrets.length ? `, with ${command.secrets.join(', ')}` : ''}${run ? `\n  run ${run}` : ''}`);
	output({ runs: command.runs, secrets: command.secrets.join(','), summary: parsed.summary, run: run ?? '', build: JSON.stringify(build) });
	summary(`## ${parsed.summary}\n\n\`${text.replace(/`/g, "'")}\``);
	process.exit(0);
}

if (command.runs !== 'linux' || !command.argv) fail(`"${command.words.join(' ')}" is a build: it runs through the App workflow (the Run workflow starts it)`);
const missing = command.secrets.filter((s) => !process.env[s]);
if (missing.length) fail(`${missing.join(', ')} not set: the secrets "${command.words.join(' ')}" needs`);

/** @type {Record<string, string>} */
const env = { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' };
for (const s of command.secrets) env[s] = /** @type {string} */ (process.env[s]);

const argv = command.argv(values, apply);
console.log(`${parsed.summary}\n`);
let out = '';
const child = spawn(process.execPath, argv, { env, stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) {
	stream.on('data', (chunk) => {
		const s = chunk.toString();
		out += s;
		(stream === child.stdout ? process.stdout : process.stderr).write(s);
	});
}
child.on('close', (code) => {
	const tail = out.length > 60000 ? `…\n${out.slice(-60000)}` : out;
	summary(`### ${code === 0 ? 'Done' : `Failed (exit ${code})`}\n\n\`\`\`\n${tail.trim()}\n\`\`\``);
	process.exit(code ?? 1);
});
