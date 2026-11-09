// @ts-check
/**
 * About: what MyOrdbok is, what it holds, how it grows, how to help, the
 * version, and the sources it builds on. Figures (meanings, last update,
 * version) come live from /api/health, so they never go stale; offline or
 * without a dictionary the page still reads well without them.
 */
import { getJSON } from '#platform/http.js';
import { parseVersion } from '#shared/version.js';
import { REPOSITORY as REPO } from '../core/config.js';
import { h } from '../core/dom.js';
import { definitionHref } from '../core/routes.js';

const PAYPAL = 'https://www.paypal.com/donate/?hosted_button_id=C9PDG3T47WJ26';
const SPONSORS = 'https://github.com/sponsors/khensolomon';

export function title() {
	return 'About';
}

/**
 * @typedef {object} Health
 * @property {string} version
 * @property {{ built: string | null, rows: Record<string, number> } | null} dictionary
 */

export async function view() {
	/** @type {Health | null} */
	const health = await getJSON('/api/health').catch(() => null);
	const rows = health?.dictionary?.rows ?? {};
	const built = health?.dictionary?.built;
	const n = (/** @type {number | undefined} */ v) => (typeof v === 'number' ? v.toLocaleString('en') : null);

	return h(
		'article',
		{ class: 'page prose about' },
		h('h1', null, 'A comprehensive online Myanmar dictionary'),
		h('p', { class: 'about-lead' }, 'Look up a word in English or in Myanmar and read its meaning in the other language.'),

		part(
			'The name',
			h(
				'p',
				null,
				h('q', null, 'Ordbok'),
				' is ',
				link('Norwegian'),
				' for ',
				link('dictionary'),
				': a book of words, each described in its own terms. ',
				h('strong', null, 'MyOrdbok'),
				' is the Myanmar dictionary: ',
				h('q', null, 'My'),
				' for Myanmar, ',
				h('q', null, 'Ordbok'),
				' for dictionary. Since 2010 it has been one of the most used Myanmar dictionaries online.',
			),
		),

		part(
			'What it holds',
			n(rows.emd_sense) && n(rows.med_sense)
				? h(
						'ul',
						{ class: 'about-figures' },
						figure(n(rows.emd_sense), 'English → Myanmar meanings'),
						figure(n(rows.med_sense), 'Myanmar → English meanings'),
						n(rows.mya_word) ? figure(n(rows.mya_word), 'Myanmar headwords') : null,
					)
				: null,
			h(
				'p',
				null,
				'English words come with their forms (go, went, gone), spelling variants (colour, color), synonyms, similar and broader words, opposites and related words. Myanmar words come with their pronunciation in IPA and in MLC transcription. A grammar of Myanmar, ',
				h('a', { href: '/grammar' }, 'မြန်မာသဒ္ဒါ'),
				', sits beside the dictionary.',
			),
			h(
				'p',
				null,
				'Every meaning shows how far it has been checked: a ',
				h('em', null, 'draft'),
				' is not yet checked, and ',
				h('em', null, 'awaiting review'),
				' means checked and waiting for a native speaker. The rest have been reviewed.',
			),
			built ? h('p', { class: 'notice' }, `Dictionary last updated ${built}.`) : null,
		),

		part(
			'Aim',
			h(
				'p',
				null,
				'Practical, meaningful definitions for beginners and advanced learners alike, quick to find and easy to read on any device. The dictionary keeps growing, with attention to how words are actually used, including regional forms.',
			),
		),

		part(
			'How it grows',
			h(
				'p',
				null,
				'The dictionary is kept as reviewed data and released in batches. Each release is checked as a whole before it reaches the site, so a half-finished change never shows. Corrections and new meanings suggested by readers are reviewed by editors and arrive with the next release.',
			),
		),

		part(
			'Help improve it',
			h(
				'p',
				null,
				'Reading and searching need no account. Signing in with Google or GitHub lets you like an entry, comment, and suggest a correction or a new meaning right beside it. MyOrdbok then keeps the name, picture and verified email address the provider gives, only to recognise you and to credit your contributions; it never uses them for advertising and never shares them. The ',
				h('a', { href: '/privacy' }, 'Privacy'),
				' page explains what is stored and how to have it deleted. Mistakes and suggestions are also welcome as an ',
				h('a', { href: `${REPO}/issues`, rel: 'noopener' }, 'issue on GitHub'),
				'.',
			),
		),

		part(
			'Support',
			h(
				'p',
				null,
				'MyOrdbok is free, without advertising. Donations pay for the servers and for further development, and for nothing else.',
			),
			h(
				'p',
				{ class: 'about-actions' },
				h('a', { class: 'about-button', href: PAYPAL, rel: 'noopener' }, 'Donate with PayPal'),
				h('a', { class: 'about-button', href: SPONSORS, rel: 'noopener' }, 'Sponsor on GitHub'),
			),
		),

		part(
			'Version',
			health?.version ? h('p', null, h('strong', null, `MyOrdbok ${health.version}`)) : null,
			h('p', null, 'The version reads the year, month and day of the latest change, then how many changes there have been so far', versionExample(health?.version), '. It identifies a release by its date; it says nothing about how large a change was.'),
		),

		part(
			'Sources',
			h(
				'ul',
				null,
				h('li', null, 'Synonyms, similar, broader and opposite words: ', h('a', { href: 'https://wordnet.princeton.edu', rel: 'noopener' }, 'Princeton WordNet'), '.'),
				h('li', null, 'Related words: the Moby Thesaurus by Grady Ward, in the public domain.'),
				h(
					'li',
					null,
					'Grammar: ',
					h(
						'a',
						{ href: 'https://my.wikipedia.org/wiki/%E1%80%99%E1%80%BC%E1%80%94%E1%80%BA%E1%80%99%E1%80%AC%E1%80%9E%E1%80%92%E1%80%BA%E1%80%92%E1%80%AB', rel: 'noopener', lang: 'my' },
						'မြန်မာသဒ္ဒါ',
					),
					', volumes 1 and 2.',
				),
				h('li', null, 'The app itself is open source: ', h('a', { href: REPO, rel: 'noopener' }, 'khensolomon/myordbok'), ' on GitHub.'),
			),
			h('p', null, 'How MyOrdbok handles data is set out in the ', h('a', { href: '/privacy' }, 'privacy policy'), '.'),
		),
	);
}

/**
 * ": 26.11.8+20 is change 20, made on 8 November 2026", from the running version.
 * @param {string | undefined} version
 */
function versionExample(version) {
	if (!version) return '';
	const v = parseVersion(version); // the server's own version; a bad one is a bug worth seeing
	const date = new Date(Date.UTC(2000 + v.yy, v.mm - 1, v.dd)).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
	return `: ${version} is change ${v.changes}, made on ${date}`;
}

/**
 * @param {string} heading
 * @param {...import('../core/dom.js').Child} body
 */
function part(heading, ...body) {
	return h('section', null, h('h2', null, heading), body);
}

/**
 * @param {string | null} value
 * @param {string} label
 */
function figure(value, label) {
	return h('li', null, h('strong', null, value), h('span', null, label));
}

/** @param {string} word */
function link(word) {
	return h('a', { href: definitionHref(word) }, word);
}
