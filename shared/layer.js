// @ts-check
/**
 * Live edits laid over what the dictionary build holds.
 *
 * An edit is applied only where the build still holds what the edit was
 * made against, the same rule the data release follows:
 *
 *   edit    the sense exists and its field holds the old value (or, after
 *           an earlier edit in the layer, that edit's new value); the
 *           fields are sense, exam, wrte (part of speech) and wrkd (status)
 *   delete  the sense exists
 *   add     the word has no sense with this part of speech and meaning
 *
 * So a build that already contains an edit is left as it is, and an edit
 * the dataset has moved past changes nothing. Nothing here reads a
 * database: the Worker loads the edits (worker/lib/layer.js).
 */

/**
 * @typedef {object} LiveEdit
 * @property {number} id
 * @property {'emd' | 'med'} dict
 * @property {'edit' | 'add' | 'delete'} action
 * @property {number | null} sense_id
 * @property {string | null} field      'sense', 'exam', 'wrte' or 'wrkd' for an edit.
 * @property {string | null} old_value
 * @property {string | null} new_value
 * @property {string} word
 * @property {string | null} data       JSON of an added sense: { wrte, sense, exam?, ipa?, mlc? }.
 */

/**
 * A sense as a row: `example` in a lookup, `exam` in the tables.
 * @typedef {{ id?: number | null, word?: string, type?: string, sense: string | null, [key: string]: unknown }} SenseRow
 */

/**
 * How a row keeps one field: whether it holds the value an edit was made
 * against, and the row with a new value (null: the value means nothing here).
 * @template T
 * @typedef {{ holds: (row: T, old: string | null) => boolean, put: (row: T, value: string | null) => T | null }} Field
 */

const same = (/** @type {unknown} */ a, /** @type {unknown} */ b) => (a ?? '') === (b ?? '');

/**
 * @param {LiveEdit} edit
 * @returns {{ wrte: number, sense: string, exam?: string | null, ipa?: string, mlc?: string } | null}
 */
export function addedSense(edit) {
	try {
		const d = JSON.parse(String(edit.data));
		return d && typeof d.sense === 'string' && Number.isInteger(d.wrte) ? d : null;
	} catch {
		return null;
	}
}

/**
 * Senses with the edits applied, in the order given (oldest edit first).
 * @template {SenseRow} T
 * @param {T[]} rows  Not changed; changed senses are copies.
 * @param {LiveEdit[]} edits  Of one dictionary, for these senses or this word.
 * @param {object} how
 * @param {Record<string, Field<T> | undefined>} how.fields  How a row keeps each field an edit names; one it does not keep is left alone.
 * @param {(wrte: number) => string | undefined} how.typeName  Part of speech by id.
 * @param {(added: { wrte: number, type: string, sense: string, exam: string | null }, edit: LiveEdit) => T} how.make  A row for an added sense.
 * @returns {T[]}
 */
export function applyEdits(rows, edits, how) {
	let out = rows;
	for (const e of [...edits].sort((a, b) => a.id - b.id)) {
		if (e.action === 'add') {
			const d = addedSense(e);
			const type = d ? how.typeName(d.wrte) : undefined;
			if (!d || !type) continue;
			if (out.some((r) => r.type === type && r.sense === d.sense)) continue;
			out = [...out, how.make({ wrte: d.wrte, type, sense: d.sense, exam: d.exam ?? null }, e)];
			continue;
		}
		const at = out.findIndex((r) => r.id === e.sense_id);
		if (at < 0) continue;
		if (e.action === 'delete') {
			out = out.filter((_, i) => i !== at);
			continue;
		}
		const field = how.fields[String(e.field)];
		if (!field || !field.holds(out[at], e.old_value)) continue;
		const next = field.put(out[at], e.new_value);
		if (!next) continue;
		out = out.map((r, i) => (i === at ? next : r));
	}
	return out;
}

/**
 * A text field kept under a key of the row.
 * @template {SenseRow} T
 * @param {string} key
 * @returns {Field<T>}
 */
export function textField(key) {
	return { holds: (row, old) => same(row[key], old), put: (row, value) => ({ ...row, [key]: value ?? null }) };
}
