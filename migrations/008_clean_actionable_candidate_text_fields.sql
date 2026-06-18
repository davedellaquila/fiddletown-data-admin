-- Migration: Clean high-ASCII / encoded garbage in actionable candidate text fields
-- Scope: actionable queue only (new + needs_review). Safe to re-run (idempotent).
-- This extends the original description-only cleanup to all editable text fields.

CREATE OR REPLACE FUNCTION public.normalize_scraped_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  match text[];
  codepoint int;
  entity text;
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN
    RETURN NULL;
  END IF;

  t := input;

  -- Unescape literal backslash sequences from scraped JSON/text payloads.
  t := replace(t, E'\\n', E'\n');
  t := replace(t, E'\\r', E'\r');
  t := replace(t, E'\\t', E'\t');
  t := replace(t, E'\\''', '''');
  t := replace(t, E'\\"', '"');

  -- Decode common mojibake sequences caused by UTF-8 text read as Windows-1252.
  t := replace(t, 'â€™', '''');
  t := replace(t, 'â€˜', '''');
  t := replace(t, 'â€œ', '"');
  t := replace(t, 'â€�', '"');
  t := replace(t, 'â€“', '-');
  t := replace(t, 'â€”', '-');
  t := replace(t, 'â€¦', '...');
  t := replace(t, 'â€¢', '-');
  t := replace(t, 'Â ', ' ');
  t := replace(t, 'Â', '');
  t := replace(t, '�', '');

  -- Decode named HTML entities first.
  t := regexp_replace(t, '&nbsp;', ' ', 'gi');
  t := regexp_replace(t, '&lt;', '<', 'gi');
  t := regexp_replace(t, '&gt;', '>', 'gi');
  t := regexp_replace(t, '&quot;', '"', 'gi');
  t := regexp_replace(t, '&apos;', '''', 'gi');
  t := regexp_replace(t, '&amp;', '&', 'gi');

  -- Decode decimal numeric HTML entities, including source-obfuscated emails.
  FOR match IN SELECT regexp_matches(t, '&#([0-9]{1,6});', 'g') LOOP
    codepoint := match[1]::int;
    IF codepoint > 0 AND codepoint <= 1114111 THEN
      entity := '&#' || match[1] || ';';
      t := replace(t, entity, chr(codepoint));
    END IF;
  END LOOP;

  -- Strip HTML tags and normalize spacing without destroying intentional line breaks.
  t := regexp_replace(t, '<[^>]+>', '', 'g');
  t := regexp_replace(t, '[\r\t ]+', ' ', 'g');
  t := regexp_replace(t, E' *\n *', E'\n', 'g');
  t := regexp_replace(t, E'\n{3,}', E'\n\n', 'g');
  t := btrim(t);

  IF t = '' THEN
    RETURN NULL;
  END IF;

  RETURN t;
END;
$$;

UPDATE public.event_candidates
SET
  title = public.normalize_scraped_text(title),
  host_org = public.normalize_scraped_text(host_org),
  location = public.normalize_scraped_text(location),
  source_name = public.normalize_scraped_text(source_name),
  short_description = public.normalize_scraped_text(short_description),
  description = public.normalize_scraped_text(description),
  raw_text = public.normalize_scraped_text(raw_text),
  review_notes = public.normalize_scraped_text(review_notes),
  updated_at = now()
WHERE status IN ('new', 'needs_review')
  AND (
    public.normalize_scraped_text(title) IS DISTINCT FROM title
    OR public.normalize_scraped_text(host_org) IS DISTINCT FROM host_org
    OR public.normalize_scraped_text(location) IS DISTINCT FROM location
    OR public.normalize_scraped_text(source_name) IS DISTINCT FROM source_name
    OR public.normalize_scraped_text(short_description) IS DISTINCT FROM short_description
    OR public.normalize_scraped_text(description) IS DISTINCT FROM description
    OR public.normalize_scraped_text(raw_text) IS DISTINCT FROM raw_text
    OR public.normalize_scraped_text(review_notes) IS DISTINCT FROM review_notes
  );
