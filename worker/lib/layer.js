// @ts-check
/**
 * The live layer: approved edits an admin or owner has made live, shown to
 * readers before the data release that carries them into the dataset
 * (migration 0014, shared/layer.js).
 *
 * The whole layer is small (edits since the last release) and is held per
 * isolate for LAYER_TTL_MS, so a lookup costs no extra database read; an
 * edit made live reaches every reader within that time, plus the time a
 * cached answer lives (worker/routes/read.js).
 *
 * Which edits belong to it depends on the build being read:
 *   approved, exported   always: no build is known to hold them
 *   merged               while the build read is older than the one that
 *                        merged them (live, between `make data-beta` and
 *                        `make data-live`)
 * A conflict, found by the release, leaves the layer: the dataset moved on.
 *
 * Setting edits.live off empties the layer; readers then get the build alone.
 */
import { AppError } from '../../shared/errors.js';
import { addedSense, applyEdits } from '../../shared/layer.js';
import { dictionary, explainDictError } from './dict.js';

/** @typedef {import('../../shared/layer.js').LiveEdit} LiveEdit */
/** @typedef {import('../../shared/types.js').LookupResult} LookupResult */

export const LAYER_TTL_MS = 30_000;
/** Most edits the layer holds; making another live is refused until a release (worker/routes/workspace.js). */
export const LAYER_MAX = 2000;

/** Edits that are live for a site reading the build ?1. */
export const LIVE_EDITS = `SELECT id, dict, action, sense_id, field, old_value, new_value, word, data FROM dict_edits
		WHERE live_at IS NOT NULL AND status IN ('approved', 'exported')
	UNION ALL
	SELECT id, dict, action, sense_id, field, old_value, new_value, word, data FROM dict_edits
		WHERE live_at IS NOT NULL AND status = 'merged' AND merged_in > ?1
	ORDER BY id LIMIT ${LAYER_MAX * 2 + 1}`;

/**
 * @typedef {object} Layer
 * @property {number} size  Edits in the layer.
 * @property {<T extends LookupResult>(result: T) => T} apply  A lookup with the layer over it.
 * @property {<T extends { id: number, sense: string | null, exam: string | null }>(dict: 'emd' | 'med', rows: T[]) => T[]} senses
 *   Rows of a sense table with the layer over them: edited and deleted; added senses are left out.
 */

/**
 * Refuses another live edit while the layer is full: a release empties it.
 * @param {{ APP: D1Database }} env
 */
export async function requireLayerRoom(env) {
	const row = /** @type {{ n: number }} */ (await env.APP.prepare("SELECT count(*) AS n FROM dict_edits WHERE live_at IS NOT NULL AND status IN ('approved', 'exported')").first());
	if (Number(row.n) >= LAYER_MAX) throw new AppError('conflict', `${LAYER_MAX} edits are live and wait for a data release; no more can be made live until one is run (make data-release).`);
}

/** @type {{ key: string, at: number, layer: Layer } | null} */
let cached = null;

/** Forget the cached layer (tests, and after a change in this isolate). */
export function resetLayerCache() {
	cached = null;
}

const lower = (/** @type {string} */ w) => w.toLowerCase();

/**
 * @param {LiveEdit[]} edits
 * @param {Map<number, string>} types  Part of speech by id.
 * @returns {Layer}
 */
