// @ts-check
/**
 * History-API router. Same-origin link clicks are handled in place;
 * every route is reachable directly by URL (deep links), online or offline.
 */
import { h } from './dom.js';
import { match } from './routes.js';
import { pageScroll, scrollPageTo } from './scroll.js';
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

	/**
	 * @param {'load' | 'push' | 'pop' | 'replace'} [how]  How the page came:
	 *   under 1024px pages pushed ease in from the right, pages gone back to
	 *   from the left (app.css, data-enter).
	 */
	async function render(how = 'load') {
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

		// What the Worker wrote about the page asked for (its address to index,
		// whether to index it: worker/routes/page.js) is about that page alone.
		if (mine > 1) for (const el of document.head.querySelectorAll('link[rel="canonical"], meta[name="robots"], meta[property^="og:"]')) el.remove();
		/** @type {import('./routes.js').ViewContext} */
		const ctx = { query: url.searchParams, go, replace };
		startProgress();
		try {
			let mod;
			try {
				mod = await route.load();
			} catch (err) {
				if (mine === token && reloadOnce()) return;
				throw err;
			}
			const node = await mod.view(ctx);
			if (mine !== token) return; // a newer navigation won
			endProgress();
			if (node instanceof HTMLElement && (how === 'push' || how === 'pop')) node.dataset.enter = how;
			outlet.replaceChildren(node);
			// A view may name itself once it knows what it shows (an entry: the word and its first meanings).
			const title = ctx.title ?? (mod.title ? mod.title(ctx) : null);
			document.title = title ? `${title} · MyOrdbok` : 'MyOrdbok';
			// Back or forward to a page: where it was left. A deep link to a place
			// in the page (/grammar/noun#s-2): that place. Otherwise the top.
			const saved = history.state?.scroll;
			const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
			if (typeof saved === 'number') scrollPageTo(saved);
			else if (target) target.scrollIntoView();
			else scrollPageTo(0);
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
		history.replaceState({ ...history.state, scroll: pageScroll() }, '');
		history.pushState({ from: here, ...origin(path) }, '', path);
		render('push');
	}

	/**
	 * Swaps the current history entry for `path` without adding one, for a
	 * page that turns out to live at another address ("what is love" → love).
	 * @param {string} path
	 */
	function replace(path) {
		history.replaceState({ ...history.state, scroll: undefined }, '', path);
		render('replace');
	}

	document.addEventListener('click', (event) => {
		const a = /** @type {HTMLElement} */ (event.target).closest?.('a');
		// A link something else already handled (the Search tab on home) is left alone.
		if (event.defaultPrevented || !a || a.target || a.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey) return;
		const url = new URL(a.href, location.href);
		if (url.origin !== location.origin || !match(url.pathname)) return;
		// A link to a place on this same page: the browser scrolls to it.
		if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
		event.preventDefault();
		go(url.pathname + url.search);
	});
	window.addEventListener('popstate', () => render('pop'));
	render();

	/**
	 * Shows the page again, asked anew (pull to refresh, pull.js); where it
	 * was scrolled to is kept.
	 */
	async function refresh() {
		history.replaceState({ ...history.state, scroll: pageScroll() }, '');
		await render('load');
	}

	/**
	 * Where a definition was opened from, kept through the definitions opened
	 * from it (love, then lover, then lovable all came from Liked): Back on a
	 * definition returns there in one step (main.js), `depth` pages back.
	 * Opened straight (a link from outside), there is no origin: Back goes home.
	 * @param {string} path  Where the page goes.
	 * @returns {{ origin?: string | null, depth?: number }}
	 */
	function origin(path) {
		if (match(new URL(path, location.origin).pathname)?.name !== 'definition') return {};
		const now = history.state ?? {};
		if (match(location.pathname)?.name !== 'definition') return { origin: location.pathname + location.search, depth: 1 };
		return { origin: now.origin ?? null, depth: (now.depth ?? 0) + 1 };
	}

	return { go, replace, refresh };
}

/** @param {string} path */
function notFound(path) {
	return h('section', { class: 'page notice' }, h('h1', null, t('Page not found')), h('p', null, t('Nothing lives at {path}.', { path })), h('a', { href: '/' }, t('Go to the dictionary')));
}

/** Session key: when the page was last loaded again for a script it lacked. */
const RELOADED = 'mo:reloaded';

/**
 * A page's script that cannot be loaded is, online, most often one a release
 * replaced while this page was open: the page is loaded again, once, after a
 * moment (a release takes a few seconds to reach every server). A second
 * failure within a minute, or one offline, is shown as it is.
 * @returns {boolean}  Whether the page is being loaded again.
 */
function reloadOnce() {
	if (!navigator.onLine) return false;
	try {
		const last = Number(sessionStorage.getItem(RELOADED));
		if (last && Date.now() - last < 60_000) return false;
		sessionStorage.setItem(RELOADED, String(Date.now()));
	} catch {
		return false; // storage blocked: no guard against a loop, so no reload
	}
	setTimeout(() => location.reload(), 2000);
	return true;
}

/** @param {unknown} err */
function failure(err) {
	const message = err instanceof Error ? err.message : String(err);
	return h('section', { class: 'page notice', role: 'alert' }, h('h1', null, t('Something went wrong')), h('p', null, message));
}
