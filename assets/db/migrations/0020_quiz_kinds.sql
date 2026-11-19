-- Test yourself asks three more kinds of question (shared/quiz.js KINDS):
-- listen (the word heard), type (the word typed for a Myanmar meaning) and
-- sense (which of the word's meanings an example uses). The kind checks of
-- quiz_answers and quiz_reports widen to them; SQLite changes a CHECK only
-- by building the table again, rows and indexes kept.

CREATE TABLE quiz_answers_next (
	kind    TEXT NOT NULL CHECK (kind IN ('en-my', 'my-en', 'gap', 'listen', 'type', 'sense')),
	word    TEXT NOT NULL CHECK (length(word) BETWEEN 1 AND 100),
	answer  TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 300),
	chosen  TEXT NOT NULL CHECK (length(chosen) BETWEEN 1 AND 300),
	n       INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
	last_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (kind, word, answer, chosen)
) WITHOUT ROWID;
INSERT INTO quiz_answers_next SELECT kind, word, answer, chosen, n, last_at FROM quiz_answers;
DROP TABLE quiz_answers;
ALTER TABLE quiz_answers_next RENAME TO quiz_answers;

CREATE TABLE quiz_reports_next (
	id         INTEGER PRIMARY KEY,
	kind       TEXT NOT NULL CHECK (kind IN ('en-my', 'my-en', 'gap', 'listen', 'type', 'sense')),
	word       TEXT NOT NULL CHECK (length(word) BETWEEN 1 AND 100),
	prompt     TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 600),
	answer     TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 300),
	choices    TEXT NOT NULL CHECK (json_valid(choices) AND length(choices) <= 2000),
	chosen     TEXT CHECK (chosen IS NULL OR length(chosen) BETWEEN 1 AND 300),
	reason     TEXT NOT NULL CHECK (reason IN ('answer', 'choices', 'spelling', 'other')),
	note       TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
	lang       TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'my')),
	user_id    INTEGER,
	status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO quiz_reports_next SELECT id, kind, word, prompt, answer, choices, chosen, reason, note, lang, user_id, status, created_at FROM quiz_reports;
DROP TABLE quiz_reports;
ALTER TABLE quiz_reports_next RENAME TO quiz_reports;
CREATE INDEX IF NOT EXISTS quiz_reports_status ON quiz_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_reports_word ON quiz_reports (word);
