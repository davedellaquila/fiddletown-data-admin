-- Allow curator-approved duplicate candidates to publish.
--
-- Duplicate status is a review hint, not a hard publishing block. When a user
-- explicitly clicks Publish on a duplicate-marked candidate, reuse the existing
-- URL/schedule de-dupe behavior from migration 009.

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
  existing_event_id uuid;
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

  IF c.status NOT IN ('new', 'needs_review', 'duplicate') THEN
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

  -- Reuse existing published event when same listing URL + schedule (title may differ).
  SELECT e.id INTO existing_event_id
  FROM public.events e
  WHERE e.status = 'published'
    AND public.normalize_event_url(e.website_url) = public.normalize_event_url(resolved_website_url)
    AND public.events_share_schedule(
      e.start_date, e.end_date, e.start_time, e.end_time,
      c.start_date, c.end_date, c.start_time, c.end_time
    )
  ORDER BY (
    SELECT COUNT(*) FROM public.event_keywords ek WHERE ek.event_id = e.id
  ) DESC, e.created_at ASC
  LIMIT 1;

  IF existing_event_id IS NOT NULL THEN
    PERFORM public.link_event_keywords(existing_event_id, p_keyword_names);
    UPDATE public.event_candidates
    SET
      status = 'published',
      reviewed_at = now(),
      updated_at = now()
    WHERE id = p_candidate_id;
    RETURN existing_event_id;
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
