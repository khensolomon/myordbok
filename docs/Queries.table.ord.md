# Of ord

```sql
CREATE TABLE `ord_*` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `word` VARCHAR(250) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `sense` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `usage` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `status` INT(10) NULL DEFAULT NULL,
 PRIMARY KEY (`id`) USING BTREE,
 INDEX `index` (`word`) USING BTREE
);
