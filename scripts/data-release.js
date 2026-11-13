// @ts-check
/**
 * One dictionary release, from the workspace's approved edits to beta:
 *
 *   1. checks   the dataset checkout is on its branch, clean and up to date
 *   2. edits    approved workspace edits → the dataset scripts' input files
 *               (scripts/data.js prepareExport), checked against what
 *               live readers see; conflicts are listed
 *   3. dry run  each file through its dataset script without --apply
 *   ── a dry run (no --apply) stops here ──
 *   4. apply    each file through its script with --apply, then a CHANGELOG
 *               entry in the dataset's own style
 *   5. build    scripts/db_build.py --apply, with its search checks
 *   6. review   the dataset's diff, and one question: commit, push, publish?
 *   7. commit   in the dataset (and push); the edits become exported; the
 *               build is made again, so it names the commit as its source
 *   8. beta     the build's offline packs, then the build, to beta
 *               (scripts/data.js releaseBeta); its edits become merged
 *
 * Then, after a look at beta: make data-live APPLY=1, as before.
 *
 * The dataset changes only through its own scripts, as its Readme says; this
 * file runs them in order and adds nothing of its own but the CHANGELOG
 * entry. Each step stops the release on failure, and until the answer to
 * the question in step 6 the dataset is put back as it was and no edit is
 * marked. Every step also runs on its own (make edits-export, the dataset
 * scripts, make data-beta).
 *
 *   node scripts/data-release.js --dataset ../lai/myordbok [--apply] [--local]
 *   make data-release [DATASET=../lai/myordbok] [APPLY=1]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { EXPORT_SCRIPTS, prepareExport, recordExport, releaseBeta, wranglerRunner, writeExport } from './data.js';

/** @typedef {import('./data.js').Runner} Runner */
/** @typedef {import('./data.js').ExportPlan} ExportPlan */

/** The dataset's branch: releases are built from it alone. */
export const DATASET_BRANCH = 'dataset';
/** Lines of the dataset's diff shown before the question; all of it is in git. */
const DIFF_LINES = 120;
/** Headwords named in the CHANGELOG entry; the rest are counted. */
const WORDS_NAMED = 12;

/**
 * @typedef {(cmd: string, args: string[], cwd: string) => string} Run
 *   Runs a program; returns its output, throws with it when it fails.
 * @typedef {(question: string) => Promise<boolean>} Confirm
 */

/** @type {Run} */
function run(cmd, args, cwd) {
	try {
		return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
	} catch (err) {
		const e = /** @type {{ stdout?: string, stderr?: string, status?: number }} */ (err);
		const said = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
		throw new Error(`${cmd} ${args.join(' ')} failed${e.status ? ` (exit ${e.status})` : ''}${said ? `:\n${said}` : ''}`);
	}
}

/** @type {Confirm} */
async function confirm(question) {
	if (!process.stdin.isTTY) throw new Error('The release asks before it commits; run it in a terminal.');
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
	} finally {
		rl.close();
	}
}

/**
 * The dataset checkout: its folder holds the scripts, it is on the dataset
 * branch, nothing is uncommitted, and it is not behind its remote.
 * @param {string} dataset  The myordbok folder of the dataset checkout.
 * @param {Run} sh
 * @param {boolean} fetch  Ask the remote first (off in tests).
 */
export function checkDataset(dataset, sh, fetch = true) {
	if (!existsSync(join(dataset, 'scripts', 'db_build.py'))) throw new Error(`${dataset} is not the dataset's myordbok folder (no scripts/db_build.py)`);
	const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], dataset).trim();
	if (branch !== DATASET_BRANCH) throw new Error(`The dataset is on branch ${branch}; releases are built from ${DATASET_BRANCH}.`);
	const dirty = sh('git', ['status', '--porcelain', '--', '.'], dataset).trim();
	if (dirty) throw new Error(`The dataset has uncommitted changes; commit or put them aside first:\n${dirty}`);
	if (fetch) {
		sh('git', ['fetch', '--quiet', 'origin', DATASET_BRANCH], dataset);
		const behind = Number(sh('git', ['rev-list', '--count', `HEAD..origin/${DATASET_BRANCH}`], dataset).trim());
		if (behind) throw new Error(`The dataset is ${behind} commit(s) behind origin/${DATASET_BRANCH}; git pull first.`);
	}
}

/**
 * What the edits do, counted for the CHANGELOG and the commit.
 * @param {ExportPlan} plan
 */
