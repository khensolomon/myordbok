-- Members' verified email. The same verified address through Google or
-- GitHub is the same member, so likes, comments and suggestions stay with one
-- person whichever provider they sign in with. Stored lower case; used to
-- recognise members, never for marketing. Adding a column keeps the code
-- already deployed working.
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email) WHERE email IS NOT NULL;
