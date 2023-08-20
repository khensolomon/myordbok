# table

word, mean, exam, sequence
wo, me, ex, se

## Create

```sql
-- word
CREATE TABLE `en_word` (
  `id` INT(10) NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(250) NULL DEFAULT NULL,
  `ipa` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `key` (`word`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=DYNAMIC;

-- define
CREATE TABLE `en_sense` (
  `id` INT(30) NOT NULL AUTO_INCREMENT,
  `wid` INT(10) NULL DEFAULT NULL,
  `sense` TEXT NULL,
  `seq` INT(5) NULL DEFAULT NULL,
  `tid` INT(3) NULL DEFAULT NULL,
  `kid` INT(5) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=DYNAMIC;

-- describe
CREATE TABLE `en_exam` (
  `id` INT(30) NOT NULL AUTO_INCREMENT,
  `sid` INT(10) NULL DEFAULT NULL,
  `exam` TEXT NULL,
  `seq` INT(5) NOT NULL DEFAULT '0',
  `kid` INT(5) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=DYNAMIC;

-- suggest table
CREATE TABLE `en_suggest` (
  `id` INT(10) NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(250) NOT NULL,
  `type` INT(3) NULL DEFAULT '0',
  `mean` TEXT NOT NULL COLLATE 'utf8_unicode_ci',
  `exam` TEXT NULL COLLATE 'utf8_unicode_ci',
  `lang` VARCHAR(5) NOT NULL DEFAULT 'en',
  `kid` INT(5) NOT NULL DEFAULT '0',
  `uid` INT(30) NOT NULL DEFAULT '0',
  `dates` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=DYNAMIC;
```

## Reset ID

```sql
-- Reset id
ALTER TABLE `en_src` DROP COLUMN `id`;
ALTER TABLE `en_src`
  ADD COLUMN `id` INT(10) NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`);

-- Reset word_id
UPDATE `en_src` SET `wid` = 0;
-- Create word_id
UPDATE `en_src` o
  INNER JOIN `en_src` s ON s.`word` = o.`word`
SET o.`wid` = s.`id`

-- Clean testing
SELECT * FROM en_src WHERE source = 'love'
```

## Import

```sql
-- Import word: word from source
-- en_sense -> sense means def, clue, cue, sense
-- en_exam -> exam exams des, exam means,exams, exam
-- en_kind ->
-- en_suggest ->
-- en_type ->
-- en_word ->

DELETE FROM `en_word`;
INSERT INTO `en_word` (`id`,`word`)
  SELECT `wid`,`word` FROM `en_src` WHERE `word` !='' GROUP BY `wid` ORDER BY `wid` ASC;

-- Import define: Definition
DELETE FROM `en_sense`;
INSERT INTO `en_sense` (`id`,`sense`,`wid`,`tid`,`sid`,`kid`)
  SELECT o.`id`, o.`sense`, o.`wid`, o.`tid`, o.`seq`,  o.`kid` FROM `en_src` o WHERE o.`sense` IS NOT NULL;

-- Import describe: Usage/Example
DELETE FROM `en_exam`;
INSERT INTO `en_exam` (`id`,`exam`)
  SELECT o.`id`, o.`exam` FROM `en_src` o WHERE o.`exam` IS NOT NULL;

-- Testing by word
SELECT d.*,s.`exam` FROM `en_word` w
  INNER JOIN `en_sense` d ON d.`wid` = w.`id`
  LEFT JOIN `en_exam` s ON s.`id` = d.`id`
WHERE w.`word` LIKE 'noun' ORDER BY d.`tid`, d.`sid` ASC

-- Testing by ID
SELECT d.*,s.`exam` FROM `en_sense` d
  LEFT JOIN `en_exam` s ON s.`id` = d.`id`
