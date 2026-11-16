// @ts-check
/**
 * The button beside a headword that says it aloud (worker/routes/pronunciation.js).
 *
 * One sound at a time: a press while it plays stops it, a press on another
 * button stops the first. The sound starts within the press itself (a
 * browser plays nothing it was not asked for by the reader). When it cannot
 * play, the reason is asked of the server and shown on the button for a
 * few seconds; without a connection it says so at once.
 *
 * The icon's waves move on hover and for as long as the sound plays (app.css).
 */
import { h, icon } from '../core/dom.js';
import { ICONS } from '../core/icons.js';
import { t } from '../i18n/index.js';

/** @type {{ audio: HTMLAudioElement, button: HTMLElement } | null} */
let playing = null;

function stop() {
	if (!playing) return;
	playing.audio.pause();
	playing.button.removeAttribute('data-state');
	playing = null;
}

/**
 * @param {string} word  The headword as the dictionary spells it.
 * @param {'en' | 'my'} lang
 */
export function pronounceButton(word, lang) {
	const label = t('Listen');
	const said = h('span', { class: 'visually-hidden', role: 'status' });
	const button = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'pronounce', 'aria-label': label, title: label }, icon(ICONS.speaker, 22), said));
	const url = `/api/pronunciation?q=${encodeURIComponent(word)}&tl=${lang}`;
	/** @type {number | undefined} */
	let clear;

	/** @param {string} why */
	const failed = (why) => {
		button.dataset.state = 'failed';
		button.title = why;
		said.textContent = why;
		clearTimeout(clear);
		clear = window.setTimeout(() => {
			if (button.dataset.state === 'failed') button.removeAttribute('data-state');
			button.title = label;
			said.textContent = '';
		}, 5000);
	};

	/** Why the sound did not play: the server's own words when it has some. */
	const reason = async () => {
		try {
			const res = await fetch(url);
			if (!res.ok) {
				const body = await res.json().catch(() => null);
				if (body?.error?.message) return String(body.error.message);
			}
		} catch {
			return t('The pronunciation needs a connection.');
		}
		return t('The pronunciation could not be played.');
	};

	button.addEventListener('click', () => {
		const mine = playing?.button === button;
		stop();
		if (mine) return;
		clearTimeout(clear);
		button.title = label;
		said.textContent = '';
		if (!navigator.onLine) return failed(t('The pronunciation needs a connection.'));
		const audio = new Audio(url);
		playing = { audio, button };
		button.dataset.state = 'loading';
		const mineStill = () => playing?.audio === audio;
		audio.addEventListener('playing', () => mineStill() && (button.dataset.state = 'playing'));
		audio.addEventListener('ended', () => mineStill() && stop());
		audio.play().catch(async (err) => {
			if (!mineStill()) return; // stopped by another press
			playing = null;
			// Refused by the browser itself (not by the network): its own reason is the one to show.
			failed(err instanceof DOMException && err.name === 'NotAllowedError' ? t('The pronunciation could not be played.') : await reason());
		});
	});
	return button;
}
