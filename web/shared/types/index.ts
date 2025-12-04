/**
 * Shared TypeScript types and constants
 * 
 * Central export point for all shared types and type utilities.
 * This file serves as the single entry point for importing types.
 */

export * from './models'

/**
 * Shared constants for status and difficulty values
 * These constants ensure consistent usage across the application.
 */

/**
 * Valid status values
 */
export const STATUS_VALUES = ['draft', 'published', 'archived'] as const

/**
 * Valid difficulty values
 */
export const DIFFICULTY_VALUES = ['easy', 'moderate', 'challenging'] as const

/**
 * Default status for new records
 */
export const DEFAULT_STATUS: Status = 'draft'

/**
 * Type guards and validation helpers
 */

/**
 * Type guard to check if a string is a valid Status
 */
export function isStatus(value: string): value is Status {
  return STATUS_VALUES.includes(value as Status)
}

/**
 * Type guard to check if a string is a valid Difficulty
 */
export function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTY_VALUES.includes(value as Difficulty)
}

/**
 * Validate that a Location has required fields
 */
export function isValidLocation(location: Partial<Location>): location is Location {
  return (
    typeof location.id === 'string' &&
    typeof location.name === 'string' &&
    location.name.trim().length > 0 &&
    typeof location.status === 'string' &&
    isStatus(location.status) &&
    typeof location.created_at === 'string' &&
    typeof location.updated_at === 'string'
  )
}

/**
 * Validate that an EventRow has required fields
 */
export function isValidEvent(event: Partial<EventRow>): event is EventRow {
  return (
    typeof event.name === 'string' &&
    event.name.trim().length > 0
  )
}

/**
 * Validate that a RouteRow has required fields
 */
export function isValidRoute(route: Partial<RouteRow>): route is RouteRow {
  return (
    typeof route.id === 'string' &&
    typeof route.name === 'string' &&
    route.name.trim().length > 0 &&
    typeof route.status === 'string' &&
    isStatus(route.status) &&
    typeof route.created_at === 'string' &&
    typeof route.updated_at === 'string'
  )
}

