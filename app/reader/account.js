// @ts-check
/**
 * /account: an address for links and bookmarks that goes to the
 * workspace's account (/workspace?s=account), keeping ?return and ?error.
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
