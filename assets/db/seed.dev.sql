-- Sample dictionary for local development and tests.
--
-- NOT the real dataset. Every row here is written for illustration; the real
-- data lives in a private repository and never enters this one. The tables
-- and columns match the build of the dataset (scripts/db_build.py), so the
-- same lookup code runs on both; `make dataset-sync` checks that they still
-- match.
--
-- Loaded into the local myordbok-live by `make data-sample`.

DROP TABLE IF EXISTS type_word;
CREATE TABLE type_word (id INTEGER, name TEXT, shortname TEXT, PRIMARY KEY (id));
INSERT INTO type_word (id, name, shortname) VALUES
(0, 'Noun', 'n'), (1, 'Verb', 'v'), (2, 'Adjective', 'adj'), (3, 'Adverb', 'adv');

DROP TABLE IF EXISTS type_sense;
CREATE TABLE type_sense (id INTEGER, name TEXT, PRIMARY KEY (id));
INSERT INTO type_sense (id, name) VALUES
(0, 'Draft'), (1, 'Active'), (3, 'Country'), (9, 'Idiom'), (39, 'Checked: awaiting native review');

DROP TABLE IF EXISTS eng_word;
CREATE TABLE eng_word (id INTEGER, word TEXT, derived INTEGER, PRIMARY KEY (id));
INSERT INTO eng_word (id, word, derived) VALUES
(1, 'love', 0), (2, 'loves', 2), (3, 'loved', 2), (4, 'loving', 0),
(5, 'go', 0), (6, 'went', 1), (7, 'gone', 1), (8, 'goes', 2), (9, 'going', 0),
(10, 'colour', 0), (11, 'color', 0), (12, 'water', 0), (13, 'hate', 0),
(14, 'affection', 0), (15, 'lovable', 0), (16, 'love affair', 0), (17, 'adore', 0),
(18, 'school', 0), (19, 'plant', 0), (20, 'family', 0), (21, 'waters', 2),
(22, 'king', 0), (23, 'Denmark', 0), (24, 'Norway', 0), (25, 'big', 0), (26, 'house', 0), (27, 'kings', 2),
(28, 'God', 0), (29, 'god', 0);
CREATE INDEX eng_word_1 ON eng_word (word COLLATE NOCASE);

DROP TABLE IF EXISTS emd_sense;
CREATE TABLE emd_sense (id INTEGER, wrid INTEGER, wrte INTEGER, sense TEXT, exam TEXT, wseq INTEGER, wrkd INTEGER, synset INTEGER, PRIMARY KEY (id));
INSERT INTO emd_sense (id, wrid, wrte, sense, exam, wseq, wrkd, synset) VALUES
(1, 1, 0, 'ချစ်ခြင်း; ချစ်ခင်မှု', 'a mother''s love for her <family>', 1, 1, 107543288),
(2, 1, 0, 'ချစ်သူ', 'You were my first love.', 2, 39, NULL),
(3, 1, 1, 'ချစ်သည်', '<love/loved/loved>; She loves her <family>.', 3, 1, 201775164),
(4, 1, 1, '[type:informal] အလွန်နှစ်သက်သည်', 'I (-love-) this song!', 4, 0, NULL),
(5, 5, 1, 'သွားသည်', '<go/went/gone>; We go to <school> by bus.', 1, 1, NULL),
(6, 10, 0, '[US:color] အရောင်', 'What colour is it?', 1, 1, NULL),
(7, 12, 0, 'ရေ', 'a glass of water', 1, 1, NULL),
(8, 12, 1, 'ရေလောင်းသည်', 'Water the <plant>s every morning.', 2, 1, NULL),
(9, 15, 2, 'ချစ်စရာကောင်းသော', NULL, 1, 1, NULL),
(10, 16, 0, 'အချစ်ဇာတ်လမ်း', NULL, 1, 1, NULL),
(11, 13, 1, 'မုန်းသည်', NULL, 1, 1, 201774136),
(12, 14, 0, 'ချစ်ခင်မှု', NULL, 1, 1, 107543288),
(13, 17, 1, 'အလွန်ချစ်မြတ်နိုးသည်', NULL, 1, 1, 201775164),
(14, 18, 0, 'ကျောင်း', NULL, 1, 1, NULL),
(15, 19, 0, 'အပင်', NULL, 1, 1, NULL),
(16, 20, 0, 'မိသားစု', NULL, 1, 1, NULL),
(17, 22, 0, 'အကောင်းဆုံးသူ; ထိပ်ဆုံးသူ', 'the king of jazz', 1, 1, NULL),
(18, 22, 0, 'ဘုရင်; မင်း', 'the King of Spain; The king opened the bridge.', 2, 1, NULL),
(19, 23, 0, 'ဒိန်းမတ်နိုင်ငံ', NULL, 1, 3, NULL),
(20, 24, 0, 'နော်ဝေနိုင်ငံ', NULL, 1, 3, NULL),
(21, 25, 2, 'ကြီးသော', 'a big house', 1, 1, NULL),
(22, 26, 0, 'အိမ်', NULL, 1, 1, NULL),
(23, 28, 0, 'ဘုရားသခင်', 'pray to God', 1, 1, NULL),
(24, 29, 0, 'နတ်ဘုရား', 'the gods of ancient Greece', 1, 1, NULL);
CREATE INDEX emd_sense_1 ON emd_sense (wrid, wseq);
CREATE INDEX emd_sense_2 ON emd_sense (synset);

