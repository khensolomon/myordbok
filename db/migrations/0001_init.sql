-- MyOrdbok initial schema (Cloudflare D1 / SQLite).
--
-- Dictionary tables follow the dataset's one-place rule: each headword is
-- stored once (eng_word, mya_word) and senses refer to it by wrid.
-- Every edit goes through `changes`, an append-only log that also drives
-- delta sync for offline readers.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- dictionary

CREATE TABLE word_type (
	id     INTEGER PRIMARY KEY,
	name   TEXT NOT NULL UNIQUE          -- noun, verb, adjective, ...
);

CREATE TABLE eng_word (
	id     INTEGER PRIMARY KEY,
	word   TEXT NOT NULL UNIQUE,
	key    TEXT NOT NULL                 -- NFC + lower-case, for prefix search
);
CREATE INDEX eng_word_key ON eng_word (key);

CREATE TABLE mya_word (
	id     INTEGER PRIMARY KEY,
	word   TEXT NOT NULL UNIQUE,
	key    TEXT NOT NULL
);
CREATE INDEX mya_word_key ON mya_word (key);

-- English → Myanmar senses.
CREATE TABLE emd_sense (
	id       INTEGER PRIMARY KEY,
	wrid     INTEGER NOT NULL REFERENCES eng_word (id),
	wrte     INTEGER NOT NULL REFERENCES word_type (id),
	sense    TEXT NOT NULL,
	exam     TEXT,
	wseq     INTEGER NOT NULL DEFAULT 1,  -- display order, 1 first
	wrkd     INTEGER NOT NULL DEFAULT 0,  -- review status: 0 draft, 1 checked, 2 active
	deleted  INTEGER NOT NULL DEFAULT 0   -- soft delete, so sync can remove it on clients
);
CREATE INDEX emd_sense_word ON emd_sense (wrid, wrte, wseq);

-- Myanmar → English senses.
CREATE TABLE med_sense (
	id       INTEGER PRIMARY KEY,
	wrid     INTEGER NOT NULL REFERENCES mya_word (id),
	wrte     INTEGER NOT NULL REFERENCES word_type (id),
	sense    TEXT NOT NULL,
	exam     TEXT,
	wseq     INTEGER NOT NULL DEFAULT 1,
	wrkd     INTEGER NOT NULL DEFAULT 0,
	deleted  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX med_sense_word ON med_sense (wrid, wrte, wseq);

-- ---------------------------------------------------------------- people

CREATE TABLE users (
	id          INTEGER PRIMARY KEY,
	name        TEXT NOT NULL,
	avatar_url  TEXT,
	role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
	status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- One person may sign in with both Google and GitHub. Linking a second
-- provider happens only from an already signed-in session, never by email.
CREATE TABLE identities (
	provider          TEXT NOT NULL CHECK (provider IN ('google', 'github')),
	provider_user_id  TEXT NOT NULL,
	user_id           INTEGER NOT NULL REFERENCES users (id),
	created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX identities_user ON identities (user_id);

-- Server-side sessions: deleting a row signs the device out at once.
CREATE TABLE sessions (
	id_hash     TEXT PRIMARY KEY,          -- SHA-256 of the cookie value
	user_id     INTEGER NOT NULL REFERENCES users (id),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Who gave or took which level, and when.
CREATE TABLE role_grants (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	role        TEXT NOT NULL CHECK (role IN ('member', 'editor', 'admin')),
	granted_by  INTEGER REFERENCES users (id),  -- NULL only for the CLI bootstrap
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ---------------------------------------------------------------- history

-- Append-only. `id` is the dataset version that offline clients sync from.
CREATE TABLE changes (
	id           INTEGER PRIMARY KEY AUTOINCREMENT,
	table_name   TEXT NOT NULL CHECK (table_name IN ('eng_word', 'mya_word', 'emd_sense', 'med_sense')),
	row_id       INTEGER NOT NULL,
	op           TEXT NOT NULL CHECK (op IN ('insert', 'update', 'delete', 'revert')),
	before_json  TEXT,
	after_json   TEXT,
	user_id      INTEGER REFERENCES users (id),
	suggestion_id INTEGER REFERENCES suggestions (id),
	created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX changes_row ON changes (table_name, row_id);
CREATE INDEX changes_user ON changes (user_id, created_at);

-- ---------------------------------------------------------------- community

-- A like (1) or dislike (-1) per member per headword.
CREATE TABLE reactions (
	user_id     INTEGER NOT NULL REFERENCES users (id),
	lang        TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	wrid        INTEGER NOT NULL,
	value       INTEGER NOT NULL CHECK (value IN (1, -1)),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (user_id, lang, wrid)
);
CREATE INDEX reactions_word ON reactions (lang, wrid);

-- A proposed change to an entry, reviewed by an editor.
CREATE TABLE suggestions (
	id            INTEGER PRIMARY KEY,
	user_id       INTEGER NOT NULL REFERENCES users (id),
	lang          TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	wrid          INTEGER NOT NULL,
	sense_id      INTEGER,                  -- NULL for a new sense or a new entry
	base_change   INTEGER,                  -- changes.id the suggestion was made against
	body_json     TEXT NOT NULL,
	status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
	reviewed_by   INTEGER REFERENCES users (id),
	review_note   TEXT,
	created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
	reviewed_at   INTEGER
);
CREATE INDEX suggestions_status ON suggestions (status, created_at);

-- Comments on a headword or its search result.
CREATE TABLE comments (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	lang        TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	wrid        INTEGER NOT NULL,
	body        TEXT NOT NULL,
	status      TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX comments_word ON comments (lang, wrid, created_at);
