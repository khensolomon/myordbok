-- A like (1) or dislike (-1) per member per sense. Sense ids come from the
-- dataset's TSV files and outlive a rebuild; text_hash is the SHA-256 of the
-- meaning the reaction was given for, and a sense counts only the reactions
-- for its current meaning, so feedback starts afresh when the meaning is
-- corrected. Whole-entry reactions stay in `reactions`, by headword.
CREATE TABLE IF NOT EXISTS sense_reactions (
	user_id     INTEGER NOT NULL REFERENCES users (id),
	dict        TEXT NOT NULL CHECK (dict IN ('emd', 'med')),
	sense_id    INTEGER NOT NULL,
	text_hash   TEXT NOT NULL,
	value       INTEGER NOT NULL CHECK (value IN (1, -1)),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (user_id, dict, sense_id)
);
CREATE INDEX IF NOT EXISTS sense_reactions_sense ON sense_reactions (dict, sense_id, text_hash);
