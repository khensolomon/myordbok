// @ts-check
/**
 * Terms of use. Kept in step with what the app actually offers (offline
 * downloads, sign-in, suggestions); a change there updates this page too.
 */
import { CONTACT, REPOSITORY } from '../core/config.js';
import { englishOnly, t } from '../i18n/index.js';
import { h } from '../core/dom.js';

const UPDATED = '8 November 2026';

export function title() {
	return t('Terms of Use');
}

/**
 * @param {string} heading
 * @param {...import('../core/dom.js').Child | import('../core/dom.js').Child[]} body
 */
function part(heading, ...body) {
	return h('section', null, h('h2', null, heading), ...body);
}

/** @param {...import('../core/dom.js').Child | import('../core/dom.js').Child[]} items */
const list = (...items) => h('ul', null, items.map((i) => h('li', null, i)));

export function view() {
	return h(
		'article',
		{ class: 'page prose', lang: 'en' },
		englishOnly(),
		h('h1', null, 'Terms of Use'),
		h('p', { class: 'notice' }, `Updated ${UPDATED}`),
		h(
			'p',
			null,
			'These terms cover the use of MyOrdbok: the website at myordbok.com, the app installed from it, and everything they offer. Using MyOrdbok means accepting them.',
		),

		h(
			'section',
			{ class: 'in-short' },
			h('h2', null, 'In short'),
			list(
				'Use MyOrdbok for personal, educational and other non-commercial purposes.',
				'Quote short passages with credit; do not copy the dictionary in bulk or harvest it automatically.',
				'Meanings can be wrong; check anything important against other sources.',
				'Suggestions and comments made when signed in may be edited and published as part of the dictionary.',
				'MyOrdbok is provided as it is, free and without guarantees.',
			),
		),

		part(
			'Using MyOrdbok',
			h(
				'p',
				null,
				'MyOrdbok is a free, non-commercial English–Myanmar dictionary, offered as general information. It sells nothing and provides no paid or commercial services. Reading and searching need no account. It may be used for personal, educational and other non-commercial purposes, and not for anything unlawful, or in a way that harms the service or other readers.',
			),
		),

		part(
			'The dictionary content',
			h(
				'p',
				null,
				'The definitions, examples and the way they are arranged are the work of MyOrdbok and its contributors, and are protected by copyright. Short quotations, such as a definition or an example, are welcome for study, teaching, reviews and discussion, with MyOrdbok named as the source.',
			),
			h('p', null, 'Without written permission, it is not allowed to:'),
			list(
				'copy, republish or sell the dictionary or a substantial part of it;',
				'harvest it automatically: scraping, crawling the search, or sending requests in bulk;',
				'share or republish the offline download; it is for reading on the device it was downloaded to.',
			),
			h(
				'p',
				null,
				'Some parts come from other sources and remain under their own terms: synonyms, similar, broader and opposite words from Princeton WordNet (under its own licence), and related words from the Moby Thesaurus (public domain).',
			),
			h(
				'p',
				null,
				'The app itself is open source, and its code may be used under the MIT licence of the ',
				h('a', { href: REPOSITORY, rel: 'noopener' }, 'repository'),
				'. That licence covers the code only, not the dictionary content.',
			),
		),

		part(
			'Accuracy',
			h(
				'p',
				null,
				'Meanings are checked by editors and native speakers, but every dictionary has gaps and mistakes. Meanings marked ',
				h('em', null, 'draft'),
				' or ',
				h('em', null, 'awaiting review'),
				' have not been fully checked. MyOrdbok is general information, not a professional translation or legal, medical or other advice. Anything important should be checked against other sources.',
			),
		),

		part(
			'Accounts and contributions',
			h(
				'p',
				null,
				'Signing in with Google or GitHub is optional. It allows liking or disliking entries, commenting, and suggesting corrections or new meanings. Each account is personal; activity under it is the account holder’s responsibility.',
			),
			h(
				'p',
				null,
				'Contributions must be the contributor’s own work, or freely usable, and must respect others. By submitting a suggestion or comment, the contributor allows MyOrdbok to use, edit, publish and distribute it as part of the dictionary, without payment and without time limit. Editors review suggestions before they are published and may change or decline them. Accepted contributions stay in the dictionary when an account is deleted, without the name attached.',
			),
			h(
				'p',
				null,
				'Comments and suggestions that are abusive, misleading, spam, or that infringe someone else’s rights may be removed, and accounts used for them may be suspended or closed.',
			),
		),

		part(
			'Personal data',
			h('p', null, 'How MyOrdbok handles personal data is set out in the ', h('a', { href: '/privacy' }, 'Privacy Policy'), '.'),
		),

		part(
			'Myanmar fonts',
			h(
				'p',
				null,
				'The ',
				h('a', { href: '/myanmar-fonts' }, 'Myanmar fonts'),
				' page describes older Myanmar fonts, many made before Unicode, for study and research into how Myanmar script was displayed. MyOrdbok does not own these fonts. Their licences differ; for any use beyond study, permission belongs with each font’s owner.',
			),
		),

		part(
			'Availability and liability',
			h(
				'p',
				null,
				'MyOrdbok is provided free, as it is and as available, without warranties of any kind. It may change, pause or end any part of the service. As far as the law allows, MyOrdbok is not liable for any loss or damage arising from the use of the service or its content.',
			),
		),

		part(
			'Reporting a problem',
			h(
				'p',
				null,
				'Mistakes in the dictionary can be reported as an ',
				h('a', { href: `${REPOSITORY}/issues`, rel: 'noopener' }, 'issue on GitHub'),
				'. Content believed to infringe someone’s rights, and anything else about these terms: ',
				h('a', { href: CONTACT }, 'the contact form'),
				'.',
			),
		),

		part(
			'Changes',
			h(
				'p',
				null,
				'These terms may change as MyOrdbok develops; the date at the top shows the latest update. Continuing to use MyOrdbok after a change means accepting the new terms.',
			),
		),
	);
}
