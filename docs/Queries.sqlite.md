# SQLite

... before importing

```sql
DELETE FROM list
```

```sql
-- sense.db
CREATE TABLE "list" (
  "id" INTEGER,
  "word" TEXT,
  "wrte" INTEGER,
  "sense" TEXT,
  "exam" TEXT,
  "wseq" INTEGER
)

-- thesaurus.db
CREATE TABLE "map" (
  "wrid" INTEGER,
  "wlid" INTEGER
)

-- word.db
CREATE TABLE "list" (
  "id" INTEGER,
  "word" TEXT,
  "derived" INTEGER
)
CREATE TABLE "map" (
  "id"  INTEGER,
  "wrid"  INTEGER,
  "wrte"  INTEGER,
  "dete"  INTEGER,
  "wirg"  INTEGER
)
```
