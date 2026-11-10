// @ts-check
/**
 * /offline moved into the workspace (?s=offline); the address stays for old
 * links and goes there.
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
