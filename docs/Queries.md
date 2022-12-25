# table

... search

```sql

-- get thesaurus

SELECT
  *
FROM `list_word` AS w
  JOIN `map_thesaurus` c ON w.id = c.wrid
    INNER JOIN `list_word` d ON c.wlid = d.id
WHERE w.word = 'apples';

SELECT
  w.id AS root, c.wlid AS wrid, d.word AS word, d.derived AS derived
FROM `list_word` AS w
  JOIN `map_thesaurus` c ON w.id = c.wrid
    INNER JOIN `list_word` d ON c.wlid = d.id
WHERE w.word = 'loving';

-- get root words

SELECT
  *
FROM `list_word` AS w
  INNER JOIN `map_derive` c ON w.id = c.wrid
    INNER JOIN `list_word` d ON c.id = d.id
WHERE w.word = 'apples';

-- get base words

SELECT
  *
FROM `list_word` AS w
  JOIN `map_derive` c ON w.id = c.id
    INNER JOIN `list_word` d ON c.wrid = d.id
WHERE w.word = 'apple';

-- get base and root words (?)

SELECT
  w.word AS word, d.word AS base, d.derived AS derived, c.dete AS derived_type, c.wrte AS word_type, c.wirg AS irreg
FROM `list_word` AS w
  INNER JOIN `map_derive` c ON w.id = c.id OR w.id = c.wrid AND c.wrte < 10
    JOIN `list_word` d ON c.wrid = d.id OR c.id = d.id AND d.word != w.word
WHERE w.word = 'love';
```

Merge id

