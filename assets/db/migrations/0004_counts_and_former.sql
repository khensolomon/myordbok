-- Searches, counted per word and day: how often, and whether the dictionary
-- had it. Nothing about who searched is kept. term is the query as looked
-- up (lower case for English), at most 60 characters.
CREATE TABLE IF NOT EXISTS search_counts (
	day    TEXT NOT NULL,                                  -- YYYY-MM-DD, UTC
	lang   TEXT NOT NULL CHECK (lang IN ('en', 'my')),
	term   TEXT NOT NULL,
	found  INTEGER NOT NULL CHECK (found IN (0, 1)),       -- as of the latest search that day
	hits   INTEGER NOT NULL DEFAULT 1,
	PRIMARY KEY (day, lang, term)
);
CREATE INDEX IF NOT EXISTS search_counts_term ON search_counts (lang, term);

-- "Former member": deleted accounts' reviewed suggestions are kept for the
-- dataset's history and moved here; id 0 is never handed out.
INSERT OR IGNORE INTO users (id, name, status) VALUES (0, 'Former member', 'suspended');
