// @ts-check
/**
 * History-API router. Same-origin link clicks are handled in place;
 * every route is reachable directly by URL (deep links), online or offline.
 */
import { h } from './dom.js';
import { MOVED, match } from './routes.js';
import { pageScroll, scrollPageTo } from './scroll.js';
import { endProgress, startProgress } from './progress.js';
import { t } from '../i18n/index.js';

/**
 * Pages kept as they were shown, to be shown again at once when gone back
 * (or forward) to: no wait, no flash, and on iOS nothing between the end of
 * the swipe back and the page. Only pages whose content does not change
 * while away are kept (a definition, grammar, the site's pages); Home,
 * Liked, More, Practice and the workspace are asked again each time.
 */
const KEEP = new Set(['definition', 'grammar', 'fonts', 'about', 'contact', 'privacy', 'terms', 'support', 'link']);
/** How many pages are kept, the oldest let go first. */
const KEPT_MAX = 16;

/** @returns {string} A key for a history entry, kept in its state. */
function entryKey() {
	return Math.random().toString(36).slice(2, 10);
}

/**
 * @param {HTMLElement} outlet  Element the current view renders into.
 * @param {(route: import('./routes.js').Route | null) => void} [onRoute]
 */
export function startRouter(outlet, onRoute) {
	let token = 0;
	// The router puts each page back where it was left (below), not the browser.
	history.scrollRestoration = 'manual';
	if (!history.state?.key) history.replaceState({ ...history.state, key: entryKey() }, '');
	/** @type {Map<string, { node: HTMLElement, title: string, route: string }>} */
	const kept = new Map();
	/** The history entry shown now, and the page shown for it. */
	let shownKey = history.state.key;
	/** @type {string | null} */
	let shownRoute = null;
	/** Back asked by a button of the page (back()), not a swipe: that page comes in sideways. */
	let slideNextPop = false;

	/**
	 * @param {'load' | 'push' | 'pop' | 'replace'} [how]  How the page came:
	 *   under 1024px pages pushed ease in from the right, pages gone back to
	 *   from the left (app.css, data-enter).
	 */
	async function render(how = 'load') {
		const mine = ++token;
		const moved = MOVED[location.pathname.replace(/\/+$/, '')];
		if (moved) history.replaceState(history.state, '', moved + location.search + location.hash);
		if (!history.state?.key) history.replaceState({ ...history.state, key: entryKey() }, '');
		const url = new URL(location.href);
		const route = match(url.pathname);
		// The page left, kept as it is if it is one to keep.
		const leaving = outlet.firstElementChild;
		if (how !== 'load' && shownRoute && KEEP.has(shownRoute) && leaving instanceof HTMLElement && shownKey !== history.state.key) {
			leaving.removeAttribute('data-enter');
			kept.delete(shownKey);
			kept.set(shownKey, { node: leaving, title: document.title, route: shownRoute });
			while (kept.size > KEPT_MAX) kept.delete(/** @type {string} */ (kept.keys().next().value));
		}
		shownKey = history.state.key;
		shownRoute = route?.name ?? null;
		onRoute?.(route);
		// Gone back (or forward) to a page kept: shown again at once.
		const keptPage = how === 'pop' && route ? kept.get(shownKey) : undefined;
		if (keptPage && keptPage.route === route?.name) {
			endProgress();
			if (slideNextPop) keptPage.node.dataset.enter = 'pop';
			slideNextPop = false;
			outlet.replaceChildren(keptPage.node);
			document.title = keptPage.title;
			const saved = history.state?.scroll;
			scrollPageTo(typeof saved === 'number' ? saved : 0);
			window.dispatchEvent(new CustomEvent('mo:navigated', { detail: route.name }));
			return;
		}

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
			// Pushed pages come in sideways; a page gone back to only when a
			// button asked (a swipe back has moved the pages already).
			if (node instanceof HTMLElement && (how === 'push' || (how === 'pop' && slideNextPop))) node.dataset.enter = how;
			if (how === 'pop') slideNextPop = false;
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
		history.pushState({ from: here, key: entryKey() }, '', path);
		render('push');
	}

	/**
	 * Back one page, as a page's own Back button: the page gone back to
	 * comes in from the left. Opened straight (nothing in this app before
	 * it), false: the button's link is followed instead.
	 * @returns {boolean}
	 */
	function back() {
		if (!history.state?.from) return false;
		history.replaceState({ ...history.state, scroll: pageScroll() }, '');
		slideNextPop = true;
		history.back();
		return true;
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

	return { go, replace, refresh, back };
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
