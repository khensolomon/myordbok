-- Lookup statements shared by the Python reference (scripts/db_build.py)
-- and the JavaScript module (search/search.mjs). Each statement starts with
-- a `-- name:` line. Parameters are numbered (?1, ?2); a list is passed as a
-- JSON array and read with json_each, so the statement text never changes.

-- name: my_entries
-- Myanmar headword: its senses in order. ?1 = the headword.
SELECT t.name AS type, s.sense, s.exam, s.etymology
FROM mya_word w JOIN med_sense s ON s.wrid = w.id JOIN type_word t ON t.id = s.wrte
WHERE w.word = ?1 ORDER BY s.wseq;

-- name: my_pronunciation
-- ?1 = the headword.
SELECT ipa, mlc FROM mya_word WHERE word = ?1;

-- name: word_ids
-- Ids of every spelling equal to the query, ignoring case. ?1 = the query.
SELECT id FROM eng_word WHERE word = ?1 COLLATE NOCASE;

-- name: variant_of
-- Headwords whose senses name the query as a spelling variant
-- ([also:…], [US:…], [brit:…]). ?1 = the query.
SELECT DISTINCT v.wrid, w.word FROM eng_variant v JOIN eng_word w ON w.id = v.wrid
WHERE v.variant = ?1 COLLATE NOCASE ORDER BY w.word;

-- name: entries
-- Senses of the headwords. ?1 = JSON array of word ids.
SELECT w.word, t.name AS type, k.name AS kind, s.sense, s.exam, s.synset
FROM emd_sense s JOIN eng_word w ON w.id = s.wrid
JOIN type_word t ON t.id = s.wrte JOIN type_sense k ON k.id = s.wrkd
WHERE s.wrid IN (SELECT value FROM json_each(?1)) ORDER BY s.wseq;

-- name: forms_of
-- Words the query is a form of (went -> go). ?1 = JSON array of word ids.
SELECT DISTINCT r.word, f.pos, f.type FROM eng_form f JOIN eng_word r ON r.id = f.root
WHERE f.form IN (SELECT value FROM json_each(?1)) AND f.root != f.form
ORDER BY r.word, f.type;

-- name: forms
-- Forms of the query (go -> went, gone). ?1 = JSON array of word ids.
SELECT DISTINCT e.word, f.pos, f.type FROM eng_form f JOIN eng_word e ON e.id = f.form
WHERE f.root IN (SELECT value FROM json_each(?1)) ORDER BY f.pos, f.type, e.word;

-- name: root_senses
-- Number of senses of each root spelling. ?1 = JSON array of spellings.
SELECT j.value AS word, (SELECT count(*) FROM emd_sense s WHERE s.wrid IN
                 (SELECT id FROM eng_word WHERE word = j.value COLLATE NOCASE)) AS senses
FROM json_each(?1) j;

-- name: synsets_of
-- WordNet meanings of the words. ?1 = JSON array of word ids.
SELECT DISTINCT synset FROM wn_member WHERE word IN (SELECT value FROM json_each(?1));

-- name: words_of
-- Other words of the meanings, closest first. ?1 = JSON array of synset
-- ids, ?2 = JSON array of the query's word ids (left out).
SELECT w.word FROM wn_member m JOIN eng_word w ON w.id = m.word
WHERE m.synset IN (SELECT value FROM json_each(?1))
AND m.word NOT IN (SELECT value FROM json_each(?2))
GROUP BY w.word ORDER BY min(m.rank), w.word;

-- name: similar
-- Meanings linked as similar. ?1 = JSON array of synset ids.
SELECT target AS synset FROM wn_link WHERE type = 3 AND word = 0 AND synset IN (SELECT value FROM json_each(?1))
UNION SELECT synset FROM wn_link WHERE type = 3 AND word = 0 AND target IN (SELECT value FROM json_each(?1));

-- name: broader
-- Broader meanings. ?1 = JSON array of synset ids.
SELECT target AS synset FROM wn_link WHERE type IN (1, 2) AND word = 0 AND synset IN (SELECT value FROM json_each(?1));

-- name: opposite
-- Opposite words. ?1 = JSON array of word ids.
SELECT DISTINCT w.word FROM eng_word w JOIN
  (SELECT target_word AS other FROM wn_link WHERE type = 5 AND word IN (SELECT value FROM json_each(?1))
   UNION SELECT word FROM wn_link WHERE type = 5 AND target_word IN (SELECT value FROM json_each(?1))
   AND word NOT IN (SELECT value FROM json_each(?1))) o ON w.id = o.other
ORDER BY w.word;

-- name: related
-- Related words from the Moby Thesaurus. ?1 = JSON array of word ids.
SELECT w.word FROM eng_related r JOIN eng_word w ON w.id = r.related
WHERE r.wrid IN (SELECT value FROM json_each(?1)) ORDER BY r.rank;
