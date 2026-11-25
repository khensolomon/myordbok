// @ts-check
/**
 * The privacy policy, as content: one source for the app's page
 * (app/reader/privacy.js, drawn with the DOM) and the server's
 * (worker/routes/page.js, /privacy as HTML, readable without scripts, as
 * the stores' reviewers and search engines read it).
 *
 * Kept in step with what the app does: any change to data handling
 * (analytics, sign-in, storage, purchases) changes this text and UPDATED.
 *
 * A section is a heading and blocks: { p: inline[] }, { ul: inline[][] },
 * or { choice: true } (the app's analytics choice; on the server, a line
 * saying where to make it). Inline: a string, or { href, text } a link
 * ({ external: true } opens elsewhere).
 */

export const UPDATED = '25 November 2026';
export const TITLE = 'Privacy Policy';
/** The page's description, for the server's <meta name="description">. */
export const DESCRIPTION = 'What data the MyOrdbok dictionary, its website and its iOS and Android apps handle, why, and the choices available.';

const CONTACT = { href: '/contact', text: 'the contact form' };

/**
 * @typedef {string | { href: string, text: string, external?: boolean }} Inline
 * @typedef {{ p: Inline[] } | { ul: Inline[][] } | { choice: true }} Block
 * @typedef {{ heading: string, blocks: Block[] }} Section
 */

/** @type {Inline[]} */
export const INTRO = [
	'MyOrdbok is a free English–Myanmar dictionary: this website, myordbok.com, and the MyOrdbok apps for iOS and Android. Reading, searching and offline use need no account. This page explains what data MyOrdbok handles, why, and the choices available.',
];

