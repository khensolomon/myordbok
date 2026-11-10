// @ts-check
/**
 * Offline (?s=offline): what this device keeps of the dictionary, and what
 * it can keep. Word lists arrive by themselves (app/data/offline.js
 * keepWordLists) and have no buttons; definitions and related words are
 * chosen here, one pack at a time, so a device short of space keeps only
 * what it needs. A pack already current offers no download, and removing
 * asks twice, so nothing is fetched again for no reason.
 */
import { h } from '../core/dom.js';
import { install, installed, keepOnDevice, packsInfo, remove, storageUse } from '../data/offline.js';
import { mark, t } from '../i18n/index.js';

/** @typedef {import('../data/offline.js').PackInfo} PackInfo */
/** @typedef {import('../data/offline.js').Installed} Installed */

/** @type {Record<string, { name: string, about: string }>} */
const PACKS = {
	'words-en': { name: mark('English word list'), about: mark('Suggestions while typing, and whether a word is in the dictionary.') },
	'words-my': { name: mark('Myanmar word list'), about: mark('The same for Myanmar words.') },
	'senses-en': { name: mark('English → Myanmar definitions'), about: mark('Every English word’s meanings, examples and forms.') },
	'senses-my': { name: mark('Myanmar → English definitions'), about: mark('Every Myanmar word’s meanings and pronunciation.') },
	'related-en': { name: mark('English related words'), about: mark('Synonyms, opposites and related words, shown with the English definitions.') },
};

export async function offlinePane() {
	const list = h('ul', { class: 'offline-packs' });
	const status = h('p', { class: 'offline-status', role: 'status' });
	const use = h('p', { class: 'offline-use' });
	const page = h(
		'div',
		{ class: 'ws-work offline' },
		h('h1', { class: 'ws-settings-title' }, t('Offline copy')),
		h('p', { class: 'offline-lead' }, t('Keep the dictionary on this device to look words up without a connection. Choose only what you need; each part can be removed again.')),
		status,
		list,
		use,
		h('p', { class: 'offline-note' }, t('Phrases and sentences, ratings and suggestions still need a connection.')),
	);

	/** @type {Awaited<ReturnType<typeof packsInfo>> | null} */
	let info = null;
	/** @type {Installed[]} */
	let have = [];
	const refresh = async () => {
		[info, have] = await Promise.all([packsInfo().catch((err) => (status.textContent = message(err), null)), installed().catch(() => [])]);
		if (info) status.textContent = info.access === 'members' && !info.signedIn ? t('Word lists are open to everyone; the definitions need a sign-in.') : '';
		const ids = info ? info.packs.map((p) => p.id) : have.map((p) => p.id);
		list.replaceChildren(...ids.map((id) => row(id)));
		const u = await storageUse();
		use.textContent = u ? t('This site uses {used} of the space the browser allows ({quota}).', { used: bytes(u.used), quota: bytes(u.quota) }) : '';
	};

	/** @param {string} id */
	const row = (id) => {
		const offer = info?.packs.find((p) => p.id === id) ?? null;
		const mine = have.find((p) => p.id === id) ?? null;
		const meta = PACKS[id];
		const state = h('span', { class: 'offline-state' });
		const bar = /** @type {HTMLProgressElement} */ (h('progress', { max: 1, value: 0, hidden: true }));
		const act = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'offline-act' }));
		const drop = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'offline-drop', hidden: !mine }, t('Remove')));
		const current = mine && info && mine.build === info.build;
		if (mine) state.textContent = current ? t('On this device') : t('On this device, an older build ({build})', { build: mine.build });
		else state.textContent = offer ? bytes(offer.bytes) : '';
		if (!offer) act.hidden = true;
		else if (!offer.allowed) {
			act.textContent = t('Sign in to download');
			act.addEventListener('click', () => location.assign(`/workspace?s=account&return=${encodeURIComponent('/workspace?s=offline')}`));
		} else {
			act.textContent = mine ? t('Update') : t('Download');
			// A current pack needs nothing; word lists keep themselves current.
			act.hidden = Boolean(current);
			act.addEventListener('click', async () => {
				if (!info) return;
				act.disabled = drop.disabled = true;
				bar.hidden = false;
				state.textContent = t('Downloading…');
				try {
					await install(offer, info.build, (f) => (bar.value = f));
					await keepOnDevice();
					await refresh();
				} catch (err) {
					act.disabled = drop.disabled = false;
					bar.hidden = true;
					state.textContent = message(err);
				}
			});
		}
		if (id.startsWith('words-')) drop.hidden = true;
		let sure = false;
		drop.addEventListener('click', async () => {
			if (!sure) {
				sure = true;
				drop.textContent = t('Choose again to remove');
				setTimeout(() => {
					sure = false;
					if (drop.isConnected && !drop.disabled) drop.textContent = t('Remove');
				}, 4000);
				return;
			}
			drop.disabled = act.disabled = true;
			try {
				await remove(id);
				await refresh();
			} catch (err) {
				drop.disabled = act.disabled = false;
				state.textContent = message(err);
			}
		});
		return h(
			'li',
			{ class: mine ? 'offline-pack offline-have' : 'offline-pack' },
			h('div', { class: 'offline-text' }, h('strong', null, meta ? t(meta.name) : id), meta ? h('span', null, t(meta.about)) : null, state, bar),
			h('div', { class: 'offline-buttons' }, act, drop),
		);
	};

	await refresh();
	return h('main', { class: 'ws-main ws-account ws-offline', 'aria-label': t('Offline copy') }, page);
}

/** @param {unknown} err */
const message = (err) => (err instanceof Error ? err.message : String(err));

/** @param {number} n */
function bytes(n) {
	if (n >= 1073741824) return t('{n} GB', { n: Math.round(n / 107374182.4) / 10 });
	if (n >= 1048576) return t('{n} MB', { n: Math.round(n / 104857.6) / 10 });
	return t('{n} KB', { n: Math.max(1, Math.round(n / 1024)) });
}