```sql
SELECT * FROM `map_derive` AS dest WHERE dest.word REGEXP '^[0-9]+$' = 0;
SELECT * FROM `map_derive` AS dest WHERE dest.word REGEXP '^[0-9]+$';


SELECT * FROM `map_derive` AS dest WHERE dest.word REGEXP '^[0-9]+$';


SELECT * FROM `list_sense` AS d WHERE NOT EXISTS (SELECT word FROM `list_word` w WHERE w.word LIKE d.word)

SELECT * FROM `list_sense` AS o INNER JOIN (select word from `list_word` GROUP BY word) AS i ON o.word != i.word;

select * from `list_sense` where word not in (select * from `list_word`)

SELECT o.* FROM `list_sense` AS o LEFT JOIN `list_word` AS w ON o.word = w.word WHERE w.word IS NULL;
SELECT o.* FROM `list_word` AS o LEFT JOIN `map_derive` AS w ON o.word = w.word WHERE w.word IS NULL;

SELECT * FROM `list_sense` AS o INNER JOIN `list_word` AS w ON o.word != w.word;

SELECT * FROM `list_sense` AS dest LEFT JOIN (select word from `list_word` where word = dest.word) AS i ON i.word IS NULL GROUP BY dest.word;

SELECT d.word, d.sense FROM `list_sense` FROM `list_sense` AS d
  INNER JOIN `list_word` AS w ON w.word = d.word;

SELECT d.* FROM `list_dump` AS d
  INNER JOIN `list_word` AS w ON w.word = d.word;

DELETE d.* FROM `list_dump` AS d
  INNER JOIN `list_sense` AS w ON w.word = d.word;


SELECT d.* FROM `list_dump` AS d
  INNER JOIN `list_sense` AS w ON w.word = d.word;

SELECT  d.*
FROM    `list_dump` AS d
WHERE   d.word NOT IN
        (
        SELECT  word
        FROM    list_sense r
        )

SELECT  d.*
FROM    `list_dump` AS d
LEFT JOIN
        `list_sense` AS w
ON      w.word = d.word
WHERE   w.word IS NULL

SELECT  d.*
FROM    t_left l
LEFT JOIN
        t_right r
ON      r.value = l.value
WHERE   r.value IS NULL

SELECT  l.*
FROM    t_left l
WHERE   l.value NOT IN
        (
        SELECT  value
        FROM    t_right r
        )


SELECT d.* FROM `list_dump` AS d
  INNER JOIN `list_word` AS w ON w.word = d.word
    INNER JOIN `map_derive` AS m ON m.wrid = w.id AND dete = 0;


SELECT * FROM `list_dump` AS d
  INNER JOIN `list_word` AS w ON w.word = d.word
    INNER JOIN `list_sense` AS s ON s.word != d.word

SELECT * FROM `list_dump` AS d, `list_word` AS w,  `list_sense` AS s
  WHERE w.word = d.word AND d.word != s.word;

SELECT *
  FROM `list_sense` AS d
  INNER JOIN `list_word` w ON w.id != d.root_id
    WHERE d.word = 'biggest' AND d.word_type < 10;

SELECT dest.* FROM `list_sense` AS dest WHERE dest.word IN (SELECT w.word FROM `list_word` w);

UPDATE
    `list_dump` AS d
SET
    d.lst_word = 1,
FROM
    `list_word` AS dest
    INNER JOIN `list_word` AS `src`
        ON dest.id = src.id
WHERE
    dest.col3 = 'cool';


SELECT *
  FROM `list_sense` AS d
  INNER JOIN `list_word` w ON w.id != d.root_id
    WHERE d.word = 'biggest' AND d.word_type < 10;

SELECT d.*
FROM `map_derived` d
  INNER JOIN (
    SELECT w.*
    FROM `list_word` AS w
    LIMIT 1
  )
  ON d.word_id = w.id
WHERE w.word = 'love';


SELECT *
  FROM `list_word` AS w
  JOIN `map_derived` d ON d.word_id = w.id
    WHERE w.word = 'biggest';

UPDATE ?? AS o INNER JOIN (select id, word from ?? GROUP BY word) AS i ON o.word = i.word

SELECT dest.root_id, dest.derived_type, dest.irreg, dest.word_type, src.id
FROM `map_derive` AS dest
  INNER JOIN (
    SELECT src.*
    FROM `list_word` AS src
  ) AS src
  ON src.word = dest.word
WHERE u.package = 1

-- root_id derived_type irreg word_type
SELECT u.*
FROM users AS u
  INNER JOIN (
    SELECT p.*
    FROM payments AS p
    ORDER BY date DESC
    LIMIT 1
  )
  ON p.user_id = u.id
WHERE u.package = 1

UPDATE `map_derive` AS dest
  JOIN `list_word` AS src USING(id)
  SET dest.wrid = src.id;
    WHERE dest.word = 'cool';


UPDATE `map_derive` AS dest
  SET dest.word = (SELECT id, word FROM `list_word` WHERE word = dest.word )

UPDATE `map_derive` AS dest
  SET dest.wrid = src.id
  FROM (SELECT id, word FROM `list_word`) AS src
    WHERE src.word = dest.word;

UPDATE
  dest
SET
  dest.word = src.id
FROM
  `map_derive` AS dest
  INNER JOIN `list_word` AS src
    ON dest.word = src.word
WHERE
  dest.word = 'cool';

UPDATE
    dest
SET
    dest.col1 = src.col1,
    dest.col2 = src.col2
FROM
    `map_derive` AS dest
    INNER JOIN `list_word` AS `src`
        ON dest.id = src.id
WHERE
    dest.col3 = 'cool';

UPDATE
    `map_derive` AS `dest`,
    (
        SELECT
            *
        FROM
            `list_word`
        WHERE
            `id` = x
    ) AS `src`
SET
    `dest`.`col1` = `src`.`col1`;

UPDATE `map_derive` SET word =
  (SELECT if(start_DTS > end_DTS, 'VALID', '') AS word
    FROM `map_derive` AS d
    INNER JOIN `list_word` ON name_A = name_B
    WHERE id_A = tableA.id_A)

UPDATE tableA SET validation_check =
  (SELECT if(start_DTS > end_DTS, 'VALID', '') AS validation_check
    FROM tableA
    INNER JOIN tableB ON name_A = name_B
    WHERE id_A = tableA.id_A)
```

Delete null

```sql
DELETE FROM
  `list_sense`
WHERE
  `word` is NULL AND `sense` is NULL;
```

(with V forming N) (ပြုလုပ်သူ၊ အရာဟု ဟောသော နောက်ဆက်)။

```sql
SELECT *
  FROM `map_derive` AS d
  INNER JOIN `list_word` AS w ON w.id = d.root_id
    WHERE d.word = 'biggest' AND d.word_type < 10;

SELECT *
  FROM `list_word` AS w
  JOIN `map_derive` AS d ON d.root_id = w.id
    WHERE w.word LIKE 'love';

SELECT *
  FROM `list_word` AS w
  INNER JOIN `map_derive` AS d ON d.root_id = w.id
    WHERE w.word LIKE 'love';

SELECT s.name as Student, c.name as Course
FROM student s
    INNER JOIN bridge b ON s.id = b.sid
    INNER JOIN course c ON b.cid  = c.id
ORDER BY s.name
```

17701

## Lookup

```sql
select word,name,sense_no,definition,example
  from word_senses as w
  left join examples using (word_sense),definitions,word_types
    where equiv_word='UNGRATIFIED' and definitions.ID=w.ID and word_types.word_type=w.word_type order by binary word,w.word_type,sense_no;

```

