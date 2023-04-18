# Map of synonym_test

```sql
CREATE TABLE `map_synonym_test` (
 `word1` VARCHAR(250) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 `word2` VARCHAR(250) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 `wrid` INT(10) NULL DEFAULT '0',
 `wlid` INT(10) NULL DEFAULT '0'
)
