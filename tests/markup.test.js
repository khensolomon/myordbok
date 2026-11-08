import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMarkup, plainText, splitExamples } from '../shared/markup.js';

test('links, with / separating several words', () => {
	assert.deepEqual(parseMarkup('pl of <tooth>'), [{ t: 'text', v: 'pl of ' }, { t: 'link', words: ['tooth'] }]);
	assert.deepEqual(parseMarkup('<go/went/gone>')[0], { t: 'link', words: ['go', 'went', 'gone'] });
});

test('labels: valued, linked and bare', () => {
	const [informal, , us, , brit] = parseMarkup('[type:informal] [US:color] [brit] အရောင်');
	assert.deepEqual(informal, { t: 'label', name: 'type', value: [{ t: 'text', v: 'informal' }], words: [] });
	assert.deepEqual(us, { t: 'label', name: 'US', value: null, words: ['color'] });
	assert.deepEqual(brit, { t: 'label', name: 'brit', value: null, words: [] });
	assert.equal(plainText(parseMarkup('[eg:freedom/boredom]')), '[e.g. freedom, boredom]');
});

test('patterns and highlights; ~ stands for the headword', () => {
	assert.equal(plainText(parseMarkup('(~ sth <in/into> sb) ချစ်သည်'), 'love'), '(love sth in/into sb) ချစ်သည်');
	assert.equal(plainText(parseMarkup('I (-love-) it'), 'love'), 'I love it');
	assert.equal(parseMarkup('I (-love-) it')[1].t, 'mark');
	assert.equal(plainText(parseMarkup('~ချိုး'), 'ရေ'), 'ရေချိုး');
});

test('text that only looks like markup stays text', () => {
	for (const s of ['ခေတ်မီ [သော]', 'The set {1, 2} is a subset.', 'x + 2 > 5', 'a < b']) {
		assert.equal(plainText(parseMarkup(s)), s);
	}
});

test('examples split on ; outside brackets', () => {
	assert.deepEqual(splitExamples('<love/loved/loved>; She loves her <family>.'), ['<love/loved/loved>', 'She loves her <family>.']);
	assert.deepEqual(splitExamples('(a; b) c; d'), ['(a; b) c', 'd']);
	assert.deepEqual(splitExamples('~ချိုး; ~သောက်'), ['~ချိုး', '~သောက်']);
});
