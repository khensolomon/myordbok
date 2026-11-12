// @ts-check
/**
 * Moves the old sponsors file (docs/sponsors.json, once in the public
 * repository) into myordbok-app, where the owner keeps supporters from now on
 * (workspace → Sponsors). Run once; refused when donors are already there.
 * Node standard library only; D1 through wrangler. Dry run unless --apply.
 *
 *   node scripts/sponsors.js import --file PATH/sponsors.json [--apply] [--local]
 *
 * A donor is shown on the Support page only when the file says they agreed
 * (displayConsent) and their note does not say they wish to remain
 * anonymous; the report lists every donor where the two disagree, to check
 * with them and change in the workspace. Old donor ids are kept as the new
 * ones. No member account is linked: that is done by hand in the workspace.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { wranglerRunner } from './data.js';
import { literal } from './backup.js';

/** The file's platform names, as the methods the app knows. */
const METHOD = /** @type {Record<string, string>} */ ({ paypal: 'paypal', stripe: 'stripe', bank: 'bank', cash: 'cash', gs: 'github', 'github sponsors': 'github', github: 'github' });

/**
 * @typedef {{ id: number, name: string, shown: boolean, note: string | null, why: string | null }} NewDonor
 * @typedef {{ donor_id: number, day: string, cents: number, method: string, recurring: boolean }} NewDonation
 */

/**
 * The file as rows for the two tables; throws on anything it cannot place.
 * @param {any} data  The parsed sponsors.json.
 * @returns {{ donors: NewDonor[], donations: NewDonation[] }}
 */
export function planImport(data) {
	if (!data || !Array.isArray(data.donors) || !Array.isArray(data.donations) || !Array.isArray(data.platforms)) throw new Error('Not a sponsors file: it needs donors, donations and platforms lists.');
	/** @type {Map<number, string>} */
	const platforms = new Map();
	for (const p of data.platforms) {
		const method = METHOD[String(p.name).trim().toLowerCase()];
		if (!method) throw new Error(`Platform ${p.id} (“${p.name}”) is none of PayPal, Stripe, Bank, Cash, GS.`);
		platforms.set(Number(p.id), method);
	}
	/** @type {NewDonor[]} */
	const donors = data.donors.map((/** @type {any} */ d) => {
		const id = Number(d.id);
		if (!Number.isInteger(id) || id <= 0) throw new Error(`Donor id ${d.id} is not a whole number.`);
		const name = String(d.displayName ?? '').trim();
		if (!name || name.length > 80) throw new Error(`Donor ${id} has no name, or a name over 80 characters.`);
		const note = String(d.internalNotes ?? '').trim() || null;
		const consent = d.displayConsent === true;
		const wishes = Boolean(note && /anonym/i.test(note));
		const shown = consent && !wishes;
		const why = consent && wishes ? 'marked as consenting, but the note says they wish to remain anonymous: kept anonymous' : null;
		return { id, name, shown, note, why };
	});
	const ids = new Set(donors.map((d) => d.id));
	if (ids.size !== donors.length) throw new Error('Two donors share an id.');
	/** @type {NewDonation[]} */
	const donations = data.donations.map((/** @type {any} */ x, /** @type {number} */ i) => {
		const donor_id = Number(x.id);
		if (!ids.has(donor_id)) throw new Error(`Donation ${i + 1} is from donor ${x.id}, who is not in the donors list.`);
		const day = String(x.date ?? '');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error(`Donation ${i + 1} has the date “${x.date}”.`);
		const cents = Math.round(Number(x.amount) * 100);
		if (!Number.isInteger(cents) || cents <= 0) throw new Error(`Donation ${i + 1} has the amount “${x.amount}”.`);
		const method = platforms.get(Number(x.platformId));
		if (!method) throw new Error(`Donation ${i + 1} names platform ${x.platformId}, which is not in the platforms list.`);
		return { donor_id, day, cents, method, recurring: x.recurring === true };
	});
	return { donors, donations };
}

/**
 * @param {{ donors: NewDonor[], donations: NewDonation[] }} plan
 */
export function importSql(plan) {
	const lines = plan.donors.map((d) => `INSERT INTO donors (id, name, shown, note) VALUES (${d.id}, ${literal(d.name)}, ${d.shown ? 1 : 0}, ${literal(d.note)});`);
	for (const x of plan.donations) lines.push(`INSERT INTO donations (donor_id, day, cents, method, recurring) VALUES (${x.donor_id}, ${literal(x.day)}, ${x.cents}, ${literal(x.method)}, ${x.recurring ? 1 : 0});`);
	return `${lines.join('\n')}\n`;
}

/**
 * @param {string} file
 * @param {{ apply: boolean, local: boolean, log: (line: string) => void }} o
 */
function run(file, o) {
	const plan = planImport(JSON.parse(readFileSync(resolve(file), 'utf8')));
	const db = wranglerRunner({ local: o.local });
	const there = Number(db.query('APP', 'SELECT count(*) AS n FROM donors')[0]?.n ?? 0);
	if (there) throw new Error(`myordbok-app (${db.where}) has ${there} donor(s) already; this import runs once, into an empty list.`);
	const total = plan.donations.reduce((a, x) => a + x.cents, 0);
	o.log(`${plan.donors.length} donors, ${plan.donations.length} donations, $${(total / 100).toFixed(2)} in all, from ${plan.donations.map((x) => x.day).sort()[0] ?? '—'}.`);
	for (const d of plan.donors) {
		const gave = plan.donations.filter((x) => x.donor_id === d.id);
		o.log(`  ${String(d.id).padStart(3)}  ${d.shown ? 'shown    ' : 'anonymous'}  ${d.name}  (${gave.length} donation${gave.length === 1 ? '' : 's'})${d.why ? `\n         ${d.why}` : ''}`);
	}
	if (!o.apply) return o.log(`Dry run: nothing written to ${db.where}. Add --apply to import.`);
	const sql = join(tmpdir(), `myordbok-sponsors-${process.pid}.sql`);
	writeFileSync(sql, importSql(plan));
	try {
		db.file('APP', sql);
	} finally {
		rmSync(sql, { force: true });
	}
	o.log(`Imported into ${db.where}. Check each donor in the workspace (Sponsors), then delete the file.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const args = process.argv.slice(2);
	const at = args.indexOf('--file');
	try {
		if (args[0] !== 'import' || at < 0 || !args[at + 1]) throw new Error('Use: node scripts/sponsors.js import --file PATH/sponsors.json [--apply] [--local]');
		run(args[at + 1], { apply: args.includes('--apply'), local: args.includes('--local'), log: (l) => console.log(l) });
	} catch (err) {
		console.error(`sponsors: ${err instanceof Error ? err.message : err}`);
		process.exit(1);
	}
}
