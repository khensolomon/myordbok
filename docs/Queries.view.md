# View

```sql
-- view_sense_date
select `list_sense`.`word` AS `word`,max(`list_sense`.`dated`) AS `dated` from `list_sense` group by `list_sense`.`word`

-- incomplete definition
