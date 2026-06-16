-- Migration: Clean HTML entities / escape sequences in candidate descriptions (BUG-001)
-- Scope: actionable queue only (new + needs_review). Safe to re-run (idempotent).
-- Run in Supabase SQL editor or via apply_migration after review.

CREATE OR REPLACE FUNCTION public.normalize_scraped_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN NULL;
  END IF;

  t := input;
  t := replace(t, E'\\n', E'\n');
  t := replace(t, E'\\r', E'\r');
  t := replace(t, E'\\t', E'\t');
  t := replace(t, E'\\''', '''');
  t := replace(t, E'\\"', '"');

  t := regexp_replace(t, '&lt;', '<', 'gi');
  t := regexp_replace(t, '&gt;', '>', 'gi');
  t := regexp_replace(t, '&quot;', '"', 'gi');
  t := regexp_replace(t, '&apos;', '''', 'gi');
  t := regexp_replace(t, '&#39;', '''', 'gi');
  t := regexp_replace(t, '&amp;', '&', 'gi');

  t := regexp_replace(t, '<[^>]+>', '', 'g');
  t := btrim(t);

  IF t = '' THEN
    RETURN NULL;
  END IF;

  RETURN t;
END;
$$;

UPDATE public.event_candidates
SET
  short_description = public.normalize_scraped_text(short_description),
  description = public.normalize_scraped_text(description),
  updated_at = now()
WHERE status IN ('new', 'needs_review')
  AND (
    (short_description IS NOT NULL AND public.normalize_scraped_text(short_description) IS DISTINCT FROM short_description)
    OR (description IS NOT NULL AND public.normalize_scraped_text(description) IS DISTINCT FROM description)
  );
