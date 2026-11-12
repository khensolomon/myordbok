-- Supporters and what they gave (worker/routes/support.js), kept by the owner
-- in the workspace (Sponsors) instead of a file in the public repository.
--
-- A donor is a name as it may be shown, whether it is shown (never without
-- their consent; the default is not), and, when they are a member, their
-- account, linked by hand. No email or payment detail is kept: the payment
-- service has those. note is the owner's own, never public.
CREATE TABLE IF NOT EXISTS donors (
	id         INTEGER PRIMARY KEY,
	name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
	shown      INTEGER NOT NULL DEFAULT 0 CHECK (shown IN (0, 1)),
	user_id    INTEGER REFERENCES users (id),
	note       TEXT CHECK (note IS NULL OR length(note) <= 500),
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS donors_user ON donors (user_id) WHERE user_id IS NOT NULL;

-- One gift: the day it arrived and what reached MyOrdbok after the payment
-- service's fees, in US cents. The public page shows totals only, never an
-- amount beside a name.
CREATE TABLE IF NOT EXISTS donations (
	id         INTEGER PRIMARY KEY,
	donor_id   INTEGER NOT NULL REFERENCES donors (id),
	day        TEXT NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	cents      INTEGER NOT NULL CHECK (cents > 0),
	method     TEXT NOT NULL CHECK (method IN ('paypal', 'github', 'stripe', 'bank', 'cash', 'other')),
	recurring  INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0, 1)),
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS donations_donor ON donations (donor_id);
CREATE INDEX IF NOT EXISTS donations_day ON donations (day);
