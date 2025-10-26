import { ModuleConfig, ColumnConfig } from '../types'

export const locationsConfig: ModuleConfig = {
  tableName: 'locations',
  displayName: 'Locations',
  icon: '📍',
  searchFields: ['name', 'region'],
  importFields: ['name', 'slug', 'region', 'short_description', 'website_url', 'status', 'sort_order'],
  exportFields: ['name', 'slug', 'region', 'short_description', 'website_url', 'status', 'sort_order'],
  columns: [
    { key: 'name', label: 'Name', type: 'text', required: true, width: '200px' },
    { key: 'region', label: 'Region', type: 'text', width: '150px' },
    { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'], width: '120px' },
    { key: 'website_url', label: 'Website', type: 'url', width: '120px' }
  ]
}

export const eventsConfig: ModuleConfig = {
  tableName: 'events',
  displayName: 'Events',
  icon: '📅',
  searchFields: ['name', 'host_org', 'location'],
  importFields: ['name', 'slug', 'host_org', 'start_date', 'end_date', 'start_time', 'end_time', 'location', 'recurrence', 'website_url', 'image_url', 'status', 'sort_order'],
  exportFields: ['name', 'slug', 'host_org', 'start_date', 'end_date', 'start_time', 'end_time', 'location', 'recurrence', 'website_url', 'image_url', 'status', 'sort_order'],
  columns: [
    { key: 'name', label: 'Name', type: 'text', required: true, width: '200px' },
    { key: 'start_date', label: 'Start', type: 'date', width: '100px' },
    { key: 'end_date', label: 'End', type: 'date', width: '100px' },
    { key: 'start_time', label: 'Start Time', type: 'time', width: '100px' },
    { key: 'end_time', label: 'End Time', type: 'time', width: '100px' },
    { key: 'location', label: 'Location', type: 'text', width: '150px' },
    { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'], width: '120px' },
    { key: 'website_url', label: 'Website', type: 'url', width: '120px' },
    { key: 'image_url', label: 'Image', type: 'image', width: '80px' }
  ]
}

export const routesConfig: ModuleConfig = {
  tableName: 'routes',
  displayName: 'Routes',
  icon: '🗺️',
  searchFields: ['name', 'start_point', 'end_point'],
  importFields: ['name', 'slug', 'duration_minutes', 'start_point', 'end_point', 'difficulty', 'notes', 'status', 'sort_order'],
  exportFields: ['name', 'slug', 'duration_minutes', 'start_point', 'end_point', 'difficulty', 'notes', 'status', 'sort_order'],
  columns: [
    { key: 'name', label: 'Name', type: 'text', required: true, width: '200px' },
    { key: 'duration_minutes', label: 'Duration', type: 'number', width: '100px' },
    { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['easy', 'moderate', 'challenging'], width: '120px' },
    { key: 'gpx_url', label: 'GPX', type: 'url', width: '120px' },
    { key: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'], width: '120px' }
  ]
}
