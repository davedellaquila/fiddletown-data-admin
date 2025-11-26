-- Migration: Add anonymous read access to keywords and event_keywords
-- Run this in your Supabase SQL editor if you've already run migration 001
-- This allows the public Squarespace frontend to read keywords
-- Note: If policies already exist, you'll get an error - that's okay, just ignore it

-- Drop existing policies if they exist (to make this idempotent)
DROP POLICY IF EXISTS "Allow anonymous users to read keywords" ON keywords;
DROP POLICY IF EXISTS "Allow anonymous users to read event_keywords" ON event_keywords;

-- Allow anonymous users to read keywords (for public Squarespace frontend)
CREATE POLICY "Allow anonymous users to read keywords"
  ON keywords FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to read event_keywords (for public Squarespace frontend)
CREATE POLICY "Allow anonymous users to read event_keywords"
  ON event_keywords FOR SELECT
  TO anon
  USING (true);

