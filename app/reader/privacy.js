// @ts-check
/**
 * Privacy policy. Kept in step with what the app actually does; any change
 * to data handling (analytics, sign-in, storage) updates this page too.
 */
import { CONTACT } from '../core/config.js';
import { englishOnly, t } from '../i18n/index.js';
import { analyticsAvailable, getChoice, setChoice } from '../core/consent.js';
import { h } from '../core/dom.js';

const UPDATED = '10 November 2026';

export function title() {
	return t('Privacy Policy');
}

/**
 * @param {string} heading
 * @param {...(Node | string | null)} body
 */
function part(heading, ...body) {
	return h('section', null, h('h2', null, heading), ...body);
}

/** @param {...(Node | string)} items */
const list = (...items) => h('ul', null, items.map((i) => h('li', null, i)));

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

export function view() {
	return h(
		'article',
		{ class: 'page prose', lang: 'en' },
		englishOnly(),
		h('h1', null, 'Privacy Policy'),
		h('p', { class: 'notice' }, `Updated ${UPDATED}`),
		h(
			'p',
			null,
			'MyOrdbok is a free English–Myanmar dictionary. Reading, searching and offline use need no account. This page explains what data the app handles, why, and the choices available.',
		),

		part(
			'Messages',
			h(
				'p',
				null,
				'A message sent through ',
				h('a', { href: CONTACT }, 'the contact form'),
				' is kept with the kind of message, the page it was about, the interface language and, when signed in, the account that sent it. An email address left for a reply is used only to answer that message. Messages are read by the site’s administrators and deleted with the account that sent them, or on request.',
			),
		),

		part(
			'Reading and searching',
			h(
				'p',
				null,
				'Searches are sent to the MyOrdbok server only to find matching words. For each search page the server adds one to a count of that word for that day, noting whether the dictionary had it, so missing words can be added. Nothing about who searched is kept with it, and no search history is kept on the server. Suggestions while typing, numbers and sums are not counted.',
			),
			h(
				'p',
				null,
				'MyOrdbok runs on Cloudflare. Like any web host, Cloudflare processes technical request data such as IP address, browser type and time of request to deliver pages and protect the service from abuse.',
			),
		),

		part(
			'Stored on your device',
			h('p', null, 'Some data stays in the browser or app on the device and is never sent to MyOrdbok:'),
			list(
				'Settings such as theme, interface language and the analytics choice (local storage).',
				'Dictionary data downloaded for offline use (IndexedDB).',
			),
			h('p', null, 'Clearing the site data in the browser, or removing the app, deletes all of it.'),
		),

		part(
			'Analytics',
			h(
				'p',
				null,
				'With permission, MyOrdbok uses Google Analytics to count visits and see which pages are used, so the dictionary can be improved. Nothing is loaded and no analytics cookies are set until “Allow” is chosen.',
			),
			h(
				'p',
				null,
				'When allowed, Google Analytics sets the cookies _ga and _ga_<id> and records pages viewed, approximate location (country or city), device and browser type. Advertising features are switched off. Google processes this data under its own ',
				h('a', { href: 'https://policies.google.com/privacy', rel: 'noopener', target: '_blank' }, 'privacy policy'),
				'.',
			),
			choiceControl(),
		),

		part(
			'Accounts',
			h(
				'p',
				null,
				'Signing in with Google or GitHub is optional and only needed to like or dislike entries, comment, or suggest edits. MyOrdbok then stores:',
			),
			list(
				'The name, profile picture, account ID and email address that Google or GitHub provides. The email is kept only when the provider has verified it, and is used only to recognise the same person signing in with either provider. It is never used for advertising or newsletters, and never shared.',
				'A sign-in session, kept in a cookie (__Host-mo_session) for up to 30 days, and during sign-in a short-lived cookie (__Host-mo_oauth) that protects the sign-in itself. Both are required for signing in and used for nothing else.',
				'Likes, dislikes, comments and suggestions, linked to the account. Comments and accepted suggestions show the account name.',
			),
			h(
				'p',
				null,
				'An account can be deleted at any time under Account in the workspace. Deleting it removes its sign-in details, sessions, ratings, comments and suggestions still waiting for review; suggestions already reviewed stay in the dictionary’s history as “Former member”, without the name attached.',
			),
		),

		part(
			'Sharing',
			h(
				'p',
				null,
				'MyOrdbok does not sell or share personal data. The only services involved are Cloudflare (hosting), Google or GitHub (sign-in, when used) and Google Analytics (when allowed).',
			),
		),

		part(
			'Your rights',
			h(
				'p',
				null,
				'Anyone may ask to see, correct or delete personal data held about them, or object to its use. Analytics consent can be withdrawn at any time above, and sign-in data is kept only as long as the account exists.',
			),
		),

		part(
			'Words in the dictionary',
			h(
				'p',
				null,
				'As a dictionary, MyOrdbok includes words that some readers may find sensitive or offensive. They are listed only to explain the language. Parental guidance is advised for younger users. Inappropriate content can be reported and will be reviewed promptly.',
			),
		),

		part(
			'Contact',
			h('p', null, 'Questions, data requests and reports: ', h('a', { href: CONTACT }, 'the contact form'), '.'),
			h('p', null, 'This policy may change as the app develops; the date at the top shows the latest update.'),
		),
	);
}
