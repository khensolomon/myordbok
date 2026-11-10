// @ts-check
/**
 * /account now lives in the workspace: this address (in old links and
 * bookmarks) moves to /workspace?s=account, keeping ?return and ?error.
 */
export function title() {
	return 'Account';
}

/** @param {import('../core/routes.js').ViewContext} ctx */
export function view(ctx) {
	const q = new URLSearchParams(ctx.query);
	q.set('s', 'account');
	ctx.replace(`/workspace?${q}`);
	return document.createElement('div');
}
