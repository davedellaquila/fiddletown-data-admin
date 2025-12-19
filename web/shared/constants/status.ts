/**
 * Shared Status Constants
 * 
 * Status and difficulty options for form dropdowns.
 * These constants ensure consistent display labels across the application.
 * 
 * @module status
 */

/**
 * Status options for select dropdowns
 * 
 * Used in Locations, Events, and Routes modules for status selection.
 * Each option includes an emoji icon and display label.
 */
export const STATUS_OPTIONS = [
  { value: 'draft', label: '📝 Draft' },
  { value: 'published', label: '✅ Published' },
  { value: 'archived', label: '📦 Archived' }
] as const

/**
 * Difficulty options for route select dropdowns
 * 
 * Used in Routes module for difficulty level selection.
 * Each option includes a color-coded emoji and display label.
 */
export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: '🟢 Easy' },
  { value: 'moderate', label: '🟡 Moderate' },
  { value: 'challenging', label: '🔴 Challenging' }
] as const




