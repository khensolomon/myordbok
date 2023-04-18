# Map of antonym

```sql
CREATE TABLE `map_antonym` (
 `wrid` INT(10) NOT NULL DEFAULT '0',
 `wlid` INT(10) NOT NULL DEFAULT '0',
 INDEX `Key` (`wrid`, `wlid`) USING BTREE
)
