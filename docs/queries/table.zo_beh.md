# ZO of beh

```sql
CREATE TABLE `zo_beh` (
 `beh_id` INT(10) NOT NULL AUTO_INCREMENT,
 `beh_name` VARCHAR(100) NOT NULL DEFAULT '0' COLLATE 'utf8mb3_general_ci',
 `beh_description` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `beh_status` INT(10) NOT NULL DEFAULT '0',
 PRIMARY KEY (`beh_id`) USING BTREE
)
