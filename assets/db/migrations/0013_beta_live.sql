-- Beta and live: one name per site, the same name for its dictionary
-- database. The two dictionary databases are now myordbok-beta (was
-- myordbok-dataset) and myordbok-live (was myordbok-dictionary), and the
-- live site is "live" (was "production").
--
-- dict_release keeps its rows under the new names. SQLite cannot change a
-- CHECK constraint in place, so the table is rebuilt.
--
-- Normally beta reads myordbok-beta (the preview) and live reads
-- myordbok-live. Live reads myordbok-beta only while `make data-promote`
-- imports the same build into myordbok-live, so readers never wait.

CREATE TABLE dict_release_next (
	env          TEXT PRIMARY KEY CHECK (env IN ('beta', 'live')),
	reads        TEXT NOT NULL CHECK (reads IN ('beta', 'live')),
	build        TEXT NOT NULL,                -- meta.built of that database when switched
	switched_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	switched_by  TEXT NOT NULL
);

INSERT INTO dict_release_next (env, reads, build, switched_at, switched_by)
SELECT
	CASE env WHEN 'production' THEN 'live' ELSE env END,
	CASE reads WHEN 'dataset' THEN 'beta' ELSE 'live' END,
	build, switched_at, switched_by
FROM dict_release;

DROP TABLE dict_release;
ALTER TABLE dict_release_next RENAME TO dict_release;
