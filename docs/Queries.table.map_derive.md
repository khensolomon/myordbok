# Map of derive

```sql
CREATE TABLE `map_derive` (
 `id` INT(10) NULL DEFAULT NULL,
 `dete` INT(10) NULL DEFAULT NULL,
 `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `wrig` INT(10) NULL DEFAULT NULL,
 `wrte` INT(10) NULL DEFAULT NULL,
 `wrid` INT(10) NULL DEFAULT '0',
 INDEX `Indexed` (`word`) USING BTREE
)
