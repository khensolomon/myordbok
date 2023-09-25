# View

```sql
-- view_sense_date
select `list_sense`.`word` AS `word`,max(`list_sense`.`dated`) AS `dated` from `list_sense` group by `list_sense`.`word`;

-- view_none_en
-- none_def_log
select `log_keyword`.`word` AS `word`,`log_keyword`.`status` AS `status`,`log_keyword`.`view` AS `view` from `log_keyword` where ((`log_keyword`.`status` = 0) and (`log_keyword`.`lang` = 'en')) order by `log_keyword`.`modified` desc;

-- incomplete definition

-- nosense_all
SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word NOT IN (SELECT word FROM list_sense);
-- nosense_word_root

SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word NOT REGEXP '^[0-9]+$' AND w.word NOT IN (SELECT word FROM list_sense);
-- none_def_number_root none_def_number_root nondef nosense
SELECT * FROM list_word AS w WHERE w.derived = 0 AND w.word REGEXP '^[0-9]+$' AND w.word NOT IN (SELECT word FROM list_sense);

-- nosense_all_root nosense_all_derived
-- nosense_word_root nosense_word_derived
-- nosense_number_root nosense_number_derived
