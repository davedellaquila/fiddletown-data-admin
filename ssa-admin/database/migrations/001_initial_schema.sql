-- Migration 001: Initial Schema Setup
-- Date: December 2024
-- Description: Creates the initial database schema for SSA Admin

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE status_enum AS ENUM ('draft', 'published', 'archived');
CREATE TYPE difficulty_enum AS ENUM ('easy', 'moderate', 'challenging');

-- =============================================
-- LOCATIONS TABLE (Wineries/Businesses)
-- =============================================
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    region TEXT,
    short_description TEXT,
    website_url TEXT,
    status status_enum DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- EVENTS TABLE
-- =============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    host_org TEXT,
    start_date DATE,
    end_date DATE,
    start_time TIME,
    end_time TIME,
    location TEXT,
    recurrence TEXT,
    website_url TEXT,
    image_url TEXT,
    status status_enum DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- ROUTES TABLE
-- =============================================
CREATE TABLE routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    gpx_url TEXT,
    duration_minutes INTEGER,
    start_point TEXT,
    end_point TEXT,
    difficulty difficulty_enum DEFAULT 'easy',
    notes TEXT,
    status status_enum DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Locations indexes
CREATE INDEX idx_locations_status ON locations(status);
CREATE INDEX idx_locations_slug ON locations(slug);
CREATE INDEX idx_locations_created_by ON locations(created_by);
CREATE INDEX idx_locations_deleted_at ON locations(deleted_at);

-- Events indexes
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_slug ON events(slug);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_end_date ON events(end_date);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_deleted_at ON events(deleted_at);

-- Routes indexes
CREATE INDEX idx_routes_status ON routes(status);
CREATE INDEX idx_routes_slug ON routes(slug);
CREATE INDEX idx_routes_difficulty ON routes(difficulty);
CREATE INDEX idx_routes_created_by ON routes(created_by);
CREATE INDEX idx_routes_deleted_at ON routes(deleted_at);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_locations_updated_at 
    BEFORE UPDATE ON locations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at 
    BEFORE UPDATE ON routes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Locations policies
CREATE POLICY "Users can view all locations" ON locations
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert locations" ON locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own locations" ON locations
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own locations" ON locations
    FOR DELETE USING (auth.uid() = created_by);

-- Events policies
CREATE POLICY "Users can view all events" ON events
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert events" ON events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own events" ON events
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own events" ON events
    FOR DELETE USING (auth.uid() = created_by);

-- Routes policies
CREATE POLICY "Users can view all routes" ON routes
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert routes" ON routes
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own routes" ON routes
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own routes" ON routes
    FOR DELETE USING (auth.uid() = created_by);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        REGEXP_REPLACE(
            REGEXP_REPLACE(
                REGEXP_REPLACE(input_text, '[^a-zA-Z0-9\s]', '', 'g'),
                '\s+', '-', 'g'
            ),
            '^-+|-+$', '', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to ensure unique slug
CREATE OR REPLACE FUNCTION ensure_unique_slug(
    table_name TEXT,
    slug_value TEXT,
    exclude_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    final_slug TEXT;
    counter INTEGER := 0;
    exists_check BOOLEAN;
BEGIN
    final_slug := slug_value;
    
    LOOP
        -- Check if slug exists
        EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE slug = $1 AND ($2 IS NULL OR id != $2))', table_name)
        INTO exists_check
        USING final_slug, exclude_id;
        
        IF NOT exists_check THEN
            EXIT;
        END IF;
        
        counter := counter + 1;
        final_slug := slug_value || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STORAGE BUCKETS (for file uploads)
-- =============================================

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('event-images', 'event-images', true),
    ('gpx-files', 'gpx-files', true);

-- Storage policies
CREATE POLICY "Public can view event images" ON storage.objects
    FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'event-images' AND auth.role() = 'authenticated');

CREATE POLICY "Public can view GPX files" ON storage.objects
    FOR SELECT USING (bucket_id = 'gpx-files');

CREATE POLICY "Authenticated users can upload GPX files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'gpx-files' AND auth.role() = 'authenticated');
