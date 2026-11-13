// @ts-check
/**
 * /myanmar-fonts: the Myanmar fonts page has been retired. The address stays
 * so links to it still land somewhere useful: why it went, where good
 * Myanmar fonts are found today, and a way to tell MyOrdbok if it is missed.
 */
import { CONTACT } from '../core/config.js';
import { h } from '../core/dom.js';
import { mark, t } from '../i18n/index.js';

/** Maintained Myanmar fonts, each free for any use. */
const ELSEWHERE = [
	{ name: 'Noto Sans Myanmar', by: 'Google Fonts', href: 'https://fonts.google.com/noto/specimen/Noto+Sans+Myanmar', about: mark('A clear, modern typeface, the default on many phones; Noto Serif Myanmar beside it.') },
	{ name: 'Padauk', by: 'SIL International', href: 'https://software.sil.org/padauk/', about: mark('A well-tested font for Burmese and the other languages written in Myanmar script.') },
];

export function title() {
	return t('Myanmar fonts');
}

export function view() {
	return h(
		'article',
		{ class: 'page retired' },
		h('span', { class: 'retired-letter', lang: 'my', 'aria-hidden': 'true' }, 'က'),
		h('p', { class: 'retired-kicker' }, t('Myanmar fonts')),
		h('h1', null, t('This page has been retired')),
		h(
			'p',
			{ class: 'retired-lead' },
			t('For years this page listed Myanmar fonts, many from the time before Unicode. Today every phone and computer shows Myanmar in Unicode, and better collections are kept up elsewhere, so the page no longer gave readers much. We took it down to keep MyOrdbok about the dictionary.'),
		),
		h(
			'section',
			{ class: 'retired-part', 'aria-labelledby': 'retired-elsewhere' },
			h('h2', { id: 'retired-elsewhere' }, t('Good Myanmar fonts today')),
			h(
				'div',
				{ class: 'retired-cards' },
				ELSEWHERE.map((f) => h('a', { class: 'retired-card', href: f.href, rel: 'noopener' }, h('strong', null, f.name), h('span', { class: 'retired-by' }, f.by), h('span', null, t(f.about)))),
			),
		),
		h(
			'p',
			{ class: 'retired-feedback' },
			t('Miss the page, or looking for a font we could help with?'),
			' ',
			h('a', { href: `${CONTACT}?kind=feedback` }, t('Tell MyOrdbok')),
			'.',
		),
	);
}
