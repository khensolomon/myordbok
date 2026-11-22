-- Sign in with Apple (worker/lib/apple.js): identities take 'apple' beside
-- 'google' and 'github'. SQLite changes a CHECK only by building the table
-- again; rows and the index are kept.

CREATE TABLE identities_next (
	provider          TEXT NOT NULL CHECK (provider IN ('google', 'github', 'apple')),
	provider_user_id  TEXT NOT NULL,
	user_id           INTEGER NOT NULL REFERENCES users (id),
	created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (provider, provider_user_id)
);
INSERT INTO identities_next (provider, provider_user_id, user_id, created_at) SELECT provider, provider_user_id, user_id, created_at FROM identities;
DROP TABLE identities;
ALTER TABLE identities_next RENAME TO identities;
CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id);
