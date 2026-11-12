// @ts-check
/**
 * myordbok-backup: a weekly backup of myordbok-app into the private bucket
 * myordbok, under backup/myordbok-app/ (shared/backup.js has the layout and
 * the retention).
 *
 * The cron (backup/wrangler.toml) starts one instance of the Workflow
 * Backup; `make backup-now APPLY=1` starts one by hand. Its steps:
 *
 *   export and store   the D1 export API makes the dump; it is downloaded,
 *                      gzipped and put in R2 with the export's Time Travel
 *                      bookmark in its metadata
 *   prune              backups past the retention go; index.json lists the rest
 *
 * Each step is retried on its own; a failed run stays failed in the
 * dashboard (Workers → Workflows → myordbok-backup), and the Overview shows
 * admins when the last backup was made.
 *
 * Secrets (never in this repository):
 *   ACCOUNT_ID       the Cloudflare account
 *   D1_EXPORT_TOKEN  an API token with Account · D1 · Edit
 *
 * The Worker has no address: fetch answers 404 to anything.
 */
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { BACKUP_INDEX, BACKUP_PREFIX, backupIndex, backupKey, backupName, planPrune } from '../shared/backup.js';

/**
 * @typedef {object} Env
 * @property {string} ACCOUNT_ID
 * @property {string} D1_EXPORT_TOKEN
 * @property {string} DATABASE_ID
 * @property {string} [API_BASE]  Local tests only: a stand-in for api.cloudflare.com.
 * @property {R2Bucket} STORAGE
 * @property {Workflow} BACKUP
 */

/** How long an export may take before the step gives up (it is retried). */
const EXPORT_MS = 10 * 60 * 1000;
/** Between polls; an export left unpolled is cancelled by D1. */
const POLL_MS = 2000;
/** A dump smaller than this is not a database. */
const DUMP_MIN = 200;

export class Backup extends WorkflowEntrypoint {
	/**
	 * @param {WorkflowEvent<unknown>} event
	 * @param {WorkflowStep} step
	 */
	async run(event, step) {
		const env = /** @type {Env} */ (this.env);
		for (const name of /** @type {const} */ (['ACCOUNT_ID', 'D1_EXPORT_TOKEN', 'DATABASE_ID'])) {
			if (!env[name]) throw new NonRetryableError(`${name} is not set: see docs/deploy.md, Backups`);
		}
		// The name is the moment the instance began, the same on every retry.
		const name = backupName(new Date(event.timestamp));

		const stored = await step.do('export and store', { retries: { limit: 2, delay: '5 minutes', backoff: 'linear' }, timeout: '20 minutes' }, async () => {
			const { url, bookmark } = await exportDatabase(env);
			const dump = await fetch(url);
			if (!dump.ok) throw new Error(`Downloading the export failed: HTTP ${dump.status}`);
			const sql = await dump.arrayBuffer();
			if (sql.byteLength < DUMP_MIN) throw new Error(`The export is ${sql.byteLength} bytes: not a database dump`);
			const gz = await new Response(new Blob([sql]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
			const key = backupKey(name);
			await env.STORAGE.put(key, gz, {
				httpMetadata: { contentType: 'application/gzip' },
				customMetadata: { database: env.DATABASE_ID, bookmark, sql_bytes: String(sql.byteLength) },
			});
			return { key, bytes: gz.byteLength, sql_bytes: sql.byteLength, bookmark };
		});

		const pruned = await step.do('prune', { retries: { limit: 3, delay: '1 minute', backoff: 'exponential' } }, async () => {
			/** @type {Array<{ key: string, size: number }>} */
			const objects = [];
			/** @type {string | undefined} */
			let cursor;
			do {
				const page = await env.STORAGE.list({ prefix: BACKUP_PREFIX, cursor });
				objects.push(...page.objects.map((o) => ({ key: o.key, size: o.size })));
				cursor = page.truncated ? page.cursor : undefined;
			} while (cursor);
			const now = Date.now();
			const { kept, dropped } = planPrune(objects, now);
			if (!kept.some((b) => b.key === stored.key)) throw new NonRetryableError(`${stored.key} is missing from the bucket after it was stored`);
			if (dropped.length) await env.STORAGE.delete(dropped);
			await env.STORAGE.put(BACKUP_INDEX, JSON.stringify(backupIndex(kept, now), null, '\t'), { httpMetadata: { contentType: 'application/json' } });
			return { kept: kept.length, dropped };
		});

		return { ...stored, kept: pruned.kept, dropped: pruned.dropped };
	}
}

/**
 * Starts an export and polls it until the dump is ready.
 * @param {Env} env
 * @returns {Promise<{ url: string, bookmark: string }>}
 */
async function exportDatabase(env) {
	const endpoint = `${env.API_BASE ?? 'https://api.cloudflare.com'}/client/v4/accounts/${env.ACCOUNT_ID}/d1/database/${env.DATABASE_ID}/export`;
	/** @param {Record<string, unknown>} body */
	const call = async (body) => {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { authorization: `Bearer ${env.D1_EXPORT_TOKEN}`, 'content-type': 'application/json' },
			body: JSON.stringify({ output_format: 'polling', ...body }),
		});
		const data = /** @type {{ success?: boolean, errors?: Array<{ message: string }>, result?: any } | null} */ (await res.json().catch(() => null));
		const why = data?.errors?.map((e) => e.message).join('; ') || res.statusText;
		// A token or account that is wrong stays wrong: no retries.
		if (res.status === 401 || res.status === 403) throw new NonRetryableError(`The D1 export API refused the token (HTTP ${res.status}): ${why}`);
		if (!res.ok || !data?.success || !data.result) throw new Error(`The D1 export API failed (HTTP ${res.status}): ${why}`);
		return data.result;
	};
	let result = await call({});
	const bookmark = result.at_bookmark;
	if (!bookmark) throw new Error('The D1 export API returned no bookmark');
	const until = Date.now() + EXPORT_MS;
	while (result.status !== 'complete') {
		if (result.status === 'error') throw new Error(`The export failed: ${result.error ?? 'no reason given'}`);
		if (Date.now() > until) throw new Error(`The export did not finish in ${EXPORT_MS / 60000} minutes`);
		await new Promise((done) => setTimeout(done, POLL_MS));
		result = await call({ current_bookmark: bookmark });
	}
	const url = result.result?.signed_url;
	if (!url) throw new Error('The export finished without a download address');
	return { url, bookmark };
}

export default {
	/**
	 * @param {ScheduledController} _controller
	 * @param {Env} env
	 */
	async scheduled(_controller, env) {
		const instance = await env.BACKUP.create();
		console.log(`backup started: ${instance.id}`);
	},
	fetch() {
		return new Response('Not found', { status: 404 });
	},
};
