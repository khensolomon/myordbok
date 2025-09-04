# Map of antonym

```sql
CREATE TABLE `map_antonym` (
 `wrid` INT(10) NOT NULL DEFAULT '0',
 `wlid` INT(10) NOT NULL DEFAULT '0',
 INDEX `Wrid` (`wrid`) USING BTREE,
 INDEX `Wlid` (`wlid`) USING BTREE
)

ALTER TABLE antonym RENAME COLUMN word_sense1 TO wrid;
ALTER TABLE antonym RENAME COLUMN word_sense2 TO wlid;

ALTER TABLE antonym ADD COLUMN wrid INTEGER;
ALTER TABLE antonym ADD COLUMN wlid INTEGER;


-- Update wrid -> word_sense1
UPDATE antonym
SET wrid = (SELECT w.word_id from word_senses AS s 
            JOIN unique_words AS w
            ON s.word = w.word
            WHERE s.word_sense = antonym.word_sense1) 
where EXISTS (SELECT w.word_id from word_senses AS s 
            JOIN unique_words AS w
            ON s.word = w.word
            WHERE s.word_sense = antonym.word_sense1) 

-- Update wlid -> word_sense2
UPDATE antonym
SET wlid = (SELECT w.word_id from word_senses AS s 
            JOIN unique_words AS w
            ON s.word = w.word
            WHERE s.word_sense = antonym.word_sense2) 
where EXISTS (SELECT w.word_id from word_senses AS s 
            JOIN unique_words AS w
            ON s.word = w.word
            WHERE s.word_sense = antonym.word_sense2) 


-- 111795 65536 prix fixe
select * from antonym AS i JOIN word_senses AS s ON s.word_sense = i.word_sense1 WHERE i.word_sense1 = 176343
-- 111796 65536 à la carte
select * from antonym AS i JOIN word_senses AS s ON s.word_sense = i.word_sense2 WHERE i.word_sense2 = 237319

select * from unique_words WHERE word_id = 111796


select * from antonym AS i 
  JOIN word_senses AS s ON s.word_sense = i.word_sense1 WHERE i.word_sense1 = 176343;


select * from word_sense AS s WHERE s.word_sense = 111796

SELECT w.word_id from word_senses AS s 
  JOIN unique_words AS w
  ON s.word = w.word
  WHERE s.word_sense = 176343;



UPDATE antonym
SET wrid = (SELECT purchprice
                  FROM softwarecost
                  WHERE id = software.id) 
where EXISTS (SELECT purchprice
                  FROM softwarecost
                  WHERE id = software.id)

select * from antonym AS i 
  JOIN word_senses AS s ON s.word_sense = i.word_sense1
  JOIN unique_words AS w ON w.word = i.word_sense1
  ;


-- view_antonym
select i.wrid, i.wlid, s.word AS word, o.word AS opposite from map_antonym AS i 
  JOIN list_word AS s ON s.id = i.wrid 
  JOIN list_word AS o ON o.id = i.wlid;

SELECT * FROM view_antonym  WHERE word LIKE "love"
