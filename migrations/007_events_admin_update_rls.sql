-- Migration: Allow authenticated admins to update any event (incl. soft delete)
-- Problem: auth_update_events only allowed auth.uid() = created_by, blocking delete on
-- imported events (created_by IS NULL) and events created by other users.
-- Matches event_candidates admin pattern (authenticated full UPDATE access).

DROP POLICY IF EXISTS auth_update_events ON public.events;

CREATE POLICY auth_update_events ON public.events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
