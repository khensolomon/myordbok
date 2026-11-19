-- Help the dictionary (worker/routes/help.js): questions put to signed-in
-- members who read Myanmar, not scored, whose answers editors decide on.
--
-- help_items is what is asked. A spelling item offers 2 to 4 spellings of
-- one word (a word searched and not found, against dictionary words a slip
-- away; or added by an editor). A meaning item asks whether a meaning not yet
-- reviewed is right, for the meaning's text as it was (text_hash, as ratings
-- keep it): a meaning changed since starts a new item.
--
-- help_votes is one answer a member and item: for spelling the spelling
-- chosen, 'many' (more than one is right) or 'unsure'; for meaning 'yes',
-- 'no' or 'unsure'. Votes count only from members whose check answers show
-- they read Myanmar (help_checks), and 'unsure' never counts.
--
-- help_checks counts a member's check questions: dictionary words against
-- spellings a slip away that are not words, answered like any spelling item.
--
-- help_asked holds a question handed out until it is answered, so the
-- answer is checked against what was asked and a check's right answer
-- never leaves the server. Rows older than a day are removed.
--
-- A decision never changes the dictionary: it labels a searched misspelling
-- (search_marks) or leaves a meaning for an editor to change in the studio.

CREATE TABLE IF NOT EXISTS help_items (
	id          INTEGER PRIMARY KEY,
	kind        TEXT NOT NULL CHECK (kind IN ('spelling', 'meaning')),
	key         TEXT NOT NULL UNIQUE,
	options     TEXT CHECK (options IS NULL OR (json_valid(options) AND json_array_length(options) BETWEEN 2 AND 4)),
	word        TEXT CHECK (word IS NULL OR length(word) BETWEEN 1 AND 100),
	type        TEXT,
	sense_id    INTEGER,
	text_hash   TEXT,
	gloss       TEXT CHECK (gloss IS NULL OR length(gloss) <= 600),
	source      TEXT NOT NULL CHECK (source IN ('search', 'editor', 'review')),
	status      TEXT NOT NULL DEFAULT 'collecting' CHECK (status IN ('collecting', 'decided', 'set_aside')),
	decision    TEXT CHECK (decision IS NULL OR length(decision) BETWEEN 1 AND 100),
	decided_by  INTEGER,
	decided_at  INTEGER,
	created_by  INTEGER,
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	CHECK ((kind = 'spelling' AND options IS NOT NULL) OR (kind = 'meaning' AND sense_id IS NOT NULL AND text_hash IS NOT NULL AND word IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS help_items_status ON help_items (kind, status);

CREATE TABLE IF NOT EXISTS help_votes (
	item_id    INTEGER NOT NULL REFERENCES help_items (id) ON DELETE CASCADE,
	user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	answer     TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 100),
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (item_id, user_id)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS help_votes_user ON help_votes (user_id);

CREATE TABLE IF NOT EXISTS help_checks (
	user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	correct INTEGER NOT NULL DEFAULT 0 CHECK (correct >= 0),
	total   INTEGER NOT NULL DEFAULT 0 CHECK (total >= correct)
);

CREATE TABLE IF NOT EXISTS help_asked (
	id         INTEGER PRIMARY KEY,
	user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	item_id    INTEGER REFERENCES help_items (id) ON DELETE CASCADE,
	options    TEXT CHECK (options IS NULL OR json_valid(options)),
	answer     TEXT,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	CHECK ((item_id IS NULL) = (answer IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS help_asked_user ON help_asked (user_id, created_at);
