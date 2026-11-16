-- A label and a note on a searched word, set by editors in the workspace's
-- Searches: what to do about a word the dictionary did not find.
--
--   add          a real word the dictionary should have
--   misspelling  a wrong spelling of a word it has ("did you mean" answers it)
--   noise        not a word: a name, a test, something typed by accident
--
-- A word with no row is still to be sorted. The label belongs to the word,
-- not to a day: it stays through every period and after older counts are
-- deleted. A word that has since become a headword is found by looking in
-- the dictionary, not kept here.

CREATE TABLE IF NOT EXISTS search_marks (
	lang       TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	term       TEXT NOT NULL CHECK (length(term) BETWEEN 1 AND 100),
	label      TEXT CHECK (label IN ('add', 'misspelling', 'noise')),
	note       TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
	marked_by  INTEGER,
	marked_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (lang, term),
	CHECK (label IS NOT NULL OR note IS NOT NULL)
) WITHOUT ROWID;
