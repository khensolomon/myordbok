import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMarkers, readMarkers } from '../scripts/markers.js';

test('markers: found in a copy whatever its case and spacing; notes are skipped', () => {
	const markers = readMarkers('# invented, 2026\nesquivalience\nto be quietly fond of a  river\n\n');
	assert.deepEqual(markers, ['esquivalience', 'to be quietly fond of a  river']);
	assert.deepEqual(findMarkers(markers, '<p>ESQUIVALIENCE (n.)</p>\n<p>To be quietly\nfond of a river</p>'), markers);
	assert.deepEqual(findMarkers(markers, 'love, river, fond'), []);
});
