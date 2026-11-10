-- A fourth level above admin: owner, who gives and takes every level
-- (shared/roles.js). SQLite cannot change a CHECK, so users and role_grants
-- are made again with their rows; foreign keys are checked at the end, when
-- the new tables carry the old names again.
PRAGMA defer_foreign_keys = on;

CREATE TABLE users_next (
	id          INTEGER PRIMARY KEY,
	name        TEXT NOT NULL,
	avatar_url  TEXT,
	role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'editor', 'admin', 'owner')),
	status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
	created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
	seen_at     INTEGER,
	email       TEXT
);
INSERT INTO users_next (id, name, avatar_url, role, status, created_at, seen_at, email)
	SELECT id, name, avatar_url, role, status, created_at, seen_at, email FROM users;
DROP TABLE users;
ALTER TABLE users_next RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;

CREATE TABLE role_grants_next (
	id          INTEGER PRIMARY KEY,
	user_id     INTEGER NOT NULL REFERENCES users (id),
	role        TEXT NOT NULL CHECK (role IN ('member', 'editor', 'admin', 'owner')),
	granted_by  INTEGER REFERENCES users (id),  -- NULL only for the command line and this migration
	created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT INTO role_grants_next (id, user_id, role, granted_by, created_at)
	SELECT id, user_id, role, granted_by, created_at FROM role_grants;
DROP TABLE role_grants;
ALTER TABLE role_grants_next RENAME TO role_grants;
CREATE INDEX IF NOT EXISTS role_grants_user ON role_grants (user_id, created_at);

-- The first admin, the one who set the site up, becomes its owner.
UPDATE users SET role = 'owner'
	WHERE id = (SELECT min(id) FROM users WHERE role = 'admin' AND status = 'active' AND id > 0);
INSERT INTO role_grants (user_id, role, granted_by)
	SELECT id, 'owner', NULL FROM users WHERE role = 'owner';
