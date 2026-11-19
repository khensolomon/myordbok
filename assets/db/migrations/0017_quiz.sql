-- Test yourself (shared/quiz.js): what readers answered, and what they
-- reported as wrong with a question.
--
-- quiz_answers counts answers per question and choice, sent only by readers
-- who allowed usage statistics. A question is its kind, its word and its
-- right answer; the choice picked is `chosen`, the same text as `answer`
-- when it was right. No reader, device or time of day is kept: a question
-- many get wrong points at an unclear meaning or two choices too close,
-- and a wrong choice many pick may be a meaning the word is missing.
--
-- quiz_reports keeps a question as the reader saw it, with what they say
-- is wrong. Editors set it done in the workspace's Questions.

CREATE TABLE IF NOT EXISTS quiz_answers (
	kind    TEXT NOT NULL CHECK (kind IN ('en-my', 'my-en', 'gap')),
	word    TEXT NOT NULL CHECK (length(word) BETWEEN 1 AND 100),
	answer  TEXT NOT NULL CHECK (length(answer) BETWEEN 1 AND 300),
	chosen  TEXT NOT NULL CHECK (length(chosen) BETWEEN 1 AND 300),
	n       INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
	last_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (kind, word, answer, chosen)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS quiz_reports (
	id         INTEGER PRIMARY KEY,
	kind       TEXT NOT NULL CHECK (kind IN ('en-my', 'my-en', 'gap')),
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
CREATE INDEX IF NOT EXISTS quiz_reports_status ON quiz_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_reports_word ON quiz_reports (word);
