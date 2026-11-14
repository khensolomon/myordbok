-- Live edits: an approved edit an admin or owner has made live is shown to
-- readers at once, laid over the dictionary build when an entry is read
-- (worker/lib/layer.js), until a build that contains it is the one read.
-- The dataset stays the source: the edit still reaches it through the next
-- data release, unchanged.
--
--   live_at, live_by   when and by whom it was made live; NULL: it waits for
--                      the release like every edit before this migration
--   merged_in          meta.built of the build that merged it (set with
--                      status 'merged'); a site still reading an older build
--                      keeps showing the edit from the layer

ALTER TABLE dict_edits ADD COLUMN live_at INTEGER;
ALTER TABLE dict_edits ADD COLUMN live_by INTEGER REFERENCES users (id);
ALTER TABLE dict_edits ADD COLUMN merged_in TEXT;

-- The layer is read whole, often: one index for the edits no build holds
-- yet, one for those a newer build than the one read has merged.
CREATE INDEX IF NOT EXISTS dict_edits_live ON dict_edits (id) WHERE live_at IS NOT NULL AND status IN ('approved', 'exported');
CREATE INDEX IF NOT EXISTS dict_edits_live_merged ON dict_edits (merged_in) WHERE live_at IS NOT NULL AND status = 'merged';
