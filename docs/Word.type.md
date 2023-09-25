# Word type

```sql
UPDATE sense SET tid=92 WHERE tid =2;
SELECT * FROM sense WHERE tid=2;

"0","Noun"
"1","Verb"
"2","Adjective"
"3","Adverb"
"4","Preposition"
"5","Conjunction"
"6","Pronoun"
"7","Interjection"
"8","Abbreviation"
"9","Prefix"
"10","Combining form"
"11","Phrase"
"12","Contraction"
"13","Adjective suffix"
"14","Noun suffix"
"15","Verb suffix"
"16","Acronym"
"17","Article"
"18","Int"

UPDATE list_sense SET wrte=27 WHERE wrte =16;
UPDATE list_sense SET wrte=28 WHERE wrte =17;
UPDATE list_sense SET wrte=29 WHERE wrte =18;

UPDATE list_sense SET wrte=17 WHERE wrte =27;
UPDATE list_sense SET wrte=18 WHERE wrte =28;
UPDATE list_sense SET wrte=16 WHERE word LIKE '-%' AND wrte = 0;


-- UPDATE sense SET tmp=0 WHERE tid =91;
UPDATE sense SET tmp=6 WHERE tid =92;
UPDATE sense SET tmp=2 WHERE tid =93;
UPDATE sense SET tmp=1 WHERE tid =94;
UPDATE sense SET tmp=1 WHERE tid =95;
UPDATE sense SET tmp=3 WHERE tid =96;
UPDATE sense SET tmp=4 WHERE tid =97;
UPDATE sense SET tmp=5 WHERE tid =98;
UPDATE sense SET tmp=7 WHERE tid =99;

0   "91","Noun"
6   "92","Pronoun"
2   "93","Adjective"
1   "94","Intransitive verb"-- 27
1   "95","Transitive verb" -- 28
3   "96","Adverb"
4   "97","Preposition"
5   "98","Conjunction"
7   "99","Interjection"

UPDATE sense SET tmp=11 WHERE tid =110;
UPDATE sense SET tmp=17 WHERE tid =111;
UPDATE sense SET tmp=1 WHERE tid =112;
-- UPDATE sense SET tmp=0 WHERE tid =113;
UPDATE sense SET tmp=8 WHERE tid =114;
UPDATE sense SET tmp=9 WHERE tid =115;
UPDATE sense SET tmp=1 WHERE tid =116;
-- UPDATE sense SET tmp=0 WHERE tid =117;
UPDATE sense SET tmp=2 WHERE tid =118;
-- UPDATE sense SET tmp=0 WHERE tid =119;

11  "110","Exclamation" --
17  "111","Indefinite article" --
1   "112","Auxiliary verb" --
0   "113","Symbol" --
8   "114","Abbreviation"
9   "115","Prefix"
1   "116","Verb"
0   "117","Suffix" --
2   "118","Adjective & Adverb" --
0   "119","Adjective & Noun" --

UPDATE sense SET tmp=10 WHERE tid =220;
UPDATE sense SET tmp=2 WHERE tid =221;
UPDATE sense SET tmp=12 WHERE tid =223;
-- UPDATE sense SET tmp=0 WHERE tid =225;
UPDATE sense SET tmp=18 WHERE tid =228;
UPDATE sense SET tmp=18 WHERE tid =229;
10  "220","Comb Form"
2   "221","Adjective & Pronoun"
----------- "222","Determiner"
12  "223","Contraction of" --
----------- "224","Predeterminer" --
0   "225","Verb & Noun" --
----------- "226","Conjunction & Adverb"
----------- "227","Preposition & Conjunction"
18  "228","Noun & Pronoun"
18  "229","Cardinal number" --

UPDATE sense SET tmp=18 WHERE tid =330;
UPDATE sense SET tmp=2 WHERE tid =331;
UPDATE sense SET tmp=3 WHERE tid =332;
UPDATE sense SET tmp=6 WHERE tid =333;
UPDATE sense SET tmp=3 WHERE tid =334;
UPDATE sense SET tmp=2 WHERE tid =335;
UPDATE sense SET tmp=6 WHERE tid =336;
UPDATE sense SET tmp=3 WHERE tid =338;
UPDATE sense SET tmp=3 WHERE tid =339;
18  "330","Ordinal number"
2   "331","Interrogative adjective" --
3   "332","Interrogative adverb" --
6   "333","Interrogative pronoun" --
3   "334","Relative adverb"
2   "335","Relative adjective"
6   "336","Relative pronoun"
----------- "337","Relative conjunction"
3   "338","Adverb & Preposition"
3   "339","Adverb, Adjective & Preposition" --

UPDATE sense SET tmp=1 WHERE tid =440;
UPDATE sense SET tmp=2 WHERE tid =441;
UPDATE sense SET tmp=6 WHERE tid =442;
UPDATE sense SET tmp=4 WHERE tid =443;
1   "440","Modal verb" --
2   "441","Possessive adjective" --
6   "442","Possessive pronoun" --
4   "443","Infinitive marker" --
----------- "444","Exclamation & Noun"

UPDATE sense SET tmp=11 WHERE tid =501;
-- UPDATE sense SET tmp=0 WHERE tid =504;
-- UPDATE sense SET tmp=0 WHERE tid =505;
UPDATE sense SET tmp=11 WHERE tid =506;
UPDATE sense SET tmp=9 WHERE tid =507;
UPDATE sense SET tmp=1 WHERE tid =509;
UPDATE sense SET tmp=1 WHERE tid =510;
-- UPDATE sense SET tmp=0 WHERE tid =511;
11  "501","Idiom" --
----------- "502","Synonym"
----------- "503","Antonym"
0   "504","Capital city" --
0   "505","Plural Noun" --
11  "506","Phrase"
9   "507","Prefix"
----------- "508","Slang" --
1   "509","Verb present tense" --
1   "510","Verb past tense"
0   "511","Country" --
