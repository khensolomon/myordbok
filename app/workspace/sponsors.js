// @ts-check
/**
 * Sponsors (?s=sponsors), for the owner: everyone who has given, and what
 * (worker/routes/support.js). The list shows each donor with their total;
 * choosing one, or New donor, opens beside it their name, whether it is
 * shown on the Support page, their member account, a private note, and
 * their donations, with a form to add one.
 *
 * Nobody is shown on the Support page without their consent, and the page
 * never puts an amount beside a name. No email or payment detail is kept
 * here; a member's account is linked by its id or sign-in email.
 */
import { h } from '../core/dom.js';
import { addDonation, deleteDonation, deleteDonor, saveDonor, workspaceDonor, workspaceSponsors } from '../data/api.js';
import { mark, num, shortDate, t, tn } from '../i18n/index.js';

/** @typedef {import('../data/api.js').Donor} Donor */
/** @typedef {import('../data/api.js').Donation} Donation */

/** @type {ReadonlyArray<[string, string]>} */
const METHODS = [
	['paypal', 'PayPal'],
	['github', 'GitHub Sponsors'],
	['stripe', 'Stripe'],
	['bank', mark('Bank transfer')],
	['cash', mark('Cash')],
	['other', mark('Other')],
];

/** @param {number} cents */
const dollars = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** @param {string} day  YYYY-MM-DD */
const dayText = (day) => shortDate(new Date(`${day}T00:00:00Z`), { year: true, utc: true });
/** @param {string} method */
const methodName = (method) => {
	const label = METHODS.find(([m]) => m === method)?.[1] ?? method;
	return method === 'paypal' || method === 'github' || method === 'stripe' ? label : t(label);
};

