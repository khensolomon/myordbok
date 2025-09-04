# CSV moby_thesaurus

## list and map, no filter

... list_words

| Id |   Word   |
|--------|:--------:|
|   id   |   word   |

```sql
SELECT
  a.id, a.word
FROM
  `list_words` AS a
INTO OUTFILE '/dev/lidea/assets/tmp/moby_list_words.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '|'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';

-- with header
(
  SELECT 'id', 'word'
)
UNION ALL
(
  SELECT
    a.id, a.word
  FROM
    `list_words` AS a
)
INTO OUTFILE '/dev/lidea/assets/tmp/moby_list_words.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
LINES TERMINATED BY '\r\n';
```

... part_of_speech

```sql
-- with header
(
  SELECT 'part_of_speech_id', 'symbol', 'part_of_speech'
)
UNION ALL
(
  SELECT
    a.part_of_speech_id, a.symbol, a.part_of_speech
  FROM `part_of_speech` AS a
    WHERE a.symbol IS NOT NULL AND a.part_of_speech IS NOT NULL
      ORDER BY a.part_of_speech_id ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/moby_part_of_speech.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\r\n';
```

... synonyms

```sql
-- with header
(
  SELECT 'synonym_id', 'word_id', 'synonym'
)
UNION ALL
(
  SELECT
    a.synonym_id, a.word_id, a.synonym
  FROM `synonyms` AS a
    WHERE a.synonym IS NOT NULL
      ORDER BY a.synonym_id ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/moby_synonyms.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\r\n';
```

... words

```sql
-- with header
(
  SELECT 'word_id', 'word'
)
UNION ALL
(
  SELECT
    a.word_id, a.word
  FROM `words` AS a
    WHERE a.word IS NOT NULL
      ORDER BY a.word_id ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/moby_words.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\r\n';
```

... word_parts_of_speech

```sql
-- with header
(
  SELECT 'word_part_of_speech_id', 'word', 'part_of_speech_id'
)
UNION ALL
(
  SELECT
    a.word_part_of_speech_id, a.word, a.part_of_speech_id
  FROM `word_parts_of_speech` AS a
    WHERE a.word IS NOT NULL
      ORDER BY a.word ASC
)
INTO OUTFILE '/dev/lidea/assets/tmp/moby_word_parts_of_speech.csv'
FIELDS ENCLOSED BY '"'
TERMINATED BY '\t'
ESCAPED BY '"'
OPTIONALLY ENCLOSED BY '"'
LINES TERMINATED BY '\r\n';
```

modified columns
pos = parts_of_speech
words: word_parts_of_speech
terms: words
synonyms: ?

... word_parts_of_speech

```sql
SELECT synonyms.* FROM words 
  LEFT JOIN synonyms ON synonyms.word_id = words.word_id 
    WHERE word = "feeling";

SELECT synonyms.* FROM words 
  LEFT JOIN synonyms ON synonyms.word_id = words.id 
    WHERE words.word = "thesaurus";
