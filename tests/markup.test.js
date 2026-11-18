import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glossesOf, itemOf, itemsOf, itemsProblem, itemsToLines, linesToItems, parseMarkup, plainText, splitItems } from '../shared/markup.js';

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

test('items: split on |, each trimmed; ; and , are punctuation', () => {
	assert.deepEqual(splitItems('<love/loved/loved> | She loves her <family>.'), ['<love/loved/loved>', 'She loves her <family>.']);
	assert.deepEqual(splitItems('Keep the box; it might come in useful.'), ['Keep the box; it might come in useful.']);
	assert.deepEqual(splitItems('(နေရာ၊ ယာဉ်ကို) စွန့်ခွာသည် | ပစ်ထားခဲ့သည်'), ['(နေရာ၊ ယာဉ်ကို) စွန့်ခွာသည်', 'ပစ်ထားခဲ့သည်']);
	assert.deepEqual(splitItems(null), []);
	assert.deepEqual(splitItems('~ချိုး | ~သောက်'), ['~ချိုး', '~သောက်']);
});

test('an item that is one bracket is a note; [xx:…] in an English headword’s sense is a language', () => {
	assert.deepEqual(itemOf('[figurative]'), { t: 'note', name: 'figurative', value: null });
	assert.deepEqual(itemOf('[Buddhist ecclesiastical law]'), { t: 'note', name: 'Buddhist ecclesiastical law', value: null });
	assert.deepEqual(itemOf('[Pali:ကာရိတ + ကြိယာ]'), { t: 'note', name: 'Pali', value: 'ကာရိတ + ကြိယာ' });
	assert.deepEqual(itemOf('[=:ရဲစခန်း]'), { t: 'note', name: '=', value: 'ရဲစခန်း' });
	assert.deepEqual(itemOf('[origin:back formation from သူဌေး]'), { t: 'note', name: 'origin', value: 'back formation from သူဌေး' });
	assert.deepEqual(itemOf('[en:to leave a place]', { languages: true }), { t: 'language', lang: 'en', text: 'to leave a place' });
	assert.deepEqual(itemOf('[en:to leave a place]'), { t: 'note', name: 'en', value: 'to leave a place' }, 'only where languages are expected');
	assert.deepEqual(itemOf('[type:informal] အလွန်နှစ်သက်သည်'), { t: 'text', text: '[type:informal] အလွန်နှစ်သက်သည်' }, 'a bracket inside a gloss is inline markup');
	assert.deepEqual(itemOf('[a] b [c]'), { t: 'text', text: '[a] b [c]' });
	const med = itemsOf('[grammar] | causative verb | [compare:သုဒ္ဓကြိယာ] | [Pali:ကာရိတ + ကြိယာ]');
	assert.deepEqual(med.map((i) => i.t), ['note', 'text', 'note', 'note']);
	assert.deepEqual(glossesOf('(နေရာ၊ ယာဉ်ကို) စွန့်ခွာသည် | ပစ်ထားခဲ့သည် | [en:to leave a place and not return to it]'), ['(နေရာ၊ ယာဉ်ကို) စွန့်ခွာသည်', 'ပစ်ထားခဲ့သည်']);
	assert.deepEqual(glossesOf('[obsolete] | [=:ရဲစခန်း] | [English:guard] | [Myanmar:တဲ]'), []);
});

test('editing: one item a line, and back', () => {
	assert.equal(itemsToLines('a | b | [en:c]'), 'a\nb\n[en:c]');
	assert.equal(linesToItems(' a \n\n b\r\n[en:c] '), 'a | b | [en:c]');
	assert.equal(linesToItems(itemsToLines('a | b')), 'a | b');
});

test('what the build would refuse in a field is said, before the release', () => {
	const sense = { field: /** @type {const} */ ('sense'), dict: /** @type {const} */ ('emd') };
	assert.equal(itemsProblem('ချစ်ခြင်း | ချစ်ခင်မှု | [en:love]', sense), null);
	assert.match(itemsProblem('ချစ်ခြင်း; ချစ်ခင်မှု', sense) ?? '', /not by ";"/);
	assert.equal(itemsProblem('(a; b) ချစ်သည်', sense), null, 'inside brackets ; is punctuation');
	assert.match(itemsProblem('a |b', sense) ?? '', /one space each side/);
	assert.match(itemsProblem('a |  | b', sense) ?? '', /nothing empty/);
	assert.match(itemsProblem('[type:informal ချစ်', sense) ?? '', /in pairs/);
	assert.match(itemsProblem('[a [b]]', sense) ?? '', /never inside each other/);
	assert.match(itemsProblem('[en:love] | ချစ်ခြင်း', sense) ?? '', /comes after the meanings/);
	assert.match(itemsProblem('[en:love]', sense) ?? '', /before its explanation/);
	assert.match(itemsProblem('a | [en:x] | [en:y]', sense) ?? '', /One explanation per language/);
	assert.equal(itemsProblem('Keep the box; it might come in useful. | It rained.', { field: 'exam', dict: 'emd' }), null, 'an English example may join two clauses');
	assert.match(itemsProblem('~ချိုး; ~သောက်', { field: 'exam', dict: 'med' }) ?? '', /Examples are separated/);
	assert.equal(itemsProblem('[obsolete] | [=:ရဲစခန်း] | [English:guard]', { field: 'sense', dict: 'med' }), null);
});
