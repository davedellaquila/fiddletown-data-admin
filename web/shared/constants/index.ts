/**
 * Shared constants for the SSA Admin application
 * 
 * These constants ensure consistent usage across both web and iOS applications.
 * When updating constants, also update the Swift constants in:
 * ios/SSA-Admin/Shared/Constants/AppConstants.swift
 * 
 * @see docs/SHARED_CONSTANTS.md - Constants reference documentation
 */

/**
 * Valid status values for locations, events, and routes
 */
export const STATUS_VALUES = ['draft', 'published', 'archived'] as const

/**
 * Valid difficulty values for routes
 */
export const DIFFICULTY_VALUES = ['easy', 'moderate', 'challenging'] as const

/**
 * Default status for new records
 */
export const DEFAULT_STATUS = 'draft' as const

/**
 * Status display labels
 */
export const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
} as const

/**
 * Difficulty display labels
 */
export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging'
} as const

/**
 * Table names in Supabase database
 */
export const TABLES = {
  locations: 'locations',
  events: 'events',
  routes: 'routes',
  keywords: 'keywords'
} as const

/**
 * Default sort order for records
 */
export const DEFAULT_SORT_ORDER = 0

/**
 * Maximum length for text fields
 */
export const MAX_LENGTHS = {
  name: 255,
  slug: 255,
  description: 5000,
  shortDescription: 500
} as const

