-- Migration: Add is_signature_event field to events table
-- Run this in your Supabase SQL editor

-- Add is_signature_event boolean column with default false
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS is_signature_event BOOLEAN DEFAULT false NOT NULL;

-- Create index for performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_events_is_signature_event ON events(is_signature_event) WHERE is_signature_event = true;

-- Add comment to document the field
COMMENT ON COLUMN events.is_signature_event IS 'Indicates whether this event is a signature event. Signature events can be filtered separately in the display options.';

