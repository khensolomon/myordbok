-- Downloads of the offline definitions, per member: how many today (UTC day
-- in offline_day), held to the setting offline.daily, and in all. Word lists
-- are not counted here; they are open to everyone.
ALTER TABLE users ADD COLUMN offline_day TEXT;
ALTER TABLE users ADD COLUMN offline_today INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN offline_total INTEGER NOT NULL DEFAULT 0;
