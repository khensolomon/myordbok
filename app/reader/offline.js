// @ts-check
/**
 * /offline: what this device keeps of the dictionary, and what it can keep
 * (the pane is the workspace's, app/workspace/offline.js). While the
 * definitions are for members (GET /api/packs, access), a visitor is asked
 * to sign in first and comes back here.
 */
import { h } from '../core/dom.js';
import { member, providerLinks } from '../core/member.js';
import { packsInfo } from '../data/offline.js';
import { t } from '../i18n/index.js';
import { offlinePane } from '../workspace/offline.js';

export function title() {
	return t('Offline copy');
}

export async function view() {
	const [me, info] = await Promise.all([member().catch(() => null), packsInfo().catch(() => null)]);
	if (!me && info?.access === 'members') {
		return h(
			'section',
			{ class: 'page offline-page' },
			h('h1', { class: 'large-title' }, t('Offline copy')),
			h('p', null, t('Members can keep every definition on the device and look words up without a connection.')),
			providerLinks('ws-provider', '/offline'),
		);
	}
	return h('section', { class: 'page offline-page' }, await offlinePane());
}