/** @param {import('../core/routes.js').ViewContext} ctx */
export async function sponsorsPane(ctx) {
	const main = h('main', { class: 'ws-main ws-overview ws-notices ws-sponsors', 'aria-label': t('Sponsors') });
	const totals = h('span', null);
	const list = h('div', { class: 'ws-notice-list' });
	const editor = h('section', { class: 'ws-card ws-notice-editor', 'aria-label': t('Donor') });
	const fresh = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-primary ws-new' }, t('New donor')));
	main.append(
		h(
			'div',
			{ class: 'ws-work' },
			h('header', { class: 'ws-ov-head ws-notices-head' }, h('h1', null, t('Sponsors')), totals, fresh),
			h('div', { class: 'ws-notices-grid' }, list, editor),
		),
	);

	/** @type {Donor[]} */
	let donors = [];

	const load = async () => {
		const got = await workspaceSponsors();
		donors = got.donors;
		totals.textContent = got.totals.count ? t('{n} donations, {amount} since {year}, after fees', { n: num(got.totals.count), amount: dollars(got.totals.cents), year: got.totals.since ?? '' }) : t('No donations recorded yet.');
		drawList();
	};

	/**
	 * @param {number | null} id
	 * @param {boolean} [reveal]
	 */
	const choose = async (id, reveal = false) => {
		const url = new URL(location.href);
		if (id) url.searchParams.set('id', String(id));
		else url.searchParams.delete('id');
		history.replaceState(history.state, '', url);
		for (const b of list.querySelectorAll('[data-id]')) b.setAttribute('aria-current', String(Number(/** @type {HTMLElement} */ (b).dataset.id) === id));
		try {
			const detail = id ? await workspaceDonor(id) : null;
			editor.replaceChildren(...donorForm(detail, refresh));
		} catch (err) {
			editor.replaceChildren(h('p', { class: 'ws-result', role: 'alert' }, err instanceof Error ? err.message : String(err)));
		}
		if (reveal && editor.getBoundingClientRect().top > list.getBoundingClientRect().top + 40) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	/** @param {number | null} id  The donor to show after a change; null after a delete. */
	const refresh = async (id) => {
		await load();
		await choose(id);
	};

	const drawList = () => {
		if (!donors.length) {
			list.replaceChildren(h('div', { class: 'ws-card ws-notice-empty' }, h('p', null, t('No donors yet.')), h('p', { class: 'ws-quiet' }, t('Add a donor, then their donations. The Support page shows the totals, and a donor’s name only when they agreed to it.'))));
			return;
		}
		const shown = donors.filter((d) => d.shown);
		const hidden = donors.filter((d) => !d.shown);
		/** @type {Array<[string, Donor[]]>} */
		const groups = [
			[t('Shown on the Support page'), shown],
			[t('Anonymous'), hidden],
		];
		list.replaceChildren(...groups.filter(([, g]) => g.length).map(([title, g]) => h('section', { class: 'ws-card ws-notice-group' }, h('h2', null, title), h('ul', { class: 'ws-notice-rows' }, g.map((d) => h('li', null, row(d, () => choose(d.id, true))))))));
	};

	fresh.addEventListener('click', () => choose(null, true));
	await load();
	const asked = Number(ctx.query.get('id'));
	await choose(donors.some((d) => d.id === asked) ? asked : (donors[0]?.id ?? null));
	return main;
}

/**
 * @param {Donor} d
 * @param {() => void} onOpen
 */
function row(d, onOpen) {
	const b = h(
		'button',
		{ type: 'button', class: 'ws-notice-row', 'data-id': String(d.id), 'aria-current': 'false' },
		h('span', { class: `ws-notice-dot ${d.shown ? 'ws-sponsor-dot-shown' : 'ws-sponsor-dot-hidden'}`, 'aria-hidden': 'true' }),
		h(
			'span',
			{ class: 'ws-notice-main' },
			h('span', { class: 'ws-notice-text' }, d.name),
			h('span', { class: 'ws-notice-meta' }, d.count ? tn('{n} donation, {amount}', '{n} donations, {amount}', d.count, { amount: dollars(d.cents) }) : t('No donations yet'), d.last ? ` · ${dayText(d.last)}` : '', d.member ? ` · ${t('member')}` : ''),
		),
	);
	b.addEventListener('click', onOpen);
	return b;
}

/**
 * A donor's form and their donations; a new donor when null.
 * @param {{ donor: Donor, donations: Donation[] } | null} detail
 * @param {(id: number | null) => Promise<void>} done
 * @returns {Node[]}
 */
function donorForm(detail, done) {
	const d = detail?.donor ?? null;
	const name = /** @type {HTMLInputElement} */ (h('input', { type: 'text', maxlength: 80, required: true, value: d?.name ?? '', placeholder: t('As it may be shown: a name, initials or a nickname') }));
	const shown = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox', checked: d?.shown ? true : null }));
	const memberField = /** @type {HTMLInputElement} */ (h('input', { type: 'text', value: d?.user_id ? String(d.user_id) : '', placeholder: t('Member id or sign-in email (optional)') }));
	const note = /** @type {HTMLTextAreaElement} */ (h('textarea', { rows: 2, maxlength: 500, placeholder: t('Only you see this') }, d?.note ?? ''));
	const out = h('p', { class: 'ws-result', role: 'status' });
	const save = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-primary' }, d ? t('Save changes') : t('Add donor')));
	const remove = d && !d.count ? /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-link-button ws-delete-notice' }, t('Delete'))) : '';
	const field = (/** @type {string} */ label, /** @type {Node} */ control, /** @type {string} */ hint = '') => h('label', { class: 'ws-notice-field' }, h('span', null, label), control, hint ? h('small', null, hint) : '');

	const form = h(
		'form',
		{ class: 'ws-notice-form', novalidate: true },
		h('h2', null, d ? d.name : t('New donor')),
		d?.count ? h('p', { class: 'ws-quiet' }, t('{n} donations, {amount}, from {first} to {last}', { n: num(d.count), amount: dollars(d.cents), first: dayText(/** @type {string} */ (d.first)), last: dayText(/** @type {string} */ (d.last)) })) : '',
		field(t('Name'), name),
		h('label', { class: 'ws-notice-check' }, shown, h('span', null, t('Show this name on the Support page'), h('small', null, t('Only with their consent. Unticked, they count as anonymous; amounts are never shown beside a name.')))),
		h('div', { class: 'ws-notice-pair' }, field(t('Member'), memberField, d?.member ? t('Linked to {name}: their avatar shows beside the name, and they are never asked to support.', { name: d.member }) : t('A member linked here is never asked to support.')), field(t('Note'), note)),
		h('div', { class: 'ws-notice-actions' }, save, remove, out),
	);
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		if (!name.value.trim()) {
			out.textContent = t('Give a name; an anonymous donor still needs one here.');
			name.focus();
			return;
		}
		save.disabled = true;
		out.textContent = t('Saving…');
		try {
			const saved = await saveDonor({ name: name.value, shown: shown.checked, member: memberField.value.trim(), note: note.value }, d?.id ?? null);
			await done(saved.donor.id);
		} catch (err) {
			out.textContent = err instanceof Error ? err.message : String(err);
			save.disabled = false;
		}
	});
	if (remove && d) {
		remove.addEventListener('click', async () => {
			if (remove.dataset.sure !== '1') {
				remove.dataset.sure = '1';
				remove.textContent = t('Delete for good?');
				return;
			}
			remove.disabled = true;
			try {
				await deleteDonor(d.id);
				await done(null);
			} catch (err) {
				remove.disabled = false;
				out.textContent = err instanceof Error ? err.message : String(err);
			}
		});
	}
	if (!d || !detail) return [form];
	return [form, donations(d, detail.donations, done)];
}

