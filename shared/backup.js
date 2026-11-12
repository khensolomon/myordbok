// @ts-check
/**
 * Backups of myordbok-app, the database of what the app writes (members,
 * comments, suggestions, settings …). The dictionary databases are not
 * backed up: they are rebuilt from the private dataset.
 *
 * The Worker myordbok-backup (backup/worker.js) exports the database once a
 * week through the D1 export API and keeps the dump, gzipped, in the private
 * bucket myordbok:
 *
 *   backup/myordbok-app/2026-11-15-2017.sql.gz    one per backup (UTC time)
 *   backup/myordbok-app/index.json                the backups kept, newest first
 *
 * Retention: every backup of the last KEEP_DAYS days, and never fewer than
 * the newest KEEP. A backup started by hand does not push a weekly one out,
 * and backups that stop coming do not let the old ones expire.
 *
 * Shared by the backup Worker, the app Worker (the Overview shows the last
 * backup to admins) and scripts/backup.js (list, pull, restore).
 */

export const BACKUP_DATABASE = 'myordbok-app';
export const BACKUP_PREFIX = `backup/${BACKUP_DATABASE}/`;
export const BACKUP_INDEX = `${BACKUP_PREFIX}index.json`;
/** Fewest backups kept, whatever their age. */
export const KEEP = 12;
/** Every backup younger than this is kept. */
export const KEEP_DAYS = 84;
/** A backup older than this is overdue (a week, and a day to spare). */
export const STALE_DAYS = 8;

const NAME = /^\d{4}-\d{2}-\d{2}-\d{4}$/;

/**
 * A backup's name from the moment it was started, in UTC: 2026-11-15-2017.
 * @param {Date} at
 */
export function backupName(at) {
	if (Number.isNaN(at.getTime())) throw new Error('backupName: not a date');
	const iso = at.toISOString();
	return `${iso.slice(0, 10)}-${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

/** @param {string} name */
export function isBackupName(name) {
	return NAME.test(name);
}

/** @param {string} name */
export function backupKey(name) {
	if (!isBackupName(name)) throw new Error(`Not a backup name: ${name} (like 2026-11-15-2017)`);
	return `${BACKUP_PREFIX}${name}.sql.gz`;
}

/**
 * The backup's name from its key, or null for anything else under the prefix.
 * @param {string} key
 */
export function nameOfKey(key) {
	if (!key.startsWith(BACKUP_PREFIX) || !key.endsWith('.sql.gz')) return null;
	const name = key.slice(BACKUP_PREFIX.length, -'.sql.gz'.length);
	return isBackupName(name) ? name : null;
}

/**
 * When a backup was started, from its name.
 * @param {string} name
 */
export function timeOfName(name) {
	if (!isBackupName(name)) throw new Error(`Not a backup name: ${name}`);
	return Date.parse(`${name.slice(0, 10)}T${name.slice(11, 13)}:${name.slice(13, 15)}:00Z`);
}

/**
 * @typedef {{ name: string, key: string, bytes: number, at: string }} BackupEntry
 * @typedef {{ updated: string, keep: number, keep_days: number, backups: BackupEntry[] }} BackupIndex
 */

/**
 * Which backups stay and which go.
 * @param {Array<{ key: string, size: number }>} objects  Everything listed under BACKUP_PREFIX.
 * @param {number} now  Milliseconds.
 * @returns {{ kept: BackupEntry[], dropped: string[] }}  kept newest first; dropped: keys.
 */
export function planPrune(objects, now) {
	const all = objects
		.map((o) => ({ name: nameOfKey(o.key), key: o.key, bytes: o.size }))
		.filter((/** @type {{ name: string | null }} */ o) => o.name !== null)
		.map((o) => ({ ...o, name: /** @type {string} */ (o.name), at: new Date(timeOfName(/** @type {string} */ (o.name))).toISOString() }))
		.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
	const oldest = now - KEEP_DAYS * 86400000;
	/** @type {BackupEntry[]} */
	const kept = [];
	/** @type {string[]} */
	const dropped = [];
	all.forEach((b, i) => (i < KEEP || Date.parse(b.at) >= oldest ? kept.push(b) : dropped.push(b.key)));
	return { kept, dropped };
}

/**
 * @param {BackupEntry[]} kept  Newest first.
 * @param {number} now
 * @returns {BackupIndex}
 */
export function backupIndex(kept, now) {
	return { updated: new Date(now).toISOString(), keep: KEEP, keep_days: KEEP_DAYS, backups: kept };
}
