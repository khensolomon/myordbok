# Map of thesaurus

```sql
CREATE TABLE `map_thesaurus` (
 `wrid` INT(10) NULL DEFAULT NULL,
 `wlid` INT(10) NULL DEFAULT NULL,
 `word1` VARCHAR(225) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `word2` VARCHAR(225) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 INDEX `Key` (`wrid`, `wlid`) USING BTREE
)
