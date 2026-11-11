// @ts-check
/**
 * History-API router. Same-origin link clicks are handled in place;
 * every route is reachable directly by URL (deep links), online or offline.
 */
import { h } from './dom.js';
import { match } from './routes.js';
import { endProgress, startProgress } from './progress.js';
import { t } from '../i18n/index.js';

/**
 * @param {HTMLElement} outlet  Element the current view renders into.
 * @param {(route: import('./routes.js').Route | null) => void} [onRoute]
 */
export function startRouter(outlet, onRoute) {
	let token = 0;
	// The router puts each page back where it was left (below), not the browser.
	history.scrollRestoration = 'manual';

	async function render() {
		const mine = ++token;
		const url = new URL(location.href);
		const route = match(url.pathname);
		onRoute?.(route);

		if (!route) {
			endProgress();
			outlet.replaceChildren(notFound(url.pathname));
			document.title = `${t('Page not found')} · MyOrdbok`;
			return;
		}

		const ctx = { query: url.searchParams, go, replace };
		startProgress();
		try {
			const mod = await route.load();
			const node = await mod.view(ctx);
			if (mine !== token) return; // a newer navigation won
			endProgress();
			outlet.replaceChildren(node);
			document.title = mod.title ? `${mod.title(ctx)} · MyOrdbok` : 'MyOrdbok';
			// Back or forward to a page: where it was left. A deep link to a place
			// in the page (/grammar/noun#s-2): that place. Otherwise the top.
			const saved = history.state?.scroll;
			const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
			if (typeof saved === 'number') window.scrollTo(0, saved);
			else if (target) target.scrollIntoView();
			else window.scrollTo(0, 0);
			window.dispatchEvent(new CustomEvent('mo:navigated', { detail: route.name }));
		} catch (err) {
			if (mine !== token) return;
			endProgress();
			console.error(err);
			outlet.replaceChildren(failure(err));
		}
	}

	/**
	 * Each history entry remembers where its page was scrolled to when left,
	 * and the page it was opened from (history.state.from), so a page can
	 * offer a back that returns there.
	 * @param {string} path
	 */
	function go(path) {
		const here = location.pathname + location.search;
		if (path === here) return;
		history.replaceState({ ...history.state, scroll: window.scrollY }, '');
		history.pushState({ from: here }, '', path);
		render();
	}

	/**
	 * Swaps the current history entry for `path` without adding one, for a
	 * page that turns out to live at another address ("what is love" → love).
	 * @param {string} path
	 */
	function replace(path) {
		history.replaceState({ ...history.state, scroll: undefined }, '', path);
		render();
	}

	document.addEventListener('click', (event) => {
		const a = /** @type {HTMLElement} */ (event.target).closest?.('a');
		// A link something else already handled (the person menu's button) is left alone.
		if (event.defaultPrevented || !a || a.target || a.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) return;
		const url = new URL(a.href, location.href);
		if (url.origin !== location.origin || !match(url.pathname)) return;
		// A link to a place on this same page: the browser scrolls to it.
		if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
		event.preventDefault();
		go(url.pathname + url.search);
	});
	window.addEventListener('popstate', render);
	render();

	return { go, replace };
}

/** @param {string} path */
function notFound(path) {
	return h('section', { class: 'page notice' }, h('h1', null, t('Page not found')), h('p', null, t('Nothing lives at {path}.', { path })), h('a', { href: '/' }, t('Go to the dictionary')));
}

/** @param {unknown} err */
function failure(err) {
	const message = err instanceof Error ? err.message : String(err);
	return h('section', { class: 'page notice', role: 'alert' }, h('h1', null, t('Something went wrong')), h('p', null, message));
}
