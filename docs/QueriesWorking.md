# ?

```sql


UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_sense` GROUP BY word HAVING COUNT(*) = 1) AS b ON a.word = b.word
  SET a.dated = '2021-04-30 10:00:00'
  WHERE a.word NOT LIKE '% %' AND a.exam IS NOT NULL AND a.wrid > 0

UPDATE `list_sense`
  LEFT JOIN
    (SELECT id FROM `list_sense` WHERE DATE(dated) = '2021-04-29' AND word NOT LIKE '% %' AND exam IS NOT NULL AND wrid > 0
    GROUP BY word
    HAVING COUNT(*) = 1) AS b ON a.id = b.id
SET dated = CURRENT_TIMESTAMP

UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_word` GROUP BY word) AS b ON a.word = b.word
  SET a.dated = '2021-04-30 14:55:12'
  WHERE DATE(dated) = '2021-05-02' AND a.wrte = 0;

SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-29' AND word NOT LIKE '% %' AND exam IS NOT NULL AND wrid > 0
  GROUP BY word
  HAVING COUNT(*) = 1;

SELECT
    CONCAT("[",
         GROUP_CONCAT(
              CONCAT('{"id":"',id,'",'),
              CONCAT('"word":"',word,'"}\r\n')
         )
    ,"]")
AS o FROM `list_sense` LIMIT 20
INTO OUTFILE '/tmp/myordbok/list-sense.json'

SELECT JSON_ARRAYAGG(
  JSON_OBJECT('id', id, 'word', word, 'wrte', wrte, 'sense', sense, 'exam', exam, 'wseq', wseq)
  )
FROM `list_sense` LIMIT 20
INTO OUTFILE '/tmp/myordbok/list-sense.json'

SELECT JSON_OBJECT
  ('id', id,
    'word', word)
FROM `list_sense` LIMIT 20
INTO OUTFILE '/tmp/myordbok/list-sense.json'

-- update sequence
UPDATE `list_sense` tar
  JOIN(
    SELECT id
      FROM `list_sense`
      GROUP BY word
    HAVING COUNT(*) = 1
  ) src ON tar.id = src.id
SET tar.wseq = 0
WHERE tar.wseq != 0;

UPDATE `list_sense` tar
  JOIN(
    SELECT id
      FROM `list_sense`
      GROUP BY word
    HAVING COUNT(*) = 2
  ) src ON tar.id = src.id
SET tar.wseq = 0
WHERE tar.wseq != 0;


CREATE VIEW `word_root` AS
SELECT
  w.id AS roid, c.wrid, c.wrte, c.dete, c.wirg, d.word, d.derived
FROM `list_word` AS w
  INNER JOIN `map_derive` c ON w.id = c.wrid
    INNER JOIN `list_word` d ON c.id = d.id
WHERE w.word = 'loves';

CREATE VIEW `word_base` AS
SELECT
  w.id AS roid, c.wrid, c.wrte, c.dete, c.wirg, d.word, d.derived
FROM `list_word` AS w
  JOIN `map_derive` c ON w.id = c.id
    INNER JOIN `list_word` d ON c.wrid = d.id
WHERE w.word = 'apple';


CREATE VIEW `thesaurus` AS
SELECT
  w.id AS roid, w.word AS word, d.word AS term
FROM `list_word` AS w
  JOIN `map_thesaurus` c ON w.id = c.wrid
    INNER JOIN `list_word` d ON c.wlid = d.id
WHERE w.word = 'loving';

CREATE VIEW `todo` AS
SELECT
  w.*
FROM `list_word` AS w
WHERE w.word NOT IN (
  SELECT word FROM `list_sense` GROUP BY word
) AND w.derived = 0;

SELECT
  w.*
FROM `list_word` AS w
WHERE NOT EXISTS (
  SELECT word FROM `list_sense` WHERE word NOT LIKE w.word GROUP BY word
) LIMIT 1;

SELECT * FROM `list_sense` WHERE wrid = 0 AND word is not '% %' ORDER BY word;
SELECT * FROM `list_word` WHERE word LIKE '';


UPDATE `previous_synonym` AS o INNER JOIN (select id, word from `list_word` GROUP BY word) AS i ON o.word1 = i.word SET o.wrid = i.id;
UPDATE `previous_synonym` AS o INNER JOIN (select id, word from `list_word` GROUP BY word) AS i ON o.word2 = i.word SET o.wlid = i.id;

UPDATE `list_synonym` AS dest
SET dest.wrid =
INNER JOIN (select id, word from `list_word` GROUP BY word) AS i ON o.wrid = i.id

UPDATE `list_synonym` AS dest
    SET dest.wrid = (select id from `list_word` AS src where src.word1 = dest.id);

INSERT IGNORE INTO `list_word` (word)
SELECT src.word1
FROM `list_synonym` AS src
WHERE condition;

INSERT INTO word (word)
SELECT * FROM (SELECT 'name1', 'add', '022') AS tmp
WHERE NOT EXISTS (
    SELECT name FROM word WHERE name = 'name1'
) LIMIT 1;

UPDATE `list_sense` AS a set a.sense = TRIM(REPLACE(a.sense, '  ', ' ')) WHERE a.sense LIKE ' %';
UPDATE `list_sense` AS a set a.sense = REPLACE(a.sense, '  ', ' ') WHERE a.sense LIKE '%  %';
UPDATE `list_sense` AS a set a.exam = REPLACE(a.exam, '  ', ' ') WHERE a.exam LIKE '%  %';
UPDATE `list_sense` AS a set a.exam = NULL WHERE a.exam LIKE '';

SELECT * FROM list_sense WHERE sense LIKE '% ​%';
UPDATE `list_sense` AS a set a.sense = REPLACE(a.sense, ' ​', ' ') WHERE a.sense LIKE '% ​%';
UPDATE `list_sense` AS a set a.exam = REPLACE(a.exam, ' ​', ' ') WHERE a.exam LIKE '% ​%';

SELECT * FROM list_sense WHERE exam LIKE '%​%';
UPDATE `list_sense` AS a set a.sense = REPLACE(a.sense, '​', '') WHERE a.sense LIKE '%​%';

SELECT * FROM list_sense WHERE exam LIKE '%(2)%';
UPDATE `list_sense` AS a set a.exam = TRIM(REPLACE(a.exam, '(2)', ' ')) WHERE a.exam LIKE '%(2)%';
UPDATE `list_sense` AS a set a.exam = TRIM(REPLACE(a.exam, ' .', '')) WHERE a.exam LIKE '% .%';

SELECT * FROM list_sense WHERE exam LIKE '% ​%';

UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_word` GROUP BY word) AS b ON a.word = b.word
  SET a.wrid = b.id;




