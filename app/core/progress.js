// @ts-check
/**
 * A thin bar across the top of the page while a page is loading. It shows
 * only when loading takes longer than a moment, so quick pages never flash
 * it; it creeps towards the end while waiting and runs out when done.
 */

const DELAY_MS = 150;

/** @type {HTMLDivElement | null} */
let bar = null;
/** @type {number | undefined} */
let timer;
let running = false;

function element() {
	if (!bar) {
		bar = document.createElement('div');
		bar.className = 'progress';
		bar.setAttribute('aria-hidden', 'true');
		document.body.append(bar);
	}
	return bar;
}

/** Loading has begun; the bar appears if it is still going after a moment. */
export function startProgress() {
	clearTimeout(timer);
	timer = window.setTimeout(() => {
		const b = element();
		running = true;
		b.removeAttribute('data-done');
		b.setAttribute('data-run', '');
		// Restart from empty, then creep (the transition in app.css does the creeping).
		b.style.transition = 'none';
		b.style.transform = 'scaleX(0)';
		void b.offsetWidth;
		b.style.transition = '';
		b.style.transform = 'scaleX(0.85)';
	}, DELAY_MS);
}

/** Loading has ended, well or not; a bar showing runs out and fades. */
export function endProgress() {
	clearTimeout(timer);
	if (!running || !bar) return;
	running = false;
	bar.setAttribute('data-done', '');
	bar.style.transform = 'scaleX(1)';
}
