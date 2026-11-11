-- Site notices that admins schedule in the workspace (worker/routes/notices.js):
-- maintenance and information show as a bar on every page, a celebration as
-- a line on the home page. starts_at and ends_at are what the notice is about
-- (the maintenance window, the day); it shows from announce_at, or from
-- starts_at without one, until ends_at. A yearly one repeats every year on the
-- same days (fixed-date days such as 25 December). Text in either language
-- or both; at least one.
CREATE TABLE IF NOT EXISTS notices (
	id         INTEGER PRIMARY KEY,
	kind       TEXT NOT NULL CHECK (kind IN ('maintenance', 'info', 'celebration')),
	text_en    TEXT CHECK (text_en IS NULL OR length(text_en) BETWEEN 1 AND 280),
	text_my    TEXT CHECK (text_my IS NULL OR length(text_my) BETWEEN 1 AND 280),
	link       TEXT CHECK (link IS NULL OR length(link) <= 300),
	audience   TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'member', 'editor')),
	announce_at INTEGER,
	starts_at  INTEGER NOT NULL,
	ends_at    INTEGER NOT NULL,
	yearly     INTEGER NOT NULL DEFAULT 0 CHECK (yearly IN (0, 1)),
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_by INTEGER NOT NULL DEFAULT 0,
	CHECK (text_en IS NOT NULL OR text_my IS NOT NULL),
	CHECK (ends_at > starts_at),
	CHECK (announce_at IS NULL OR announce_at <= starts_at)
);
CREATE INDEX IF NOT EXISTS notices_ends ON notices (ends_at);
