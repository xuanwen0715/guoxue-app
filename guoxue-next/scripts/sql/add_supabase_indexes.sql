-- Enable trigram extension (needed for fast ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Dictionary table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dictionary_pinyin_trgm ON public.dictionary USING gin (pinyin gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dictionary_char ON public.dictionary (char);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dictionary_traditional ON public.dictionary (traditional);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dictionary_radical ON public.dictionary (radical);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dictionary_total_strokes ON public.dictionary (total_strokes);

-- Idioms table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_idioms_word_trgm ON public.idioms USING gin (word gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_idioms_pinyin_trgm ON public.idioms USING gin (pinyin gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_idioms_abbrev_trgm ON public.idioms USING gin (abbreviation gin_trgm_ops);

-- Words table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_word_trgm ON public.words USING gin (word gin_trgm_ops);

-- Optional: verify usage (run these manually in the editor when needed)
-- EXPLAIN ANALYZE SELECT * FROM public.idioms WHERE word ILIKE '%学%研%' LIMIT 50;
-- EXPLAIN ANALYZE SELECT * FROM public.idioms WHERE abbreviation ILIKE 'xy%' LIMIT 50;
-- EXPLAIN ANALYZE SELECT * FROM public.dictionary WHERE pinyin ILIKE '%xue%' LIMIT 50;
