# Map of similar

```sql
CREATE TABLE `map_similar` (
 `wrid` INT(10) NOT NULL DEFAULT '0',
 `wlid` INT(10) NOT NULL DEFAULT '0',
 INDEX `Key` (`wrid`, `wlid`) USING BTREE
)
