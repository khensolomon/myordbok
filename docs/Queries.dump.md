# Dump

```sql

ALTER TABLE table_name DROP COLUMN lst_word;
ALTER TABLE table_name DROP COLUMN lst_sense;

ALTER TABLE `list_dump`
  ADD COLUMN `lst_word` INT(10) NOT NULL DEFAULT '0',
  ADD COLUMN `lst_sense` INT(10) NOT NULL DEFAULT '0';
  
ALTER TABLE `list_dump` 
  DROP COLUMN lst_word,
  DROP COLUMN lst_sense;


-- check if list_word has it
UPDATE `list_dump` AS a
  INNER JOIN (select word from `list_word`) AS b ON a.word = b.word
  SET a.lst_word = 1;

-- check if list_sense has it
UPDATE `list_dump` AS a
  INNER JOIN (select word from `list_sense`) AS b ON a.word = b.word
  SET a.lst_sense = 1;

-- see list of valid by found none on list_sense
SELECT * FROM `list_dump` WHERE lst_word = 1 AND lst_sense = 0;
