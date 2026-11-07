import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../shared/errors.js';
import { assertCan, can, isRole } from '../shared/roles.js';
import { detectLang, normalizeQuery, parseLang, parseReaction, wordKey } from '../shared/validate.js';
import { nextVersion, parseVersion } from '../shared/version.js';

test('roles: each level includes the ones below it', () => {
	assert.equal(can('member', 'react'), true);
	assert.equal(can('member', 'suggest'), true);
	assert.equal(can('member', 'edit'), false);
	assert.equal(can('editor', 'edit'), true);
	assert.equal(can('editor', 'manage_members'), false);
	assert.equal(can('admin', 'manage_members'), true);
	assert.equal(isRole('owner'), false);
});

test('roles: forbidden actions and unknown roles fail loudly', () => {
	assert.throws(() => assertCan('member', 'edit'), (e) => e instanceof AppError && e.code === 'forbidden');
	assert.throws(() => can(/** @type {any} */ ('owner'), 'react'), (e) => e instanceof AppError && e.code === 'internal');
});

test('validate: queries are normalised, empty or long ones rejected', () => {
	assert.equal(normalizeQuery('  love   affair '), 'love affair');
	assert.equal(wordKey('Love'), 'love');
	assert.throws(() => normalizeQuery('   '), /empty/);
	assert.throws(() => normalizeQuery(undefined), /missing/);
	assert.throws(() => normalizeQuery('x'.repeat(101)), /longer than/);
});

test('validate: script decides the dictionary', () => {
	assert.equal(detectLang('love'), 'en');
	assert.equal(detectLang('ကကွက်'), 'my');
	assert.equal(parseLang('my'), 'my');
	assert.throws(() => parseLang('fr'), /Unknown dictionary/);
});

test('validate: reactions are like or dislike only', () => {
	assert.equal(parseReaction(1), 1);
	assert.equal(parseReaction(-1), -1);
	assert.throws(() => parseReaction(2), /like/);
});

test('version: date part follows the day, counter keeps counting', () => {
	assert.deepEqual(parseVersion('26.4.4'), { yy: 26, mm: 4, dd: 4, changes: 0 });
	assert.equal(nextVersion('26.4.4', new Date(Date.UTC(2026, 10, 7))), '26.11.7+1');
	assert.equal(nextVersion('26.11.7+1', new Date(Date.UTC(2026, 10, 7))), '26.11.7+2');
	assert.equal(nextVersion('26.11.7+2', new Date(Date.UTC(2027, 0, 3))), '27.1.3+3');
	assert.throws(() => parseVersion('26.11.7.1'), /yy\.mm\.dd\+changes/);
});
