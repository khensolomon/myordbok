# Moby

```sql
SELECT synonyms.* FROM words LEFT JOIN synonyms ON synonyms.word_id = words.word_id WHERE word = "a cappella";

INSERT INTO table ( column1, column2, column 3, etc)
SELECT column1, column2, column3, etc from table where condition = 'whatever condition you want inserted into the table'

-- synonyms (2275475) 101762
INSERT IGNORE INTO list_words (`word`) SELECT `synonym` from synonyms where synonyms.synonym = 'whatever';
INSERT IGNORE INTO list_words (`word`) SELECT `synonym` from synonyms;
-- words (30195) 102633
INSERT IGNORE INTO list_words (`word`) SELECT `word` from words where words.word = 'whatever';
INSERT IGNORE INTO list_words (`word`) SELECT `word` from words;
-- word_parts_of_speech (297828) 200000
INSERT IGNORE INTO list_words (`word`) SELECT `word` from word_parts_of_speech where word_parts_of_speech.word = 'whatever';
INSERT IGNORE INTO list_words (`word`) SELECT `word` from word_parts_of_speech;

DELETE t1 FROM list_words t1
  INNER JOIN list_words t2 
    WHERE 
      t1.id > t2.id AND t1.word = t2.word;


delete t1 FROM list_words t1
  INNER JOIN list_words t2
    WHERE
      t1.id < t2.id AND t1.word = t2.word;

INSERT INTO list_words (`word`)
 SELECT
    synonyms.synonym
FROM
    synonyms
LEFT JOIN list_words ON list_words.word = synonyms.synonym
WHERE
    list_words.word IS NULL;

-- check duplicates
SELECT 
    word, 
    COUNT(word)
FROM
    list_words
GROUP BY 
    word
HAVING 
    COUNT(word) > 1;

-- check non-alphanumeric character
SELECT * FROM list_words WHERE word REGEXP '^[^a-z0-9]'
SELECT * FROM list_words WHERE word LIKE '%[^0-9a-zA-Z ]%'
