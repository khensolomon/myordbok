// @ts-check
/**
 * The one state pattern: a small store on EventTarget.
 * `set` merges a patch and notifies subscribers once.
 */

/**
 * @template {Record<string, unknown>} S
 * @param {S} initial
 */
export function createStore(initial) {
	const events = new EventTarget();
	let state = Object.freeze({ ...initial });

	return {
		/** @returns {Readonly<S>} */
		get: () => state,

		/** @param {Partial<S>} patch */
		set(patch) {
			state = Object.freeze({ ...state, ...patch });
			events.dispatchEvent(new Event('change'));
		},

		/**
		 * @param {(state: Readonly<S>) => void} fn
		 * @returns {() => void} unsubscribe
		 */
		subscribe(fn) {
			const listener = () => fn(state);
			events.addEventListener('change', listener);
			return () => events.removeEventListener('change', listener);
		},
	};
}
