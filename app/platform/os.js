// @ts-check
/**
 * The system the app (the Tauri build) runs on, from the web view's user agent. An iPad's web
 * view introduces itself as a Mac's Safari (since iPadOS 13): a Mac with a
 * touch screen is an iPad, as no Mac has one. The splash's inline script
 * (scripts/build.js, appSplash) makes the same test before anything loads.
 * @param {string} [agent]
 * @param {number} [touchPoints]
 * @returns {'ios' | 'android' | 'desktop'}
 */
export function platformOf(agent = globalThis.navigator?.userAgent ?? '', touchPoints = globalThis.navigator?.maxTouchPoints ?? 0) {
	if (/iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && touchPoints > 1)) return 'ios';
	return /Android/.test(agent) ? 'android' : 'desktop';
}

/** The same test as source, for the splash's inline script. */
export const PLATFORM_SCRIPT = `(/iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))?'ios':/Android/.test(navigator.userAgent)?'android':'desktop'`;
