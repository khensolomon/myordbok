-- MyOrdbok app database (binding DB). Cloudflare D1 / SQLite.
--
-- Holds what the app writes: members, sign-in, reactions, comments and
-- dictionary edits. The dictionary itself is NOT here: it is built from the
-- dataset TSV files and published into a separate database (bindings DICT_A
-- and DICT_B, see docs/deploy.md). Nothing in this database ever writes to
-- emd_sense or med_sense; edits wait in dict_edits until they are exported to
-- the dataset, merged there, and come back with the next data release.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- people

CREATE TABLE IF NOT EXISTS users (
	id          INTEGER PRIMARY KEY,
	name        TEXT NOT NULL,
	avatar_url  TEXT,
	role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin')),
	status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	seen_at     INTEGER
);

-- One person may sign in with both Google and GitHub. Linking a second
-- provider happens only from an already signed-in session, never by email.
-- The provider's email is not stored: the app does not need it.
CREATE TABLE IF NOT EXISTS identities (
	provider          TEXT NOT NULL CHECK (provider IN ('google', 'github')),
	provider_user_id  TEXT NOT NULL,
	user_id           INTEGER NOT NULL REFERENCES users (id),
	created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id);

-- Server-side sessions: deleting a row signs the device out at once.
CREATE TABLE IF NOT EXISTS sessions (
	id_hash     TEXT PRIMARY KEY,          -- SHA-256 of the cookie value
	user_id     INTEGER NOT NULL REFERENCES users (id),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

-- Who gave or took which level, and when. users.role is the current level;
-- this is its history.
CREATE TABLE IF NOT EXISTS role_grants (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	role        TEXT NOT NULL CHECK (role IN ('member', 'editor', 'admin')),
	granted_by  INTEGER REFERENCES users (id),  -- NULL only for the command-line bootstrap
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS role_grants_user ON role_grants (user_id, created_at);

-- ---------------------------------------------------------------- community

-- A like (1) or dislike (-1) per member per headword. `word` is the
-- headword text, not an id: ids belong to one dictionary build, the
-- spelling survives a rebuild.
CREATE TABLE IF NOT EXISTS reactions (
	user_id     INTEGER NOT NULL REFERENCES users (id),
	lang        TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	word        TEXT NOT NULL,
	value       INTEGER NOT NULL CHECK (value IN (1, -1)),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (user_id, lang, word)
);
CREATE INDEX IF NOT EXISTS reactions_word ON reactions (lang, word);

-- Comments on a search result.
CREATE TABLE IF NOT EXISTS comments (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	lang        TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	word        TEXT NOT NULL,
	body        TEXT NOT NULL,
	status      TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS comments_word ON comments (lang, word, created_at);

-- ---------------------------------------------------------------- dictionary edits
--
-- Every correction, addition or deletion made in the studio, by a member's
-- suggestion or an editor's own edit. One row is one change to one field,
-- matching one line of the dataset's patch files:
--
--   action  'edit'    sense_id + field + old_value → new_value  (emd_patch / med_patch)
--           'delete'  sense_id, old_value = current headword    (field 'delete' in the patch)
--           'add'     word + data (JSON: wrte, sense, exam, …)  (emd_new / emd_more, med_new / med_more)
--
-- Life of a row:
--   pending → approved | rejected        an editor reviews it
--   approved → exported                  `make edits-export` wrote it to a TSV batch
--   exported → merged | conflict         the dataset accepted it, or its old value had changed
--
-- Values may not contain tabs or line breaks, because they travel as TSV.

CREATE TABLE IF NOT EXISTS dict_edits (
	id            INTEGER PRIMARY KEY,
	user_id       INTEGER NOT NULL REFERENCES users (id),
	dict          TEXT NOT NULL CHECK (dict IN ('emd', 'med')),
	action        TEXT NOT NULL CHECK (action IN ('edit', 'add', 'delete')),
	sense_id      INTEGER,                    -- emd_sense.id / med_sense.id; NULL for 'add'
	field         TEXT,                       -- for 'edit'
	old_value     TEXT,                       -- value the editor saw; checked again on export
	new_value     TEXT,
	word          TEXT NOT NULL,              -- headword, for review lists and for 'add'
	data          TEXT,                       -- 'add': JSON of the new sense
	source        TEXT,                       -- dictionary build the edit was made against (meta.built)
	status        TEXT NOT NULL DEFAULT 'pending'
	              CHECK (status IN ('pending', 'approved', 'rejected', 'exported', 'merged', 'conflict')),
	note          TEXT,                       -- the author's reason
	reviewed_by   INTEGER REFERENCES users (id),
	review_note   TEXT,
	export_id     INTEGER REFERENCES dict_exports (id),
	created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
	reviewed_at   INTEGER,
	CHECK (action != 'edit' OR (sense_id IS NOT NULL AND field IS NOT NULL)),
	CHECK (action != 'delete' OR sense_id IS NOT NULL),
	CHECK (action != 'add' OR data IS NOT NULL),
	CHECK (coalesce(old_value, '') NOT GLOB '*[' || char(9, 10, 13) || ']*'),
	CHECK (coalesce(new_value, '') NOT GLOB '*[' || char(9, 10, 13) || ']*'),
	CHECK (word NOT GLOB '*[' || char(9, 10, 13) || ']*')
);
CREATE INDEX IF NOT EXISTS dict_edits_status ON dict_edits (status, created_at);
CREATE INDEX IF NOT EXISTS dict_edits_sense ON dict_edits (dict, sense_id);
CREATE INDEX IF NOT EXISTS dict_edits_user ON dict_edits (user_id, created_at);

-- One row per `make edits-export APPLY=1`: which edits left, and when the
-- dataset release that carries them was published.
CREATE TABLE IF NOT EXISTS dict_exports (
	id             INTEGER PRIMARY KEY,
	created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
	created_by     TEXT NOT NULL,              -- who ran the command (git user name)
	counts         TEXT NOT NULL,              -- JSON: rows per file
	merged_source  TEXT,                       -- meta.built of the release that contains them
	merged_at      INTEGER
);

-- Which dictionary database each site reads. The dictionary lives in two
-- slots (DICT_A, DICT_B); a release is imported into the slot not in use,
-- checked, then switched to. Switching back is the rollback.
CREATE TABLE IF NOT EXISTS dict_release (
	env          TEXT PRIMARY KEY CHECK (env IN ('beta', 'production')),
	slot         TEXT NOT NULL CHECK (slot IN ('a', 'b')),
	source       TEXT NOT NULL,                -- meta.built of the slot when switched
	switched_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	switched_by  TEXT NOT NULL
);
