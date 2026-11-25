// @ts-check
/**
 * Privacy policy: the text is shared/privacy.js, which the server also
 * writes as HTML for /privacy (worker/routes/page.js); here it is drawn
 * with the analytics choice in its place.
 */
import { INTRO, SECTIONS, TITLE, UPDATED } from '#shared/privacy.js';
import { englishOnly, t } from '../i18n/index.js';
import { analyticsAvailable, getChoice, setChoice } from '../core/consent.js';
import { h } from '../core/dom.js';

export function title() {
	return t('Privacy Policy');
}

/** @param {import('#shared/privacy.js').Inline[]} inline */
const inline = (inline) =>
	inline.map((i) =>
		typeof i === 'string' ? i : h('a', i.external ? { href: i.href, rel: 'noopener', target: '_blank' } : { href: i.href }, i.text),
	);

function choiceControl() {
	if (!analyticsAvailable()) {
		return h('p', { class: 'notice' }, 'Analytics never runs on this address.');
	}
	const status = h('p', { 'aria-live': 'polite' });
	const render = () => {
		const c = getChoice();
		status.textContent =
			c === 'granted' ? 'Current choice: analytics allowed.' : c === 'denied' ? 'Current choice: analytics declined.' : 'No choice made yet.';
	};
	render();
	window.addEventListener('mo:consent', render);
	return h(
		'div',
		{ class: 'choice' },
		status,
		h(
			'div',
			{ class: 'consent-actions' },
			h('button', { type: 'button', class: 'consent-no', onClick: () => setChoice('denied') }, 'Decline analytics'),
			h('button', { type: 'button', class: 'consent-yes', onClick: () => setChoice('granted') }, 'Allow analytics'),
		),
	);
}

/** @param {import('#shared/privacy.js').Block} b */
function block(b) {
	if ('p' in b) return h('p', null, ...inline(b.p));
	if ('ul' in b) return h('ul', null, b.ul.map((li) => h('li', null, ...inline(li))));
	return choiceControl();
}

export function view() {
	return h(
		'article',
		{ class: 'page prose', lang: 'en' },
		englishOnly(),
		h('h1', null, TITLE),
		h('p', { class: 'notice' }, `Updated ${UPDATED}`),
		h('p', null, ...inline(INTRO)),
		SECTIONS.map((s) => h('section', null, h('h2', null, s.heading), ...s.blocks.map(block))),
	);
}
