-- Migration: Event candidate admin access (RLS + approve-as-draft RPC)
-- Run in Supabase SQL editor or via apply_migration

-- ---------------------------------------------------------------------------
-- RLS policies (tables already have RLS enabled with no policies)
-- ---------------------------------------------------------------------------

CREATE POLICY "authenticated_select_event_candidates"
  ON public.event_candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "authenticated_update_event_candidates"
  ON public.event_candidates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_select_event_sources"
  ON public.event_sources FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Slug helper (matches web/shared/utils/slugify.ts behavior)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.slugify_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(
      lower(trim(coalesce(input, ''))),
      '[''`]', '', 'g'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- Approve candidate as draft event (atomic)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.approve_event_candidate_as_draft(p_candidate_id uuid)
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
    c.website_url,
    c.image_url,
    c.raw_text,
    'draft'::status_enum,
    auth.uid()
  )
  RETURNING id INTO new_event_id;

  UPDATE public.event_candidates
  SET
    status = 'approved',
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_candidate_id;

  RETURN new_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_event_candidate_as_draft(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_event_candidate_as_draft(uuid) TO authenticated;