/** @type {Section[]} */
export const SECTIONS = [
	{
		heading: 'Messages',
		blocks: [
			{
				p: [
					'A message sent through ',
					CONTACT,
					' is kept with the kind of message, the page it was about, the interface language and, when signed in, the account that sent it. An email address left for a reply is used only to answer that message. Messages are read by the site’s administrators and deleted with the account that sent them, or on request.',
				],
			},
		],
	},
	{
		heading: 'Reading and searching',
		blocks: [
			{
				p: [
					'Searches are sent to the MyOrdbok server only to find matching words. For each search page the server adds one to a count of that word for that day, noting whether the dictionary had it, so missing words can be added. Nothing about who searched is kept with it, and no search history is kept on the server. Suggestions while typing, numbers and sums are not counted. The home page lists words several different searches looked for in the past week, drawn from these counts alone.',
				],
			},
			{
				p: [
					'Offline use is counted the same way, without words. Each download of offline data adds one to a count for that day, noting whether it replaced an older copy. Once a day, a device that keeps the definitions sends which of them it keeps and how many words it answered offline since it last did; the device keeps that number until then, and nothing else. Nothing identifying the device or its owner is sent with it.',
				],
			},
			{
				p: [
					'MyOrdbok runs on Cloudflare. Like any web host, Cloudflare processes technical request data such as IP address, browser type and time of request to deliver pages and protect the service from abuse.',
				],
			},
		],
	},
	{
		heading: 'Stored on your device',
		blocks: [
			{ p: ['Some data stays in the browser or app on the device and is never sent to MyOrdbok:'] },
			{
				ul: [
					['Settings such as theme, interface language and the analytics choice (local storage).'],
					['The last few searches, shown under the search box on the home page (local storage); “Clear” there removes them all, and a single one can be removed on its own.'],
					['Test yourself: the words practised, when each comes back, and the day streak (local storage); “Forget my progress” on the Practice page removes them. Signed in, the same is also kept with the account, so it follows the account to every device; forgetting it there removes that copy too.'],
					['Dictionary data kept for offline use (IndexedDB): the word lists, which arrive by themselves after the first visit (about 0.6 MB, not when the browser saves data), and the definitions chosen on the Offline page.'],
					['In the apps: whether the store account supports MyOrdbok, and how often each tip was given from the device (see Supporting MyOrdbok).'],
				],
			},
			{ p: ['Clearing the site data in the browser, or removing the app, deletes all of it.'] },
		],
	},
	{
		heading: 'Analytics',
		blocks: [
			{
				p: [
					'With permission, MyOrdbok uses Google Analytics to count visits and see which pages are used, so the dictionary can be improved. Nothing is loaded and no analytics cookies are set until “Allow” is chosen.',
				],
			},
			{
				p: [
					'When allowed, Google Analytics sets the cookies _ga and _ga_<id> and records pages viewed, approximate location (country or city), device and browser type. Advertising features are switched off. Google processes this data under its own ',
					{ href: 'https://policies.google.com/privacy', text: 'privacy policy', external: true },
					'.',
				],
			},
			{
				p: [
					'The same choice covers Test yourself: when allowed, the answers of a round are counted on MyOrdbok’s own server by question and choice (the word, the right answer and the one picked), with no account, device or address, so editors can see which questions are often missed. A question reported as wrong is kept as shown, with the note written and, when signed in, the account.',
				],
			},
			{ choice: true },
		],
	},
	{
		heading: 'Accounts',
		blocks: [
			{
				p: [
					'Signing in with Google, GitHub or Apple is optional and only needed to like or dislike entries, comment, suggest edits, or keep Test yourself progress across devices. MyOrdbok then stores:',
				],
			},
			{
				ul: [
					['The name, profile picture, account ID and email address that Google, GitHub or Apple provides. The email is kept only when the provider has verified it (with Apple, it may be a private relay address Apple makes), and is used only to recognise the same person signing in with another provider. It is never used for advertising or newsletters, and never shared.'],
					['On the website, a sign-in session kept in a cookie (__Host-mo_session) for up to 30 days, and during sign-in a short-lived cookie (__Host-mo_oauth) that protects the sign-in itself. Both are required for signing in and used for nothing else.'],
					['In the apps, a sign-in begins on the website: the app shows a short code, approved at myordbok.com/link by the signed-in account. The app then keeps its own session token on the device; the server keeps only a hash of it, with the kind of device (iOS, Android or desktop) and when it was linked, listed under linked devices on the Account page, where any of them can be signed out.'],
					['Likes, dislikes, comments and suggestions, linked to the account. Comments and accepted suggestions show the account name.'],
					['How many times the account downloaded the offline definitions, today and in all, to hold downloads to a few a day. Admins see these two numbers; nothing else about the downloads is kept.'],
				],
			},
			{
				p: [
					'An account can be deleted at any time under Account in the workspace. Deleting it removes its sign-in details, sessions and linked devices, ratings, comments and suggestions still waiting for review; suggestions already reviewed stay in the dictionary’s history as “Former member”, without the name attached.',
				],
			},
		],
	},
	{
		heading: 'Supporting MyOrdbok',
		blocks: [
			{
				p: [
					'Everything in MyOrdbok is free. In the iOS and Android apps, a one-time Supporter purchase and tips can be given through the App Store or Google Play; they unlock nothing. The payment is made and handled entirely by Apple or Google under their own terms and privacy policies: MyOrdbok receives no card, bank or billing details.',
				],
			},
			{
				p: [
					'The app asks the store which MyOrdbok purchases the store account owns (the Supporter purchase, or a purchase made in an earlier version of the app), and keeps on the device whether the account is a supporter and how often each tip was given. None of this is sent to the MyOrdbok server.',
				],
			},
		],
	},
	{
		heading: 'Sharing',
		blocks: [
			{
				p: [
					'MyOrdbok does not sell or share personal data. The only services involved are Cloudflare (hosting), Google, GitHub or Apple (sign-in, when used), Apple’s App Store and Google Play (the apps, and payments when given), and Google Analytics (when allowed).',
				],
			},
		],
	},
	{
		heading: 'Your rights',
		blocks: [
			{
				p: [
					'Anyone may ask to see, correct or delete personal data held about them, or object to its use. Analytics consent can be withdrawn at any time on this page, and sign-in data is kept only as long as the account exists.',
				],
			},
		],
	},
	{
		heading: 'Words in the dictionary',
		blocks: [
			{
				p: [
					'As a dictionary, MyOrdbok includes words that some readers may find sensitive or offensive. They are listed only to explain the language. Parental guidance is advised for younger users. Inappropriate content can be reported and will be reviewed promptly.',
				],
			},
		],
	},
	{
		heading: 'Contact',
		blocks: [
			{ p: ['Questions, data requests and reports: ', CONTACT, '.'] },
			{ p: ['This policy may change as MyOrdbok develops; the date at the top shows the latest update.'] },
		],
	},
];

const escape = (/** @type {string} */ s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** @param {Inline[]} inline */
function inlineHtml(inline) {
	return inline
		.map((i) => (typeof i === 'string' ? escape(i) : `<a href="${escape(i.href)}"${i.external ? ' rel="noopener" target="_blank"' : ''}>${escape(i.text)}</a>`))
		.join('');
}

/**
 * The whole policy as HTML, for the server's page: what the app draws, but
 * for the analytics choice, which needs the app's scripts.
 * @returns {string}
 */
export function privacyHtml() {
	/** @param {Block} b */
	const block = (b) => {
		if ('p' in b) return `<p>${inlineHtml(b.p)}</p>`;
		if ('ul' in b) return `<ul>${b.ul.map((li) => `<li>${inlineHtml(li)}</li>`).join('')}</ul>`;
		return '<p class="notice">The analytics choice is made on this page in the app, or with the notice shown at the first visit.</p>';
	};
	return [
		'<article class="page prose" lang="en">',
		`<h1>${TITLE}</h1>`,
		`<p class="notice">Updated ${UPDATED}</p>`,
		`<p>${inlineHtml(INTRO)}</p>`,
		...SECTIONS.map((s) => `<section><h2>${escape(s.heading)}</h2>${s.blocks.map(block).join('')}</section>`),
		'</article>',
	].join('');
}
