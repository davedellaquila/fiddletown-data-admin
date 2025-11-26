/**
 * Enhanced OCR Text Parser for Event Data Extraction
 * 
 * This module provides improved parsing capabilities for extracting
 * event information from OCR-scanned text, including:
 * - Better date/time parsing with multiple format support
 * - Improved name/title extraction
 * - Enhanced location detection
 * - Better handling of various text formats
 */

export interface ParsedEventData {
  name?: string
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  host_org?: string | null
  website_url?: string | null
  recurrence?: string | null
  description?: string | null
}

const formatISO = (d: Date) => d.toISOString().slice(0, 10)

/**
 * Enhanced date patterns - comprehensive coverage of common formats
 */
const DATE_PATTERNS = [
  // Full date patterns with various separators
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s+\d{4})/i,
  /(\b\d{1,2}\/\d{1,2}\/\d{4})/,
  /(\b\d{1,2}-\d{1,2}-\d{4})/,
  /(\b\d{4}-\d{1,2}-\d{1,2})/,
  /(\b\d{1,2}\.\d{1,2}\.\d{4})/,
  // Day + date patterns
  /(\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  /(\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s+\d{4})/i,
  // Month + day patterns
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})/i,
  // Numeric patterns
  /(\b\d{1,2}\/\d{1,2}\/\d{2,4})/,
  /(\b\d{1,2}-\d{1,2}-\d{2,4})/,
  // Year patterns
  /(\b20\d{2}\b)/,
  // Ordinal dates: "March 15th", "15th of March", "DECEMBER 13TH" (all caps)
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?)/i,
  /(\b\d{1,2}(?:st|nd|rd|th)?\s+of\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i,
  // All caps month names (common in flyers)
  /(\b(?:JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d{1,2}(?:ST|ND|RD|TH)?)/i,
  // Date ranges
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  /(\b\d{1,2}\/\d{1,2}\/\d{4}\s*[-–—]\s*\d{1,2}\/\d{1,2}\/\d{4})/,
]

/**
 * Time patterns - various time formats
 */
const TIME_PATTERNS = [
  /(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)(?:\s*[-–—]\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?))?/i,
  /(\d{1,2}\s*[AaPp][Mm])(?:\s*[-–—]\s*(\d{1,2}\s*[AaPp][Mm]))?/i,
  /(\d{1,2}:\d{2})\s*(?:to|until|-|–|—)\s*(\d{1,2}:\d{2})/i,
]

/**
 * Location indicators - common words/phrases that indicate location
 */
const LOCATION_INDICATORS = [
  /\b(at|@|location|venue|where|address|place|held at|hosted at)\s*:?\s*(.+)/i,
  /\b(\d+\s+[A-Z][a-z]+(?:\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pl|Ct))?[,\s]+[A-Z][a-z]+(?:\s+[A-Z]{2})?\s+\d{5})/i, // Street address
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Theater|Hall|Center|Centre|Auditorium|Room|Building|Campus|Park|Plaza|Square|Museum|Gallery|Library|Cafe|Restaurant|Bar|Club|Venue|Stadium|Arena))/i,
]

/**
 * Website/URL patterns
 */
const URL_PATTERNS = [
  /(https?:\/\/[^\s]+)/i,
  /(www\.[^\s]+)/i,
  /([a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|us)[^\s]*)/i,
]

/**
 * Host organization patterns
 */
const HOST_ORG_PATTERNS = [
  /\b(presented by|hosted by|sponsored by|organized by|by)\s*:?\s*(.+)/i,
  /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Association|Society|Club|Group|Foundation|Institute|Organization|Committee|Council|Board))/i,
]

/**
 * Recurrence patterns
 */
const RECURRENCE_PATTERNS = [
  /\b(annual|yearly|monthly|weekly|daily|bi-weekly|bi-monthly|quarterly|seasonal|every\s+\w+day)/i,
  /\b(every\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)day)/i,
]

