-- Migration: Create ad system tables (vendors, ads, impressions, clicks)
-- Run this in your Supabase SQL editor

-- Create ad_vendors table
CREATE TABLE IF NOT EXISTS ad_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create ads table
CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES ad_vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  mobile_image_url TEXT,
  position TEXT NOT NULL DEFAULT 'header' CHECK (position IN ('header', 'body')),
  priority INTEGER DEFAULT 100,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create ad_impressions table (Tracking)
CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  impressed_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT
);

-- Create ad_clicks table (Tracking)
CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ads_vendor_id ON ads(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);
CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);
CREATE INDEX IF NOT EXISTS idx_ads_dates ON ads(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ads_deleted_at ON ads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_vendors_status ON ad_vendors(status);
CREATE INDEX IF NOT EXISTS idx_ad_vendors_deleted_at ON ad_vendors(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id ON ad_impressions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_impressed_at ON ad_impressions(impressed_at);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_clicked_at ON ad_clicks(clicked_at);

-- Enable RLS (Row Level Security)
ALTER TABLE ad_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ad_vendors
-- Allow authenticated users to read all vendors
CREATE POLICY "Allow authenticated users to read ad_vendors"
  ON ad_vendors FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert vendors
CREATE POLICY "Allow authenticated users to insert ad_vendors"
  ON ad_vendors FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update vendors
CREATE POLICY "Allow authenticated users to update ad_vendors"
  ON ad_vendors FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete vendors (soft delete)
CREATE POLICY "Allow authenticated users to delete ad_vendors"
  ON ad_vendors FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for ads
-- Allow authenticated users to read all ads
CREATE POLICY "Allow authenticated users to read ads"
  ON ads FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to read published ads (for public Squarespace frontend)
CREATE POLICY "Allow anonymous users to read published ads"
  ON ads FOR SELECT
  TO anon
  USING (status = 'published' AND (deleted_at IS NULL) AND 
         (start_date IS NULL OR start_date <= CURRENT_DATE) AND
         (end_date IS NULL OR end_date >= CURRENT_DATE));

-- Allow authenticated users to insert ads
CREATE POLICY "Allow authenticated users to insert ads"
  ON ads FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update ads
CREATE POLICY "Allow authenticated users to update ads"
  ON ads FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete ads (soft delete)
CREATE POLICY "Allow authenticated users to delete ads"
  ON ads FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for ad_impressions
-- Allow anonymous users to insert impressions (for tracking)
CREATE POLICY "Allow anonymous users to insert ad_impressions"
  ON ad_impressions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read impressions
CREATE POLICY "Allow authenticated users to read ad_impressions"
  ON ad_impressions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for ad_clicks
-- Allow anonymous users to insert clicks (for tracking)
CREATE POLICY "Allow anonymous users to insert ad_clicks"
  ON ad_clicks FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated users to read clicks
CREATE POLICY "Allow authenticated users to read ad_clicks"
  ON ad_clicks FOR SELECT
  TO authenticated
  USING (true);

