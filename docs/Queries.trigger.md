# TRIGGER

## list-sense

```sql
-- list_sense_created
BEGIN
  SET new.dated := NOW();
END

-- list_sense_updated
BEGIN
IF (new.word != old.word OR new.wrte != old.wrte OR new.sense != old.sense OR new.exam != old.exam OR new.wseq != old.wseq OR new.wrkd != old.wrkd) THEN
   SET new.dated := NOW();
 END IF;
END,
```

```sql
DELIMITER |
--  create date on insert
DROP TRIGGER IF EXISTS list_sense_created;
CREATE TRIGGER list_sense_created BEFORE INSERT ON `list_sense`
FOR EACH ROW BEGIN
  SET NEW.dated := NOW();
END;

|
--  update dated only on specific column
DROP TRIGGER IF EXISTS list_sense_updated;
CREATE TRIGGER list_sense_updated BEFORE UPDATE ON `list_sense`
FOR EACH ROW
  BEGIN
    IF (NEW.word != OLD.word OR NEW.wrte != OLD.wrte OR NEW.sense != OLD.sense OR NEW.exam != OLD.exam OR NEW.wseq != OLD.wseq OR NEW.wrkd != OLD.wrkd) THEN
      SET NEW.dated := NOW();
    END IF;
  END;
END;

DELIMITER |
```

... alter

```sql
ALTER TABLE `list_sense` ADD `dated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE `list_sense` ADD `dated` TIMESTAMP NOT NULL;

ALTER TABLE `list_sense` MODIFY `dated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

... check

```sql
SELECT DATE(dated) as id, COUNT(id) AS total, dated FROM `list_sense` GROUP BY DATE(dated) ORDER BY dated DESC;

SELECT * FROM  `list_sense` WHERE dated > '2021-04-30';
SELECT * FROM  `list_sense` WHERE DATE(dated) > '2021-04-30';
SELECT * FROM  `list_sense` WHERE DATE(dated) = '2021-04-29';

UPDATE `list_sense` AS a
  INNER JOIN (select id, word from `list_word` GROUP BY word) AS b ON a.word = b.word
  SET a.dated = '2021-04-30 14:55:12'
  WHERE DATE(dated) = '2021-05-02' AND a.wrte = 0;

UPDATE `list_sense`
  SET dated = '1981-07-08 20:08:07'
  WHERE DATE(dated) = '2021-05-02';

UPDATE `list_sense`
  SET dated = CURRENT_TIMESTAMP
  WHERE DATE(dated) = '2021-04-30';




SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-30' AND word LIKE '% %' AND wrid > 0;

SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-30' AND word LIKE '%-%' AND wrid > 0;

SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-29' AND word NOT LIKE '%-%' AND word NOT LIKE '% %' AND wrid > 0;

SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-30' AND word NOT LIKE '%-%' AND word NOT LIKE '% %' AND wrid > 0;

SELECT * FROM  `list_sense`
  WHERE DATE(dated) = '2021-04-29' AND word NOT LIKE '% %' AND exam IS NOT NULL
  GROUP BY word
  HAVING count(*) > 1;
