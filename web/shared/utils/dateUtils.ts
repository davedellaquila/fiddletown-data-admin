/**
 * Shared date utility functions
 * 
 * These functions must behave identically in both TypeScript and Swift implementations.
 * See docs/SHARED_LOGIC.md for business logic contracts.
 * 
 * @see docs/SHARED_LOGIC.md - Business logic contracts
 * @see web/shared/utils/README.md - Detailed documentation and test cases
 */

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 * 
 * Uses ISO 8601 date format with UTC timezone for consistency.
 * 
 * @param date - JavaScript Date object to format
 * @returns ISO date string in format YYYY-MM-DD
 * 
 * @example
 * ```typescript
 * formatISO(new Date(2024, 0, 15)) // "2024-01-15"
 * formatISO(new Date(2024, 11, 31)) // "2024-12-31"
 * ```
 * 
 * @see docs/SHARED_LOGIC.md#date-formatting
 */
export function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Format time string to 12-hour AM/PM format
 * 
 * Converts 24-hour time format (HH:MM or HH:MM:SS) to 12-hour format with AM/PM.
 * 
 * @param timeStr - Time string in 24-hour format (HH:MM or HH:MM:SS), or null
 * @returns 12-hour format string (e.g., "2:30 PM") or "—" for null input
 * 
 * @example
 * ```typescript
 * formatTimeToAMPM("00:30") // "12:30 AM"
 * formatTimeToAMPM("09:15") // "9:15 AM"
 * formatTimeToAMPM("14:30") // "2:30 PM"
 * formatTimeToAMPM(null) // "—"
 * ```
 * 
 * @see docs/SHARED_LOGIC.md#time-formatting
 */
export function formatTimeToAMPM(timeStr: string | null): string {
  if (!timeStr) return '—'
  
  // Handle both HH:MM and HH:MM:SS formats
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!timeMatch) return timeStr
  
  const hours = parseInt(timeMatch[1])
  const minutes = timeMatch[2]
  
  if (hours === 0) {
    return `12:${minutes} AM`
  } else if (hours < 12) {
    return `${hours}:${minutes} AM`
  } else if (hours === 12) {
    return `12:${minutes} PM`
  } else {
    return `${hours - 12}:${minutes} PM`
  }
}

/**
 * Convert time string to 24-hour format (HH:MM)
 * 
 * Supports multiple input formats and converts them to 24-hour format.
 * Handles abbreviated formats, 12-hour format, 24-hour format, and single numbers.
 * 
 * @param timeStr - Time string in various formats (see examples)
 * @param isEndTime - Whether this is an end time (affects AM/PM inference for ambiguous cases)
 * @param startTime - Start time for context when inferring AM/PM for end times
 * @returns 24-hour format string (HH:MM) or null if invalid
 * 
 * @example
 * ```typescript
 * convertTo24Hour("2:30 PM") // "14:30"
 * convertTo24Hour("9:15 AM") // "09:15"
 * convertTo24Hour("2p") // "14:00"
 * convertTo24Hour("7", false) // "07:00" (start time)
 * convertTo24Hour("7", true) // "19:00" (end time)
 * convertTo24Hour("invalid") // null
 * ```
 * 
 * Supported formats:
 * - Abbreviated: "2p", "9a", "2:30p", "12a"
 * - 12-hour: "2:30 PM", "9:15 AM", "12:00 PM"
 * - 24-hour: "14:30", "09:15"
 * - Single number with suffix: "1P", "9A", "12P"
 * - Single number: "7", "9", "10", "11", "12"
 * 
 * @see docs/SHARED_LOGIC.md#time-formatting
 */
