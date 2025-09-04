# MED

```sql
-- med_word
CREATE TABLE `med_word` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `word` VARCHAR(255) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 `ipa` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `mlc` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `cate_count` INT(10) NULL DEFAULT '0',
 PRIMARY KEY (`id`) USING BTREE,
 UNIQUE INDEX `Unique` (`word`) USING BTREE,
 INDEX `Word` (`word`) USING BTREE
)

-- med_sense
CREATE TABLE `med_sense` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `wrid` INT(10) NOT NULL COMMENT 'word id',
 `wrte` INT(10) NOT NULL DEFAULT '0' COMMENT 'word type of POS',
 `rfid` INT(10) NOT NULL DEFAULT '0' COMMENT 'word reference id',
 `cate` INT(10) NULL DEFAULT '0' COMMENT 'category',
 `trid` INT(10) NULL DEFAULT '0' COMMENT '0:unknown, 1:word, 2:phrase, 3:sentence',
 `sense` TEXT NULL DEFAULT NULL COMMENT 'Definition' COLLATE 'utf8mb3_general_ci',
 `exam` TEXT NULL DEFAULT NULL COMMENT 'Example' COLLATE 'utf8mb3_general_ci',
 `wrkd` INT(10) NULL DEFAULT '40' COMMENT 'Source id',
 `usg` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `ref` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `note` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `dated` TIMESTAMP NOT NULL,
 PRIMARY KEY (`id`) USING BTREE,
 INDEX `foks_med_sense_type_terms` (`trid`) USING BTREE,
 INDEX `foks_med_sense_type_word` (`wrte`) USING BTREE,
 INDEX `foks_med_sense_med_word` (`wrid`) USING BTREE,
 FULLTEXT INDEX `Sense` (`sense`),
 CONSTRAINT `foks_med_sense_med_word` FOREIGN KEY (`wrid`) REFERENCES `med_word` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
 CONSTRAINT `foks_med_sense_type_terms` FOREIGN KEY (`trid`) REFERENCES `type_terms` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT,
 CONSTRAINT `foks_med_sense_type_word` FOREIGN KEY (`wrte`) REFERENCES `type_word` (`id`) ON UPDATE RESTRICT ON DELETE RESTRICT
)

-- med_reference
CREATE TABLE `med_reference` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `wrid` INT(10) NOT NULL DEFAULT '0',
 `etymology` TINYTEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `reference` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `variant` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`id`) USING BTREE,
 INDEX `Word Id` (`wrid`) USING BTREE
)

-- med_thesaurus
CREATE TABLE `med_thesaurus` (
 `wrid` INT(10) NOT NULL,
 `wlid` INT(10) NOT NULL,
 `cate` INT(10) NULL DEFAULT '0' COMMENT 'category',
 INDEX `word id` (`wrid`) USING BTREE,
 INDEX `reference id` (`wlid`) USING BTREE
)
-- word
-- sense
-- thesaurus
-- word
-- definition

-- SELECT w.word
--   FROM med_thesaurus AS t
--   JOIN `med_word` AS w ON w.id=t.wlid
--     WHERE t.wrid = 1
SELECT w.word
  FROM med_thesaurus AS t
  JOIN med_word AS w ON w.id=t.wlid
    WHERE t.wrid = 1 AND t.cate = 0

SELECT w.word, s.wrte
  FROM med_thesaurus AS t
  JOIN med_word AS w ON w.id=t.wlid
  JOIN med_sense AS s ON s.wrid=t.wlid
    WHERE t.wrid = 1 AND t.cate = 0

SELECT b.word, t.cate
  FROM med_word AS w
  JOIN med_thesaurus AS t ON w.id=t.wrid
  JOIN med_word AS b ON b.id=t.wlid
    WHERE w.word = "က"

-- SELECT *
--   FROM med_word AS w
--   JOIN `med_sense` AS s ON s.wrid=w.id
--     WHERE w.word = "ကား"
-- SELECT *
--   FROM med_sense AS s
--   JOIN `med_mean` AS m ON m.wrid=s.id
--     WHERE s.word = "ကား"

SELECT *
  FROM med_word AS w
  JOIN med_sense AS s ON s.wrid=w.id
    WHERE w.word = "ကား"

SELECT *
  FROM med_word AS w
  JOIN med_sense AS s ON s.wrid=w.id
  LEFT JOIN med_reference AS r ON r.id=s.rfid AND r.wrid=s.wrid
    WHERE w.word = "က"

-- SELECT *
--   FROM med_sense AS s
--   JOIN `med_word` AS w ON s.wrid=w.id
--     WHERE w.sense = "destructively"
-- SELECT *
--   FROM med_mean AS m
--   JOIN `med_sense` AS s ON m.wrid=s.id
--     WHERE m.mean = "destructively"
SELECT *
  FROM med_sense AS s
  JOIN `med_word` AS w ON w.id=s.wrid
    WHERE s.sense LIKE "destructively"

SELECT *
  FROM med_words AS w
  JOIN `med_catalog` AS c ON c.wrid=w.id
  JOIN `med_sense` AS s ON s.wrid=c.id
    WHERE w.word = "ကား"