/**
 * A donor's donations, newest first, and a form to add one.
 * @param {Donor} d
 * @param {Donation[]} list
 * @param {(id: number | null) => Promise<void>} done
 */
function donations(d, list, done) {
	const today = new Date().toISOString().slice(0, 10);
	const day = /** @type {HTMLInputElement} */ (h('input', { type: 'date', value: today, max: today, required: true }));
	const amount = /** @type {HTMLInputElement} */ (h('input', { type: 'text', inputmode: 'decimal', placeholder: '25.00', required: true }));
	const method = /** @type {HTMLSelectElement} */ (h('select', null, METHODS.map(([m]) => h('option', { value: m }, methodName(m)))));
	const recurring = /** @type {HTMLInputElement} */ (h('input', { type: 'checkbox' }));
	const out = h('p', { class: 'ws-result', role: 'status' });
	const add = /** @type {HTMLButtonElement} */ (h('button', { type: 'submit', class: 'ws-primary' }, t('Add donation')));
	const field = (/** @type {string} */ label, /** @type {Node} */ control, /** @type {string} */ hint = '') => h('label', { class: 'ws-notice-field' }, h('span', null, label), control, hint ? h('small', null, hint) : '');

	const form = h(
		'form',
		{ class: 'ws-notice-form ws-donation-form', novalidate: true },
		h('h3', null, t('Add a donation')),
		h('div', { class: 'ws-notice-pair' }, field(t('Day received'), day), field(t('Amount in US dollars'), amount, t('What arrived, after the payment service’s fees.'))),
		h('div', { class: 'ws-notice-pair' }, field(t('How'), method), h('label', { class: 'ws-notice-check ws-donation-recurring' }, recurring, h('span', null, t('Part of a monthly gift')))),
		h('div', { class: 'ws-notice-actions' }, add, out),
	);
	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		add.disabled = true;
		out.textContent = t('Saving…');
		try {
			await addDonation(d.id, { day: day.value, amount: amount.value.trim(), method: method.value, recurring: recurring.checked });
			await done(d.id);
		} catch (err) {
			out.textContent = err instanceof Error ? err.message : String(err);
			add.disabled = false;
		}
	});

	const rows = list.map((x) => {
		const del = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'ws-link-button' }, t('Remove')));
		del.addEventListener('click', async () => {
			if (del.dataset.sure !== '1') {
				del.dataset.sure = '1';
				del.textContent = t('Remove for good?');
				return;
			}
			del.disabled = true;
			try {
				await deleteDonation(x.id);
				await done(d.id);
			} catch (err) {
				del.disabled = false;
				del.textContent = err instanceof Error ? err.message : String(err);
			}
		});
		return h('li', { class: 'ws-donation' }, h('span', { class: 'ws-donation-day' }, dayText(x.day)), h('strong', null, dollars(x.cents)), h('span', { class: 'ws-quiet' }, methodName(x.method), x.recurring ? ` · ${t('monthly')}` : ''), del);
	});

	return h('div', { class: 'ws-donations' }, form, list.length ? h('div', null, h('h3', null, t('Donations')), h('ul', { class: 'ws-donation-list' }, rows)) : h('p', { class: 'ws-quiet' }, t('No donations yet.')));
}
