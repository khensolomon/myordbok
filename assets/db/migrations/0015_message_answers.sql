-- An answer to a message, read by its sender on the site.
--
-- A member who writes through the contact form finds the message in the
-- workspace Inbox, with what an admin answered: a text (answer), or the
-- state alone (replied, done). A visitor who was not signed in has no Inbox;
-- an answer to them still goes by mail, to the address they left.
--
-- answered_at is the last time an admin answered or set the state to
-- replied or done. seen_at is when the sender opened the Inbox after that;
-- each new answer empties it again, so an answer with no seen_at is new to
-- the sender.

ALTER TABLE messages ADD COLUMN answer TEXT CHECK (answer IS NULL OR length(answer) BETWEEN 1 AND 2000);
ALTER TABLE messages ADD COLUMN answered_at INTEGER;
ALTER TABLE messages ADD COLUMN answered_by INTEGER;
ALTER TABLE messages ADD COLUMN seen_at INTEGER;

-- A member's own messages, newest first.
CREATE INDEX IF NOT EXISTS messages_sender ON messages (user_id, id) WHERE user_id IS NOT NULL;
