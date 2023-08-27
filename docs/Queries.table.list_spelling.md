# List of spelling

```sql
CREATE TABLE `list_spelling` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `word` VARCHAR(225) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 `suggest` TEXT NOT NULL COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`id`) USING BTREE,
 UNIQUE INDEX `Unique` (`word`) USING BTREE,
 INDEX `Key` (`id`) USING BTREE,
 INDEX `Text` (`word`) USING BTREE
);