UPDATE `senses` SET `sense` = REPLACE(`sense`, '“', '"') WHERE `sense` LIKE '“';
UPDATE `senses` SET `sense` = REPLACE(REPLACE(`sense`, '”', '"'), '“', '"') WHERE `sense` LIKE '%“%';
UPDATE `senses` SET `exam` = REPLACE(REPLACE(`exam`, '”', '"'), '“', '"') WHERE `exam` LIKE '%“%';

SELECT * FROM `senses` WHERE `sense` NOT LIKE '% %' AND `sense` NOT LIKE '%[%' AND `sense` LIKE '%a%';
SELECT * FROM `senses` WHERE LENGTH(REPLACE(`sense`, ')', '')) <> LENGTH(REPLACE(`sense`, '(', ''))
```

```sql
SELECT * FROM `db_en` WHERE `exam` LIKE '%[%' ORDER BY `word_id`, `state`, `seq` ASC
#SELECT * FROM `db_en` WHERE `exam` LIKE '%[%' AND (`exam` NOT LIKE '%[pos:%' AND `exam` NOT LIKE '%[with:%' AND `exam` NOT LIKE '%[list:%' AND `exam` NOT LIKE '%[also:%' AND `exam` NOT LIKE '%[abbr:%') ORDER BY `word_id`, `state`, `seq` ASC
#SELECT * FROM `db_en` WHERE `exam` LIKE '%[sentence]%' ORDER BY `word_id`, `state`, `seq` ASC
#SELECT * FROM `db_en` WHERE BINARY `exam` LIKE '%[%' ORDER BY `word_id`, `state`, `seq` ASC
#SELECT * FROM `db_en` WHERE `exam` LIKE '%[with %' ORDER BY `word_id`, `state`, `seq` ASC
#SELECT * FROM `db_en` WHERE `exam` LIKE '%adj%' ORDER BY `word_id`, `state`, `seq` ASC

#UPDATE `db_en` SET `exam` = REPLACE(`exam`, "[with]", "[with:]") WHERE `exam` IS NOT NULL;
#SELECT * FROM `db_en` WHERE `exam` LIKE '%[pos:A]%' ORDER BY `word_id`, `state`, `seq` ASC

#UPDATE `db_en` SET `exam` = REPLACE(`exam`, "/", "/") WHERE `exam` IS NOT NULL;
#UPDATE `db_en` SET `exam` = REPLACE(LTRIM(RTRIM(`exam`)), '  ', ' ') WHERE `exam` IS NOT NULL;
```

```sql
UPDATE `senses_copy` SET `sense` = REPLACE(`sense`, "[with]", "[with:]") WHERE `sense` IS NOT NULL;

UPDATE `senses_copy` SET `sense` = REPLACE(`sense`, "</b>,", "</b>/") WHERE `sense` LIKE '%</b>,%';
UPDATE `senses_copy` SET `sense` = REPLACE(`sense`, "</b>,", "</b>/") WHERE `sense` LIKE '%</b> ,%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "( <b>", "(<b>") WHERE `sense` LIKE '%( <b>%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "</b> )", "</b>)") WHERE `sense` LIKE '%</b> )%';

