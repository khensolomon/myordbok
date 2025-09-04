# CSV

## list and map, no filter

... all words

| RootId |   Word   | derived |
|--------|:--------:|-----------:|
|   id   |   word   | derived |

```sql
SELECT
  a.id, a.word, a.derived
FROM
  `list_word` AS a
INTO OUTFILE '/dev/lidea/assets/tmp/word-list-word.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- with header
(
  SELECT 'id', 'word', 'derived'
)
UNION ALL
(
  SELECT
    a.id, a.word, a.derived
  FROM
    `list_word` AS a
)
INTO OUTFILE '/dev/lidea/assets/tmp/word-list-word.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';
```

... all sense

| RootId |  Word  | WordType |  Sense  |  Exam  | Sequence |
|--------|:------:|---------:|--------:|-------:|---------:|
|   id   |  word  |   wrte   |  sense  |  exam  |   wseq   |

```sql
SELECT
  a.id, a.word, a.wrte, REPLACE(a.sense, '\r\n', '\n'), REPLACE(COALESCE(a.exam,''), '\r\n', '\n'), a.wseq
FROM `list_sense` AS a
  WHERE a.word IS NOT NULL AND a.sense IS NOT NULL
    ORDER BY a.word, a.wseq ASC
INTO OUTFILE '/dev/lidea/assets/tmp/sense-list-all.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- with header
(
  SELECT 'id', 'word', 'wrte', 'sense', 'exam', 'wseq'
)
UNION ALL
(
  SELECT
    a.id, a.word, a.wrte, REPLACE(a.sense, '\r\n', '\n'), REPLACE(COALESCE(a.exam,''), '\r\n', '\n'), a.wseq
  FROM `list_sense` AS a
    WHERE a.word IS NOT NULL AND a.sense IS NOT NULL
      ORDER BY a.word, a.wseq ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/sense-list-all.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\r\n';
```

... map derive

| RootId | DeriveType | WordId  | Irregular | WordType  |
|--------|:----------:|--------:|----------:|----------:|
|   id   |    dete    |  wrid   |   wrig    |   wrte    |

```sql
SELECT
  a.id, a.dete, a.wrid, a.wrig, a.wrte
FROM `map_derive` AS a
  ORDER BY a.wrid, a.wrte ASC
INTO OUTFILE '/dev/lidea/assets/tmp/word-map-derive.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- with header with NO ID
(
  SELECT 'id', 'dete', 'wrid', 'wrig', 'wrte'
)
UNION ALL
(
  SELECT
    a.id, a.dete, a.wrid, a.wrig, a.wrte
  FROM `map_derive` AS a
    ORDER BY a.wrid, a.wrte ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/word-map-derive.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';
```

... map thesaurus

| WordId | WordId List |
|--------|:-----------:|
|  wrid  |    wlid     |

```sql
SELECT
  a.wrid, a.wlid
FROM `map_thesaurus` AS a
INTO OUTFILE '/dev/lidea/assets/tmp/thesaurus-map-all.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- with header
(
  SELECT 'wrid', 'wlid'
)
UNION ALL
(
  SELECT
    a.wrid, a.wlid
  FROM `map_thesaurus` AS a
)
INTO OUTFILE '/dev/lidea/assets/tmp/thesaurus-map-all.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';
```

## individual

... words, sense, usage

```sql

-- words

SELECT
  a.wrid, a.word
FROM `list_sense` AS a
  WHERE a.word IS NOT NULL
    GROUP BY a.wrid ORDER BY a.word ASC
INTO OUTFILE '/dev/lidea/assets/tmp/sense-list-??.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- sense

SELECT
  a.id, a.wrid, a.wrte, a.sense
FROM `list_sense` AS a
  WHERE a.word IS NOT NULL AND a.sense IS NOT NULL
    ORDER BY a.wrte, a.wseq ASC
INTO OUTFILE '/dev/lidea/assets/tmp/sense-list-??.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- usage

SELECT
  a.id, a.exam
FROM `list_sense` AS a
  WHERE a.exam IS NOT NULL AND a.exam <> ''
    ORDER BY a.wrte, a.wseq ASC
INTO OUTFILE '/dev/lidea/assets/tmp/sense-list-usage-??.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY ','
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- json

SELECT
  a.id, a.word, a.derived
FROM `list_word` AS a
  WHERE a.word IS NOT NULL
    ORDER BY a.word, a.derived ASC
    ORDER BY a.word, a.derived DESC
INTO OUTFILE '/dev/myordbok/docs/tmp/testing-word-list.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY ','
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- error: 1582
-- incorrect parameter count in the cell to native function 'JSON_OBJECT'

-- select JSON_OBJECT(id,word, derived) from list_word; > test_data.json
-- select JSON_OBJECT(id,word, derived) from list_word; > /dev/myordbok/docs/tmp/testing-word-list.json
