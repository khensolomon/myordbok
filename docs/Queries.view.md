# View

```sql
-- view_sense_date
select `list_sense`.`word` AS `word`,max(`list_sense`.`dated`) AS `dated` from `list_sense` group by `list_sense`.`word`;

-- view_none_en
select `log_keyword`.`word` AS `word`,`log_keyword`.`status` AS `status`,`log_keyword`.`view` AS `view` from `log_keyword` where ((`log_keyword`.`status` = 0) and (`log_keyword`.`lang` = 'en')) order by `log_keyword`.`modified` desc;

-- incomplete definition
