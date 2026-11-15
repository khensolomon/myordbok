import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, mapGlyphs } from '../scripts/legacy-font.js';

// Lines taken from the 2013 MLC grammar, as extracted, with the page text they render.
const lines = [
	['®mn\\maqd»å', 'မြန်မာသဒ္ဒါ'],
	['1" na;®Pc\\. Âka;qmYkiu AqM hu eKÅqv\\"', '၁။ နားဖြင့် ကြားသမျှကို အသံ ဟု ခေါ်သည်။'],
	['Amxt\\qekçtm¥a;kiu', 'အမှတ်သင်္ကေတများကို'],
	['ek¥ac\\;qa;tiuÏqv\\', 'ကျောင်းသားတို့သည်'],
	['elKÁn\\qM', 'လေချွန်သံ'],
	['qN~i™an\\', 'သန္နိဋ္ဌာန်'],
	['m¥U\\;qa;på"', 'မျဉ်းသားပါ။'],
	['É;Bfqa;', 'ဦးဘ၏သား'],
	['kÁnu\\p\\', 'ကျွန်ုပ်'],
	['qiTil', 'သိထိလ'],
	['A•wå\' p•a', 'အဏ္ဏဝါ၊ ပဏ္ဏာ'],
	['qigÇ', 'သိင်္ဂီ'],
];

test('legacy lines convert to the Unicode the page shows', () => {
	for (const [legacy, unicode] of lines) assert.equal(convert(legacy), unicode, legacy);
});

test('asat comes before dot-below, as in the thuddar data', () => {
	assert.equal(convert('Nxc\\.'), 'နှင့်');
	assert.deepEqual([...convert('Nxc\\.')].slice(-2), ['်', '့']);
});

test('extractor markers: Latin text passes through, Gautami ellipsis becomes "..."', () => {
	assert.equal(convert('Supdt. qv\\'), 'Supdt. သည်');
	assert.equal(convert('qv\\mx'), '...သည်...မှ');
});

test('an unmapped glyph stops the run unless lenient', () => {
	assert.throws(() => mapGlyphs('kÐ'), /no mapping for "Ð" \(U\+00D0\) at column 2/);
	assert.equal(convert('kÐ', { lenient: true }), 'ကÐ');
});
