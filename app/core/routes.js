// @ts-check
/**
 * Every URL the app answers, in one place. Paths keep the live site's URLs
 * so existing links and search results stay valid; confirm any change here
 * against the live site before release.
 *
 * Views load lazily, so the studio's code is never downloaded by readers.
 */

/**
 * @typedef {object} ViewContext
 * @property {URLSearchParams} query
 * @property {(path: string) => void} go
 */

/**
 * @typedef {object} ViewModule
 * @property {(ctx: ViewContext) => Node | Promise<Node>} view
 * @property {(ctx: ViewContext) => string} [title]
 */

/**
 * @typedef {object} Route
 * @property {string} name
 * @property {string} path
 * @property {() => Promise<ViewModule>} load
 * @property {boolean} [offline]  Part of the offline app shell.
 */

/** @type {readonly Route[]} */
export const ROUTES = Object.freeze([
	{ name: 'home', path: '/', load: () => import('../reader/home.js'), offline: true },
	{ name: 'definition', path: '/definition', load: () => import('../reader/entry.js'), offline: true },
	{ name: 'grammar', path: '/grammar', load: () => import('../reader/grammar.js'), offline: true },
	{ name: 'fonts', path: '/myanmar-fonts', load: () => import('../reader/page.js'), offline: true },
	{ name: 'about', path: '/about', load: () => import('../reader/about.js'), offline: true },
	{ name: 'privacy', path: '/privacy', load: () => import('../reader/privacy.js'), offline: true },
	{ name: 'terms', path: '/terms', load: () => import('../reader/page.js'), offline: true },
	{ name: 'studio', path: '/studio', load: () => import('../workspace/index.js') },
]);

/**
 * @param {string} pathname
 */
export function match(pathname) {
	const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return ROUTES.find((r) => r.path === clean || clean.startsWith(`${r.path}/`) && r.path !== '/') ?? null;
}

/**
 * Link to a headword's page.
 * @param {string} word
 */
export function definitionHref(word) {
	return `/definition?q=${encodeURIComponent(word)}`;
}
