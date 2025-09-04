# Todo

Non-definition - using list_word

- Todo 125,199

```sql
-- not in sense and word
-- Todo 125,199
SELECT
  *
FROM `list_word` AS w
  WHERE w.derived = 0 AND NOT EXISTS
  (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word);

-- not in sense and derive
-- Todo 120,997
SELECT
  *
FROM `list_word` AS w
  WHERE NOT EXISTS (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word)
  AND NOT EXISTS (SELECT word FROM `map_derive` AS d  WHERE d.word <> w.word);
```

Non-definition - using list_derive

- Todo 20,982

```sql
SELECT
  *
FROM `map_derive` AS w
  WHERE w.dete = 0 AND NOT EXISTS
  (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word);

-- noun - 7,783
SELECT
  *
FROM `map_derive` AS w
  WHERE w.dete = 0 AND w.wrte = 0 AND NOT EXISTS
  (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word);

-- verb- 1,052 [dis,de,re,un,etc]
SELECT
  *
FROM `map_derive` AS w
  WHERE w.dete = 0 AND w.wrte = 1 AND NOT EXISTS
  (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word);

-- adjective - 3,832
SELECT
  *
FROM `map_derive` AS w
  WHERE w.dete = 0 AND w.wrte = 2 AND NOT EXISTS
  (SELECT word FROM `list_sense` AS s  WHERE s.word = w.word);
