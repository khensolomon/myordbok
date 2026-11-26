// The tool commands (shared/commands.js): the line checked word by word,
// the line the workspace builds read back the same, each command's run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, SECRETS, line, parse, split } from '../shared/commands.js';

test('commands: a line in words, quotes and escapes kept, #run read off', () => {
	assert.deepEqual(split('google release promote --notes "two words" --to production #run c7f3k'), { words: ['google', 'release', 'promote', '--notes', 'two words', '--to', 'production'], run: 'c7f3k' });
	assert.deepEqual(split(`x --notes 'it\\'s' --a ""`).words, ['x', '--notes', "it's", '--a', '']);
	assert.throws(() => split('x --notes "open'), /not closed/);
});

test('commands: checked against the list, defaults filled, nothing guessed', () => {
	const p = parse('google release promote --to production --rollout 20 --apply');
	assert.equal(p.command.words.join(' '), 'google release promote');
	assert.deepEqual(p.values, { from: 'alpha', to: 'production', rollout: 20 });
	assert.equal(p.apply, true);
	assert.equal(p.summary, 'Google · release ▸ promote closed testing → production, 20 %');
	assert.throws(() => parse('google release'), /Did you mean: google release promote \| google release rollout/);
	assert.throws(() => parse('google relase promote'), /not a command/);
	assert.throws(() => parse('google release promote --track production'), /has no --track/);
	assert.throws(() => parse('google release promote --to moon'), /not one of/);
	assert.throws(() => parse('google release promote --rollout 120'), /at most 100/);
	assert.throws(() => parse('google release promote --code 12.5'), /whole number/);
	assert.throws(() => parse('google release rollout --track production'), /--rollout is needed/);
	assert.throws(() => parse('google status --apply'), /changes nothing/);
	assert.throws(() => parse('google release promote --to production --to beta'), /twice/);
	assert.throws(() => parse('google release promote production'), /stands alone/);
	assert.throws(() => parse('google release promote --notes'), /no value/);
	assert.equal(parse('apple release').apply, false, 'without --apply: check only');
});

test('commands: the line the workspace builds reads back the same', () => {
	for (const c of COMMANDS) {
		/** @type {Record<string, string | number>} */
		const values = {};
		for (const [n, f] of Object.entries(c.fields)) values[n] = f.choices ? f.choices[f.choices.length - 1] : f.type === 'text' ? 'a "b" \\ c' : (f.max ?? 7);
		const built = line(c, values, true, 'ab12c');
		const back = parse(built);
		assert.equal(back.command, c, built);
		assert.equal(back.run, 'ab12c');
		assert.equal(back.apply, c.changes);
		for (const [n, v] of Object.entries(values)) assert.equal(back.values[n], v, `${built}: --${n}`);
	}
});

test('commands: each runs something, and names only secrets it is given', () => {
	for (const c of COMMANDS) {
		const p = parse(c.words.join(' ') + Object.entries(c.fields).filter(([, f]) => f.required).map(([n]) => ` --${n} 50`).join(''));
		if (c.runs === 'linux') assert.match(/** @type {any} */ (c).argv(p.values, true)[0], /^scripts\/[a-z-]+\.js$/, c.words.join(' '));
		else assert.ok(/** @type {any} */ (c).build(p.values, true).build, c.words.join(' '));
		for (const s of c.secrets) assert.ok(SECRETS.includes(s));
	}
	assert.equal(new Set(COMMANDS.map((c) => c.words.join(' '))).size, COMMANDS.length, 'no two commands alike');
});

test('commands: the Run workflow hands out every secret a command names, and only by name', async () => {
	const { readFile } = await import('node:fs/promises');
	const yml = await readFile(new URL('../.github/workflows/run.yml', import.meta.url), 'utf8');
	for (const s of SECRETS) assert.ok(yml.includes(`${s}: \${{ contains(format(',{0},', needs.plan.outputs.secrets), ',${s},') && secrets.${s} || '' }}`), s);
	assert.equal((yml.match(/secrets\.[A-Z_0-9]+/g) ?? []).length, SECRETS.length, 'no secret beyond those');
});
