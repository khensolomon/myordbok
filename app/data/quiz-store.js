// @ts-check
/**
 * A learner's progress (shared/quiz.js), kept in this browser (mo:quiz).
 * Signed in, it is also kept with the account: every save is merged with
 * the account's copy (POST /api/quiz/progress), so the words follow the
 * member to each device. Signed out, it never leaves the browser. Storage
 * may be blocked: then rounds still play, and nothing is remembered
 * between pages.
 */
import { mergeProgress, noProgress, readProgress, recordRound } from '#shared/quiz.js';
import { member } from '../core/member.js';
import { syncQuizProgress } from './api.js';

const KEY = 'mo:quiz';
/** Set when the reader turned the questions on word pages off on this device. */
const OFF = 'mo:quiz-off';

/** @type {import('#shared/quiz.js').Progress | null} Kept for this page when storage is blocked. */
let memory = null;

/** Known once the member is: whether progress is kept with an account. */
let account = false;
/** Answers of the member's that help the dictionary, as of the last save. */
let helpedCount = /** @type {number | null} */ (null);

/** Whether progress is kept with the member's account, as far as known now. */
export function keptWithAccount() {
	return account;
}

/** How many answers of the signed-in member help the dictionary, once a save has said. */
export function helped() {
	return helpedCount;
}

/** @param {import('#shared/quiz.js').Progress} p */
function write(p) {
	memory = p;
	try {
		localStorage.setItem(KEY, JSON.stringify(p));
	} catch {
		// storage blocked: kept for this page only
	}
}

/**
 * Merges this device's progress with the account's, when signed in, and
 * keeps the result here too. Resolves false when signed out.
 */
export async function syncProgress() {
	const m = await member().catch(() => null);
	account = Boolean(m);
	if (!m) return false;
	const r = await syncQuizProgress(progress());
	// A round saved while this was on its way stays: merged, not replaced.
	if (r.progress) write(mergeProgress(progress(), readProgress(r.progress)));
	if (typeof r.helped === 'number') helpedCount = r.helped;
	return true;
}

/** @type {Promise<void> | null} */
let queued = null;

/** One sync for the rounds saved together, as a practice round saves each word. */
function queueSync() {
	if (queued) return;
	queued = Promise.resolve()
		.then(() => syncProgress())
		.then(
			() => undefined,
			(err) => console.warn('Progress not kept with the account this time:', err),
		)
		.finally(() => (queued = null));
}

/** @returns {import('#shared/quiz.js').Progress} */
export function progress() {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? readProgress(JSON.parse(raw)) : (memory ?? noProgress());
	} catch {
		return memory ?? noProgress();
	}
}

/**
 * @param {string} word
 * @param {boolean} right  Every question on it answered right.
 * @param {number} today
 */
export function saveRound(word, right, today) {
	const next = recordRound(progress(), word, right, today);
	write(next);
	queueSync();
	return next;
}

/** Whether word pages offer questions on this device. */
export function quizShown() {
	try {
		return localStorage.getItem(OFF) !== '1';
	} catch {
		return true;
	}
}

/** @param {boolean} shown */
export function showQuiz(shown) {
	try {
		if (shown) localStorage.removeItem(OFF);
		else localStorage.setItem(OFF, '1');
	} catch {
		// storage blocked: the choice lasts this page
	}
}

/** Forgets every word and the streak, here and, signed in, with the account. */
export async function clearProgress() {
	memory = null;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// storage blocked: nothing was kept
	}
	if (await member().catch(() => null)) await syncQuizProgress(null);
}