UPDATE `senses` SET `sense` = REPLACE(`sense`, "<b> ", "<b>") WHERE `sense` LIKE '%<b> %';
UPDATE `senses` SET `sense` = REPLACE(`sense`, " </b>", "</b>") WHERE `sense` LIKE '% </b>%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "</b>/ <b>", "</b>/<b>") WHERE `sense` LIKE '%</b>/ <b>%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "<b>- ", "<b>-") WHERE `sense` LIKE '%<b>- %';

UPDATE `senses` SET `sense` = REPLACE(`sense`, "</b> or <b>", "</b>/<b>") WHERE `sense` LIKE '%</b> or <b>%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "( ", "(") WHERE `sense` LIKE '%( %';
-- remove double spaces
UPDATE `senses` SET `sense` = REPLACE(`sense`, '  ', ' ') WHERE `sense` LIKE '%  %';

UPDATE `senses` SET `sense` = REPLACE(`sense`, "(fml)", "[fml]") WHERE `sense` LIKE '%(fml)%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "(infml)", "[infml]") WHERE `sense` LIKE '%(infml)%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "(Formal)", "[fml]") WHERE `sense` LIKE '%(Formal)%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "(Informal)", "[infml]") WHERE `sense` LIKE '%(Informal)%';

UPDATE `senses` SET `sense` = REPLACE(`sense`, "U.S.", "US") WHERE `sense` LIKE '%. <%';


SELECT * FROM `senses` WHERE `sense` LIKE '%\u200%';
SELECT * FROM `senses` WHERE `sense` LIKE '%.,%';

UPDATE `senses` SET `sense` = REPLACE(
  `sense`, "); (~", ";"
)
UPDATE `senses` SET `sense` = REPLACE(
  `sense`, "); ~", "; "
) WHERE `sense` LIKE '%); ~%';

REPLACE(`sense`, "</i> <b>", ":")
REPLACE(`sense`, "</b>)", "]")
REPLACE(`sense`, "(<i>", "[")

(~ to sth) (with sb) နှင့်လာသည်။ လိုက်သည်။
UPDATE `senses_test` SET `sense` = REPLACE(
  REPLACE(
    REPLACE(`sense`,"</b>", "]"),
    "<b>", ""
  ),
  "See ", "[see:"
) WHERE `sense` LIKE 'See %' AND `sense` LIKE '%</b>';

UPDATE `senses_test` SET `sense` = REPLACE(
  REPLACE(
    REPLACE(`sense`,"); ~", "; "),
    "; ~", ";"
  ),
  ";~ ", "; "
) WHERE `sense` LIKE '%; ~%';

REPLACE(
  `sense`,
  "<b>", ""
)
REPLACE(
  `sense`,
  "</b>", "]"
)
(~ on 1) |iˈlabəˌrāt|
|iˈlabəˌrāt| (~ on 2)
(~ on 3) |iˈlabəˌrāt| (~ on 4)
regexp_replace('Randy Orton','(.*) (.*)','\2, \1')
regexp_replace('Randy Orton','/(.*)/','-done-')


UPDATE `senses` SET `word` = NULL WHERE `sense` LIKE 'past%';
SELECT * FROM `senses` WHERE `word` IS NULL;
UPDATE `senses` SET `tid` = 0, `sense` = NULL, `exam` = NULL, `seq` = 0, `kid` = 0, `wid` = 0 WHERE `word` IS NULL;

-- SELECT * from senses WHERE sense LIKE '%<b>%';
-- SELECT * FROM `senses` WHERE `sense` LIKE '%<i>%' AND `sense` LIKE '%<b>%';
-- SELECT * FROM `senses` WHERE `sense` LIKE '%<b>%' AND tid = 8;
-- SELECT * FROM `senses` WHERE tid = 8;
-- SELECT * FROM `senses` WHERE `word` IS NULL;
-- SELECT * FROM `senses` WHERE `sense` LIKE '%past & past part%';

UPDATE `ord_ar` SET `sense` = REPLACE(`sense`, ",", ";") WHERE `sense` LIKE '%,%';

UPDATE `senses_test` SET `sense` = REGEXP_REPLACE(`sense`,'(.*)|.*|(.*)','\2, - \1') WHERE `sense` LIKE '%|%|%';

UPDATE `senses` SET `sense` = REPLACE(`sense`, "~ sth (", "(~ sth ") WHERE `sense` LIKE '%~ sth (%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "~ sth(", "(~ sth ") WHERE `sense` LIKE '%~ sth(%';
UPDATE `senses` SET `sense` = REPLACE(`sense`, "~ sb (", "(~ sb ") WHERE `sense` LIKE '%~ sb (%';


UPDATE `ord_ar` SET `sense` = REPLACE(`sense`, ",", ";") WHERE `sense` LIKE '%,%';

```
