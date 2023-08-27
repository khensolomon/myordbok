# Log of keyword

In `log_keyword` stored each requested keywords

```sql
CREATE TABLE `log_keyword` (
 `word` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `view` BIGINT(19) NOT NULL DEFAULT '1',
 `status` INT(10) NOT NULL DEFAULT '0',
 `lang` CHAR(10) NULL DEFAULT NULL COLLATE 'utf8mb3_general_ci',
 `modified` DATETIME NULL DEFAULT 'CURRENT_TIMESTAMP' ON UPDATE (CURRENT_TIMESTAMP),
 `created` DATETIME NULL DEFAULT 'CURRENT_TIMESTAMP',
 UNIQUE INDEX `Unique` (`word`) USING BTREE,
 INDEX `Text` (`word`) USING BTREE
)

-- insert or update
INSERT INTO log_keyword (word) values
('king'),
('queen')
ON DUPLICATE KEY UPDATE view = view + 1;

INSERT INTO log_keyword SET word="king" ON DUPLICATE KEY UPDATE view = view + 1;
