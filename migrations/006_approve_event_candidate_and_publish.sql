-- Migration: Approve candidate and publish (with keywords)
-- Run in Supabase SQL editor or via apply_migration

-- ---------------------------------------------------------------------------
-- Keyword linker (shared by publish RPC)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_event_keywords(p_event_id uuid, p_keyword_names text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  kw text;
  normalized text;
  kw_id uuid;
BEGIN
  FOREACH kw IN ARRAY coalesce(p_keyword_names, '{}'::text[]) LOOP
    normalized := lower(trim(kw));
    IF normalized = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.keywords (name)
    VALUES (normalized)
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO kw_id FROM public.keywords WHERE name = normalized;
    IF kw_id IS NOT NULL THEN
      INSERT INTO public.event_keywords (event_id, keyword_id)
      VALUES (p_event_id, kw_id)
      ON CONFLICT (event_id, keyword_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.link_event_keywords(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_event_keywords(uuid, text[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Approve candidate → published event (atomic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_event_candidate_and_publish(
  p_candidate_id uuid,
  p_keyword_names text[] DEFAULT '{}'::text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  base_slug text;
  candidate_slug text;
  suffix int := 1;
  new_event_id uuid;
  resolved_website_url text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO c
  FROM public.event_candidates
  WHERE id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  IF c.status NOT IN ('new', 'needs_review') THEN
    RAISE EXCEPTION 'Candidate is not actionable (status: %)', c.status;
  END IF;

  IF coalesce(trim(c.title), '') = '' THEN
    RAISE EXCEPTION 'Title is required to publish';
  END IF;

  IF c.start_date IS NULL THEN
    RAISE EXCEPTION 'Start date is required to publish';
  END IF;

  IF coalesce(trim(c.location), '') = '' THEN
    RAISE EXCEPTION 'Location is required to publish';
  END IF;

  IF coalesce(trim(c.short_description), '') = '' THEN
    RAISE EXCEPTION 'Short description is required to publish';
  END IF;

  resolved_website_url := coalesce(nullif(trim(c.website_url), ''), nullif(trim(c.source_url), ''));
  IF resolved_website_url IS NULL THEN
    RAISE EXCEPTION 'Website or source URL is required to publish';
  END IF;

  base_slug := public.slugify_text(c.title) || '-' || coalesce(to_char(c.start_date, 'YYYY-MM-DD'), 'undated');
  candidate_slug := base_slug;

  WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = candidate_slug) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  END LOOP;

  INSERT INTO public.events (
    name,
    slug,
    host_org,
    start_date,
    end_date,
    start_time,
    end_time,
    location,
    short_description,
    description,
    website_url,
    image_url,
    ocr_text,
    status,
    created_by
  ) VALUES (
    c.title,
    candidate_slug,
    c.host_org,
    c.start_date,
    c.end_date,
    c.start_time,
    c.end_time,
    c.location,
    c.short_description,
    c.description,
    resolved_website_url,
    c.image_url,
    c.raw_text,
    'published'::status_enum,
    auth.uid()
  )
  RETURNING id INTO new_event_id;

  PERFORM public.link_event_keywords(new_event_id, p_keyword_names);

  UPDATE public.event_candidates
  SET
    status = 'published',
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_candidate_id;

  RETURN new_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_event_candidate_and_publish(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_event_candidate_and_publish(uuid, text[]) TO authenticated;
