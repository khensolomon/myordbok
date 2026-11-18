// @ts-check
/**
 * A learner's progress (shared/quiz.js), kept only in this browser (mo:quiz)
 * and never sent anywhere. Storage may be blocked: then rounds still play,
 * and nothing is remembered between pages.
 */
import { noProgress, readProgress, recordRound } from '#shared/quiz.js';

const KEY = 'mo:quiz';
/** Set when the reader turned the questions on word pages off on this device. */
const OFF = 'mo:quiz-off';

/** @type {import('#shared/quiz.js').Progress | null} Kept for this page when storage is blocked. */
let memory = null;

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
	memory = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {
		// storage blocked: kept for this page only
	}
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

/** Forgets every word and the streak. */
export function clearProgress() {
	memory = null;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// storage blocked: nothing was kept
	}
}