export function summary(plan) {
	let changed = 0;
	let deleted = 0;
	let added = 0;
	for (const [name, f] of Object.entries(plan.files)) {
		if (name.endsWith('_patch.tsv')) {
			const field = f.header.indexOf('field');
			for (const r of f.rows) r[field] === 'delete' ? deleted++ : changed++;
		} else added += f.rows.length;
	}
	return { changed, added, deleted };
}

/**
 * The headwords the edits touch, as written in the files (patch lines carry
 * no word; the edits do).
 * @param {Array<{ word: string, id: number }>} edits
 * @param {ExportPlan} plan
 */
function wordsOf(edits, plan) {
	const done = new Set(plan.exported);
	return [...new Set(edits.filter((e) => done.has(e.id)).map((e) => e.word))];
}

/**
 * The CHANGELOG entry, in the dataset's style: a dated heading and a bullet.
 * @param {string} day  YYYY-MM-DD
 * @param {number} exportId
 * @param {ReturnType<typeof summary>} n
 * @param {string[]} words
 */
export function changelogEntry(day, exportId, n, words) {
	const parts = [n.changed && `${n.changed} sense edit${n.changed === 1 ? '' : 's'}`, n.added && `${n.added} sense${n.added === 1 ? '' : 's'} added`, n.deleted && `${n.deleted} sense${n.deleted === 1 ? '' : 's'} removed`].filter(Boolean);
	const named = words.slice(0, WORDS_NAMED).map((w) => `\`${w}\``).join(', ');
	const more = words.length > WORDS_NAMED ? ` and ${words.length - WORDS_NAMED} more` : '';
	return `## ${day} (workspace edits, export ${String(exportId).padStart(4, '0')})\n- Approved in the MyOrdbok workspace: ${parts.join(', ')}; ${named}${more}.\n`;
}

/**
 * Puts an entry at the top of the CHANGELOG, under its title.
 * @param {string} text  The file.
 * @param {string} entry
 */
