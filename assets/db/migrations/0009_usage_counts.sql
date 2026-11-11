-- Usage counters, per day and name: how a feature is used, never by whom.
-- One row per counter and day (UTC); kept as long as the table is.
--   offline.devices           devices that kept definitions on that day (one
--                             check-in per device and day, no device id)
--   offline.devices.{pack}    the same, per pack (senses-en, senses-my, related-en)
--   offline.lookups           words answered from a device's own copy
--   download.{pack}.new       a pack downloaded to a device that had none
--   download.{pack}.update    a pack downloaded again, for a newer build
CREATE TABLE IF NOT EXISTS usage_counts (
	day  TEXT NOT NULL,                                   -- YYYY-MM-DD, UTC
	name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
	n    INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
	PRIMARY KEY (day, name)
);
