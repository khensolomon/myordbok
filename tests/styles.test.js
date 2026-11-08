import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const DIR = join(import.meta.dirname, '..', 'app', 'styles');

/**
 * A stray brace makes browsers drop the rules after it without a word, so
 * every stylesheet must open and close its blocks in pairs.
 */
test('every stylesheet has balanced braces', () => {
	for (const name of readdirSync(DIR).filter((f) => f.endsWith('.css'))) {
		const css = readFileSync(join(DIR, name), 'utf8')
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
		let depth = 0;
		css.split('\n').forEach((line, i) => {
			for (const c of line) {
				if (c === '{') depth++;
				if (c === '}') depth--;
				assert.ok(depth >= 0, `${name}:${i + 1}: a } without its {`);
			}
		});
		assert.equal(depth, 0, `${name}: ${depth} block(s) not closed`);
	}
});
