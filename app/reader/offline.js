// @ts-check
/**
 * /offline: an address for links and bookmarks that goes to the
 * workspace's offline copy (/workspace?s=offline).
 */
import { t } from '../i18n/index.js';

export function title() {
	return t('Offline copy');
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export function view(ctx) {
	ctx.replace('/workspace?s=offline');
	return document.createElement('div');
}