/**
 * Convert time string to 24-hour format for HTML time inputs
 */
function convertTo24Hour(timeStr: string): string {
  const cleanTime = timeStr.trim()
  const isPM = /[Pp][Mm]/.test(cleanTime)
  const isAM = /[Aa][Mm]/.test(cleanTime)
  
  // Extract hours and minutes
  const timeMatch = cleanTime.match(/(\d{1,2}):?(\d{2})?/)
  if (!timeMatch) return ''
  
  let hours = parseInt(timeMatch[1])
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
  
  if (isPM && hours !== 12) hours += 12
  if (isAM && hours === 12) hours = 0
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Enhanced date parsing with multiple fallback strategies
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null
  
  const cleaned = dateStr
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Try different parsing approaches
  const attempts = [
    cleaned,
    cleaned.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*,?\s*/i, ''),
    cleaned.replace(/(?:st|nd|rd|th)/gi, ''),
    cleaned.replace(/\bof\s+/gi, ''),
  ]
  
  for (const attempt of attempts) {
    const d = new Date(attempt)
    if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
      return d
    }
  }
  
  // Manual parsing for common formats
  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    const fullYear = year.length === 2 
      ? (parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year))
      : parseInt(year)
    const d = new Date(fullYear, parseInt(month) - 1, parseInt(day))
    if (!isNaN(d.getTime())) return d
  }
  
  // Month DD, YYYY
  const monthMatch = cleaned.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i)
  if (monthMatch) {
    const [, monthName, day, year] = monthMatch
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      .findIndex(m => monthName.toLowerCase().startsWith(m.toLowerCase()))
    if (monthIndex !== -1) {
      const d = new Date(parseInt(year), monthIndex, parseInt(day))
      if (!isNaN(d.getTime())) return d
    }
  }
  
  // Month DD (without year) - infer year based on current date
  // If the date has passed this year, assume next year; otherwise assume this year
  const monthDayMatch = cleaned.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?/i)
  if (monthDayMatch) {
    const [, monthName, day] = monthDayMatch
    const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      .findIndex(m => monthName.toLowerCase().startsWith(m.toLowerCase()))
    if (monthIndex !== -1) {
      const dayNum = parseInt(day)
      const now = new Date()
      const currentYear = now.getFullYear()
      
      // Create date for this year
      const thisYearDate = new Date(currentYear, monthIndex, dayNum)
      
      // If date has passed this year, use next year; otherwise use this year
      const year = (thisYearDate < now) ? currentYear + 1 : currentYear
      const d = new Date(year, monthIndex, dayNum)
      if (!isNaN(d.getTime())) return d
    }
  }
  
  // Handle all-caps month names (DECEMBER 13TH, JANUARY 1ST, etc.)
  const allCapsMonthMatch = cleaned.match(/(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})(?:ST|ND|RD|TH)?/i)
  if (allCapsMonthMatch) {
    const [, monthName, day] = allCapsMonthMatch
    const fullMonthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
    const monthIndex = fullMonthNames.findIndex(m => monthName.toUpperCase().startsWith(m))
    if (monthIndex !== -1) {
      const dayNum = parseInt(day)
      const now = new Date()
      const currentYear = now.getFullYear()
      
      // Create date for this year
      const thisYearDate = new Date(currentYear, monthIndex, dayNum)
      
      // If date has passed this year, use next year; otherwise use this year
      const year = (thisYearDate < now) ? currentYear + 1 : currentYear
      const d = new Date(year, monthIndex, dayNum)
      if (!isNaN(d.getTime())) return d
    }
  }
  
  return null
}

/**
 * Extract location from text
 */
function extractLocation(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of LOCATION_INDICATORS) {
      const match = line.match(pattern)
      if (match && match[2]) {
        const location = match[2].trim()
        // Clean up common OCR artifacts
        const cleaned = location
          .replace(/[|]/g, 'I')
          .replace(/\s+/g, ' ')
          .trim()
        if (cleaned.length > 3) return cleaned
      }
    }
  }
  return null
}

