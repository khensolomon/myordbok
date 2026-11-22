// @ts-check
/**
 * Where the page scrolls. On the website, the window. In the app
 * (html[data-app], platform/tauri/boot.js) the window itself is held still
 * and <body> scrolls instead (app.css): the phone then bounces the page at
 * its ends as in any app, while the tab bar, fixed outside it, stays put.
 */

/** The element that scrolls the page. */
export function pageScroller() {
	return document.documentElement.dataset.app ? document.body : (document.scrollingElement ?? document.documentElement);
}

/** How far the page is scrolled, in pixels. */
export function pageScroll() {
	return pageScroller().scrollTop;
}

/**
 * @param {number} top
 * @param {boolean} [smooth]
 */
export function scrollPageTo(top, smooth = false) {
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	pageScroller().scrollTo({ top, behavior: smooth && !still ? 'smooth' : 'auto' });
}
