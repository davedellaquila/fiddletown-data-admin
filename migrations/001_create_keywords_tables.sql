-- Migration: Create keywords and event_keywords tables
-- Run this in your Supabase SQL editor

-- Create keywords table
CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create event_keywords junction table
CREATE TABLE IF NOT EXISTS event_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, keyword_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_keywords_event_id ON event_keywords(event_id);
CREATE INDEX IF NOT EXISTS idx_event_keywords_keyword_id ON event_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_keywords_name ON keywords(name);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_keywords ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
-- Allow authenticated users to read keywords
CREATE POLICY "Allow authenticated users to read keywords"
  ON keywords FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to read keywords (for public Squarespace frontend)
CREATE POLICY "Allow anonymous users to read keywords"
  ON keywords FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to insert keywords
CREATE POLICY "Allow authenticated users to insert keywords"
  ON keywords FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read event_keywords
CREATE POLICY "Allow authenticated users to read event_keywords"
  ON event_keywords FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to read event_keywords (for public Squarespace frontend)
CREATE POLICY "Allow anonymous users to read event_keywords"
  ON event_keywords FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to insert event_keywords
CREATE POLICY "Allow authenticated users to insert event_keywords"
  ON event_keywords FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to delete event_keywords
CREATE POLICY "Allow authenticated users to delete event_keywords"
  ON event_keywords FOR DELETE
  TO authenticated
  USING (true);


