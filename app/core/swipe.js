// @ts-check
/**
 * Back by a swipe from the left edge, in the iOS app (html[data-app="ios"],
 * platform/tauri/boot.js): its web view has no gesture of its own, while
 * Safari and Android have theirs, so the website leaves it to them. The
 * page follows the finger; let go past a third of the width, or flicked,
 * it goes back (the page before slides in, router.js), otherwise it
 * returns. Only when there is a page in this app to go back to
 * (history.state.from, router.js).
 */

/** How near the left edge a swipe starts, in pixels. */
const EDGE = 24;
/** Past this share of the width, letting go goes back. */
const FAR = 1 / 3;
/** A flick this fast (pixels per millisecond) goes back however short. */
const FLICK = 0.5;

export function backSwipe() {
	/** @type {{ x: number, y: number, t: number, page: HTMLElement, moving: boolean } | null} */
	let swipe = null;

	document.addEventListener(
		'touchstart',
		(e) => {
			if (document.documentElement.dataset.app !== 'ios' || e.touches.length !== 1 || !history.state?.from) return;
			const touch = e.touches[0];
			const page = document.getElementById('view');
			if (touch.clientX > EDGE || !page || document.body.hasAttribute('data-searching')) return;
			swipe = { x: touch.clientX, y: touch.clientY, t: performance.now(), page, moving: false };
		},
		{ passive: true },
	);

	document.addEventListener(
		'touchmove',
		(e) => {
			if (!swipe) return;
			const touch = e.touches[0];
			const dx = touch.clientX - swipe.x;
			const dy = touch.clientY - swipe.y;
			// A swipe that runs more up or down than across is a scroll.
			if (!swipe.moving && Math.abs(dy) > Math.abs(dx)) {
				swipe = null;
				return;
			}
			swipe.moving = dx > 6;
			if (swipe.moving) {
				e.preventDefault();
				swipe.page.style.transition = 'none';
				swipe.page.style.transform = `translateX(${Math.max(0, dx)}px)`;
			}
		},
		{ passive: false },
	);

	const end = (/** @type {TouchEvent} */ e) => {
		if (!swipe) return;
		const { page, x, t, moving } = swipe;
		swipe = null;
		if (!moving) return;
		const dx = (e.changedTouches[0]?.clientX ?? x) - x;
		const fast = dx / Math.max(1, performance.now() - t) > FLICK;
		page.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
		if (dx > window.innerWidth * FAR || fast) {
			page.style.transform = `translateX(${window.innerWidth}px)`;
			page.addEventListener('transitionend', () => {
				// The page gone back to is already in place: no slide of its own (app.css).
				document.documentElement.toggleAttribute('data-swiped', true);
				setTimeout(() => document.documentElement.removeAttribute('data-swiped'), 600);
				// Back in place once the page gone back to is shown.
				const reset = () => {
					page.style.transition = 'none';
					page.style.transform = '';
				};
				window.addEventListener('mo:navigated', reset, { once: true });
				setTimeout(reset, 1500);
				history.back();
			}, { once: true });
		} else {
			page.style.transform = '';
		}
	};
	document.addEventListener('touchend', end, { passive: true });
	document.addEventListener('touchcancel', end, { passive: true });
}
