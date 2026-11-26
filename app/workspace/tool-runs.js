// @ts-check
/**
 * The Run workflow's runs and what each found, read from GitHub for the
 * workspace's Tools (tools.js). The repository is public, so its runs are
 * read without any key, from the reader's own browser: GitHub's public API
 * allows 60 requests an hour from one address, and an unchanged list
 * (If-None-Match, 304) does not count. What a run found is its annotation
 * titled MyOrdbok (scripts/run.js): JSON with run, summary, ok and data.
 */

const API = 'https://api.github.com/repos/khensolomon/myordbok';
const HEADERS = { accept: 'application/vnd.github+json' };

/**
 * @typedef {object} ToolRun
 * @property {number} id
 * @property {string} line  The command as pasted (the run's title, less "Run · ").
 * @property {string | null} name  The workspace's name for it (#run …).
 * @property {'queued' | 'in_progress' | 'completed' | string} status
 * @property {string | null} conclusion  success, failure, cancelled…
 * @property {string} url
 * @property {string} actor
 * @property {number} at  ms
 */
/**
 * @typedef {object} Finding
 * @property {boolean} ok
 * @property {string} [summary]
 * @property {string} [error]
 * @property {string} [last]
 * @property {boolean} [apply]
 * @property {any} [data]
 */

let etag = '';
/** @type {ToolRun[]} */
let cached = [];
/** What finished runs found, kept for the visit: a finished run does not change. */
const found = new Map();

/** @param {string} path */
async function get(path, extra = {}) {
	const res = await fetch(`${API}${path}`, { headers: { ...HEADERS, ...extra } });
	if (res.status === 403 || res.status === 429) throw new Error('GitHub asks to wait: its public API allows 60 requests an hour from one address. Try again in a while.');
	return res;
}

/**
 * The newest runs of the Run workflow.
 * @returns {Promise<ToolRun[]>}
 */
export async function recentRuns() {
	const res = await get('/actions/workflows/run.yml/runs?per_page=15', etag ? { 'if-none-match': etag } : {});
	if (res.status === 304) return cached;
	if (!res.ok) throw new Error(`GitHub answered ${res.status} for the runs`);
	etag = res.headers.get('etag') ?? '';
	const body = await res.json();
	cached = (body.workflow_runs ?? []).map((/** @type {any} */ r) => {
		const line = String(r.display_title ?? '').replace(/^Run · /, '');
		return {
			id: r.id,
			line,
			name: /#run\s+([a-z0-9]+)\s*$/i.exec(line)?.[1]?.toLowerCase() ?? null,
			status: r.status,
			conclusion: r.conclusion,
			url: r.html_url,
			actor: r.triggering_actor?.login ?? r.actor?.login ?? '',
			at: Date.parse(r.run_started_at ?? r.created_at),
		};
	});
	return cached;
}

/**
 * What a run found: its MyOrdbok annotation (the last of its jobs').
 * Null while it runs, or when it left none.
 * @param {ToolRun} run
 * @returns {Promise<Finding | null>}
 */
export async function finding(run) {
	if (found.has(run.id)) return found.get(run.id);
	const jobs = await (await get(`/actions/runs/${run.id}/jobs`)).json();
	/** @type {Finding | null} */
	let last = null;
	for (const job of jobs.jobs ?? []) {
		if (!job.check_run_url) continue;
		const res = await fetch(`${job.check_run_url}/annotations`, { headers: HEADERS });
		if (!res.ok) continue;
		for (const a of await res.json()) {
			if (a.title !== 'MyOrdbok') continue;
			try {
				last = JSON.parse(a.message);
			} catch {
				last = { ok: false, error: a.message };
			}
		}
	}
	if (run.status === 'completed') found.set(run.id, last);
	return last;
}
