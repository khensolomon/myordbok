-- Messages sent through the site's contact form (worker/routes/messages.js),
-- read by admins in the workspace's Inbox. A message from a signed-in member
-- names them; anyone may leave an address for a reply.
CREATE TABLE IF NOT EXISTS messages (
	id         INTEGER PRIMARY KEY,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	kind       TEXT NOT NULL CHECK (kind IN ('feedback', 'question', 'problem', 'word')),
	body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
	reply_to   TEXT CHECK (reply_to IS NULL OR length(reply_to) <= 254),
	page       TEXT CHECK (page IS NULL OR length(page) <= 300),
	lang       TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	user_id    INTEGER REFERENCES users (id),
	status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done'))
);
CREATE INDEX IF NOT EXISTS messages_status ON messages (status, id);

-- Site settings that admins change in the workspace; one row per setting,
-- the value as JSON. Known keys and their defaults: worker/lib/settings.js.
CREATE TABLE IF NOT EXISTS settings (
	key        TEXT PRIMARY KEY,
	value      TEXT NOT NULL,
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_by INTEGER NOT NULL DEFAULT 0
);
