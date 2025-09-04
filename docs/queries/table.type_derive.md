# Type of derive

```sql
CREATE TABLE `type_derive` (
 `derived_type` INT(10) NOT NULL AUTO_INCREMENT,
 `word_type` INT(10) NOT NULL,
 `derivation` VARCHAR(20) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 PRIMARY KEY (`derived_type`) USING BTREE
)
