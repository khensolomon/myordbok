-- Test yourself progress of a signed-in member (shared/quiz.js Progress, as
-- JSON): the words practised, when each comes back, and the day streak. The
-- app keeps a copy on each device and merges it with this one whenever it
-- saves (mergeProgress), so a member's words follow them to every device.
-- Removed with the account, or by "Forget my progress".

CREATE TABLE IF NOT EXISTS quiz_progress (
	user_id    INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
	data       TEXT NOT NULL CHECK (json_valid(data) AND length(data) <= 400000),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
