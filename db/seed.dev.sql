-- Sample rows for local development only (wrangler d1 execute --local).
-- Real data arrives through the migration script from the dataset.

INSERT INTO word_type (id, name) VALUES (1, 'noun'), (2, 'verb'), (3, 'adjective');

INSERT INTO eng_word (id, word, key) VALUES
	(1, 'love', 'love'),
	(2, 'lovable', 'lovable'),
	(3, 'love affair', 'love affair'),
	(4, 'choreography', 'choreography');

INSERT INTO emd_sense (wrid, wrte, sense, exam, wseq, wrkd) VALUES
	(1, 1, 'အချစ်', 'a love <song> or <story> etc.', 1, 2),
	(1, 1, 'ခုံမင်နှစ်သက်ခြင်း', '(sing) a love of <learning>, <adventure> or <nature> etc.', 2, 2),
	(1, 1, 'ချစ်သူ', 'She was the love of my life.', 3, 2),
	(1, 1, 'စွဲလမ်းခြင်း', 'She''s fond of all sports, but tennis is her <first>, <greatest> love.', 4, 2),
	(1, 1, 'ကြိုက်ခြင်း', NULL, 5, 2),
	(1, 2, 'ချစ်ခင်မြတ်နိုးမှုကို ဖော်ပြတတ်သော', 'She loves her husband deeply.', 1, 2),
	(1, 2, 'ချစ်', 'do you love me?', 2, 2),
	(1, 2, 'ဝါသနာပါသည်', 'Children love to <play>, <love> playing.', 3, 2);

INSERT INTO mya_word (id, word, key) VALUES (1, 'ကကွက်', 'ကကွက်');

INSERT INTO med_sense (wrid, wrte, sense, exam, wseq, wrkd) VALUES
	(1, 1, 'style of dancing', NULL, 1, 2),
	(1, 1, 'choreography', NULL, 2, 2);
