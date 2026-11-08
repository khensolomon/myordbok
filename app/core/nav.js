// @ts-check
/**
 * The header's moving shapes: a tint that follows the pointer from link to
 * link, and a lens on the current page that glides to the new link when the
 * page changes. Both are absolutely placed spans sized to the link (app.css,
 * .nav-hover and .nav-lens); CSS animates the move.
 */

/**
 * @param {HTMLElement} nav  The .site-nav element.
 * @returns {{ setCurrent: (link: HTMLAnchorElement | null) => void }}
 */
export function initNav(nav) {
	const hover = document.createElement('span');
	const lens = document.createElement('span');
	hover.className = 'nav-hover';
	lens.className = 'nav-lens';
	hover.setAttribute('aria-hidden', 'true');
	lens.setAttribute('aria-hidden', 'true');
	nav.prepend(lens, hover);

	/** @type {HTMLAnchorElement | null} */
	let current = null;

	/**
	 * @param {HTMLElement} shape
	 * @param {HTMLElement} link
	 * @param {boolean} jump  Place without the move animation.
	 */
	function place(shape, link, jump) {
		if (jump) shape.setAttribute('data-jump', '');
		shape.style.setProperty('--x', `${link.offsetLeft}px`);
		shape.style.setProperty('--w', `${link.offsetWidth}px`);
		shape.setAttribute('data-on', '');
		if (jump) requestAnimationFrame(() => requestAnimationFrame(() => shape.removeAttribute('data-jump')));
	}

	nav.addEventListener('pointerover', (e) => {
		const link = /** @type {HTMLElement} */ (e.target).closest?.('a');
		if (!link || !nav.contains(link)) return;
		// Appearing: start at the link. Already shown: glide from the last one.
		place(hover, link, !hover.hasAttribute('data-on'));
	});
	nav.addEventListener('pointerleave', () => hover.removeAttribute('data-on'));

	// Link widths change with the window (text on wide screens, icons on phones).
	new ResizeObserver(() => {
		if (current) place(lens, current, true);
	}).observe(nav);

	return {
		setCurrent(link) {
			if (link === current) return;
			const first = !current;
			current = link;
			if (link) place(lens, link, first);
			else lens.removeAttribute('data-on');
		},
	};
}
