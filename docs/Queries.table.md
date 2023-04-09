# table

## Column definition

```bash
word Id -> wrid
word Type -> wrte
word Kind(?:sense) -> wrkd

wordId List -> wlid
word sequence -> wseq
word irregular -> wirg

derive Id -> deid
derive Type -> dete
```

## list - table

```sql

-- list_word

CREATE TABLE `list_word` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8_bin',
  `derived` INT(1) NULL DEFAULT '0',
  `fr_thesaurus` INT(1) NULL DEFAULT '0',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `Key` (`id`, `word`) USING BTREE,
  FULLTEXT INDEX `Text` (`word`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPACT
AUTO_INCREMENT=295908;

-- list_sense

CREATE TABLE `list_sense` (
  `id` INT(10) NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `wrte` INT(2) NOT NULL DEFAULT '0',
  `sense` TEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `exam` TEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `wseq` INT(2) NOT NULL DEFAULT '0',
  `wrkd` INT(2) NOT NULL DEFAULT '0',
  `wrid` INT(10) NOT NULL DEFAULT '0',
  `dated` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `indexed` (`id`, `word`) USING BTREE,
  FULLTEXT INDEX `texted` (`word`)
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
AUTO_INCREMENT=93258
-- AUTO_INCREMENT=94197
-- AUTO_INCREMENT=103582

-- Sort by word
ALTER TABLE `list_sense` ORDER BY `word` ASC;

-- Reset id
ALTER TABLE `list_sense` DROP PRIMARY KEY,
  DROP COLUMN `id`;
ALTER TABLE `list_sense`
  ADD COLUMN `id` INT(10) NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`);

-- Sort by word


-- Reset id
ALTER TABLE `list_sense` DROP COLUMN `id`;
ALTER TABLE `list_sense` ORDER BY `word` ASC;
ALTER TABLE `list_sense`
  ADD COLUMN `id` INT(10) NOT NULL AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`);


ALTER TABLE `list_sense` DROP COLUMN `id`;
ALTER TABLE `list_sense`
  ADD COLUMN `id` int(10) NOT NULL PRIMARY KEY AUTO_INCREMENT FIRST,
  ADD PRIMARY KEY (`id`);

-- check
SELECT COUNT(*) AS total FROM `list_sense`;
93334
93248

```

## map - table

```sql
-- map_derive

CREATE TABLE `map_derive` (
  `id` INT(11) NULL DEFAULT NULL,
  `wrid` INT(11) NOT NULL DEFAULT '0',
  `wrte` INT(2) NULL DEFAULT NULL,
  `dete` INT(2) NULL DEFAULT NULL,
  `wirg` INT(1) NULL DEFAULT NULL,
  INDEX `Index 2` (`wrid`) USING BTREE,
  INDEX `Key` (`id`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPACT;

-- map_thesaurus

CREATE TABLE `map_thesaurus` (
  `wrid` INT(11) NULL DEFAULT NULL,
  `wlid` INT(11) NULL DEFAULT NULL
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB;
```

## type - table

```sql

-- type_word

CREATE TABLE `type_word` (
  `word_type` INT(2) NOT NULL,
  `name` VARCHAR(50) NOT NULL DEFAULT '' COLLATE 'utf8_bin',
  `shortname` VARCHAR(5) NULL DEFAULT NULL COLLATE 'utf8_bin'
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPACT;

-- type_derive

CREATE TABLE `type_derive` (
  `derived_type` INT(2) NOT NULL AUTO_INCREMENT,
  `word_type` INT(2) NOT NULL,
  `derivation` VARCHAR(20) NULL DEFAULT NULL COLLATE 'utf8_bin',
  PRIMARY KEY (`derived_type`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPACT
AUTO_INCREMENT=11;

-- type_sense

CREATE TABLE `type_sense` (
  `id` INT(2) NOT NULL DEFAULT '0',
  `name` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8_bin'
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=DYNAMIC;
```

## ord - table

```sql

CREATE TABLE `ord_ar` (
  `id` INT(30) NOT NULL AUTO_INCREMENT,
  `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `sense` TEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `usage` TEXT NULL DEFAULT NULL COLLATE 'utf8_general_ci',
  `status` INT(5) NULL DEFAULT NULL,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `index` (`word`) USING BTREE
)
COLLATE='utf8_general_ci'
ENGINE=InnoDB
ROW_FORMAT=COMPACT
AUTO_INCREMENT=2954;
```

## view

```sql

CREATE VIEW `todo` AS
SELECT
  w.*
FROM `list_word` AS w
WHERE w.word NOT IN (
  SELECT word FROM `list_sense` GROUP BY word
) AND w.derived = 0;
```

## SQLite

```sql

-- list_sense

CREATE TABLE "list_sense" (
  "id" INTEGER,
  "word" TEXT,
  "wrte" INTEGER,
  "sense" TEXT,
  "exam" TEXT,
  "wseq" INTEGER,
  PRIMARY KEY("id" AUTOINCREMENT)
);

-- list_word

CREATE TABLE "list_word" (
  "id" INTEGER,
  "word" TEXT,
  "derived" INTEGER
);

-- map_derive

CREATE TABLE "map_derive" (
  "id" INTEGER,
  "wrid" INTEGER,
  "wrte" INTEGER,
  "dete" INTEGER,
  "wirg" INTEGER
);

-- map_thesaurus

CREATE TABLE "map_thesaurus" (
  "wrid" INTEGER,
  "wlid" INTEGER
);

CREATE TABLE "updates" (
  "id" INTEGER,
  "param" INTEGER,
  "note" TEXT,
  "task" INTEGER DEFAULT 0,
  PRIMARY KEY("id" AUTOINCREMENT)
);

INSERT INTO updates ("id","param","note","task") VALUES (1,19810708,"built-in",1);


SELECT word, MAX(dated) as dated
  FROM list_sense 
  GROUP BY word
SELECT word, MAX(dated)  as dated
  FROM list_sense 
  WHERE word LIKE 'love'
  GROUP BY word

SELECT *
FROM list_sense 
WHERE dated IN (
  SELECT MAX(dated)
  FROM list_sense 
  WHERE word LIKE 'love'
  GROUP BY word )
ORDER BY dated ASC;

SELECT * 
FROM (
    SELECT * FROM list_sense
    ORDER BY dated DESC
) AS sub
WHERE word LIKE 'love'
GROUP BY word