export function convertTo24Hour(
  timeStr: string | null, 
  isEndTime: boolean = false, 
  startTime?: string | null
): string | null {
  if (!timeStr || timeStr === null) return null
  
  // Handle abbreviated formats (e.g., "2p", "9a", "2:30p", "12a")
  const abbrevMatch = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m?)$/i)
  if (abbrevMatch) {
    let hours = parseInt(abbrevMatch[1])
    const minutes = abbrevMatch[2] ? abbrevMatch[2] : '00'
    const ampm = abbrevMatch[3].toLowerCase()
    
    if (ampm.startsWith('a')) {
      if (hours === 12) hours = 0
    } else { // PM
      if (hours !== 12) hours += 12
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }
  
  // Handle 12-hour format (e.g., "2:30 PM", "9:15 AM", "12:00 PM")
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/)
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1])
    const minutes = ampmMatch[2]
    const ampm = ampmMatch[3].toUpperCase()
    
    if (ampm === 'AM') {
      if (hours === 12) hours = 0
    } else { // PM
      if (hours !== 12) hours += 12
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }
  
  // Handle 24-hour format (e.g., "14:30", "09:15")
  const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/)
  if (time24Match) {
    let hours = parseInt(time24Match[1])
    const minutes = time24Match[2]
    
    // For end_time, if the hour is 1-11, assume it's PM
    if (isEndTime && hours >= 1 && hours <= 11) {
      hours += 12
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`
  }
  
  // Handle single numbers with P/A suffix (e.g., "1P", "9A", "12P")
  const singleWithSuffixMatch = timeStr.match(/^(\d{1,2})([AP])$/i)
  if (singleWithSuffixMatch) {
    let hours = parseInt(singleWithSuffixMatch[1])
    const ampm = singleWithSuffixMatch[2].toUpperCase()
    
    if (ampm === 'A') {
      if (hours === 12) hours = 0
    } else { // PM
      if (hours >= 1 && hours <= 11) {
        hours += 12
      }
    }
    return `${hours.toString().padStart(2, '0')}:00`
  }
  
  // Handle single numbers (e.g., "7", "9", "10", "11", "12")
  const singleNumberMatch = timeStr.match(/^(\d{1,2})$/)
  if (singleNumberMatch) {
    let hours = parseInt(singleNumberMatch[1])
    
    if (hours >= 1 && hours <= 9) {
      if (isEndTime) {
        if (startTime && startTime !== null) {
          const startHour = parseInt(startTime.split(':')[0])
          if (startHour >= 0 && startHour <= 11) {
            if (hours < startHour) {
              hours += 12
            }
          } else {
            hours += 12
          }
        } else {
          hours += 12
        }
      }
      return `${hours.toString().padStart(2, '0')}:00`
    } else if (hours === 10 || hours === 11) {
      if (isEndTime) {
        if (startTime && startTime !== null) {
          const startHour = parseInt(startTime.split(':')[0])
          if (startHour >= 0 && startHour <= 11) {
            if (hours < startHour) {
              hours += 12
            }
          } else {
            hours += 12
          }
        } else {
          hours += 12
        }
      }
      return `${hours.toString().padStart(2, '0')}:00`
    } else if (hours === 12) {
      return '12:00'
    }
  }
  
  return null
}

/**
 * Normalize URL string (add https:// if missing)
 * 
 * Ensures URLs have a protocol prefix. If the URL already has http:// or https://,
 * it is returned as-is. Otherwise, https:// is prepended.
 * 
 * @param u - URL string to normalize, or null/undefined
 * @returns Normalized URL string with protocol, or empty string for null/empty input
 * 
 * @example
 * ```typescript
 * normalizeUrl("example.com") // "https://example.com"
 * normalizeUrl("https://example.com") // "https://example.com"
 * normalizeUrl("http://example.com") // "http://example.com"
 * normalizeUrl("  example.com  ") // "https://example.com"
 * normalizeUrl(null) // ""
 * ```
 * 
 * @see docs/SHARED_LOGIC.md#url-normalization
 * @deprecated This function will be moved to urlUtils.ts in a future update
 */
export function normalizeUrl(u?: string | null): string {
  if (!u) return ''
  const s = u.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}




