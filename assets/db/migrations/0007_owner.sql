-- A fourth level above admin: owner, who gives and takes every level
-- (shared/roles.js). SQLite cannot change a CHECK, so users and role_grants
-- are made again with their rows.
--
-- Many tables point at users, and D1 keeps foreign keys on. So: plain
-- copies first; role_grants (which points at users) goes, then users; the
-- new users is created under its own name and the rows go back in, which
-- answers every reference that pointed at the old one before the
-- transaction ends (foreign keys are checked at the end, deferred).
PRAGMA defer_foreign_keys = on;

CREATE TABLE users_copy AS SELECT id, name, avatar_url, role, status, created_at, seen_at, email FROM users;
CREATE TABLE role_grants_copy AS SELECT id, user_id, role, granted_by, created_at FROM role_grants;
DROP TABLE role_grants;
DROP TABLE users;

CREATE TABLE users (
	id          INTEGER PRIMARY KEY,
	name        TEXT NOT NULL,
	avatar_url  TEXT,
	role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin', 'owner')),
	status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	seen_at     INTEGER,
	email       TEXT
);
INSERT INTO users (id, name, avatar_url, role, status, created_at, seen_at, email)
	SELECT id, name, avatar_url, role, status, created_at, seen_at, email FROM users_copy;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;

CREATE TABLE role_grants (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	role        TEXT NOT NULL CHECK (role IN ('member', 'editor', 'admin', 'owner')),
	granted_by  INTEGER REFERENCES users (id),  -- NULL only for the command line and this migration
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO role_grants (id, user_id, role, granted_by, created_at)
	SELECT id, user_id, role, granted_by, created_at FROM role_grants_copy;
CREATE INDEX IF NOT EXISTS role_grants_user ON role_grants (user_id, created_at);

DROP TABLE role_grants_copy;
DROP TABLE users_copy;

-- The first admin, the one who set the site up, becomes its owner.
UPDATE users SET role = 'owner'
	WHERE id = (SELECT min(id) FROM users WHERE role = 'admin' AND status = 'active' AND id > 0);
INSERT INTO role_grants (user_id, role, granted_by)
	SELECT id, 'owner', NULL FROM users WHERE role = 'owner';
