# ZO of gam

```sql
CREATE TABLE `zo_gam` (
 `zogam_id` INT(10) NOT NULL AUTO_INCREMENT,
 `zogam_min` VARCHAR(100) NOT NULL DEFAULT '0' COLLATE 'utf8mb3_general_ci',
 `zogam_thu` TEXT NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `zogam_status` INT(10) NOT NULL DEFAULT '0',
 `zogam_userid` INT(10) NOT NULL DEFAULT '0',
 PRIMARY KEY (`zogam_id`) USING BTREE
)
