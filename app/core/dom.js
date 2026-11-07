// @ts-check
/**
 * The one way views build DOM: `h(tag, props, ...children)`.
 * Text is always inserted as text nodes, never as HTML.
 */

/**
 * @typedef {Node | string | number | null | undefined | false} Child
 */

/**
 * @template {string} K
 * @param {K} tag
 * @param {Record<string, unknown> | null} [props]  `class`, `on<Event>` handlers, attributes, or `dataset`.
 * @param {...(Child | Child[])} children
 * @returns {K extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[K] : HTMLElement}
 */
export function h(tag, props, ...children) {
	const el = document.createElement(tag);
	for (const [name, value] of Object.entries(props ?? {})) {
		if (value === undefined || value === null || value === false) continue;
		if (name.startsWith('on') && typeof value === 'function') {
			el.addEventListener(name.slice(2).toLowerCase(), /** @type {EventListener} */ (value));
		} else if (name === 'dataset' && typeof value === 'object') {
			Object.assign(el.dataset, value);
		} else {
			el.setAttribute(name === 'className' ? 'class' : name, value === true ? '' : String(value));
		}
	}
	append(el, children);
	return /** @type {any} */ (el);
}

/**
 * @param {Node} parent
 * @param {(Child | Child[])[]} children
 */
export function append(parent, children) {
	for (const child of children.flat()) {
		if (child === null || child === undefined || child === false) continue;
		parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
	}
}

/**
 * Inline SVG icon from the shared set (24 grid, stroke drawn by CSS).
 * @param {string} paths  Trusted markup from `icons.js`, never user input.
 * @param {number} [size]
 */
export function icon(paths, size = 20) {
	const ns = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', String(size));
	svg.setAttribute('height', String(size));
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'icon');
	svg.innerHTML = paths;
	return svg;
}
