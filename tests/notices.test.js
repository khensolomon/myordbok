import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkNotice, nextShowing, seenBy, showingNow } from '../shared/notices.js';

const at = (iso) => Date.parse(iso) / 1000;

test('notices: a one-off notice shows from its announcement until it ends', () => {
	const n = { announce_at: at('2026-11-12T08:00:00Z'), starts_at: at('2026-11-14T21:00:00Z'), ends_at: at('2026-11-14T22:00:00Z'), yearly: 0 };
	const o = { shows: n.announce_at, starts: n.starts_at, ends: n.ends_at };
	assert.equal(showingNow(n, at('2026-11-12T07:59:59Z')), null);
	assert.deepEqual(nextShowing(n, at('2026-11-01T00:00:00Z')), o);
	assert.deepEqual(showingNow(n, at('2026-11-13T12:00:00Z')), o, 'announced ahead');
	assert.deepEqual(showingNow(n, at('2026-11-14T21:30:00Z')), o);
	assert.equal(showingNow(n, at('2026-11-14T22:00:00Z')), null, 'the end is not included');
	assert.equal(nextShowing(n, at('2026-11-15T00:00:00Z')), null);
	assert.equal(showingNow({ ...n, announce_at: null }, at('2026-11-13T12:00:00Z')), null, 'without an announcement it shows from the start');
});

test('notices: a yearly window comes back every year, across the new year too', () => {
	const xmas = { starts_at: at('2025-12-24T00:00:00Z'), ends_at: at('2025-12-27T00:00:00Z'), yearly: 1 };
	const y27 = { shows: at('2027-12-24T00:00:00Z'), starts: at('2027-12-24T00:00:00Z'), ends: at('2027-12-27T00:00:00Z') };
	assert.deepEqual(showingNow(xmas, at('2027-12-25T12:00:00Z')), y27);
	assert.equal(showingNow(xmas, at('2027-06-01T00:00:00Z')), null);
	assert.deepEqual(nextShowing(xmas, at('2027-06-01T00:00:00Z')), y27);
	const newYear = { starts_at: at('2025-12-31T00:00:00Z'), ends_at: at('2026-01-02T00:00:00Z'), yearly: 1 };
	assert.deepEqual(showingNow(newYear, at('2028-01-01T08:00:00Z')), { shows: at('2027-12-31T00:00:00Z'), starts: at('2027-12-31T00:00:00Z'), ends: at('2028-01-02T00:00:00Z') });
	assert.equal(showingNow(newYear, at('2025-06-01T00:00:00Z')), null, 'nothing before its first year');
});

test('notices: who sees what', () => {
	assert.equal(seenBy('everyone', null), true);
	assert.equal(seenBy('member', null), false);
	assert.equal(seenBy('member', 'member'), true);
	assert.equal(seenBy('editor', 'member'), false);
	assert.equal(seenBy('editor', 'admin'), true);
});

test('notices: a notice is checked before it is kept', () => {
	const ok = { kind: 'celebration', text_en: '  Merry   Christmas ', starts_at: 100, ends_at: 200 };
	assert.deepEqual(checkNotice(ok), { kind: 'celebration', text_en: 'Merry Christmas', text_my: null, link: null, audience: 'everyone', announce_at: null, starts_at: 100, ends_at: 200, yearly: 0 });
	assert.equal(checkNotice({ ...ok, announce_at: 50 }).announce_at, 50);
	assert.throws(() => checkNotice({ ...ok, announce_at: 150 }), /before it starts/);
	assert.throws(() => checkNotice({ ...ok, kind: 'party' }), /kind/);
	assert.throws(() => checkNotice({ ...ok, text_en: ' ' }), /English, Myanmar or both/);
	assert.throws(() => checkNotice({ ...ok, ends_at: 100 }), /end after/);
	assert.throws(() => checkNotice({ ...ok, link: 'javascript:alert(1)' }), /link/);
	assert.throws(() => checkNotice({ ...ok, link: '//evil.example' }), /link/);
	assert.equal(checkNotice({ ...ok, link: '/about' }).link, '/about');
	assert.equal(checkNotice({ ...ok, link: 'https://example.org/x' }).link, 'https://example.org/x');
	assert.throws(() => checkNotice({ ...ok, yearly: true, ends_at: 100 + 366 * 86400 }), /less than a year/);
});
