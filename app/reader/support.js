// @ts-check
/**
 * Support (/support): why MyOrdbok asks, how to give, how to help without
 * money, and thanks to everyone who has given, by year (/api/support:
 * totals, and names only with each donor's consent, never an amount beside
 * a name). Offline, or before anyone is listed, the page still reads well
 * without the figures and the names.
 */
import { CONTACT, GIVE } from '../core/config.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { supportFigures } from '../data/api.js';
import { num, t } from '../i18n/index.js';

export function title() {
	return t('Support MyOrdbok');
}

export async function view() {
	const figures = await supportFigures().catch(() => null);
	const share = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'support-way' }, way('↗', t('Share MyOrdbok'), t('Tell a classmate, a teacher or a group that learns English or Myanmar.'))));
	share.addEventListener('click', () => shareSite(share));

	return h(
		'article',
		{ class: 'page support' },
		h(
			'section',
			{ class: 'support-hero' },
			h(
				'div',
				{ class: 'support-intro' },
				h('p', { class: 'support-kicker' }, t('Support MyOrdbok')),
				h('h1', null, t('Free for everyone, kept going by readers')),
				h('p', { class: 'support-lead' }, t('Since 2010 MyOrdbok has been free and without advertising, built by one person in holidays and free evenings. Readers who give pay for the servers and the time to keep it growing, so it stays free for the student, the translator and the family abroad who need it.')),
				h(
					'div',
					{ class: 'support-actions' },
					h('a', { class: 'support-primary', href: '#give' }, icon(ICONS.like, 16), t('Give to MyOrdbok')),
					h('a', { class: 'support-secondary', href: '#help' }, t('Other ways to help')),
				),
			),
			figures && figures.count ? since(figures) : null,
		),

		h(
			'section',
			{ id: 'give', class: 'support-part' },
			head(t('Give'), t('Once or every month, in any amount. You choose whether your name is shown below.')),
			h(
				'div',
				{ class: 'support-cards' },
				giveCard('PayPal', t('Card or PayPal account, once or monthly.'), t('Give with PayPal'), GIVE.paypal),
				giveCard('GitHub Sponsors', t('For developers: a monthly sponsorship shown on GitHub.'), t('Sponsor on GitHub'), GIVE.github),
			),
		),

		h(
			'section',
			{ id: 'help', class: 'support-part' },
			head(t('Other ways to help'), t('Not everyone can give money. The dictionary grows just as much from these.')),
			h(
				'div',
				{ class: 'support-cards' },
				h('div', { class: 'support-way' }, way('✎', t('Suggest a meaning'), t('Add a meaning a word lacks, or correct one, with ✎ beside it on any entry.'))),
				h('div', { class: 'support-way' }, way('★', t('Rate meanings'), t('A thumbs up or down shows editors what to improve first.'))),
				share,
				h('a', { class: 'support-way', href: `${CONTACT}?kind=word` }, way('?', t('Tell us about a word'), t('A word we lack, or a mistake: the contact form reaches us.'))),
			),
		),

		figures && figures.years.length ? thanks(figures.years) : null,
	);
}

/**
 * The totals since the first gift.
 * @param {import('../data/api.js').SupportFigures} f
 */
function since(f) {
	return h(
		'aside',
		{ class: 'support-since', 'aria-label': t('Since {year}', { year: f.since ?? '' }) },
		h('h2', null, t('Since {year}', { year: f.since ?? '' })),
		h(
			'dl',
			null,
			h('div', null, h('dt', null, t('donations')), h('dd', null, num(f.count))),
			h('div', null, h('dt', null, t('received, after fees')), h('dd', null, `$${num(Math.round(f.cents / 100))}`)),
		),
		h('p', null, t('Every dollar goes to the servers and to the dictionary, nothing else.')),
	);
}

/**
 * @param {string} title
 * @param {string} lead
 */
function head(title, lead) {
	return h('div', { class: 'support-head' }, h('h2', null, title), h('p', null, lead));
}

/**
 * @param {string} name
 * @param {string} about
 * @param {string} action
 * @param {string} href
 */
function giveCard(name, about, action, href) {
	return h('a', { class: 'support-give', href, rel: 'noopener' }, h('strong', null, name), h('span', null, about), h('span', { class: 'support-go' }, `${action} →`));
}

/**
 * @param {string} mark
 * @param {string} title
 * @param {string} text
 */
function way(mark, title, text) {
	return [h('span', { class: 'support-mark', 'aria-hidden': 'true' }, mark), h('span', { class: 'support-way-text' }, h('strong', null, title), h('span', null, text))];
}

/**
 * Everyone who has given, by year.
 * @param {import('../data/api.js').SupportFigures['years']} years
 */
function thanks(years) {
	return h(
		'section',
		{ class: 'support-part' },
		head(t('Thank you'), t('Everyone who has given, by year. Names only with their permission.')),
		h(
			'div',
			{ class: 'support-years' },
			years.map((y) =>
				h(
					'div',
					{ class: 'support-year' },
					h('h3', null, y.year),
					h(
						'ul',
						null,
						y.names.map((n) => h('li', { class: 'support-name' }, n.avatar_url ? h('img', { src: n.avatar_url, alt: '', width: 20, height: 20, loading: 'lazy', referrerpolicy: 'no-referrer' }) : h('span', { class: 'support-heart', 'aria-hidden': 'true' }, icon(ICONS.like, 12)), n.name)),
						y.anonymous ? h('li', { class: 'support-anonymous' }, y.names.length ? t('and {n} anonymous', { n: num(y.anonymous) }) : t('{n} anonymous', { n: num(y.anonymous) })) : null,
					),
				),
			),
		),
		h('p', { class: 'support-note' }, t('Missing, or shown the wrong way?'), ' ', h('a', { href: CONTACT }, t('Tell us')), ' ', t('and it is put right. Amounts are never shown beside a name.')),
	);
}

/**
 * The phone's own share sheet where there is one; elsewhere the address is
 * copied, and the button says so.
 * @param {HTMLButtonElement} button
 */
async function shareSite(button) {
	const data = { title: 'MyOrdbok', text: t('A free English–Myanmar dictionary'), url: location.origin };
	try {
		if (navigator.share) return await navigator.share(data);
		await navigator.clipboard.writeText(data.url);
		const text = button.querySelector('.support-way-text > span');
		if (text) text.textContent = t('The address is copied: paste it wherever you like.');
	} catch (err) {
		// Closing the share sheet is not an error.
		if (err instanceof Error && err.name === 'AbortError') return;
		const text = button.querySelector('.support-way-text > span');
		if (text) text.textContent = location.origin;
	}
}