## tmp

table

derives -> derived (word_id -> id, word, derived -> derived)
derivetype -> derived_type
unique_words -> words
word_types -> word_type

```sql
DELETE FROM `list_word` WHERE word REGEXP '^[0-9]+$';
SELECT * FROM `list_word` WHERE word REGEXP '[^0-9].+';
SELECT * FROM `list_word` WHERE word REGEXP '^[0-9]+$';

SELECT *
  FROM derives AS d, derivetype AS t
    WHERE d.word LIKE '%ed' AND d.derived_type=t.derived_type;

SELECT *
  FROM derives AS d
  INNER JOIN `list_word` w ON w.id = d.root_id
    WHERE d.word LIKE '%tion';

select
    *
from
    `list_word` w
    left join `map_derive` l1
        on w.id = l1.wrid
    left join `map_derive` l2
        on l1.root_id = l2.root_id
where
    w.word = 'active';
```

## Derived forms

```sql
select derivation,word
  from derives,word_derive_type
    where root = 'love' and derived.derived_type=derived_types.derived_type;

-- get Derived
SELECT *
  FROM derives AS d, derivetype AS t
    WHERE d.derive = 'loves' and d.derive_type=t.derived_type;

-- get Base word
SELECT *
  FROM derives AS d
  INNER JOIN `list_word` w ON w.id = d.word_id
    WHERE d.derive = 'loves' AND d.word_type < 10;
-- contrastiveness
-- loves

SELECT *
  FROM derives AS d, `list_word` AS w
    WHERE d.derive = 'loves' and w.id=d.word_id;

SELECT *
  FROM derives AS d
  INNER JOIN `list_word` w ON w.id = d.word_id
    WHERE d.derive = 'loves';

SELECT w.id,w.word
  FROM derives AS d
  INNER JOIN `list_word` w ON w.id = d.word_id
    WHERE d.derive = 'loves' AND d.derive_type > 0 GROUP BY w.id;

-- get pos
SELECT *
  FROM `list_word` AS w, derives AS d
    WHERE w.word = 'define' AND d.word_id = w.id;
SELECT *
  FROM `list_word` AS w
  JOIN derives AS d ON d.word_id = w.id
    WHERE w.word LIKE 'define';
-- ??
SELECT *
  FROM derives AS d
    WHERE d.word = 'loved' AND d.derived_type > 0

SELECT *
  FROM derives AS d, `list_word` AS w
  JOIN `list_word` w ON w.id=d.word_id
    WHERE d.word = 'love'
```

## Synonyms

```sql
select distinct w2.word,w2.word_type
  from word_senses as w1,word_senses as w2
    where w1.equiv_word='LUCID' and w1.ID=w2.ID and w1.word_sense<>w2.word_sense order by w2.word_type,w2.word;
```

## antonym

```sql
SELECT *
  FROM wordantonym AS a, `list_word` AS w
    WHERE a.word_sense1 = w.word
```

## ?

```sql


SELECT * FROM `list_word` WHERE id ='151505';
SELECT * FROM `list_word` WHERE word ='loving';
SELECT * FROM `list_sense` WHERE word ='abandon';
SELECT * FROM `list_word` WHERE word ='ungratified';
SELECT * FROM wordantonym WHERE word_sense2 ='151505';
SELECT * FROM derives WHERE word ='loves';


SELECT * FROM `list_word` AS w
  JOIN `list_sense` s ON s.word <> w.word
  WHERE w.derived = 0;

-- No definition list
SELECT w.* FROM `list_word` AS w
  LEFT JOIN `list_sense` s ON s.word = w.word
  WHERE w.derived = 0 AND concat('',w.word * 1) != w.word AND s.word IS NULL;

SELECT w.* FROM `list_word` AS w
  LEFT JOIN `list_sense` s ON s.word = w.word
  WHERE w.derived = 0 AND w.word NOT REGEXP '^[0-9|.]+' AND s.word IS NULL;

SELECT w.* FROM `list_word` AS w
  LEFT JOIN `list_sense` s ON s.word = w.word
  WHERE w.derived = 0 AND w.word NOT REGEXP '[0-9|.|-| ]+' AND s.word IS NULL;

-- to be removed
SELECT w.* FROM `list_word` AS w
  LEFT JOIN `list_sense` s ON s.word = w.word
  WHERE w.derived = 0 AND w.word NOT REGEXP '[0-9|.|-| ]+' AND s.word IS NULL;
