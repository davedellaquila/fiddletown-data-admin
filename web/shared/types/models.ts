/**
 * Shared TypeScript type definitions for data models
 * 
 * This file serves as the SOURCE OF TRUTH for data models.
 * When types change here, Swift models in ios/SSA-Admin/Shared/Models/DataModels.swift
 * must be synchronized. See docs/TYPE_SYNC.md for sync process.
 * 
 * @see docs/TYPE_SYNC.md - Type synchronization guide
 * @see docs/SHARED_LOGIC.md - Business logic contracts
 */

/**
 * Status values for locations, events, and routes
 * 
 * - `draft`: Work in progress, not visible to public
 * - `published`: Live and visible to public
 * - `archived`: No longer active, historical record
 * 
 * @see docs/SHARED_LOGIC.md#status-transitions
 */
export type Status = 'draft' | 'published' | 'archived'

/**
 * Difficulty levels for routes
 * 
 * - `easy`: Suitable for beginners
 * - `moderate`: Requires some experience
 * - `challenging`: Requires advanced skills
 */
export type Difficulty = 'easy' | 'moderate' | 'challenging'

/**
 * Location model representing wineries, parks, or other points of interest
 * 
 * @property id - Unique identifier (UUID string)
 * @property name - Display name (required, non-empty)
 * @property slug - URL-friendly identifier (auto-generated from name if not provided)
 * @property region - Geographic region (e.g., "Napa Valley")
 * @property short_description - Brief description for listings
 * @property website_url - Website URL (normalized with https:// if missing)
 * @property status - Current status (default: 'draft')
 * @property sort_order - Display order (lower numbers appear first)
 * @property created_by - User ID who created the record
 * @property created_at - ISO 8601 timestamp of creation
 * @property updated_at - ISO 8601 timestamp of last update
 * @property deleted_at - ISO 8601 timestamp of soft delete (null if not deleted)
 * 
 * @see docs/SHARED_LOGIC.md#location-validation
 */
export interface Location {
  id: string
  name: string
  slug: string | null
  region: string | null
  short_description: string | null
  website_url: string | null
  status: Status
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Event model representing scheduled events
 * 
 * @property id - Unique identifier (number, optional for new events)
 * @property name - Event name (required, non-empty)
 * @property slug - URL-friendly identifier (auto-generated from name if not provided)
 * @property description - Full event description
 * @property host_org - Hosting organization name
 * @property start_date - ISO date string (YYYY-MM-DD) for event start
 * @property end_date - ISO date string (YYYY-MM-DD) for event end (must be >= start_date)
 * @property start_time - Time string (HH:MM) for event start
 * @property end_time - Time string (HH:MM) for event end
 * @property location - Location name or address
 * @property recurrence - Recurrence pattern (e.g., "weekly", "monthly")
 * @property website_url - Event website URL (normalized with https:// if missing)
 * @property image_url - Event image URL
 * @property ocr_text - Raw OCR text from event image processing
 * @property status - Current status (default: 'draft')
 * @property sort_order - Display order (lower numbers appear first)
 * @property created_by - User ID who created the record
 * @property created_at - ISO 8601 timestamp of creation
 * @property updated_at - ISO 8601 timestamp of last update
 * @property deleted_at - ISO 8601 timestamp of soft delete (null if not deleted)
 * @property keywords - Array of keyword strings for filtering
 * @property is_signature_event - Whether this event is a signature event (default: false)
 * 
 * @see docs/SHARED_LOGIC.md#event-validation
 */
export interface EventRow {
  id?: number
  name: string
  slug?: string | null
  description?: string | null
  host_org?: string | null
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  recurrence?: string | null
  website_url?: string | null
  image_url?: string | null
  ocr_text?: string | null
  status?: string | null
  sort_order?: number | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  keywords?: string[]
  is_signature_event?: boolean | null
}

/**
 * Route model representing hiking or walking routes
 * 
 * @property id - Unique identifier (UUID string)
 * @property name - Route name (required, non-empty)
 * @property slug - URL-friendly identifier (auto-generated from name if not provided)
 * @property gpx_url - URL to GPX file for route
 * @property duration_minutes - Estimated duration in minutes (positive integer)
 * @property start_point - Starting point description
 * @property end_point - Ending point description
 * @property difficulty - Route difficulty level
 * @property notes - Additional route notes
 * @property status - Current status (default: 'draft')
 * @property sort_order - Display order (lower numbers appear first)
 * @property created_by - User ID who created the record
 * @property created_at - ISO 8601 timestamp of creation
 * @property updated_at - ISO 8601 timestamp of last update
 * @property deleted_at - ISO 8601 timestamp of soft delete (null if not deleted)
 * 
 * @see docs/SHARED_LOGIC.md#route-validation
 */
export interface RouteRow {
  id: string
  name: string
  slug: string | null
  gpx_url: string | null
  duration_minutes: number | null
  start_point: string | null
  end_point: string | null
  difficulty: Difficulty | null
  notes: string | null
  status: Status
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}




