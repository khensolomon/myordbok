# Map of derive

```sql
CREATE TABLE `map_derive` (
 `id` INT(10) NULL DEFAULT NULL,
 `dete` INT(10) NULL DEFAULT NULL,
 `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `wrig` INT(10) NULL DEFAULT NULL,
 `wrte` INT(10) NULL DEFAULT NULL,
 `wrid` INT(10) NULL DEFAULT '0',
 INDEX `Key` (`id`) USING BTREE,
 INDEX `Text` (`word`) USING BTREE
)
COMMENT='id: root_id\r\ndete: derived_type\r\nwrid: word_id \r\nwrig: irreg\r\nwrte: word_type';
