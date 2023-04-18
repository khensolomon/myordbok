# Type of sense

```sql
CREATE TABLE `type_sense` (
 `id` INT(10) NOT NULL,
 `name` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`id`) USING BTREE
)