DROP TABLE IF EXISTS eng_form;
CREATE TABLE eng_form (form INTEGER, root INTEGER, pos TEXT, type INTEGER, PRIMARY KEY (form, root, pos, type));
INSERT INTO eng_form (form, root, pos, type) VALUES
(2, 1, 'n', 1), (2, 1, 'v', 2), (3, 1, 'v', 3), (3, 1, 'v', 4), (4, 1, 'v', 5),
(6, 5, 'v', 3), (7, 5, 'v', 4), (8, 5, 'v', 2), (9, 5, 'v', 5),
(21, 12, 'n', 1), (21, 12, 'v', 2), (27, 22, 'n', 1);
CREATE INDEX eng_form_1 ON eng_form (root);

DROP TABLE IF EXISTS wn_member;
CREATE TABLE wn_member (synset INTEGER, word INTEGER, rank INTEGER, PRIMARY KEY (synset, word));
INSERT INTO wn_member (synset, word, rank) VALUES
(107543288, 1, 1), (107543288, 14, 2),
(201775164, 1, 1), (201775164, 17, 2),
(201774136, 13, 1);
CREATE INDEX wn_member_1 ON wn_member (word);

DROP TABLE IF EXISTS wn_link;
CREATE TABLE wn_link (synset INTEGER, word INTEGER, target INTEGER, target_word INTEGER, type INTEGER, PRIMARY KEY (synset, word, target, target_word, type));
INSERT INTO wn_link (synset, word, target, target_word, type) VALUES
(201775164, 1, 201774136, 13, 5);
CREATE INDEX wn_link_1 ON wn_link (target, target_word);
CREATE INDEX wn_link_2 ON wn_link (word, type);
CREATE INDEX wn_link_3 ON wn_link (target_word, type);

DROP TABLE IF EXISTS eng_related;
CREATE TABLE eng_related (wrid INTEGER, related INTEGER, rank INTEGER, PRIMARY KEY (wrid, rank));
INSERT INTO eng_related (wrid, related, rank) VALUES
(1, 14, 1), (1, 15, 2), (1, 16, 3);

DROP TABLE IF EXISTS mya_word;
CREATE TABLE mya_word (id INTEGER, word TEXT, ipa TEXT, mlc TEXT, PRIMARY KEY (id));
INSERT INTO mya_word (id, word, ipa, mlc) VALUES
(1, 'ရေ', 'jè', 're'),
(2, 'ချစ်', 'tɕʰɪʔ', 'hkyit'),
(3, 'ချစ်သူ', 'tɕʰɪʔ θù', 'hkyit su'),
(4, 'သောက်', 'θauʔ', 'sauk'),
(5, 'သူ', 'θù', 'su');
CREATE INDEX mya_word_1 ON mya_word (word);

DROP TABLE IF EXISTS med_sense;
CREATE TABLE med_sense (id INTEGER, wrid INTEGER, wrte INTEGER, sense TEXT, exam TEXT, wseq INTEGER, wrkd INTEGER, cate INTEGER, usg TEXT, ref TEXT, etymology TEXT, variant TEXT, reference TEXT, PRIMARY KEY (id));
INSERT INTO med_sense (id, wrid, wrte, sense, exam, wseq, wrkd, cate, usg, ref, etymology, variant, reference) VALUES
(1, 1, 0, '<water>', '~ချိုး; ~သောက်', 1, 1, 0, NULL, NULL, NULL, NULL, NULL),
(2, 2, 1, 'to <love>; to be fond of', '~သူ', 1, 1, 0, NULL, NULL, NULL, NULL, NULL),
(3, 3, 0, '<lover>; <sweetheart>', NULL, 1, 1, 0, NULL, NULL, NULL, NULL, NULL),
(4, 4, 1, 'to <drink>', '~ရေ~', 1, 1, 0, NULL, NULL, NULL, NULL, NULL),
(5, 5, 0, 'he; she', NULL, 1, 1, 0, NULL, NULL, NULL, NULL, NULL);
CREATE INDEX med_sense_1 ON med_sense (wrid, wseq);

DROP TABLE IF EXISTS med_thesaurus;
CREATE TABLE med_thesaurus (wrid INTEGER, wlid INTEGER, cate INTEGER, PRIMARY KEY (wrid, wlid, cate));
INSERT INTO med_thesaurus (wrid, wlid, cate) VALUES (2, 3, 0);
CREATE INDEX med_thesaurus_1 ON med_thesaurus (wlid);

DROP TABLE IF EXISTS eng_variant;
CREATE TABLE eng_variant (variant TEXT, wrid INTEGER, PRIMARY KEY (variant, wrid));
INSERT INTO eng_variant (variant, wrid) VALUES ('color', 10);
CREATE INDEX eng_variant_1 ON eng_variant (variant COLLATE NOCASE);

DROP TABLE IF EXISTS meta;
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
INSERT INTO meta (key, value) VALUES
('built', 'sample'),
('source', 'sample'),
('rows.type_word', '4'), ('rows.type_sense', '5'), ('rows.eng_word', '29'), ('rows.emd_sense', '24'),
('rows.eng_form', '12'), ('rows.wn_member', '5'), ('rows.wn_link', '1'), ('rows.eng_related', '3'),
('rows.mya_word', '5'), ('rows.med_sense', '5'), ('rows.med_thesaurus', '1'), ('rows.eng_variant', '1');