WHERE d.`wid` LIKE '1' ORDER BY d.`tid`, d.`sid` ASC
```

## Prepare

```sql
-- Clean source
UPDATE `en_src` SET `word` = REPLACE(LTRIM(RTRIM(`word`)), '  ', ' ') WHERE `word` IS NOT NULL;
-- Clean def
UPDATE `en_src` SET `sense` = NULL WHERE `sense` = '';
UPDATE `en_src` SET `sense` = REPLACE(LTRIM(RTRIM(`sense`)), '  ', ' ') WHERE `sense` IS NOT NULL;
-- Clean exam
UPDATE `en_src` SET `exam` = NULL WHERE `exam` = '';
UPDATE `en_src` SET `exam` = REPLACE(`exam`, `\\`, ``) WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` = REPLACE(`exam`, "\\'", "'") WHERE `exam` IS NOT NULL;
-- UPDATE `en_src` SET `exam` = REPLACE(`exam`, ".", ".\\n") WHERE `exam` IS NOT NULL;
-- UPDATE `en_src` SET `exam` = REPLACE(`exam`, ".\\n", ".") WHERE `exam` IS NOT NULL;

-- UPDATE `en_src`
--   SET `exam` = REPLACE(
--     REPLACE(`exam`, "<b>", " [")
--   , "</b>", "] ")
-- WHERE `exam` IS NOT NULL;
--
-- UPDATE `en_src`
--   SET `exam` = REPLACE(
--     REPLACE(`exam`, "<i>", " [")
--   , "</i>", "] ")
-- WHERE `exam` IS NOT NULL;

-- UPDATE `en_src`
--   SET `exam` = REPLACE(
--     REPLACE(`exam`, "", " ")
--   , "", " ")
-- WHERE `exam` IS NOT NULL;

UPDATE `en_src` SET `exam` = REPLACE(REPLACE(`exam`, "’", "'"), "‘", "'") WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` = REPLACE(LTRIM(RTRIM(`exam`)), '  ', ' ') WHERE `exam` IS NOT NULL;

-- UPDATE en_src SET source = replace(source, '\\', '');
-- UPDATE en_src set source = TRIM(source);

-- Adding word
SELECT * FROM en_src WHERE source LIKE '' ORDER BY state, seq ASC

SELECT d.* FROM `en_sense` d
  INNER JOIN `en_word` w ON w.`word` = 'love'
  INNER JOIN `en_exam` s ON s.`id` = w.`id`
WHERE d.`id` = w.`id`


SELECT * FROM `en_src` WHERE `word` LIKE 'noun' ORDER BY `tid`, `seq` ASC


INSERT INTO `en_sense` (`wid`,`sense`,`seq`,`tid`,`kid`)
  SELECT w.`id`,o.`sense`,o.`seq`,o.`tid`,o.`kid` FROM `en_src` o
    INNER JOIN `en_word` w WHERE w.`word` = o.`word`;



INSERT INTO `en_exam` (`sid`,`exam`)
  SELECT w.`id`, o.`exam` FROM `en_src` o
    INNER JOIN `en_sense` w ON w.`sense` LIKE o.`sense`
  WHERE o.`exam` IS NOT NULL
  LIMIT 100,100;

INSERT INTO `en_exam` (`sid`,`exam`,`seq`)
  SELECT `id`,`exam`,`seq` FROM `en_sense` WHERE `exam` IS NOT NULL;

-- Testing with basic
SELECT d.* FROM en_sense d
  INNER JOIN en_word w ON w.word = 'love'
WHERE d.wid= w.id
-- Testing with describe
SELECT d.* FROM en_sense d
  INNER JOIN en_word w ON w.word = 'love'
  INNER JOIN en_exam s ON s.sid = w.id
WHERE d.wid= w.id
Orders LIMIT 30;

INSERT INTO `en_exam` (`sid`,`exam`,`seq`) SELECT `id`,`exam`,`seq` FROM `en_sense` WHERE `exam` IS NOT NULL;
```

## exam to be replace

```sql
[pos:*]
[with:*]
[list:*]
[list:-er/-est]
[list:-ier/-iest]
[list:-eries]
[abbr:*]
[also:*]
[brit:*]
[US:*]
[asin:British]
[asin:American]
[asin:Mathematics]
[asin:Grammar]
UPDATE `en_src`
  SET `exam` = REPLACE(REPLACE(`exam`, " ]", "]") , "[ ", "[")
WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` = REPLACE(`exam`, "[as adj. ]", "[pos:A]") WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` = REPLACE(LTRIM(RTRIM(`exam`)), '  ', ' ') WHERE `exam` IS NOT NULL;
SELECT * FROM `en_src` WHERE `exam` LIKE '%[%' ORDER BY `word`, `tid`, `seq` ASC
SELECT * FROM `en_src` WHERE `word` LIKE 'noun' ORDER BY `word`, `tid`, `seq` ASC


UPDATE `list_sense` SET `sense` = REPLACE(`sense`, "ယောကျာ်း", "ယောက်ျား") WHERE `sense` IS NOT NULL;


-- UPDATE `en_src` SET `exam` =
--   REPLACE(
--     REPLACE(
--       REPLACE(
--         REPLACE(`exam`, " </b>", "</b>"),
--         "<b> ", "<b>"),
--       "</b>", "</b> "),
--     "<b>", " <b>")
-- WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` =
  REPLACE(
    REPLACE(`exam`, "</b>", "-)"),
    "<b>", "(-")
WHERE `exam` IS NOT NULL;
UPDATE `en_src` SET `exam` =
  REPLACE(
    REPLACE(`exam`, "</i>", "!)"),
    "<i>", "(!")
WHERE `exam` IS NOT NULL;
```

(abbr <b>TB </b>)
-> [abbr:TB,AC]
(also <b>TB </b>)
-> [also:TB,AC]

'N'=>'Noun',
'p'=>'Plural',
'h'=>'Noun Phrase',
'V'=>'Verb (usu participle)',
't'=>'Verb (transitive)',
'i'=>'Verb (intransitive)',
'A'=>'Adjective',
'v'=>'Adverb',
'C'=>'Conjunction',
'P'=>'Preposition',
'!'=>'Interjection',
'r'=>'Pronoun',
'D'=>'Definite Article',
'I'=>'Indefinite Article',
'o'=>'Nominative'

a fortnightly clinic/ magazine. [as adj ]
-> a fortnightly clinic/ magazine. [pos:A]

He is tired of {patience} and {gentleness} and {docility}.
-> He is tired of [list:patience,gentleness,docility].

(NAFTA)
-> [abbr:NAFTA]
(Brit <b>millimetre</b>) (abbr <b>mm</b>)
-> [brit:millimetre] [abbr:mm]

(also <b>kerosine</b>) (esp US) 	= PARAFFIN: <i> a kerosene lamp.</i>
-> [also:kerosine] [US:PARAFFIN] a kerosene lamp.

{Too bad,} she replied laconically.
-> Too bad, she replied laconically.

My wife is ailing. (figurative) the ailing economy.
-> My wife is ailing.
-> (figurative) the ailing economy.

she was charged as an <b>accessory to</b> murder.
->she was charged as an (accessory to) murder.

swear/make/take/sign an affidavit.
-> [swear,make,take,sign] an affidavit.

a sexually transmitted disease (eg AIDS).
She lives locally (ie near).
My secretary will see you out (ie of the building).

## Change

