// @ts-check
/** The app's system, from its web view: an iPad introduces itself as a Mac. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLATFORM_SCRIPT, platformOf } from '../app/core/app-os.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

const cases = /** @type {const} */ ([
	[IPHONE, 5, 'ios'],
	[IPAD, 5, 'ios'],
	[IPAD, 0, 'desktop'],
	[ANDROID, 5, 'android'],
	['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 0, 'desktop'],
]);

test('an iPad (a Mac with a touch screen) is iOS; a Mac is not', () => {
	for (const [agent, touch, want] of cases) assert.equal(platformOf(agent, touch), want, `${agent} ${touch}`);
});

test('the splash\'s inline script answers as platformOf does', () => {
	for (const [agent, touch, want] of cases) {
		const answer = new Function('navigator', `return ${PLATFORM_SCRIPT}`)({ userAgent: agent, maxTouchPoints: touch });
		assert.equal(answer, want, `${agent} ${touch}`);
	}
});

test('sign-in buttons: the device maker\'s own first, the rest in the server\'s order', async () => {
	const { providerOrder } = await import('../app/core/member.js');
	const served = /** @type {const} */ (['github', 'google', 'apple']);
	assert.deepEqual(providerOrder([...served], IPHONE), ['apple', 'github', 'google']);
	assert.deepEqual(providerOrder([...served], IPAD), ['apple', 'github', 'google']);
	assert.deepEqual(providerOrder([...served], ANDROID), ['google', 'github', 'apple']);
	assert.deepEqual(providerOrder([...served], 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), ['github', 'google', 'apple']);
	assert.deepEqual(providerOrder(['github', 'google'], IPHONE), ['github', 'google'], 'Apple sign-in off: unchanged');
});