/**
 * Extract website URL from text
 */
function extractWebsite(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of URL_PATTERNS) {
      const match = line.match(pattern)
      if (match && match[1]) {
        let url = match[1].trim()
        if (!url.startsWith('http')) {
          url = 'https://' + url
        }
        return url
      }
    }
  }
  return null
}

/**
 * Extract host organization from text
 */
function extractHostOrg(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of HOST_ORG_PATTERNS) {
      const match = line.match(pattern)
      if (match && match[2]) {
        const org = match[2].trim()
        if (org.length > 2) return org
      }
    }
  }
  return null
}

/**
 * Extract recurrence information
 */
function extractRecurrence(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of RECURRENCE_PATTERNS) {
      const match = line.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
  }
  return null
}

/**
 * Main parsing function - extracts event data from OCR text
 */
export function parseEventText(text: string): ParsedEventData {
  if (!text || !text.trim()) {
    return {}
  }
  
  // Clean and normalize text
  const normalizedText = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I') // Common OCR error: | instead of I
    .replace(/[0O]/g, (match, offset) => {
      // Context-aware replacement (simplified)
      return match
    })
  
  const lines = normalizedText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
  
  if (lines.length === 0) return {}
  
  // Find lines that contain dates - these are NOT title candidates
  const dateLines: number[] = []
  let dateLine = ''
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    let hasDate = false
    
    for (const pattern of DATE_PATTERNS) {
      if (pattern.test(line)) {
        hasDate = true
        if (!dateLine) {
          dateLine = line // Use first date line found
        }
        break
      }
    }
    
    if (hasDate) {
      dateLines.push(i)
    }
  }
  
  // Helper function to check if a line looks like an address
  const isAddressLine = (line: string): boolean => {
    return /\d+\s+[A-Z][a-z]+(?:\s+(?:St|Ave|Rd|Blvd|Dr|Ln|Way|Pl|Ct|Street|Avenue|Road|Boulevard|Drive|Lane))/.test(line) ||
           /\d{5}/.test(line) || // Zip code
           /^[A-Z][a-z]+,\s*[A-Z]{2}/.test(line) || // City, State format
           /United States/.test(line) // "United States" in address
  }
  
  // Helper function to check if a line is just a time
  const isTimeOnlyLine = (line: string): boolean => {
    return /^\d{1,2}:\d{2}/.test(line) && line.length < 30
  }
  
  // Helper function to check if a line contains a date pattern
  const containsDate = (line: string): boolean => {
    return DATE_PATTERNS.some(p => p.test(line))
  }
  
  // Extract name/title - find the best candidate from non-date lines
  let name = ''
  let bestTitleCandidate = ''
  let bestTitleScore = -1
  
  // Title keywords that suggest this is the event name
  const titleKeywords = /\b(MARKET|EVENT|FESTIVAL|SHOW|CONCERT|FAIR|CELEBRATION|GATHERING|MEETING|WORKSHOP|CLASS|TOUR|TRAIL|RACE|RUN|WALK|TALK|LECTURE|PERFORMANCE|EXHIBITION|GALLERY|OPENING|CLOSING|PARTY|GALA|DINNER|LUNCH|BREAKFAST|BRUNCH|TEA|TASTING|TOUR|TRAIL)\b/i
  
  // Helper to score a line as a potential title
  const scoreTitle = (line: string): number => {
    let score = 0
    
    // All caps lines are often titles (common in flyers)
    if (line === line.toUpperCase() && line.length > 5) {
      score += 50
    }
    
    // Lines with title keywords get bonus points
    if (titleKeywords.test(line)) {
      score += 30
    }
    
    // Prefer lines that are 2-5 words (typical title length)
    const wordCount = line.split(/\s+/).filter(w => w.length > 0).length
    if (wordCount >= 2 && wordCount <= 5) {
      score += 20
    }
    
    // Prefer lines that are not too long (descriptions are usually longer)
    if (line.length >= 10 && line.length <= 60) {
      score += 10
    }
    
    // Penalize lines that look like descriptions (contain "for", "with", "including", etc.)
    if (/\b(for|with|including|featuring|presented|hosted|sponsored)\b/i.test(line)) {
      score -= 20
    }
    
    return score
  }
  
  for (let i = 0; i < lines.length; i++) {
    // Skip lines that contain dates
    if (dateLines.includes(i)) {
      continue
    }
    
    const line = lines[i].trim()
    
    // Skip empty lines, addresses, and time-only lines
    if (!line || isAddressLine(line) || isTimeOnlyLine(line)) {
      continue
    }
    
    // Score this line as a potential title
    const score = scoreTitle(line)
    if (score > bestTitleScore) {
      bestTitleScore = score
      bestTitleCandidate = line
    }
  }
  
  // Use the best candidate found
  if (bestTitleCandidate) {
    name = bestTitleCandidate
  } else if (lines.length > 0) {
    // Fallback: use first non-date line
    for (const line of lines) {
      if (!containsDate(line) && !isAddressLine(line) && !isTimeOnlyLine(line)) {
        name = line.trim()
        break
      }
    }
  }
  
  // Clean up the name - remove common OCR artifacts
  name = name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[|]/g, '') // Remove leading pipe characters
    .replace(/[|]$/g, '') // Remove trailing pipe characters
    .replace(/^[-–—]\s*/, '') // Remove leading dashes
    .replace(/\s*[-–—]$/, '') // Remove trailing dashes
  
  // Parse dates
  // Logic matches Edit form: if only start_date is provided, use it as end_date
  // If end_date is explicitly provided, use the provided end_date
  let startDate: string | null = null
  let endDate: string | null = null
  
  if (dateLine) {
    // Check for date range (e.g., "March 15 - March 20, 2024")
    const rangeMatch = dateLine.match(/(.+?)\s*[-–—]\s*(.+)/)
    if (rangeMatch) {
      const start = parseDate(rangeMatch[1])
      const end = parseDate(rangeMatch[2])
      if (start) startDate = formatISO(start)
      if (end) {
        endDate = formatISO(end) // Explicit end date provided
      } else if (start) {
        endDate = formatISO(start) // No end date parsed, default to start_date
      }
    } else {
      // Single date found
      const parsed = parseDate(dateLine)
      if (parsed) {
        startDate = formatISO(parsed)
        endDate = formatISO(parsed) // Default to same date when only start_date is provided
      }
    }
  }
  
  // Final check: ensure end_date matches Edit form logic
  // If start_date exists but end_date doesn't, set end_date = start_date
  if (startDate && !endDate) {
    endDate = startDate
  }
  
  // Extract times
  let startTime: string | null = null
  let endTime: string | null = null
  
  const timeLine = dateLine || lines.join(' ')
  for (const pattern of TIME_PATTERNS) {
    const match = timeLine.match(pattern)
    if (match) {
      startTime = convertTo24Hour(match[1])
      if (match[2]) {
        endTime = convertTo24Hour(match[2])
      }
      break
    }
  }
  
  // Extract other fields
  const location = extractLocation(lines)
  const website_url = extractWebsite(lines)
  const host_org = extractHostOrg(lines)
  const recurrence = extractRecurrence(lines)
  
  // Description: first 500 characters of full text
  const description = normalizedText.substring(0, 500).trim() || null
  
  return {
    name: name || undefined,
    start_date: startDate || null,
    end_date: endDate || null,
    start_time: startTime || null,
    end_time: endTime || null,
    location: location || null,
    host_org: host_org || null,
    website_url: website_url || null,
    recurrence: recurrence || null,
    description: description || null,
  }
}