```sql
-- Define table
ALTER TABLE en_sense
	CHANGE COLUMN `tid` `tid` INT(3),
	CHANGE COLUMN `sense` `sense` TEXT,
	CHANGE COLUMN `exam` `exam` TEXT,
	CHANGE COLUMN `seq` `seq` INT(5),
	CHANGE COLUMN `kid` `kid` INT(5),
	CHANGE COLUMN `word_id` `wid` INT(10) AFTER `id`,
	CHANGE COLUMN `word` `word` VARCHAR(250) AFTER `uid`,
	DROP COLUMN `pron`,
	DROP COLUMN `type_id`,
	DROP COLUMN `definition_id`,
	DROP COLUMN `mdate`;

-- Rename table
ALTER TABLE `db_ar` RENAME `ar_word`;
ALTER TABLE `db_da` RENAME `da_word`;
ALTER TABLE `db_de` RENAME `de_word`;
ALTER TABLE `db_el` RENAME `el_word`;
ALTER TABLE `en_src` RENAME `en_word`;
ALTER TABLE `db_es` RENAME `es_word`;
ALTER TABLE `db_fi` RENAME `fi_word`;
ALTER TABLE `db_fr` RENAME `fr_word`;
ALTER TABLE `db_hi` RENAME `hi_word`;
ALTER TABLE `db_iw` RENAME `iw_word`;
ALTER TABLE `db_ja` RENAME `ja_word`;
ALTER TABLE `db_ko` RENAME `ko_word`;
ALTER TABLE `db_ms` RENAME `ms_word`;
ALTER TABLE `db_nl` RENAME `nl_word`;
ALTER TABLE `db_no` RENAME `no_word`;
ALTER TABLE `db_pl` RENAME `pl_word`;
ALTER TABLE `db_pt` RENAME `pt_word`;
ALTER TABLE `db_ro` RENAME `ro_word`;
ALTER TABLE `db_ru` RENAME `ru_word`;
ALTER TABLE `db_sv` RENAME `sv_word`;
ALTER TABLE `db_th` RENAME `th_word`;
ALTER TABLE `db_tl` RENAME `tl_word`;
ALTER TABLE `db_vi` RENAME `vi_word`;
ALTER TABLE `db_zh` RENAME `zh_word`;
-- Rename wordweb
ALTER TABLE `en_antonym` RENAME `ww_antonym`;
ALTER TABLE `en_derive` RENAME `ww_derive`;
ALTER TABLE `en_derive_see` RENAME `ww_derive_see`;
ALTER TABLE `en_derive_type` RENAME `ww_derive_type`;
ALTER TABLE `en_mapping` RENAME `ww_mapping`;
ALTER TABLE `en_sense` RENAME `ww_sense`;
ALTER TABLE `en_word` RENAME `ww_word`;
ALTER TABLE `en_word_type` RENAME `ww_word_type`;

-- Other table(NOT en)
ALTER TABLE `*_word`
	CHANGE COLUMN `word` `word` VARCHAR(250),
	CHANGE COLUMN `tid` `sense` TEXT,
	CHANGE COLUMN `sense` `exam` TEXT AFTER `sense`,
	CHANGE COLUMN `kid` `kid` INT(5),
	DROP COLUMN `uid`,
	DROP COLUMN `mdate`;

```

## Import Old version

```sql
-- Import word
INSERT INTO mo_en_word (word) SELECT source FROM mo_en_sense GROUP BY source ORDER BY source ASC;
INSERT INTO mo_en_word (word) SELECT source FROM mo_en_sense GROUP BY source ORDER BY source DESC;
-- Import describe
UPDATE `mo_en_sense` SET `exam` = NULL WHERE `exam` = '';
INSERT INTO `mo_en_exam` (`sid`,`exam`,`seq`) SELECT `id`,`exam`,`seq` FROM `mo_en_sense` WHERE `exam` IS NOT NULL;

-- Import IDs
UPDATE mo_en_sense d
  INNER JOIN mo_en_word w ON d.source = w.word
SET d.wid = w.id
WHERE d.source = w.word;

-- Check duplicate
UPDATE mo_en_sense d
  INNER JOIN mo_en_word w ON d.source = w.source
SET d.wid = w.id
WHERE (d.source = w.source) AND (d.wid != w.id);

-- Search word
SELECT d.* FROM mo_en_sense d
  INNER JOIN mo_en_word w ON w.word = 'love'
WHERE d.wid= w.id;

-- Search ...
SELECT d.* FROM mo_en_sense d
  INNER JOIN mo_en_word w ON w.word = 'love'
  INNER JOIN mo_en_exam s ON s.sid = w.id
WHERE d.wid= w.id;

SELECT w.*, d.*
  FROM mo_en w
  LEFT JOIN mo_en_sense d ON d.wid = w.id
WHERE w.word = 'love';

SELECT w.*, d.*
  FROM mo_en w
  LEFT JOIN mo_en_sense d ON d.wid = w.id
  LEFT JOIN mo_en_exam s ON s.sid = d.id
WHERE w.word = 'love';

SELECT  bird_name, member_id
  FROM birds
  LEFT JOIN bird_likes ON birds.bird_id = bird_likes.bird_id
WHERE member_id = 2;
```

mo_define, mo_describe
en_sense, en_exam
en_word

## Utilities

```sql
UPDATE en_src SET source = replace(source, '\\', '');
UPDATE en_src set source = TRIM(source);
```