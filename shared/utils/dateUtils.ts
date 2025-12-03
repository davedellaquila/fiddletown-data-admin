/**
 * Shared date utility functions
 */

/**
 * Format a Date object to ISO date string (YYYY-MM-DD)
 */
export function formatISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Format time string to 12-hour AM/PM format
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
 */
export function normalizeUrl(u?: string | null): string {
  if (!u) return ''
  const s = u.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}




