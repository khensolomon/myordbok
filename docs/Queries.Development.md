# development

... Update wrid(word_id)

| derived_type | word_id  | word_type | irregular |
|--------------|---------:|----------:|----------:|
|     dete     |   wrid   |    wrte   |    wrig   |

```sql
-- reset list_sense.wrid
UPDATE `list_sense` AS a SET a.wrid = 0 WHERE wrid > 0;

-- update list_sense.wrid based on list_word.id
UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_word` GROUP BY word) AS b ON a.word = b.word
  SET a.wrid = b.id
  WHERE a.word IS NOT NULL;

-- update list_sense.wrid based on it's own id
UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_sense` GROUP BY word) AS b ON a.word = b.word
  SET a.wrid = b.id;

-- update map_derive.wrid based on list_word.id
UPDATE `map_derive` AS dest
  JOIN `list_word` AS src USING(word)
  SET dest.wrid = src.id
    WHERE dest.word = src.word;

SELECT * FROM `list_sense` WHERE wrid = 0 ORDER BY word;

-- DELETE FROM `list_sense` WHERE wrid = 0 AND wrte = 0 AND wrkd = 8

select * from list_word AS w
  JOIN list_sense AS s ON s.word != w.word
    WHERE w.derived = 0;

SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word NOT IN (SELECT word FROM list_sense);
-- none_def_word
SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word NOT REGEXP '^[0-9]+$' AND w.word NOT IN (SELECT word FROM list_sense);
-- none_def_number
SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word REGEXP '^[0-9]+$' AND w.word NOT IN (SELECT word FROM list_sense);



```

## str

```python
look list_word -> pos
look list_sense -> sense

if sense empty
 if check pos.root
  look again list_sense with new word from pos.root
    if sense empty
      not found
 else
  look spelling -> spelling
  if check spelling
    look again list_sense with new word from spelling.word
    if sense empty
      not found
