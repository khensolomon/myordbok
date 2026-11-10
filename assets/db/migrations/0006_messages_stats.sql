-- Messages get four states and an admin's note: new (unread), read (opened
-- in the Inbox), replied, done. SQLite cannot change a CHECK, so the table
-- is made again with the rows copied ('done' stays done, 'new' stays new).
CREATE TABLE messages_next (
	id         INTEGER PRIMARY KEY,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	kind       TEXT NOT NULL CHECK (kind IN ('feedback', 'question', 'problem', 'word')),
	body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
	reply_to   TEXT CHECK (reply_to IS NULL OR length(reply_to) <= 254),
	page       TEXT CHECK (page IS NULL OR length(page) <= 300),
	lang       TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	user_id    INTEGER REFERENCES users (id),
	status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'done')),
	-- For admins only, never shown to the sender.
	note       TEXT CHECK (note IS NULL OR length(note) <= 2000),
	-- Who changed the state last, and when (0 once that admin's account is deleted).
	handled_by INTEGER,
	handled_at INTEGER
);
INSERT INTO messages_next (id, created_at, kind, body, reply_to, page, lang, user_id, status)
	SELECT id, created_at, kind, body, reply_to, page, lang, user_id, status FROM messages;
DROP TABLE messages;
ALTER TABLE messages_next RENAME TO messages;
CREATE INDEX IF NOT EXISTS messages_status ON messages (status, id);

-- Statistics of each dictionary build, worked out where the build is made
-- (scripts/stats.js) and written at publish: the workspace reads one row
-- instead of counting the dictionary on every visit.
CREATE TABLE IF NOT EXISTS build_stats (
	build      TEXT PRIMARY KEY,
	stats      TEXT NOT NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
