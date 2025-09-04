# countries

```sql
CREATE TABLE `countries` (
 `id` INT(10) NOT NULL AUTO_INCREMENT,
 `country_code` VARCHAR(2) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 `country_name` VARCHAR(100) NOT NULL DEFAULT '' COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`id`) USING BTREE
)
