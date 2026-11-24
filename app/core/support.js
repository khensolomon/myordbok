// @ts-check
/**
 * Supporting MyOrdbok in the apps, through the store's own payments (App
 * Store, Google Play; the iap plugin, src-tauri). Everything in MyOrdbok is
 * free: nothing here unlocks anything.
 *
 *   supporter    one-time; kept by the store, so it comes back on a new
 *                phone (restore)
 *   tip_*        given as often as liked; the store keeps no record of them
 *                to restore, so this device counts them
 *   EARLIER      the earlier app's purchases (Offline access, Thesaurus,
 *                Parts of speech): free for everyone now, and whoever bought
 *                one is a supporter
 *
 * Asked quietly once each launch (restoreQuietly, from the app's start-up):
 * a past buyer is thanked once. What this device knows is kept in
 * localStorage (mo:support); in the website nothing here is offered (the
 * website's own Support page asks instead).
 *
 * Google Play takes back a purchase not acknowledged within three days:
 * each is acknowledged as soon as it is seen. A tip on Android can be given
 * again only once the server has used it up (Play Developer API); until
 * then the store answers that it is already owned.
 */
import { h } from './dom.js';
import { t } from '../i18n/index.js';

export const SUPPORTER = 'supporter';
export const TIPS = /** @type {const} */ (['tip_small', 'tip_medium', 'tip_large']);
/** The earlier app's products: all one-time, all of them free now. */
const EARLIER = ['offlineaccess', 'upgrade', 'subscription_silver'];
/** Where this device keeps what it knows. */
const KEY = 'mo:support';

/**
 * @typedef {object} StoreProduct
 * @property {string} productId
 * @property {string} title
 * @property {string} [formattedPrice]
 */
/**
 * @typedef {object} StorePurchase
 * @property {string} productId
 * @property {string} purchaseToken
 * @property {number} purchaseState  0 purchased, 1 cancelled, 2 pending
 * @property {boolean} isAcknowledged
 * @property {number} purchaseTime
 */
/**
 * @typedef {object} SupportState
 * @property {boolean} supporter
 * @property {boolean} earlier  Bought in the earlier app.
 * @property {number} tips  Given from this device.
 * @property {boolean} thanked  The earlier buyer's thank-you was shown.
 */

/** @returns {((cmd: string, args?: object) => Promise<any>) | null} */
function invoker() {
	if (!document.documentElement.dataset.app) return null;
	return /** @type {any} */ (window).__TAURI__?.core?.invoke ?? null;
}

/** Whether the store's payments are here: the iOS and Android apps. */
export function storeAvailable() {
	const app = document.documentElement.dataset.app;
	return (app === 'ios' || app === 'android') && invoker() !== null;
}

/** @returns {(cmd: string, args?: object) => Promise<any>} */
function invoke() {
	const call = invoker();
	if (!call) throw new Error('The store is not available here: only the MyOrdbok apps for iOS and Android can pay through it.');
	return call;
}

/** @returns {SupportState} */
export function supportState() {
	/** @type {SupportState} */
	const none = { supporter: false, earlier: false, tips: 0, thanked: false };
	try {
		const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		return kept && typeof kept === 'object' ? { ...none, ...kept } : none;
	} catch {
		return none;
	}
}

/** @param {Partial<SupportState>} change */
function keep(change) {
	const next = { ...supportState(), ...change };
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// Not kept on this device (storage refused): known for this visit only.
	}
	document.dispatchEvent(new CustomEvent('mo:support', { detail: next }));
	return next;
}

/**
 * The four products with their prices in the reader's currency, as the store has them.
 * @returns {Promise<Map<string, StoreProduct>>}
 */
export async function products() {
	const answer = await invoke()('plugin:iap|get_products', { payload: { productIds: [SUPPORTER, ...TIPS], productType: 'inapp' } });
	/** @type {StoreProduct[]} */
	const list = answer?.products ?? [];
	if (!list.length) throw new Error(t('The store has no MyOrdbok products to show right now. Try again later.'));
	return new Map(list.map((p) => [p.productId, p]));
}

/** @param {StorePurchase} p */
async function acknowledge(p) {
	if (document.documentElement.dataset.app !== 'android' || p.isAcknowledged || p.purchaseState !== 0) return;
	await invoke()('plugin:iap|acknowledge_purchase', { payload: { purchaseToken: p.purchaseToken } });
}

/**
 * Buys one product. Resolves with what is now known, or null when the
 * reader cancelled; a payment still waiting (some of Google's ways to pay)
 * throws a message saying so.
 * @param {string} productId
 * @returns {Promise<SupportState | null>}
 */
export async function buy(productId) {
	if (productId !== SUPPORTER && !TIPS.includes(/** @type {any} */ (productId))) throw new Error(`Not a MyOrdbok product: ${productId}`);
	/** @type {StorePurchase} */
	let p;
	try {
		p = await invoke()('plugin:iap|purchase', { payload: { productId, productType: 'inapp' } });
	} catch (err) {
		const text = err instanceof Error ? err.message : String(err);
		if (/cancel/i.test(text)) return null;
		throw new Error(text);
	}
	if (p.purchaseState === 2) throw new Error(t('The payment is waiting to be completed. It will show here once the store confirms it.'));
	await acknowledge(p);
	return productId === SUPPORTER ? keep({ supporter: true }) : keep({ supporter: supportState().supporter, tips: supportState().tips + 1 });
}

/**
 * What the store says this account owns: the Supporter purchase and the
 * earlier app's.
 * @returns {Promise<SupportState>}
 */
export async function restore() {
	const answer = await invoke()('plugin:iap|restore_purchases', { payload: { productType: 'inapp' } });
	/** @type {StorePurchase[]} */
	const owned = (answer?.purchases ?? []).filter((p) => p.purchaseState === 0);
	for (const p of owned) await acknowledge(p);
	const earlier = owned.some((p) => EARLIER.includes(p.productId));
	const supporter = earlier || owned.some((p) => p.productId === SUPPORTER);
	const now = supportState();
	return keep({ supporter: supporter || now.supporter, earlier: earlier || now.earlier });
}

/**
 * Once each launch, a few seconds in: what the store holds for this
 * account; an earlier buyer is thanked, once. A failure here is logged,
 * never shown: the reader asked nothing.
 */
export function restoreQuietly() {
	if (!storeAvailable()) return;
	setTimeout(() => {
		restore()
			.then((state) => {
				if (state.earlier && !state.thanked) thankEarlier();
			})
			.catch((err) => console.error('The store could not be asked what this account owns:', err));
	}, 3000);
}

/** The earlier buyer's thank-you: what they bought is free for everyone now. */
function thankEarlier() {
	keep({ thanked: true });
	const ok = h('button', { type: 'button', class: 'app-update-go support-thanks-ok' }, t('Thank you'));
	const sheet = h(
		'div',
		{ class: 'app-update support-thanks', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'support-thanks-title' },
		h(
			'div',
			{ class: 'app-update-box' },
			h('p', { class: 'support-thanks-heart', 'aria-hidden': 'true' }, '♥'),
			h('h2', { id: 'support-thanks-title' }, t('You are a MyOrdbok supporter')),
			h('p', null, t('You bought from MyOrdbok before. Everything is free for everyone now, what you bought included, thanks to people like you. You keep your place as a supporter.')),
			ok,
		),
	);
	ok.addEventListener('click', () => sheet.remove());
	document.body.append(sheet);
	ok.focus();
}
