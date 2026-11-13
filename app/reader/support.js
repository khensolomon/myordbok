// @ts-check
/**
 * Support (/support): MyOrdbok as something readers keep going together.
 *
 *   hero       the invitation, and what it sustains: the dictionary in
 *              figures (/api/stats) and the years it has been free
 *   story      how it came about: one person's evenings, then readers,
 *              then the reader on this page
 *   gifts      what a gift pays for, and the two ways to give
 *   help       ways to help without money
 *   thanks     everyone who has given, by year (/api/support: totals, and
 *              names only with consent, never an amount beside a name)
 *   closing    thank you, in Myanmar first
 *
 * Offline, or before figures exist, the page still reads well: every part
 * that needs the network leaves out its numbers rather than the part.
 */
import { CONTACT, GIVE } from '../core/config.js';
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { dictionaryStats, supportFigures } from '../data/api.js';
import { num, t } from '../i18n/index.js';

/** The year MyOrdbok began. */
const BEGAN = 2010;

export function title() {
	return t('Support MyOrdbok');
}

export async function view() {
	const [figures, dict] = await Promise.all([supportFigures().catch(() => null), dictionaryStats().then((r) => r.stats).catch(() => null)]);
	const share = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'support-way' }, way(ICONS.copy, t('Share MyOrdbok'), t('Tell a classmate, a teacher or a group that learns English or Myanmar.'))));
	share.addEventListener('click', () => shareSite(share));
	const years = new Date().getFullYear() - BEGAN;

	return h(
		'article',
		{ class: 'page support' },

		h(
			'section',
			{ class: 'support-hero' },
			h('span', { class: 'support-badge', 'aria-hidden': 'true' }, icon(ICONS.like, 22)),
			h('p', { class: 'support-kicker' }, t('Support MyOrdbok')),
			h('h1', null, t('A dictionary we keep together')),
			h('p', { class: 'support-lead' }, t('MyOrdbok began in {year} in one person’s free evenings. It has grown because of readers like you: everyone who looks up a word, suggests a better meaning, tells a friend, or gives. Together we keep it free and without advertising, for the student, the translator and the family far from home.', { year: String(BEGAN) })),
			h(
				'div',
				{ class: 'support-actions' },
				jump(h('a', { class: 'support-primary', href: '#give' }, icon(ICONS.like, 16), t('Give to MyOrdbok'))),
				jump(h('a', { class: 'support-secondary', href: '#help' }, t('Other ways to help'))),
			),
			h(
				'dl',
				{ class: 'support-figures' },
				dict ? figure(num(dict.en.headwords), t('English words')) : null,
				dict ? figure(num(dict.my.headwords), t('Myanmar words')) : null,
				dict ? figure(num(dict.en.senses + dict.my.senses), t('meanings')) : null,
				figure(num(years), t('years free, without advertising')),
			),
		),

		h(
			'section',
			{ class: 'support-part support-story' },
			head(t('How it came about'), ''),
			h(
				'ol',
				{ class: 'support-steps' },
				step(String(BEGAN), t('It began with one person'), t('A Myanmar dictionary that was free and easy to use did not exist, so it was written: word by word, in evenings and holidays.')),
				step(t('Since then'), t('It grew with its readers'), t('Readers suggested meanings, rated them, reported mistakes and told others. Some gave, and their gifts kept it online.')),
				step(t('Today'), t('It goes on with you'), t('Every visit, every suggestion and every gift keeps it alive for the next person who needs a word.')),
			),
		),

		h(
			'section',
			{ id: 'give', class: 'support-part', tabindex: -1 },
			head(t('Give'), t('Once or every month, in any amount. You choose whether your name is shown among the thanks below.')),
			h(
				'div',
				{ class: 'support-uses' },
				use(ICONS.download, t('Servers'), t('Fast for everyone, and the dictionary on your phone without a connection.')),
				use(ICONS.check, t('Careful meanings'), t('Meanings read and corrected by people who speak Myanmar.')),
				use(ICONS.suggest, t('New words'), t('New words and corrections in every release.')),
			),
			h(
				'div',
				{ class: 'support-cards support-give-cards' },
				giveCard('PayPal', t('Card or PayPal account, once or monthly.'), t('Give with PayPal'), GIVE.paypal),
				giveCard('GitHub Sponsors', t('For developers: a monthly sponsorship shown on GitHub.'), t('Sponsor on GitHub'), GIVE.github),
			),
			figures && figures.count ? h('p', { class: 'support-note' }, t('Since {year}: {n} gifts, ${amount} after fees. Every dollar goes to the servers and to the dictionary.', { year: figures.since ?? String(BEGAN), n: num(figures.count), amount: num(Math.round(figures.cents / 100)) })) : null,
		),

		h(
			'section',
			{ id: 'help', class: 'support-part', tabindex: -1 },
			head(t('Other ways to help'), t('Not everyone can give money. The dictionary grows just as much from these.')),
			h(
				'div',
				{ class: 'support-cards support-ways' },
				h('div', { class: 'support-way' }, way(ICONS.suggest, t('Suggest a meaning'), t('Add a meaning a word lacks, or correct one, with ✎ beside it on any entry.'))),
				h('div', { class: 'support-way' }, way(ICONS.thumbUp, t('Rate meanings'), t('A thumbs up or down shows editors what to improve first.'))),
				share,
				h('a', { class: 'support-way', href: `${CONTACT}?kind=word` }, way(ICONS.comment, t('Tell us about a word'), t('A word we lack, or a mistake: the contact form reaches us.'))),
			),
		),

		figures && figures.years.length ? thanks(figures.years) : null,

		h(
			'section',
			{ class: 'support-closing' },
			h('p', { class: 'support-closing-my', lang: 'my' }, 'ကျေးဇူးတင်ပါတယ်'),
			h('p', null, t('Thank you, from everyone who keeps MyOrdbok going.')),
		),
	);
}

/**
 * @param {string} value
 * @param {string} label
 */
function figure(value, label) {
	return h('div', null, h('dt', null, label), h('dd', null, value));
}

/**
 * @param {string} when
 * @param {string} title
 * @param {string} text
 */
function step(when, title, text) {
	return h('li', null, h('span', { class: 'support-step-when' }, when), h('strong', null, title), h('span', null, text));
}

/**
 * @param {string} path  An icon.
 * @param {string} title
 * @param {string} text
 */
function use(path, title, text) {
	return h('div', { class: 'support-use' }, h('span', { class: 'support-mark', 'aria-hidden': 'true' }, icon(path, 18)), h('strong', null, title), h('span', null, text));
}

/**
 * A link to a part of this page glides there, the address keeping the part
 * (#give) without a new page load: left to the browser, some re-render the
 * page on the hash change and land where they started.
 * @param {HTMLAnchorElement} a
 */
function jump(a) {
	a.addEventListener('click', (e) => {
		const id = a.hash.slice(1);
		const target = document.getElementById(id);
		if (!target) return;
		e.preventDefault();
		history.replaceState(history.state, '', `#${id}`);
		target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
		target.focus({ preventScroll: true });
	});
	return a;
}

/**
 * @param {string} title
 * @param {string} lead
 */
function head(title, lead) {
	return h('div', { class: 'support-head' }, h('h2', null, title), lead ? h('p', null, lead) : null);
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
 * @param {string} path  An icon.
 * @param {string} title
 * @param {string} text
 */
function way(path, title, text) {
	return [h('span', { class: 'support-mark', 'aria-hidden': 'true' }, icon(path, 18)), h('span', { class: 'support-way-text' }, h('strong', null, title), h('span', null, text))];
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
