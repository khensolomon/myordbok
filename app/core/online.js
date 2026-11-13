// @ts-check
/**
 * Whether this device has a connection, on <html data-online="true|false">,
 * kept up to date. The person button on the site and in the workspace shows
 * it as a small dot (app.css): green with a connection, grey without, when
 * the dictionary reads from the copy on the device.
 *
 * navigator.onLine is false only when the device has no network at all; a
 * network that cannot reach MyOrdbok still counts as online here.
 */

function apply() {
	document.documentElement.dataset.online = String(navigator.onLine);
}

/** Starts following the connection; call once. */
export function followOnline() {
	apply();
	addEventListener('online', apply);
	addEventListener('offline', apply);
}
