# SQLite

... before importing

```sql
DELETE FROM list;
DELETE FROM map;

-- CREATE TABLE IF NOT EXISTS 'list

-- sense.db
CREATE TABLE 'list' ('id' INTEGER, 'word' TEXT, 'wrte' INTEGER, 'sense' TEXT, 'exam' TEXT, 'wseq' INTEGER)

-- thesaurus.db
CREATE TABLE 'map' (
  'wrid' INTEGER,
  'wlid' INTEGER
)

-- word.db
CREATE TABLE 'list' ('id' INTEGER, 'word' TEXT, 'derived' INTEGER)
-- No id is required: 'id' INTEGER, on mobile
CREATE TABLE 'map' ('dete' INTEGER, 'wrid' INTEGER, 'wrig' INTEGER, 'wrte' INTEGER)