export function withEntry(text, entry) {
	const eol = text.includes('\r\n') ? '\r\n' : '\n';
	const at = text.search(/^## /m);
	const body = entry.replace(/\n/g, eol);
	if (at < 0) return `${text.trimEnd()}${eol}${eol}${body}`;
	return `${text.slice(0, at)}${body}${eol}${text.slice(at)}`;
}

/**
 * @param {{
 *   db: Runner,
 *   dataset: string,
 *   apply: boolean,
 *   log: (line: string) => void,
 *   sh?: Run,
 *   ask?: Confirm,
 *   fetch?: boolean,
 *   push?: boolean,
 *   beta?: (file: string) => Promise<void>,
 *   today?: string,
 * }} o
 */
export async function release(o) {
	const sh = o.sh ?? run;
	const ask = o.ask ?? confirm;
	const dataset = resolve(o.dataset);
	const log = o.log;
	const python = (/** @type {string[]} */ args) => sh('python3', args, dataset);

	log('1. The dataset');
	checkDataset(dataset, sh, o.fetch ?? true);
	const head = sh('git', ['rev-parse', '--short', 'HEAD'], dataset).trim();
	log(`   ${dataset}, ${DATASET_BRANCH} at ${head}, clean.`);

	log('2. Approved edits');
	const { built, edits, plan } = prepareExport(o.db);
	const n = summary(plan);
	if (!edits.length) log(`   None. The release builds the dataset as it is.`);
	else {
		for (const [name, f] of Object.entries(plan.files)) log(`   ${name}: ${f.rows.length} line(s)`);
		for (const c of plan.conflicts) log(`   conflict, left in the workspace: edit ${c.id}: ${c.reason}`);
		log(`   Checked against ${built}, what live readers see.`);
	}

	const tmp = mkdtempSync(join(tmpdir(), 'myordbok-release-'));
	/** Puts the dataset back as it was: until the question, nothing is kept. */
	const restore = () => {
		sh('git', ['checkout', '--', '.'], dataset);
		sh('git', ['clean', '-fdq', '--', '.'], dataset);
	};
	let changed = false;
	try {
		const files = await writeExport(plan, tmp);
		const scripts = files.map((name) => ({ name, cmd: [...EXPORT_SCRIPTS[/** @type {keyof typeof EXPORT_SCRIPTS} */ (name)], join(tmp, name)] }));

		log('3. Dry run of the dataset scripts');
		for (const s of scripts) {
			python(s.cmd);
			log(`   ${s.cmd.slice(0, -1).join(' ')} ${s.name}: passes`);
		}
		if (!scripts.length) log('   Nothing to run.');
		if (!o.apply) {
			log('Dry run: nothing changed. Add --apply (make data-release APPLY=1) to apply, build, review and publish to beta.');
			return;
		}

		log('4. Applying');
		changed = true;
		for (const s of scripts) {
			python([...s.cmd, '--apply']);
			log(`   ${s.cmd.slice(0, -1).join(' ')} ${s.name}: applied`);
		}

		log('5. Build and search checks');
		const out = python(['scripts/db_build.py', '--apply']);
		const tail = out.trim().split('\n').slice(-3);
		for (const line of tail) log(`   ${line}`);
		const build = join(dataset, 'build', 'myordbok.sql');
		if (!existsSync(build)) throw new Error(`db_build.py finished without ${build}`);

		log('6. Review');
		const stat = sh('git', ['diff', '--stat', '--', '.'], dataset).trim();
		if (!stat && !edits.length) {
			log('   The dataset is unchanged since its last commit; the build is the same data.');
		} else {
			log(stat.split('\n').map((l) => `   ${l}`).join('\n'));
			const diff = sh('git', ['diff', '--no-color', '-U0', '--', '.'], dataset).split('\n');
			log(diff.slice(0, DIFF_LINES).join('\n'));
			if (diff.length > DIFF_LINES) log(`   … ${diff.length - DIFF_LINES} more lines: git -C ${dataset} diff`);
		}
		const pushing = o.push ?? true;
		const question = stat || edits.length ? `Commit to the dataset${pushing ? ', push' : ''} and publish to beta?` : 'Publish this build to beta?';
		if (!(await ask(question))) {
			restore();
			changed = false;
			log('Stopped: the dataset is as it was, and no edit is marked.');
			return;
		}

		if (stat || edits.length) {
			log('7. Commit');
			await recordExport(o.db, plan, (exportId) => {
				if (!edits.length) return;
				const day = o.today ?? new Date().toISOString().slice(0, 10);
				const log_ = join(dataset, 'CHANGELOG.md');
				if (plan.exported.length) writeFileSync(log_, withEntry(readFileSync(log_, 'utf8'), changelogEntry(day, exportId, n, wordsOf(edits, plan))));
				const what = plan.exported.length ? `Workspace edits, export ${String(exportId).padStart(4, '0')}: ${[n.changed && `${n.changed} changed`, n.added && `${n.added} added`, n.deleted && `${n.deleted} removed`].filter(Boolean).join(', ')}` : 'Workspace edits: conflicts only';
				sh('git', ['add', '--all', '--', '.'], dataset);
				if (!sh('git', ['diff', '--cached', '--name-only', '--', '.'], dataset).trim()) return;
				sh('git', ['commit', '--quiet', '-m', what], dataset);
				log(`   ${what}`);
				if (pushing) {
					sh('git', ['push', '--quiet', 'origin', DATASET_BRANCH], dataset);
					log(`   pushed to origin/${DATASET_BRANCH}`);
				}
			});
			changed = false;
			if (plan.conflicts.length) log(`   ${plan.conflicts.length} conflict(s) marked in the workspace, with the reason.`);
			// The build names its source commit; built before the commit it says "-modified".
			python(['scripts/db_build.py', '--apply']);
			log(`   rebuilt from ${sh('git', ['rev-parse', '--short', 'HEAD'], dataset).trim()}`);
		}

		log('8. Beta');
		await (o.beta ? o.beta(build) : releaseBeta(o.db, build, true, (line) => log(`   ${line}`)));
	} catch (err) {
		if (changed) {
			restore();
			log('Stopped: the dataset is put back as it was, and no edit is marked.');
		}
		throw err;
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

/**
 * @param {string[]} args
 * @param {string} name
 */
function option(args, name) {
	const i = args.indexOf(name);
	return i >= 0 ? args[i + 1] : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const args = process.argv.slice(2);
	const dataset = option(args, '--dataset');
	const local = args.includes('--local');
	(async () => {
		if (!dataset) throw new Error('Give --dataset PATH, the dataset checkout’s myordbok folder (make data-release DATASET=../lai/myordbok)');
		const db = wranglerRunner({ local });
		await release({ db, dataset, apply: args.includes('--apply'), log: (line) => console.log(line), beta: local ? (file) => releaseBeta(db, file, true, (l) => console.log(`   ${l}`), { local }) : undefined });
	})().catch((err) => {
		console.error(`release: ${err instanceof Error ? err.message : err}`);
		process.exit(1);
	});
}
