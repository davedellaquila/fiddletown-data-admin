// Shared types for all data modules
export interface BaseEntity {
  id: string
  name: string
  slug: string | null
  status: 'draft' | 'published' | 'archived'
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Location extends BaseEntity {
  region: string | null
  short_description: string | null
  website_url: string | null
}

export interface Event extends BaseEntity {
  host_org: string | null
  start_date: string | null
  end_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  recurrence: string | null
  website_url: string | null
  image_url: string | null
}

export interface Route extends BaseEntity {
  gpx_url: string | null
  duration_minutes: number | null
  start_point: string | null
  end_point: string | null
  difficulty: 'easy' | 'moderate' | 'challenging' | null
  notes: string | null
}

export interface ModuleConfig {
  tableName: string
  displayName: string
  icon: string
  columns: ColumnConfig[]
  searchFields: string[]
  importFields: string[]
  exportFields: string[]
}

export interface ColumnConfig {
  key: string
  label: string
  type: 'text' | 'date' | 'time' | 'number' | 'select' | 'textarea' | 'url' | 'image'
  required?: boolean
  options?: string[]
  width?: string
}

export interface ImportPreview {
  data: any[]
  errors: string[]
  warnings: string[]
}

export interface ModuleState<T> {
  rows: T[]
  loading: boolean
  error: string | null
  editing: T | null
  searchQuery: string
  importing: boolean
  importPreview: ImportPreview | null
  selectedIds: Set<string>
}