export function layerOf(edits, types) {
	/** @type {Map<string, LiveEdit[]>} */
	const bySense = new Map();
	/** @type {Map<string, LiveEdit[]>} */
	const adds = new Map();
	const push = (/** @type {Map<string, LiveEdit[]>} */ map, /** @type {string} */ key, /** @type {LiveEdit} */ e) => map.set(key, [...(map.get(key) ?? []), e]);
	for (const e of edits) {
		if (e.action === 'add') push(adds, `${e.dict}:${e.dict === 'emd' ? lower(e.word) : e.word}`, e);
		else push(bySense, `${e.dict}:${e.sense_id}`, e);
	}
	const typeName = (/** @type {number} */ id) => types.get(id);

	/**
	 * @param {'emd' | 'med'} dict
	 * @param {Array<{ id?: number | null }>} rows
	 * @param {string[]} words
	 */
	const editsFor = (dict, rows, words) => {
		/** @type {Map<number, LiveEdit>} */
		const found = new Map();
		for (const r of rows) for (const e of bySense.get(`${dict}:${r.id}`) ?? []) found.set(e.id, e);
		for (const w of new Set(words.map((w) => (dict === 'emd' ? lower(w) : w)))) for (const e of adds.get(`${dict}:${w}`) ?? []) found.set(e.id, e);
		return [...found.values()];
	};

	return {
		size: edits.length,
		apply(result) {
			if (!edits.length) return result;
			if (result.language === 'my') {
				const mine = editsFor('med', result.entries, [result.query]);
				if (!mine.length) return result;
				const entries = applyEdits(result.entries, mine, { exampleKey: 'example', typeName, make: (a) => ({ type: a.type, sense: a.sense, example: a.exam, etymology: null }) });
				// A headword only the layer has brings its pronunciation with it.
				const first = result.pronunciation ? null : mine.map(addedSense).find((d) => d?.ipa && d?.mlc);
				return { ...result, entries, pronunciation: result.pronunciation ?? (first ? [String(first.ipa), String(first.mlc)] : null) };
			}
			const mine = editsFor('emd', result.entries, [result.query, ...result.entries.map((e) => e.word)]);
			if (!mine.length) return result;
			// An added sense is a draft in the dataset until reviewed there (emd_add.py).
			const entries = applyEdits(result.entries, mine, { exampleKey: 'example', typeName, make: (a, e) => ({ word: e.word, type: a.type, kind: 'Draft', sense: a.sense, example: a.exam }) });
			return { ...result, entries };
		},
		senses(dict, rows) {
			if (!edits.length) return rows;
			const mine = editsFor(dict, rows, []).filter((e) => e.action !== 'add');
			return mine.length ? applyEdits(rows, mine, { exampleKey: 'exam', typeName, make: () => rows[0] }) : rows;
		},
	};
}

/**
 * The layer for the dictionary this site reads now.
 * @param {import('./dict.js').DictEnv} env
 * @param {number} [now]
 * @returns {Promise<Layer>}
 */
export async function liveLayer(env, now = Date.now()) {
	const { dict, db } = await dictionary(env);
	const key = `${env.ENV_NAME ?? ''}:${dict}`;
	if (cached && cached.key === key && now - cached.at < LAYER_TTL_MS) return cached.layer;

	const [on, built, types] = await Promise.all([
		env.APP.prepare("SELECT value FROM settings WHERE key = 'edits.live'").first(),
		db.prepare("SELECT value FROM meta WHERE key = 'built'").first(),
		db.prepare('SELECT id, name FROM type_word').all(),
	]).catch((err) => {
		throw explainDictError(err, dict, env);
	});
	/** @type {LiveEdit[]} */
	let edits = [];
	// Stored as JSON; absent means on, the default (worker/lib/settings.js).
	if (!on || on.value === '"on"') {
		const { results } = await env.APP.prepare(LIVE_EDITS)
			.bind(String(built?.value ?? ''))
			.all();
		if (results.length > LAYER_MAX * 2) throw new AppError('internal', `The live layer holds more than ${LAYER_MAX * 2} edits; run a data release (make data-release).`);
		edits = /** @type {LiveEdit[]} */ (/** @type {unknown} */ (results));
	} else if (on.value !== '"off"') {
		throw new AppError('internal', `Setting edits.live holds ${on.value}, which is no longer allowed; set it again in the workspace.`);
	}
	const layer = layerOf(edits, new Map(types.results.map((r) => [Number(r.id), String(r.name)])));
	cached = { key, at: now, layer };
	return layer;
}
