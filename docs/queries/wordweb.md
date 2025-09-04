# Wordweb

```sql
-- create table
CREATE TABLE `map_derive_tpl` (
  `id` INT() NULL DEFAULT NULL,
  `dete` INT() NULL DEFAULT NULL,
  `word` VARCHAR(250) NULL DEFAULT NULL,
  `wrig` INT() NULL DEFAULT NULL,
  `wrte` INT() NULL DEFAULT NULL,
  `wrid` INT() NULL DEFAULT '0',
  INDEX `Indexed` (`word`, `wrid`) USING BTREE
)
COMMENT='id: root_id\r\ndete: derived_type\r\nwrid: word_id \r\nwrig: irreg\r\nwrte: word_type';

-- update id
UPDATE
    `map_derive_tpl` AS dest
  INNER JOIN
    `list_word` AS src ON src.word = dest.word
  SET
    dest.wrid = src.id;
WHERE
    dest.word IS NOT NULL;

UPDATE `map_derive_tpl` AS dest 
SET dest.wrid = (
    SELECT src.id 
    FROM `list_word` AS src
    WHERE src.word = dest.word
);

UPDATE 
    `map_derive` AS dest,
    `list_word` AS src
  SET 
    dest.root_id = src.id 
  WHERE
    dest.word = src.word;
    dest.word REGEXP '^[0-9]+$' = 0;
