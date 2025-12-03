/**
 * Shared TypeScript type definitions for data models
 * Used by both web app and iPad app (via TypeScript-to-Swift conversion reference)
 */

export type Status = 'draft' | 'published' | 'archived'

export type Difficulty = 'easy' | 'moderate' | 'challenging'

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
}

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


