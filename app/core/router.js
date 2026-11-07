// @ts-check
/**
 * History-API router. Same-origin link clicks are handled in place;
 * every route is reachable directly by URL (deep links), online or offline.
 */
import { h } from './dom.js';
import { match } from './routes.js';

/**
 * @param {HTMLElement} outlet  Element the current view renders into.
 * @param {(route: import('./routes.js').Route | null) => void} [onRoute]
 */
export function startRouter(outlet, onRoute) {
	let token = 0;

	async function render() {
		const mine = ++token;
		const url = new URL(location.href);
		const route = match(url.pathname);
		onRoute?.(route);

		if (!route) {
			outlet.replaceChildren(notFound(url.pathname));
			document.title = 'Not found · MyOrdbok';
			return;
		}

		const ctx = { query: url.searchParams, go };
		try {
			const mod = await route.load();
			const node = await mod.view(ctx);
			if (mine !== token) return; // a newer navigation won
			outlet.replaceChildren(node);
			document.title = mod.title ? `${mod.title(ctx)} · MyOrdbok` : 'MyOrdbok';
			window.scrollTo(0, 0);
		} catch (err) {
			if (mine !== token) return;
			console.error(err);
			outlet.replaceChildren(failure(err));
		}
	}

	/** @param {string} path */
	function go(path) {
		if (path === location.pathname + location.search) return;
		history.pushState(null, '', path);
		render();
	}

	document.addEventListener('click', (event) => {
		const a = /** @type {HTMLElement} */ (event.target).closest?.('a');
		if (!a || a.target || a.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) return;
		const url = new URL(a.href, location.href);
		if (url.origin !== location.origin || !match(url.pathname)) return;
		event.preventDefault();
		go(url.pathname + url.search);
	});
	window.addEventListener('popstate', render);
	render();

	return { go };
}

/** @param {string} path */
function notFound(path) {
	return h('section', { class: 'page notice' }, h('h1', null, 'Page not found'), h('p', null, `Nothing lives at ${path}.`), h('a', { href: '/' }, 'Go to the dictionary'));
}

/** @param {unknown} err */
function failure(err) {
	const message = err instanceof Error ? err.message : String(err);
	return h('section', { class: 'page notice', role: 'alert' }, h('h1', null, 'Something went wrong'), h('p', null, message));
}
