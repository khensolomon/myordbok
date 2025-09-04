# List of visits

```sql
CREATE TABLE `list_word` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `derived` INT(10) NULL DEFAULT '0',
 PRIMARY KEY (`id`) USING BTREE,
 INDEX `Key` (`id`) USING BTREE,
 INDEX `Text` (`word`) USING BTREE
)
