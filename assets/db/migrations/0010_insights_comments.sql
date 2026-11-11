-- A member who is shown the site's statistics without being an editor:
-- the workspace Overview's figures, Searches, and the whole site's ratings,
-- read only. Editors and above see them anyway. Set by admins on Members.
ALTER TABLE users ADD COLUMN insights INTEGER NOT NULL DEFAULT 0 CHECK (insights IN (0, 1));

-- Comments (table from 0001) are listed newest first by status in the workspace.
CREATE INDEX IF NOT EXISTS comments_status ON comments (status, created_at);
