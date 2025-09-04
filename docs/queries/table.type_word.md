# Type of word

```sql
CREATE TABLE `type_word` (
 `id` INT(10) NOT NULL,
 `name` VARCHAR(50) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `shortname` VARCHAR(5) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`id`) USING BTREE
)
