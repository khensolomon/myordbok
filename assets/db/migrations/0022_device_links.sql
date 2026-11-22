-- Linking the MyOrdbok app to an account made on the website
-- (worker/routes/link.js): the app shows a short code, a member signed in on
-- the website approves it at /link, and the app's session begins.
--
-- device_links: one row per code while it waits (10 minutes); the app's own
-- secret for asking after it is kept only as its SHA-256.
-- sessions.device: what a session belongs to; NULL a browser (a cookie),
-- otherwise the app on that platform (a bearer token), listed on the
-- Account page as a linked device.

CREATE TABLE IF NOT EXISTS device_links (
	user_code    TEXT PRIMARY KEY CHECK (length(user_code) = 8),
	device_hash  TEXT NOT NULL UNIQUE,
	device       TEXT NOT NULL CHECK (device IN ('ios', 'android', 'desktop')),
	status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
	user_id      INTEGER REFERENCES users (id),
	created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
	expires_at   INTEGER NOT NULL
);

ALTER TABLE sessions ADD COLUMN device TEXT CHECK (device IS NULL OR device IN ('ios', 'android', 'desktop'));
