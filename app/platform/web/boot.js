// @ts-check
/**
 * Web adapter: start-up. Registers the service worker, but only in a built
 * web release (the build adds <meta name="mo-sw">), never in development or
 * inside Tauri, whose WebViews do not support service workers.
 */
export async function boot() {
	if (!document.querySelector('meta[name="mo-sw"]')) return;
	if (!('serviceWorker' in navigator)) return;
	try {
		await navigator.serviceWorker.register('/sw.js', { scope: '/' });
	} catch (err) {
		console.error('Service worker registration failed; the app still works online.', err);
	}
}
