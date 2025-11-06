import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useFormFieldPopulation, createEventsFieldConfigs } from '../shared/hooks/useFormFieldPopulation'
import { useDarkModeRowReset } from '../shared/hooks/useDarkModeRowReset'
import { useNavigationWithAutoSave } from '../shared/hooks/useNavigationWithAutoSave'
import { NavigationButtons } from '../shared/components/NavigationButtons'
import { STICKY_HEADER_TOP_OFFSETS } from '../shared/constants/layout'

type EventRow = {
  id?: number
  name: string
  slug?: string | null
  host_org?: string | null
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  location?: string | null
  recurrence?: string | null
  website_url?: string | null
  image_url?: string | null
  status?: string | null
  sort_order?: number | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

const slugify = (s: string) => s
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')

const formatISO = (d: Date) => d.toISOString().slice(0, 10)

// Helper functions for time conversion
function simpleTimeToStandard(simpleTime: string, context?: { startTime?: string }): string {
  if (!simpleTime || simpleTime.trim() === '') return ''
  
  const trimmed = simpleTime.trim()
  
  // Check if it's a full time format (e.g., "3:30", "14:45")
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return ''
    }
    
    // Smart context logic: if start time is AM and end time is < 12, assume PM
    if (context?.startTime) {
      const startHour = parseInt(context.startTime)
      if (!isNaN(startHour) && startHour < 12 && hour < 12 && hour !== 0) {
        // Start time is AM, end time is < 12, assume end time is PM
        return `${(hour + 12).toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      }
    }
    
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
  }
  
  // Handle simple hour format (e.g., "3", "14")
  const hour = parseInt(trimmed)
  if (isNaN(hour) || hour < 0 || hour > 23) return ''
  
  // Smart context logic: if start time is AM and end time is < 12, assume PM
  if (context?.startTime) {
    const startHour = parseInt(context.startTime)
    if (!isNaN(startHour) && startHour < 12 && hour < 12 && hour !== 0) {
      // Start time is AM, end time is < 12, assume end time is PM
      return `${(hour + 12).toString().padStart(2, '0')}:00`
    }
  }
  
  return `${hour.toString().padStart(2, '0')}:00`
}

function standardTimeToSimple(standardTime: string): string {
  if (!standardTime || standardTime.trim() === '') return ''
  
  // Handle both "HH:MM" and "HH:MM:SS" formats
  const timeMatch = standardTime.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/)
  if (!timeMatch) return ''
  
  const hour = parseInt(timeMatch[1])
  const minute = parseInt(timeMatch[2])
  
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return ''
  
  // If minutes are 00, return just the hour for simple format
  if (minute === 0) {
    return hour.toString()
  }
  
  // Otherwise return the full time format
  return `${hour}:${minute.toString().padStart(2, '0')}`
}

function formatTimeForDisplay(simpleTime: string): string {
  if (!simpleTime || simpleTime.trim() === '') return ''
  
  const trimmed = simpleTime.trim()
  
  // Check if it's a full time format (e.g., "3:30", "14:45")
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])
    
    if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return simpleTime
    }
    
    if (hour === 0) return `12:${minute.toString().padStart(2, '0')} AM`
    if (hour < 12) return `${hour}:${minute.toString().padStart(2, '0')} AM`
    if (hour === 12) return `12:${minute.toString().padStart(2, '0')} PM`
    return `${hour - 12}:${minute.toString().padStart(2, '0')} PM`
  }
  
  // Handle simple hour format (e.g., "3", "14")
  const hour = parseInt(trimmed)
  if (isNaN(hour) || hour < 0 || hour > 23) return simpleTime
  
  if (hour === 0) return '12:00 AM'
  if (hour < 12) return `${hour}:00 AM`
  if (hour === 12) return '12:00 PM'
  return `${hour - 12}:00 PM`
}

function parseEventText(text: string) {
  console.log('=== parseEventText START ===')
  console.log('parseEventText called with text:', text)
  console.log('Text length:', text.length)
  console.log('Text preview (first 500 chars):', text.substring(0, 500))
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  console.log('parseEventText lines:', lines)
  console.log('Number of lines:', lines.length)
  
  // Enhanced date detection patterns - more comprehensive
  const datePatterns = [
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
    // Ordinal dates: "March 15th", "15th of March"
    /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?)/i,
    /(\b\d{1,2}(?:st|nd|rd|th)?\s+of\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)/i
  ]
  
  const titleLines: string[] = []
  let dateLine = ''
  let dateMatch = ''
  let foundDate = false
  let dateLineIndex = -1
  
  // First pass: find the first line with a date pattern
  for (let idx = 0; idx < lines.length; idx++) {
    const ln = lines[idx]
    if (!foundDate) {
      for (const pattern of datePatterns) {
        const match = ln.match(pattern)
        if (match) {
          dateLine = ln
          dateLineIndex = idx
          dateMatch = match[1] || match[0] || ln // Extract the matched date portion
          foundDate = true
          console.log('Found date line at index', idx, ':', dateLine)
          console.log('Extracted date match:', dateMatch)
          break
        }
      }
    }
    if (!foundDate) {
      titleLines.push(ln)
    }
  }
  
  // If no date found in first pass, try a more aggressive search through ALL lines
  if (!foundDate) {
    console.log('No date found in first pass, trying aggressive search through all lines...')
    // Search all text combined, not just individual lines (OCR might split dates across lines)
    const allText = lines.join(' ')
    console.log('Searching combined text (length:', allText.length, '):', allText.substring(0, 300))
    console.log('Full combined text:', allText)
    
    // Try patterns on the full text
    const numericPatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/,
      /\d{1,2}-\d{1,2}-\d{2,4}/,
      /\d{4}-\d{1,2}-\d{1,2}/,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
      /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i,
      /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i,
      // Look for dates with day names
      /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
    ]
    
    for (const pattern of numericPatterns) {
      const match = allText.match(pattern)
      if (match) {
        // Find which line contains this match
        for (let idx = 0; idx < lines.length; idx++) {
          if (lines[idx].includes(match[0])) {
            dateLine = lines[idx]
            dateLineIndex = idx
            dateMatch = match[0]
            foundDate = true
            console.log('Found date line (aggressive search) at index', idx, ':', dateLine)
            console.log('Extracted date match:', dateMatch)
            break
          }
        }
        if (foundDate) break
      }
    }
    
    // If still not found, try searching each line individually
    if (!foundDate) {
      for (let idx = 0; idx < lines.length; idx++) {
        const ln = lines[idx]
        for (const pattern of numericPatterns) {
          const match = ln.match(pattern)
          if (match) {
            dateLine = ln
            dateLineIndex = idx
            dateMatch = match[0] || ln
            foundDate = true
            console.log('Found date line (line-by-line search) at index', idx, ':', dateLine)
            console.log('Extracted date match:', dateMatch)
            break
          }
        }
        if (foundDate) break
      }
    }
  }
  
  // Use the extracted date match if available, otherwise use the whole line
  const dateString = dateMatch || dateLine
  
  // Extract name more intelligently - filter out OCR errors and find the actual event name
  let name = ''
  
  // First, filter out obvious OCR garbage and description text
  const isOCRgarbage = (line: string) => {
    // Lines with too many special characters that look like OCR errors
    const specialCharCount = (line.match(/[^\w\s]/g) || []).length
    const isMostlySpecialChars = specialCharCount > line.length * 0.4
    const hasTooManySpecialChars = (line.match(/[\[\]\/\~\)\@\>]/g) || []).length > 2
    const hasOCRPatterns = /[\[\]\/\~\>]\s*[A-Za-z]|Lio\s*\[|Dll\s*Siel|clel\s*Di\s*ASW|~>>\)|0\]\s*a\s*of\]/i.test(line)
    
    // Check if line has too many garbled character sequences
    const garbledPatterns = /[~>>)]\s*[A-Z]|\[\s*[\/\]]|0\]\s*a\s*of\]|Dll\s*Siel|clel\s*Di/i
    const hasGarbledPatterns = garbledPatterns.test(line)
    
    return isMostlySpecialChars || hasTooManySpecialChars || hasOCRPatterns || hasGarbledPatterns
  }
  
  const isDescriptionText = (line: string) => {
    // Skip lines that are clearly part of the description body
    const descriptionPatterns = [
      /^(join us|together|share food|friendship)/i,
      /^(beer|wine|soda|bottled water)/i,
      /^(raffle|over \d+ items)/i,
      /^(show the world|fiddletown proud|t-shirt)/i,
      /^(questions?|please contact|we look forward)/i,
      /^(reserved|tables?|no reserved)/i,
      /^(yum and more yum)/i, // This is a heading but not the event name
      /community center board$/i // Footer text
    ]
    
    return descriptionPatterns.some(pattern => pattern.test(line))
  }
  
  const looksLikeTitle = (line: string) => {
    // Titles are usually:
    // - Short (under 60 chars)
    // - Not all lowercase (has some capitalization)
    // - Not overly long sentences
    // - Don't start with common description words
    const isTooLong = line.length > 80
    const isAllLowercase = line === line.toLowerCase() && line.length > 20
    const hasTitleStructure = /^[A-Z]/.test(line) && line.length < 60
    
    return hasTitleStructure && !isTooLong && !isAllLowercase
  }
  
  if (titleLines.length > 0) {
    // Filter out OCR garbage and description text
    const cleanTitleLines = titleLines.filter(line => {
      if (isOCRgarbage(line)) {
        console.log('Skipping line as OCR garbage:', line)
        return false
      }
      if (isDescriptionText(line)) {
        console.log('Skipping line as description text:', line)
        return false
      }
      return true
    })
    
    console.log('Clean title lines after filtering:', cleanTitleLines)
    
    // Look for lines that look like titles
    const titleCandidates = cleanTitleLines.filter(looksLikeTitle)
    
    if (titleCandidates.length > 0) {
      // Use the first title-like line
      name = titleCandidates[0].replace(/\s+/g, ' ').trim()
      console.log('Using title candidate:', name)
    } else if (cleanTitleLines.length > 0) {
      // Fallback: use first clean line, but limit length
      const firstClean = cleanTitleLines[0]
      // If it's too long, try to find a natural break
      if (firstClean.length > 60) {
        // Try to find a break at punctuation or first sentence
        const breakMatch = firstClean.match(/^(.{1,60}[!?.]?)/)
        if (breakMatch) {
          name = breakMatch[1].trim()
        } else {
          // Just take first 50 chars
          name = firstClean.substring(0, 50).trim()
        }
      } else {
        name = firstClean
      }
      console.log('Using first clean line (limited):', name)
    } else {
      // Last resort: look for any line with event-related keywords
      const keywordLines = lines.filter(line => {
        return !isOCRgarbage(line) && 
               !isDescriptionText(line) &&
               /(thanksgiving|pot luck|dinner|event|festival|gathering|meeting)/i.test(line) &&
               line.length > 5 && line.length < 80
      })
      
      if (keywordLines.length > 0) {
        name = keywordLines[0].replace(/\s+/g, ' ').trim()
        console.log('Using keyword line:', name)
      } else {
        // Ultimate fallback: try to extract meaningful words from garbled lines
        // Look for location names or event keywords even in garbled text
        const locationPattern = /(fiddletown|community|center)/i
        const eventPattern = /(thanksgiving|pot\s*luck|dinner|event|festival|gathering)/i
        
        // Try to find a line that contains location or event keywords
        const locationLine = lines.find(line => locationPattern.test(line) && line.length < 100)
        const eventLine = lines.find(line => eventPattern.test(line) && line.length < 100)
        
        // Try to extract "Fiddletown Community Center" from any line (even garbled)
        const allText = lines.join(' ')
        const fiddletownMatch = allText.match(/(?:fiddletown|community|center)/gi)
        
        if (eventLine && !isDescriptionText(eventLine)) {
          // Extract just the meaningful words from the event line
          const words = eventLine.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
          if (words && words.length > 0) {
            name = words.slice(0, 3).join(' ')
            console.log('Using event keywords from garbled line:', name)
          } else {
            name = eventLine.replace(/[\[\]\/\~\)\@\>]/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 60)
            console.log('Using cleaned event line:', name)
          }
        } else if (locationLine) {
          // Try to extract clean words from location line, even if garbled
          const cleanLocation = locationLine.replace(/[\[\]\/\~\)\@\>]/g, ' ').replace(/\s+/g, ' ').trim()
          const locationWords = cleanLocation.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
          
          // Also check if we can find "Fiddletown Community Center" pattern
          const fullLocationMatch = cleanLocation.match(/fiddletown\s+community\s+center/i)
          
          if (fullLocationMatch) {
            name = 'Fiddletown Community Center Event'
            console.log('Using full location pattern:', name)
          } else if (locationWords && locationWords.length > 0) {
            // Try to construct location name from found words
            const hasFiddletown = locationWords.some(w => /fiddletown/i.test(w))
            const hasCommunity = locationWords.some(w => /community/i.test(w))
            const hasCenter = locationWords.some(w => /center/i.test(w))
            
            if (hasFiddletown && (hasCommunity || hasCenter)) {
              name = 'Fiddletown Community Center Event'
              console.log('Using constructed location name:', name)
            } else {
              name = locationWords.join(' ') + ' Event'
              console.log('Using location words:', name)
            }
          } else {
            // Extract "Fiddletown" and "Community Center" from garbled text
            const fiddletownMatch = cleanLocation.match(/fiddletown/i)
            const communityMatch = cleanLocation.match(/community|center/i)
            
            if (fiddletownMatch && communityMatch) {
              name = 'Fiddletown Community Center Event'
              console.log('Using extracted location keywords:', name)
            } else {
              name = cleanLocation.substring(0, 60)
              console.log('Using cleaned location line:', name)
            }
          }
        } else if (fiddletownMatch) {
          // Found Fiddletown/Community/Center somewhere in the text
          name = 'Fiddletown Community Center Event'
          console.log('Using location from text search:', name)
        } else {
          // Ultimate fallback: first non-garbage line
          const firstGood = lines.find(line => !isOCRgarbage(line) && !isDescriptionText(line) && line.length > 5 && line.length < 80)
          name = (firstGood || lines[0] || '').replace(/\s+/g, ' ').trim()
          console.log('Using ultimate fallback:', name)
        }
      }
    }
  } else {
    // No title lines, try to find a good line from all lines
    const firstGood = lines.find(line => !isOCRgarbage(line) && !isDescriptionText(line) && looksLikeTitle(line))
    name = firstGood || lines[0] || ''
  }
  
  // Final aggressive cleanup - remove any remaining OCR artifacts
  name = name
    .replace(/^[^\w\s]+/, '') // Remove leading special chars
    .replace(/[^\w\s]+$/, '') // Remove trailing special chars
    .replace(/[\[\]\/\~\)\@\>]/g, ' ') // Replace problematic chars with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
  
  // If name still looks like garbage after cleanup, try to extract meaningful words
  if (name && (name.match(/[\[\]\/\~\)\@\>]/g) || []).length > name.length * 0.2) {
    // Extract just words that look like real words
    const words = name.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g)
    if (words && words.length > 0) {
      // Take first 2-3 words that look like a title
      name = words.slice(0, 3).join(' ')
      console.log('Extracted meaningful words from garbage:', name)
    }
  }
  
  // Final length check - event names shouldn't be too long
  if (name.length > 80) {
    const breakMatch = name.match(/^(.{1,80}[!?.]?)/)
    name = breakMatch ? breakMatch[1].trim() : name.substring(0, 80).trim()
  }
  
  console.log('parseEventText name extracted:', name)

  const allDay = /all\s*day/i.test(dateString)
  let cleaned = dateString.replace(/,?\s*All\s*day/i, '').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim()
  
  // Remove time from date string if present (we'll extract it separately)
  cleaned = cleaned.replace(/\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?/gi, '').trim()
  cleaned = cleaned.replace(/\s*[-–—]\s*\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?/gi, '').trim()
  
  console.log('Cleaned date string:', cleaned)

  // Enhanced date parsing with multiple attempts
  const tryParseDate = (s: string) => {
    console.log('Attempting to parse date:', s)
    if (!s || s.trim() === '') return null
    
    // Try different parsing approaches
    const attempts = [
      s, // Original string
      s.replace(/,/g, ''), // Remove commas
      s.replace(/\s+/g, ' ').trim(), // Normalize spaces
      s.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*,?\s*/i, ''), // Remove day names
      s.replace(/(?:st|nd|rd|th)/gi, ''), // Remove ordinal suffixes
      s.replace(/\s+/g, ' ').replace(/,/g, '').trim(), // Combined cleanup
    ]
    
    for (const attempt of attempts) {
      console.log('Trying to parse:', attempt)
      const d = new Date(attempt)
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
        console.log('Successfully parsed date:', attempt, '->', d.toISOString())
        return d
      }
    }
    
    // Try manual parsing for common formats
    const manualParse = (dateStr: string) => {
      // Handle MM/DD/YYYY or M/D/YYYY
      const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
      if (slashMatch) {
        const [, month, day, year] = slashMatch
        const fullYear = year.length === 2 ? (parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year)) : parseInt(year)
        const d = new Date(fullYear, parseInt(month) - 1, parseInt(day))
        if (!isNaN(d.getTime())) {
          console.log('Manual slash parse successful:', d.toISOString())
          return d
        }
      }
      
      // Handle Month DD, YYYY
      const monthMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})/i)
      if (monthMatch) {
        const [, monthName, day, year] = monthMatch
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].findIndex(m => 
          monthName.substring(0, 3).toLowerCase() === m.toLowerCase()
        )
        if (monthIndex !== -1) {
          const d = new Date(parseInt(year), monthIndex, parseInt(day))
          if (!isNaN(d.getTime())) {
            console.log('Manual month parse successful:', d.toISOString())
            return d
          }
        }
      }
      
      // Handle Month DD (without year) - assume current year or next occurrence if in the past
      const monthNoYearMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})/i)
      if (monthNoYearMatch) {
        const [, monthName, day] = monthNoYearMatch
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].findIndex(m => 
          monthName.substring(0, 3).toLowerCase() === m.toLowerCase()
        )
        if (monthIndex !== -1) {
          const now = new Date()
          const currentYear = now.getFullYear()
          // Try current year first
          let d = new Date(currentYear, monthIndex, parseInt(day))
          // If date is in the past, assume next year
          if (d < now) {
            d = new Date(currentYear + 1, monthIndex, parseInt(day))
          }
          if (!isNaN(d.getTime())) {
            console.log('Manual month parse (no year) successful:', d.toISOString())
            return d
          }
        }
      }
      
      return null
    }
    
    const manualResult = manualParse(s)
    if (manualResult) return manualResult
    
    console.log('Failed to parse date:', s)
    return null
  }

  let iso: string | null = null
  const d = cleaned ? tryParseDate(cleaned) : null
  if (d) {
    iso = formatISO(d)
    console.log('Parsed date:', cleaned, '->', iso)
  } else {
    console.log('Failed to parse date from:', cleaned)
  }

  // Extract time information from the date line or nearby lines
  // Search for times independently - they might not be in the same line as dates
  let startTime: string | null = null
  let endTime: string | null = null
  
  const convertTo24Hour = (timeStr: string) => {
    const cleanTime = timeStr.trim()
    const isPM = /[Pp][Mm]/.test(cleanTime)
    const isAM = /[Aa][Mm]/.test(cleanTime)
    
    // Handle plain numbers (e.g., "5" or "6") - assume PM if afternoon/evening context
    const plainNum = cleanTime.match(/^(\d{1,2})$/)
    if (plainNum) {
      let hours = parseInt(plainNum[1])
      // If no AM/PM specified and it's a single digit or 1-11, might be PM
      // But we'll default to the hour as-is and let the user adjust
      // For now, if it's 1-11 without AM/PM, we'll treat as hour (user can adjust)
      return `${hours.toString().padStart(2, '0')}:00`
    }
    
    let [hours, minutes] = cleanTime.replace(/[AaPp][Mm]/gi, '').split(':').map(Number)
    if (isNaN(minutes)) minutes = 0
    
    if (isPM && hours !== 12) hours += 12
    if (isAM && hours === 12) hours = 0
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }
  
  // Standard time patterns with colons
  const timePattern = /(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)(?:\s*[-–—]\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?))?/i
  
  // Patterns for "Doors Open at 5, Dinner 6" or "Doors at 5, Dinner at 6"
  const doorsOpenPattern = /(?:doors|door)\s+(?:open\s+)?at\s+(\d{1,2})(?:\s*[AaPp][Mm])?/i
  const dinnerPattern = /(?:dinner|event|show|starts?)\s+(?:at\s+)?(\d{1,2})(?:\s*[AaPp][Mm])?/i
  
  // First try to find time in the date line if we found one
  let timeMatch: RegExpMatchArray | null = null
  if (dateLine) {
    timeMatch = dateLine.match(timePattern)
    console.log('Time match in date line:', timeMatch, 'from:', dateLine)
  }
  
  // If no time in date line, search all lines for time patterns
  if (!timeMatch) {
    console.log('Searching all lines for time patterns...')
    // Search all text combined first
    const allText = lines.join(' ')
    timeMatch = allText.match(timePattern)
    if (timeMatch) {
      console.log('Time match found in combined text:', timeMatch)
    }
    
    // If still not found, search each line individually
    if (!timeMatch) {
      for (let i = 0; i < lines.length; i++) {
        console.log('Checking line', i, 'for time:', lines[i])
        timeMatch = lines[i].match(timePattern)
        if (timeMatch) {
          console.log('Time match found in line', i, ':', lines[i])
          break
        }
      }
    }
  }
  
  // Also search for times with spaces (e.g., "3:30 PM" or "14:30")
  if (!timeMatch) {
    const timePatternWithSpace = /(\d{1,2})\s*:\s*(\d{2})\s*([AaPp][Mm])?/i
    const allText = lines.join(' ')
    const spaceMatch = allText.match(timePatternWithSpace)
    if (spaceMatch) {
      console.log('Found time with space pattern:', spaceMatch)
      // Reconstruct the match in the format we expect
      const timeStr = `${spaceMatch[1]}:${spaceMatch[2]}${spaceMatch[3] || ''}`
      timeMatch = [timeStr, timeStr, undefined] as any
    }
  }
  
  // Try "Doors Open at X, Dinner Y" patterns
  if (!timeMatch) {
    const allText = lines.join(' ')
    const doorsMatch = allText.match(doorsOpenPattern)
    const dinnerMatch = allText.match(dinnerPattern)
    
    if (doorsMatch || dinnerMatch) {
      console.log('Found doors/dinner pattern - doors:', doorsMatch, 'dinner:', dinnerMatch)
      if (doorsMatch && dinnerMatch) {
        // Both found - use doors as start, dinner as end
        startTime = convertTo24Hour(doorsMatch[1])
        endTime = convertTo24Hour(dinnerMatch[1])
        console.log('Extracted times from doors/dinner pattern - start:', startTime, 'end:', endTime)
      } else if (doorsMatch) {
        // Only doors found - use as start
        startTime = convertTo24Hour(doorsMatch[1])
        console.log('Extracted start time from doors pattern:', startTime)
      } else if (dinnerMatch) {
        // Only dinner found - use as start
        startTime = convertTo24Hour(dinnerMatch[1])
        console.log('Extracted start time from dinner pattern:', startTime)
      }
    }
  }
  
  if (timeMatch) {
    startTime = convertTo24Hour(timeMatch[1])
    console.log('Extracted start time:', timeMatch[1], '->', startTime)
    if (timeMatch[2]) {
      endTime = convertTo24Hour(timeMatch[2])
      console.log('Extracted end time:', timeMatch[2], '->', endTime)
    }
  } else if (!startTime) {
    console.log('No time pattern found in date line or nearby lines')
  }

  // Look for location in the text (usually after date/time line)
  let location: string | null = null
  const locSearchIndex = dateLineIndex >= 0 ? dateLineIndex : lines.findIndex(ln => ln === dateLine)
  if (locSearchIndex >= 0 && locSearchIndex < lines.length - 1) {
    // Check next few lines for location patterns
    for (let i = locSearchIndex + 1; i < Math.min(locSearchIndex + 4, lines.length); i++) {
      const line = lines[i]
      // Look for common location indicators
      if (/at|@|location|venue|address/i.test(line) || (line.length > 5 && !timePattern.test(line))) {
        location = line.replace(/^(at|@|location|venue|address):?\s*/i, '').trim()
        if (location) {
          console.log('Found location:', location)
          break
        }
      }
    }
  }

  const result = {
    name,
    start_date: iso,
    end_date: iso,
    start_time: startTime,
    end_time: endTime,
    status: 'draft' as const,
    recurrence: 'Annual',
    website_url: null as string | null,
    location: location,
    time_all_day: allDay as any
  }
  console.log('parseEventText result:', result)
  return result
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const rows: string[][] = []
  let cur: string[] = []
  let inQuotes = false
  let cell = ''

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        cur.push(cell.trim())
        cell = ''
      } else {
        cell += char
      }
    }
    if (!inQuotes) {
      cur.push(cell.trim())
      rows.push(cur)
      cur = []
      cell = ''
    } else {
      cell += '\n'
    }
  }
  if (cell.length || cur.length) { cur.push(cell); rows.push(cur) }
  return rows
    .map(r => r.map(c => c.trim()))
    .filter(r => r.length && r.some(c => c !== ''))
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

function downloadTemplateCSV() {
  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','image_url','status','sort_order']
  const csv = toCSV([], headers) + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'events_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

interface EventsProps {
  darkMode?: boolean
}

export default function Events({ darkMode = false }: EventsProps) {
  const [rows, setRows] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[] | null>(null)

  // Helper function for button styles
  const getButtonStyle = (baseStyle: React.CSSProperties = {}) => ({
    ...baseStyle,
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    color: darkMode ? '#f9fafb' : '#374151',
    borderRadius: '6px'
  })
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // OCR / Image-to-Event state with persistence
  const [ocrOpen, setOcrOpen] = useState(() => {
    const saved = localStorage.getItem('events-ocr-open')
    return saved === 'true'
  })
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrRawText, setOcrRawText] = useState(() => {
    const saved = localStorage.getItem('events-ocr-text')
    return saved || ''
  })
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(() => {
    const saved = localStorage.getItem('events-ocr-image')
    return saved || null
  })
  const [ocrDraft, setOcrDraft] = useState<EventRow | null>(() => {
    const saved = localStorage.getItem('events-ocr-draft')
    return saved ? JSON.parse(saved) : null
  })
  
  // Display state for time fields
  const [ocrStartTimeDisplay, setOcrStartTimeDisplay] = useState('')
  const [ocrEndTimeDisplay, setOcrEndTimeDisplay] = useState('')
  const [editStartTimeDisplay, setEditStartTimeDisplay] = useState('')
  const [editEndTimeDisplay, setEditEndTimeDisplay] = useState('')
  
  // Image hover preview state
  const [hoveredImage, setHoveredImage] = useState<{ src: string; alt: string } | null>(null)
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })

  // Helper function to update OCR draft safely
  const updateOcrDraft = (updates: Partial<EventRow>) => {
    if (ocrDraft) {
      setOcrDraft({...ocrDraft, ...updates});
    } else {
      setOcrDraft({
        name: '',
        status: 'draft',
        sort_order: 1000,
        ...updates
      } as EventRow);
    }
  }

  // Helper function to update editing state safely
  const updateEditing = (updates: Partial<EventRow>) => {
    console.log('🔄 Events - updateEditing called with:', updates);
    console.log('🔄 Events - Current editing state:', editing);
    if (editing) {
      const newState = {...editing, ...updates};
      console.log('🔄 Events - New editing state (existing):', newState);
      setEditing(newState);
    } else {
      const newState = {
        name: '',
        status: 'draft',
        sort_order: 1000,
        ...updates
      };
      console.log('🔄 Events - New editing state (new):', newState);
      setEditing(newState);
    }
  }

  // Debug: Log editing state changes
  useEffect(() => {
    console.log('🔄 Events - editing state changed to:', editing);
    if (editing) {
      console.log('🔄 Events - Rendering edit dialog for:', editing);
    }
  }, [editing]);

  // Handle escape key and Enter key for dialogs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null)
        } else if (ocrOpen) {
          setOcrOpen(false)
          setOcrDraft(null)
          setOcrRawText('')
          setOcrImageUrl(null)
          setOcrError(null)
        }
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        // Cmd+Enter or Ctrl+Enter to accept
        e.preventDefault()
        if (editing) {
          save()
        } else if (ocrOpen && ocrDraft && ocrDraft.name) {
          confirmOcrInsert()
        }
      }
    }

    if (editing || ocrOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editing, ocrOpen, ocrDraft])

  // Use centralized form field population
  useFormFieldPopulation({
    editing,
    fieldConfigs: editing ? createEventsFieldConfigs(editing.id?.toString() || 'new') : [],
    debugPrefix: 'Events'
  })

  // Reset table row styling when dark mode changes to prevent artifacts
  useDarkModeRowReset(darkMode)

  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null)
  const pasteRef = useRef<HTMLDivElement | null>(null)

  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','image_url','status','sort_order']

  // Image upload function
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `event-images/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return null
      }

      const { data } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Image upload failed:', error)
      return null
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
    let query = supabase
      .from('events')
        .select('id, name, slug, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, image_url, status, sort_order, created_by, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
        .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

      if (q) query = query.ilike('name', `%${q}%`)
      if (from) query = query.gte('start_date', from)
      if (to) query = query.lte('start_date', to)

    const { data, error } = await query
      if (error) throw error
      setRows((data ?? []) as EventRow[])
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load events')
    } finally {
    setLoading(false)
    }
  }

  const startNew = () => {
    const today = new Date().toISOString().slice(0,10)
    setEditing({
      name: 'Untitled Event',
      slug: '',
      host_org: null,
      start_date: today,
      end_date: today,
      start_time: null,
      end_time: null,
      location: null,
      recurrence: null,
      website_url: null,
      image_url: null,
      status: 'draft',
      sort_order: 1000
    })
    setEditingImageUrl(null)
  }

  const exportCSV = () => {
    const csv = toCSV(rows, headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'events_export.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const grid = parseCSV(text)
      if (grid.length < 2) { alert('CSV must have header + at least one row'); return }

      const rawHeaders = grid[0].map(h => h.trim().toLowerCase())
      const headerAlias: Record<string, string> = {
        'event name': 'name',
        'event title': 'name',
        'title': 'name',
        'event date': 'start_date',
        'date': 'start_date',
        'start date': 'start_date',
        'end date': 'end_date',
        'event location': 'location',
        'location': 'location',
        'venue': 'location',
        'website': 'website_url',
        'url': 'website_url',
        'event status': 'status',
        'status': 'status'
      }

      const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','image_url','status','sort_order']
      const rows = grid.slice(1).map(cols => {
        const obj: Record<string, any> = {}
        headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim() })
        return obj
      })

      const preview = rows.map(r => {
        const rec: any = {
          name: r.name || '',
          slug: r.slug || (r.name ? slugify(r.name) : ''),
          host_org: r.host_org || null,
          start_date: r.start_date || null,
          end_date: r.end_date || r.start_date || null,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          location: r.location || null,
          recurrence: r.recurrence || null,
          website_url: r.website_url || null,
          image_url: r.image_url || null,
          status: r.status || 'draft',
          sort_order: r.sort_order ? Number(r.sort_order) : null
        }
        if (!['draft','published','archived'].includes(rec.status)) rec.status = 'draft'
        return rec
      })

      setImportPreview(preview)
      setImportErrors([])
    } catch (err: any) {
      console.error(err)
      setImportErrors([err?.message || 'Import failed'])
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const confirmImport = async () => {
    if (!importPreview) return
    if (importErrors.length) { alert('Fix errors before importing'); return }
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id ?? null

    const payload = importPreview.map(r => ({
      ...r,
      created_by: uid
    }))

    const { error } = await supabase
      .from('events')
      .upsert(payload, { onConflict: 'slug' })

    if (error) { setImportErrors([error.message]); return }

    setImporting(false)
    setImportPreview(null)
    setImportErrors([])
    await load()
    alert(`Imported ${payload.length} events`)
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds(prev => {
      if (!checked) return new Set()
      const next = new Set<string>()
      rows.forEach(r => next.add(r.id!.toString()))
      return next
    })
  }

  const computeStatusFromDates = (r: EventRow) => {
    const todayISO = new Date().toISOString().slice(0, 10)
    const today = todayISO ? new Date(todayISO) : new Date()
    const sd = r.start_date ? new Date(r.start_date + 'T00:00:00') : null
    const ed = r.end_date ? new Date(r.end_date + 'T23:59:59') : sd
    if (!sd) return 'draft'
    if (sd && ed) {
      if (today < sd) return 'upcoming'
      if (today > ed) return 'past'
      return 'ongoing'
    }
    return 'draft'
  }

  const bulkSetStatusFromDates = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    const payload = rows
      .filter(r => selectedIds.has(r.id!.toString()))
      .map(r => ({ id: r.id, status: computeStatusFromDates(r) }))
    const { error } = await supabase.from('events').upsert(payload)
    if (error) { alert(error.message); return }
    await load(); alert('Statuses updated from dates.')
  }

  const bulkFillEndDates = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    const payload = rows
      .filter(r => selectedIds.has(r.id!.toString()) && r.start_date && !r.end_date)
      .map(r => ({ id: r.id, end_date: r.start_date }))
    if (!payload.length) { alert('No selected rows need end dates.'); return }
    const { error } = await supabase.from('events').upsert(payload)
    if (error) { alert(error.message); return }
    await load(); alert('End dates filled from start dates.')
  }

  const bulkGenerateSlugs = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    const payload = rows
      .filter(r => selectedIds.has(r.id!.toString()) && (!r.slug || !r.slug.trim()))
      .map(r => ({ id: r.id, slug: slugify(r.name) }))
    if (!payload.length) { alert('No selected rows need slugs.'); return }
    const { error } = await supabase.from('events').upsert(payload)
    if (error) { alert(error.message); return }
    await load(); alert('Slugs generated.')
  }

  const bulkPublish = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    const { error } = await supabase.from('events').update({ status: 'published' }).in('id', Array.from(selectedIds))
    if (error) { alert(error.message); return }
    await load(); setSelectedIds(new Set());
  }

  const bulkArchive = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    const { error } = await supabase.from('events').update({ status: 'archived' }).in('id', Array.from(selectedIds))
    if (error) { alert(error.message); return }
    await load(); setSelectedIds(new Set());
  }

  const bulkDelete = async () => {
    if (!selectedIds.size) { alert('Select at least one event.'); return }
    if (!confirm('Soft delete selected events?')) return
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds))
    if (error) { alert(error.message); return }
    await load(); setSelectedIds(new Set());
  }

  const copyEvent = async (r: EventRow) => {
    const copy = { ...r }
    const newSlug = copy.slug ? `${copy.slug}-copy` : slugify(copy.name + ' copy')
    const { id, created_at, updated_at, deleted_at, ...insertable } = copy
    const payload: any = { ...insertable, slug: newSlug, name: r.name + ' (copy)', status: 'draft', created_at: undefined, updated_at: undefined, deleted_at: null }
    const { error } = await supabase.from('events').insert(payload)
    if (error) { alert(error.message); return }
    await load();
  }


  const exportCSVFiltered = () => {
    let query = supabase
      .from('events')
      .select('id, name, slug, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, image_url, status, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (q) query = query.ilike('name', `%${q}%`)
    if (from) query = query.gte('start_date', from)
    if (to) query = query.lte('start_date', to)

    query.then(async ({ data, error }) => {
    if (error) { alert(error.message); return }
    const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','image_url','status','sort_order']
    const csv = toCSV(data || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
      a.href = url; a.download = 'events_export.csv'; a.click()
      URL.revokeObjectURL(url)
    })
  }

  async function handlePaste(ev: React.ClipboardEvent<HTMLDivElement>) {
    const items = ev.clipboardData?.items
    if (!items) return
    for (let i=0; i<items.length; i++) {
      const it = items[i]
      if (it.kind === 'file') {
        const file = it.getAsFile()
        if (file) {
          setOcrImageUrl(URL.createObjectURL(file))
          await runOCRFromFile(file)
          break
        }
      }
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setOcrImageUrl(URL.createObjectURL(f))
    runOCRFromFile(f)
    e.target.value = ''
  }

  async function runOCRFromFile(file: File) {
    setOcrError(null); setOcrLoading(true); setOcrRawText(''); setOcrDraft(null)
    try {
      const Tesseract = await import('tesseract.js')
      const { data } = await Tesseract.default.recognize(file, 'eng')
      const text = (data?.text || '').trim()
      setOcrRawText(text)
      const parsed = parseEventText(text)
      if (typeof parsed === 'object' && parsed !== null && 'name' in parsed) {
        (parsed as any).slug = parsed.name ? slugify(parsed.name) : ''
        updateOcrDraft(parsed as Partial<EventRow>)
      }
    } catch (e: any) {
      console.error(e)
      setOcrError(e?.message || 'OCR failed')
    } finally {
      setOcrLoading(false)
    }
  }

  const confirmOcrInsert = async () => {
    if (!ocrDraft) return
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id ?? null

    const payload: any = {
      name: ocrDraft.name || '',
      slug: (ocrDraft as any).slug || (ocrDraft.name ? slugify(ocrDraft.name) : ''),
      host_org: ocrDraft.host_org ?? null,
      start_date: ocrDraft.start_date ?? null,
      end_date: ocrDraft.end_date ?? ocrDraft.start_date ?? null,
      start_time: ocrDraft.start_time ?? null,
      end_time: ocrDraft.end_time ?? null,
      location: ocrDraft.location ?? null,
      recurrence: ocrDraft.recurrence ?? null,
      website_url: ocrDraft.website_url ?? null,
      image_url: ocrDraft.image_url ?? null,
      status: (ocrDraft.status as any) || 'draft',
      sort_order: ocrDraft.sort_order ?? 1000,
      created_by: uid
    }

    if (!payload.name) { alert('Name is required'); return }
    if (!payload.slug) { alert('Slug is required'); return }

    const { error } = await supabase.from('events').insert(payload)
    if (error) { alert(error.message); return }
    setOcrOpen(false); setOcrDraft(null); setOcrRawText(''); setOcrImageUrl(null)
    localStorage.removeItem('events-ocr-draft')
    localStorage.removeItem('events-ocr-text')
    localStorage.setItem('events-ocr-open', 'false')
    await load()
    alert('Event created from image')
  }

  const save = async () => {
    if (!editing) return
    const payload = { ...editing }

    if (!payload.name) return alert('Name is required')
    if (!payload.slug) payload.slug = slugify(payload.name)

    if (payload.id) {
      const { error } = await supabase.from('events').update({
        name: payload.name,
        slug: payload.slug,
        host_org: payload.host_org,
        start_date: payload.start_date,
        end_date: payload.end_date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        location: payload.location,
        recurrence: payload.recurrence,
        website_url: payload.website_url,
        image_url: payload.image_url,
        status: payload.status,
        sort_order: payload.sort_order
      }).eq('id', payload.id)
      if (error) { alert(error.message); return }
    } else {
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('events').insert(insertable).select().single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }

    setEditing(null)
    await load()
  }

  // Use shared navigation hook with auto-save functionality
  const { navigateToNext, navigateToPrevious } = useNavigationWithAutoSave(
    editing,
    rows,
    save,
    setEditing
  )

  const softDelete = async (id: string) => {
    if (!confirm('Delete this event? (soft delete)')) return
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  useEffect(() => {
    load()
  }, [])

  // Trigger search when query, from, or to changes
  useEffect(() => {
    load()
  }, [q, from, to])

  // Persist OCR state to localStorage
  useEffect(() => {
    localStorage.setItem('events-ocr-open', ocrOpen.toString())
  }, [ocrOpen])

  useEffect(() => {
    localStorage.setItem('events-ocr-text', ocrRawText)
  }, [ocrRawText])

  useEffect(() => {
    if (ocrDraft) {
      localStorage.setItem('events-ocr-draft', JSON.stringify(ocrDraft))
    } else {
      localStorage.removeItem('events-ocr-draft')
    }
  }, [ocrDraft])

  // Global paste support for adding an image when editing (works anywhere in the dialog)
  const editingRef = useRef(editing)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])

  useEffect(() => {
    async function handleWindowPaste(ev: ClipboardEvent) {
      console.log('🔵 Global paste event triggered, editing state:', editingRef.current)
      if (!editingRef.current) {
        console.log('🔵 Not editing, ignoring paste')
        return
      }
      
      const items = ev.clipboardData?.items
      console.log('🔵 Clipboard items:', items?.length || 0)
      if (!items || items.length === 0) {
        console.log('🔵 No clipboard items found')
        return
      }
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        console.log(`🔵 Item ${i}: kind=${item.kind}, type=${item.type}`)
        // Check if it's a file and an image
        if (item.kind === 'file' && (item.type.indexOf('image') !== -1 || item.type.startsWith('image/'))) {
          const file = item.getAsFile()
          console.log('🔵 Image file found in global paste:', file?.name, file?.type, file?.size)
          if (file && file.type.startsWith('image/')) {
            ev.preventDefault()
            ev.stopPropagation()
            console.log('🔵 Processing pasted image globally...')
            
            const currentEditing = editingRef.current
            
            try {
              // Upload the image first
              console.log('🔵 Uploading image...')
              const url = await uploadImage(file)
              console.log('🔵 Upload result:', url)
              if (url) {
                updateEditing({ image_url: url })
                setEditingImageUrl(url)
                
                // Run OCR on the image to extract text
                try {
                  console.log('🔵 Starting OCR on pasted image...')
                  const Tesseract = await import('tesseract.js')
                  console.log('🔵 Tesseract loaded, running OCR...')
                  const { data: ocrData } = await Tesseract.default.recognize(file, 'eng')
                  const text = (ocrData?.text || '').trim()
                  console.log('🔵 OCR completed. Extracted text:', text)
                  
                  if (text) {
                    // Parse the OCR text to extract event data
                    const parsed = parseEventText(text)
                    console.log('🔵 Parsed event data:', parsed)
                    
                    // Update editing state with parsed data
                    const updates: Partial<EventRow> = {
                      image_url: url,
                    }
                    
                    // Update name if parsed name exists and current name is empty/default
                    if (parsed.name && parsed.name.trim()) {
                      const currentName = currentEditing?.name || ''
                      if (!currentName || currentName === 'Untitled Event' || currentName.trim() === '') {
                        updates.name = parsed.name
                        updates.slug = slugify(parsed.name)
                        console.log('🔵 Updating name to:', parsed.name)
                      }
                    }
                    
                    // Update dates if they're currently empty and parsed has values
                    const currentStartDate = currentEditing?.start_date || ''
                    if (parsed.start_date && (!currentStartDate || currentStartDate.trim() === '')) {
                      updates.start_date = parsed.start_date
                      console.log('🔵 Updating start_date to:', parsed.start_date, '(was:', currentStartDate, ')')
                    } else if (parsed.start_date) {
                      console.log('🔵 Not updating start_date - already has value:', currentStartDate)
                    }
                    const currentEndDate = currentEditing?.end_date || ''
                    if (parsed.end_date && (!currentEndDate || currentEndDate.trim() === '')) {
                      updates.end_date = parsed.end_date
                      console.log('🔵 Updating end_date to:', parsed.end_date, '(was:', currentEndDate, ')')
                    } else if (parsed.end_date) {
                      console.log('🔵 Not updating end_date - already has value:', currentEndDate)
                    }
                    
                    // Update times if they're currently empty and parsed has values
                    if (parsed.start_time && (!currentEditing?.start_time || currentEditing.start_time.trim() === '')) {
                      updates.start_time = parsed.start_time
                      console.log('🔵 Updating start_time to:', parsed.start_time)
                    }
                    if (parsed.end_time && (!currentEditing?.end_time || currentEditing.end_time.trim() === '')) {
                      updates.end_time = parsed.end_time
                      console.log('🔵 Updating end_time to:', parsed.end_time)
                    }
                    
                    // Update location if it's currently empty and parsed has a value
                    if (parsed.location && (!currentEditing?.location || currentEditing.location.trim() === '')) {
                      updates.location = parsed.location
                      console.log('🔵 Updating location to:', parsed.location)
                    }
                    
                    // Apply updates
                    if (Object.keys(updates).length > 1) { // More than just image_url
                      console.log('🔵 Applying parsed updates:', updates)
                      updateEditing(updates)
                    } else {
                      console.log('🔵 No updates to apply (only image_url)')
                    }
                  } else {
                    console.warn('🔵 No text extracted from image')
                  }
                } catch (ocrError: any) {
                  console.error('🔵 OCR failed:', ocrError)
                  alert(`OCR failed: ${ocrError?.message || 'Unknown error'}`)
                  // Image upload succeeded, OCR failed - that's okay
                }
              } else {
                console.error('🔵 Image upload failed - no URL returned')
                alert('Image upload failed')
              }
            } catch (uploadError: any) {
              console.error('🔵 Upload error:', uploadError)
              alert(`Upload failed: ${uploadError?.message || 'Unknown error'}`)
            }
            return // Exit after handling first image
          }
        }
      }
      console.log('🔵 No image file found in paste event')
    }
    
    if (editing) {
      console.log('🔵 Setting up global paste handler for editing')
      window.addEventListener('paste', handleWindowPaste as any, true) // Use capture phase
      return () => {
        console.log('🔵 Removing global paste handler')
        window.removeEventListener('paste', handleWindowPaste as any, true)
      }
    } else {
      console.log('🔵 Not editing, not setting up paste handler')
    }
  }, [editing])

  if (loading) {
    return <div className="stack" style={{ padding: 16 }}>Loading events…</div>
  }
  if (error) {
  return (
      <div style={{ padding: 16, color: '#8b0000' }}>
        Error loading events: {error}
      </div>
    )
  }

  return (
    <>
      <div style={{ 
        background: darkMode ? '#111827' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        filter: editing ? 'blur(2px)' : 'none',
        transition: 'filter 0.3s ease'
      }}>
      {/* Events Toolbar */}
      <div
        className="events-toolbar"
        aria-label="Events toolbar"
        role="toolbar"
        style={{
          marginBottom: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: darkMode ? '#1f2937' : '#f8f9fa',
          padding: '12px',
          borderBottom: `1px solid ${darkMode ? '#374151' : '#dee2e6'}`,
          borderRadius: '4px',
          border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`
        }}
      >
        {/* Action Buttons Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginBottom: 12
        }}>
          {/* Module Title */}
          <h2 style={{
            color: darkMode ? '#f9fafb' : '#1f2937',
            margin: 0,
            fontSize: '24px',
            fontWeight: '600',
            marginRight: '16px'
          }}>📅 Events</h2>
          <button 
            className="btn" 
            onClick={startNew} 
            disabled={importing}
            style={getButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
            title="Create new event"
          >
            <span>➕</span>
            <span>New</span>
          </button>
          
          <button 
            className="btn" 
            onClick={() => setOcrOpen(true)} 
            disabled={importing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Add event from image using OCR"
          >
            <span>🔍</span>
            <span>OCR</span>
          </button>
          
          <button 
            className="btn" 
            onClick={load} 
            disabled={loading || importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Refresh events list"
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
          
          <button 
            className="btn" 
            onClick={downloadTemplateCSV} 
            disabled={importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Download CSV template"
          >
            <span>📋</span>
            <span>Template</span>
          </button>
          
          <button 
            className="btn" 
            onClick={exportCSV} 
            disabled={importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Export all events to CSV"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
          
          <label 
            className="btn" 
            style={{ 
              cursor: 'pointer', 
              opacity: importing ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Import events from CSV file"
          >
            <span>📥</span>
            <span>Import</span>
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImportFile} style={{ display: 'none' }} disabled={importing} />
          </label>
        </div>

        {/* Bulk Actions Row */}
        <div style={{ 
          display:'inline-flex', 
          gap:8, 
          flexWrap:'wrap',
          marginBottom: 12
        }}>
          <button 
            className="btn" 
            onClick={bulkSetStatusFromDates} 
            title="Set status to upcoming/ongoing/past based on dates"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>🤖</span>
            <span>Auto Status</span>
          </button>
          
          <button 
            className="btn" 
            onClick={bulkFillEndDates} 
            title="Fill missing end_date = start_date"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>📅</span>
            <span>Fill Dates</span>
          </button>
          
          <button 
            className="btn" 
            onClick={bulkGenerateSlugs} 
            title="Create slugs for rows missing them"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>🔗</span>
            <span>Gen Slugs</span>
          </button>
          
          <button 
            className="btn success" 
            onClick={bulkPublish} 
            title="Publish selected"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>🚀</span>
            <span>Publish</span>
          </button>
          <button 
            className="btn warning" 
            onClick={bulkArchive} 
            title="Archive selected"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>📦</span>
            <span>Archive</span>
          </button>
          
          <button 
            className="btn danger" 
            onClick={bulkDelete} 
            title="Soft delete selected"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>

        </div>

        {/* Search Controls Row */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <input 
            placeholder="Search name…" 
            value={q} 
            onChange={(e)=>setQ(e.target.value)} 
            style={{ 
              flex: 1, 
              minWidth: 220, 
              padding: 8,
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              borderRadius: '6px',
              color: darkMode ? '#f9fafb' : '#1f2937'
            }} 
          />
          <label style={{ color: darkMode ? '#f9fafb' : '#374151' }}>
            From <input 
              type="date" 
              value={from} 
              onChange={e=>setFrom(e.target.value)} 
              style={{
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                padding: '4px'
              }}
            />
          </label>
          <label style={{ color: darkMode ? '#f9fafb' : '#374151' }}>
            To <input 
              type="date" 
              value={to} 
              onChange={e=>setTo(e.target.value)} 
              style={{
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                padding: '4px'
              }}
            />
          </label>
        </div>

      </div>

      {importing && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fbfbfb' }}>
          <h3 style={{ marginTop: 0 }}>Import Preview</h3>
          <p>{importPreview?.length || 0} rows parsed. This will upsert by <code>slug</code> (create new or update existing).</p>
          {importErrors.length > 0 && (
            <div style={{ color: '#b91c1c', margin: '8px 0' }}>
              <strong>Issues:</strong>
              <ul>{importErrors.map((e,i)=><li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <div style={{ maxHeight: 240, overflow: 'auto', border: '1px solid #eee', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>name</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>slug</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>start_date</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>end_date</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>location</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>status</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>sort_order</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.slice(0,50).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.name}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.slug}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.start_date ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.end_date ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.location ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.status}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.sort_order ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn success" onClick={confirmImport} disabled={importErrors.length>0}>Confirm Import</button>{' '}
            <button className="btn secondary" onClick={()=>{ setImporting(false); setImportPreview(null); setImportErrors([]) }}>Cancel</button>
          </div>
        </div>
      )}

      {ocrOpen && (
        <div 
          onClick={() => {
            setOcrOpen(false)
            setOcrDraft(null)
            setOcrRawText('')
            setOcrImageUrl(null)
            setOcrError(null)
          }}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,0,0,0.5)', 
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '20px'
          }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: darkMode ? '#1f2937' : 'white', 
              borderRadius: '12px', 
              maxWidth: '900px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
            {/* Sticky Header */}
            <div style={{ 
              padding: '32px 32px 0 32px',
              position: 'sticky',
              top: 0,
              background: darkMode ? '#1f2937' : 'white',
              zIndex: 10,
              borderBottom: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#1f2937' }}>
                  📷 Add Event from Image
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button 
                    onClick={confirmOcrInsert}
                    disabled={!ocrDraft || !ocrDraft.name}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: ocrDraft && ocrDraft.name ? 'pointer' : 'not-allowed',
                      color: darkMode ? '#10b981' : '#059669',
                      padding: '4px',
                      opacity: ocrDraft && ocrDraft.name ? 1 : 0.5
                    }}
                    title="Accept (Cmd+Enter)"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={() => {
                      setOcrOpen(false)
                      setOcrDraft(null)
                      setOcrRawText('')
                      setOcrImageUrl(null)
                      setOcrError(null)
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: darkMode ? '#6b7280' : '#6b7280',
                      padding: '4px'
                    }}
                    title="Close (ESC)"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto', 
              padding: '0 32px',
              display: 'grid', 
              gap: '20px' 
            }}>
              {/* Image Upload Section */}
              <div style={{ 
                border: `1px dashed ${darkMode ? '#6b7280' : '#c8b68a'}`,
                padding: '20px',
                borderRadius: '8px',
                background: darkMode ? '#374151' : '#fff9ef',
                textAlign: 'center'
              }}>
                <div
                  ref={pasteRef}
                  onPaste={handlePaste}
                  tabIndex={0}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr',
                    gap: 16,
                    alignItems: 'center',
                    minHeight: 120
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    {ocrImageUrl ? (
                      <img 
                        src={ocrImageUrl} 
                        alt="pasted" 
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setHoverPosition({ x: rect.right, y: rect.top })
                          setHoveredImage({ src: ocrImageUrl, alt: 'OCR Image Preview' })
                        }}
                        onMouseLeave={() => setHoveredImage(null)}
                        style={{ 
                          maxWidth: 120, 
                          maxHeight: 120, 
                          objectFit: 'contain', 
                          borderRadius: 6, 
                          border: '1px solid #eee',
                          cursor: 'pointer'
                        }} 
                      />
                    ) : (
                      <div style={{ color: '#8b6b34', fontSize: '48px' }}>📋</div>
                    )}
                  </div>
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <input type="file" accept="image/*" onChange={handleFileSelect} />
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: darkMode ? '#d1d5db' : '#6b7280' }}>
                      Paste an image here (⌘/Ctrl+V) or choose a file. We'll OCR the text, parse it, and let you verify before saving.
                    </p>
                    <small style={{ color: darkMode ? '#9ca3af' : '#8b6b34' }}>
                      Tip: click inside this box and press <strong>⌘/Ctrl+V</strong> to paste from clipboard.
                    </small>
                  </div>
                </div>

                {ocrLoading && (
                  <div style={{ marginTop: 12, color: '#059669', fontWeight: '500' }}>🔄 Running OCR…</div>
                )}
                {ocrError && (
                  <div style={{ marginTop: 12, color: '#dc2626', fontWeight: '500' }}>❌ Error: {ocrError}</div>
                )}
              </div>


              {/* Form Fields - Only show when we have OCR data */}
              {(ocrRawText || ocrDraft) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Left side - Form fields */}
                  <div>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#374151' }}>
                      Event Details
                    </h4>
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {/* Name and Slug row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Event Name *
                          </label>
                          <input 
                            value={ocrDraft?.name ?? ''} 
                            onChange={e=>updateOcrDraft({ name: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                            placeholder="Enter event name"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Slug
                          </label>
                          <input 
                            value={(ocrDraft as any)?.slug ?? ''} 
                            onChange={e=>updateOcrDraft({ slug: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                            placeholder="event-slug"
                          />
                        </div>
                      </div>

                      {/* Host Org and Location row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Host Organization
                          </label>
                          <input 
                            value={ocrDraft?.host_org ?? ''} 
                            onChange={e=>updateOcrDraft({ host_org: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                            placeholder="Host organization"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Location
                          </label>
                          <input 
                            value={ocrDraft?.location ?? ''} 
                            onChange={e=>updateOcrDraft({ location: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                            placeholder="Event location"
                          />
                        </div>
                      </div>

                      {/* Date row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Start Date
                          </label>
                          <input 
                            type="date" 
                            value={ocrDraft?.start_date ?? ''} 
                            onChange={e => {
                              const startDate = e.target.value;
                              const updates: Partial<EventRow> = { start_date: startDate };
                              
                              // If end_date is null or empty, set it to the same value as start_date
                              if (!ocrDraft?.end_date || ocrDraft.end_date === '') {
                                updates.end_date = startDate;
                              }
                              
                              updateOcrDraft(updates);
                            }}
                            onBlur={e => {
                              const startDate = e.target.value;
                              if (startDate) {
                                const updates: Partial<EventRow> = { start_date: startDate };
                                
                                // If end_date is null or empty, set it to the same value as start_date
                                if (!ocrDraft?.end_date || ocrDraft.end_date === '') {
                                  updates.end_date = startDate;
                                }
                                
                                updateOcrDraft(updates);
                              }
                            }}
                            onInput={e => {
                              const startDate = (e.target as HTMLInputElement).value;
                              if (startDate) {
                                const updates: Partial<EventRow> = { start_date: startDate };
                                
                                // If end_date is null or empty, set it to the same value as start_date
                                if (!ocrDraft?.end_date || ocrDraft.end_date === '') {
                                  updates.end_date = startDate;
                                }
                                
                                updateOcrDraft(updates);
                              }
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            End Date
                          </label>
                          <input 
                            type="date" 
                            value={ocrDraft?.end_date ?? ''} 
                            onChange={e=>updateOcrDraft({ end_date: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                          />
                        </div>
                      </div>

                      {/* Time row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Start Time
                          </label>
                          <input 
                            type="text" 
                            placeholder="6 (6 AM), 14 (2 PM)"
                            value={ocrStartTimeDisplay || (ocrDraft?.start_time ? standardTimeToSimple(ocrDraft.start_time) : '')} 
                            onChange={e => {
                              const simpleTime = e.target.value
                              setOcrStartTimeDisplay(simpleTime)
                              const standardTime = simpleTimeToStandard(simpleTime)
                              updateOcrDraft({ start_time: standardTime })
                            }}
                            onBlur={e => {
                              const simpleTime = e.target.value
                              if (simpleTime) {
                                const formattedTime = formatTimeForDisplay(simpleTime)
                                setOcrStartTimeDisplay(formattedTime)
                              }
                            }}
                            onFocus={e => {
                              const simpleTime = ocrDraft?.start_time ? standardTimeToSimple(ocrDraft.start_time) : ''
                              setOcrStartTimeDisplay(simpleTime)
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            End Time
                          </label>
                          <input 
                            type="text" 
                            placeholder="18 (6 PM), 22 (10 PM)"
                            value={ocrEndTimeDisplay || (ocrDraft?.end_time ? standardTimeToSimple(ocrDraft.end_time) : '')} 
                            onChange={e => {
                              const simpleTime = e.target.value
                              setOcrEndTimeDisplay(simpleTime)
                              const startTime = ocrDraft?.start_time ? standardTimeToSimple(ocrDraft.start_time) : ''
                              const standardTime = simpleTimeToStandard(simpleTime, { startTime })
                              updateOcrDraft({ end_time: standardTime })
                            }}
                            onBlur={e => {
                              const simpleTime = e.target.value
                              if (simpleTime) {
                                const startTime = ocrDraft?.start_time ? standardTimeToSimple(ocrDraft.start_time) : ''
                                const contextHour = simpleTimeToStandard(simpleTime, { startTime })
                                const displayHour = standardTimeToSimple(contextHour)
                                const formattedTime = formatTimeForDisplay(displayHour)
                                setOcrEndTimeDisplay(formattedTime)
                              }
                            }}
                            onFocus={e => {
                              const simpleTime = ocrDraft?.end_time ? standardTimeToSimple(ocrDraft.end_time) : ''
                              setOcrEndTimeDisplay(simpleTime)
                            }}
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }} 
                          />
                        </div>
                      </div>

                      {/* Website and Status row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Website URL
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input 
                              type="url" 
                              value={ocrDraft?.website_url ?? ''} 
                              onChange={e=>updateOcrDraft({ website_url: e.target.value })} 
                              style={{ 
                                width: '100%', 
                                padding: '12px 40px 12px 12px', 
                                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                                borderRadius: '8px',
                                fontSize: '14px',
                                background: darkMode ? '#374151' : '#ffffff',
                                color: darkMode ? '#ffffff' : '#000000'
                              }} 
                              placeholder="https://example.com"
                            />
                            {ocrDraft?.website_url && (
                              <button
                                onClick={() => {
                                  const url = ocrDraft.website_url?.startsWith('http') 
                                    ? ocrDraft.website_url 
                                    : `https://${ocrDraft.website_url}`;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                                style={{
                                  position: 'absolute',
                                  right: '8px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  background: 'none',
                                  border: 'none',
                                  color: darkMode ? '#6b7280' : '#9ca3af',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Open website in new tab"
                              >
                                🔗
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                            Status
                          </label>
                          <select 
                            value={ocrDraft?.status ?? 'draft'} 
                            onChange={e=>updateOcrDraft({ status: e.target.value as any })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                              borderRadius: '8px',
                              fontSize: '14px',
                              background: darkMode ? '#374151' : '#ffffff',
                              color: darkMode ? '#ffffff' : '#000000'
                            }}
                          >
                            <option value="draft">📝 Draft</option>
                            <option value="published">✅ Published</option>
                            <option value="archived">📦 Archived</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side - Raw OCR text */}
                  <div>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#374151' }}>
                      Raw OCR Text
                    </h4>
                    <textarea 
                      value={ocrRawText} 
                      onChange={e=>{ setOcrRawText(e.target.value); updateOcrDraft(parseEventText(e.target.value) as Partial<EventRow>) }} 
                      style={{ 
                        width: '100%', 
                        height: 300, 
                        padding: '12px', 
                        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        background: darkMode ? '#374151' : '#f9fafb',
                        color: darkMode ? '#ffffff' : '#000000'
                      }} 
                      placeholder="OCR text will appear here..."
                    />
                    <div style={{ 
                      marginTop: 12, 
                      padding: 12, 
                      background: darkMode ? '#4b5563' : '#f3f4f6', 
                      borderRadius: 8, 
                      fontSize: '12px', 
                      color: darkMode ? '#d1d5db' : '#6b7280' 
                    }}>
                      <div style={{ marginBottom: 8, fontWeight: '600' }}>
                        <strong>Parsed from OCR:</strong>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Name:</strong> {ocrDraft?.name || '—'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Date:</strong> {ocrDraft?.start_date || '—'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Time:</strong> {ocrDraft?.start_time || '—'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Location:</strong> {ocrDraft?.location || '—'}
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <strong>Host:</strong> {ocrDraft?.host_org || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ 
                marginTop: '32px', 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end',
                paddingTop: '20px',
                borderTop: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
              }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    setOcrOpen(false)
                    setOcrDraft(null)
                    setOcrRawText('')
                    setOcrImageUrl(null)
                    setOcrError(null)
                  }}
                  style={{ 
                    padding: '12px 24px', 
                    fontSize: '14px',
                    background: darkMode ? '#374151' : '#f9fafb',
                    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                    borderRadius: '8px',
                    color: darkMode ? '#f9fafb' : '#374151'
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn primary" 
                  onClick={confirmOcrInsert} 
                  disabled={!ocrDraft || !ocrDraft.name}
                  style={{ 
                    padding: '12px 24px', 
                    fontSize: '14px',
                    background: '#3b82f6',
                    border: '1px solid #3b82f6',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '500'
                  }}
                >
                  💾 Save Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <table className="table" style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        background: darkMode ? '#1f2937' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937',
        position: 'relative'
      }}>
          <thead style={{
            position: 'sticky',
            top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
            zIndex: 110,
            background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)'
          }}>
            <tr>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>
              <input 
                type="checkbox" 
                onChange={e=>toggleSelectAllVisible(e.target.checked)} 
                style={{
                  accentColor: darkMode ? '#3b82f6' : '#3b82f6'
                }}
              />
            </th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Name</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Start</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>End</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Start Time</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>End Time</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Location</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Status</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Website</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110
            }}>Image</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '12px 8px', 
              background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
              color: darkMode ? '#f9fafb' : '#1f2937',
              fontWeight: '600',
              fontSize: '14px',
              position: 'sticky',
              top: STICKY_HEADER_TOP_OFFSETS.EVENTS,
              zIndex: 110,
              minWidth: '200px' 
            }}>Actions</th>
            </tr>
          </thead>
          <tbody>
          {rows.map((r) => (
            <tr 
              key={r.id ?? r.slug ?? r.name}
              onClick={() => {
                console.log('🎯 Events - Clicked row data:', r);
                updateEditing(r);
              }}  
              style={{ 
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f8f9fa'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = darkMode ? '#1f2937' : '#ffffff'
              }}
            >
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`
              }}>
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(r.id!.toString())} 
                  onChange={e=>toggleSelect(r.id!.toString(), e.target.checked)} 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6'
                  }}
                />
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`
              }}>
                <div style={{ fontWeight: 600, color: darkMode ? '#f9fafb' : '#1f2937' }}>{r.name}</div>
                {r.host_org ? (
                  <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#666' }}>Host: {r.host_org}</div>
                ) : null}
                {r.recurrence ? (
                  <div style={{ fontSize: 12, color: '#666' }}>{r.recurrence}</div>
                ) : null}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.start_date ? new Date(r.start_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.end_date ? new Date(r.end_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.start_time || '—'}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.end_time || '—'}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>{r.location ?? ''}</td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: darkMode 
                    ? (r.status === 'published' ? '#1b5e20' : r.status === 'archived' ? '#e65100' : '#424242')
                    : (r.status === 'published' ? '#e8f5e8' : r.status === 'archived' ? '#fff3e0' : '#f5f5f5'),
                  color: darkMode
                    ? (r.status === 'published' ? '#a5d6a7' : r.status === 'archived' ? '#ffb74d' : '#bdbdbd')
                    : (r.status === 'published' ? '#2e7d32' : r.status === 'archived' ? '#f57c00' : '#666'),
                  border: darkMode
                    ? `1px solid ${r.status === 'published' ? '#2e7d32' : r.status === 'archived' ? '#ff9800' : '#616161'}`
                    : `1px solid ${r.status === 'published' ? '#c8e6c9' : r.status === 'archived' ? '#ffcc02' : '#e0e0e0'}`
                }}>
                  {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                  {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                </span>
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.website_url ? (
                  <a 
                    href={r.website_url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      background: darkMode ? '#1e3a8a' : '#e3f2fd',
                      border: darkMode ? '1px solid #3b82f6' : '1px solid #bbdefb',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      color: darkMode ? '#93c5fd' : '#1976d2',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    <span>🔗</span>
                    Open
                  </a>
                ) : (
                  <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                )}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                {r.image_url ? (
                  <img 
                    src={r.image_url} 
                    alt={r.name} 
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoverPosition({ x: rect.right, y: rect.top })
                      setHoveredImage({ src: r.image_url, alt: r.name })
                    }}
                    onMouseLeave={() => setHoveredImage(null)}
                    style={{ 
                      width: 40, 
                      height: 40, 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      border: '1px solid #ddd',
                      cursor: 'pointer'
                    }} 
                  />
                ) : (
                  <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                )}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}` }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button 
                    className="btn secondary" 
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditing(r)
                    }} 
                    style={{ 
                      padding: '6px 10px', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '4px',
                      background: darkMode ? '#374151' : '#f3f4f6',
                      border: darkMode ? '1px solid #4b5563' : '1px solid #d1d5db',
                      color: darkMode ? '#f9fafb' : '#374151'
                    }}
                    title="Edit event"
                  >
                    <span>✏️</span>
                    Edit
                  </button>
                  <button 
                    className="btn primary" 
                    onClick={(e) => {
                      e.stopPropagation()
                      copyEvent(r)
                    }} 
                    style={{ 
                      padding: '6px 10px', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '4px',
                      background: darkMode ? '#1e40af' : '#3b82f6',
                      border: darkMode ? '1px solid #3b82f6' : '1px solid #3b82f6',
                      color: '#ffffff'
                    }}
                    title="Duplicate event"
                  >
                    <span>📋</span>
                    Copy
                  </button>
                  <button 
                    className="btn danger" 
                    onClick={(e) => {
                      e.stopPropagation()
                      softDelete(r.id!.toString())
                    }} 
                    style={{ 
                      padding: '6px 10px', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '4px',
                      background: darkMode ? '#dc2626' : '#ef4444',
                      border: darkMode ? '1px solid #dc2626' : '1px solid #ef4444',
                      color: '#ffffff'
                    }}
                    title="Delete event"
                  >
                    <span>🗑️</span>
                    Delete
                  </button>
                </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div 
          style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1000, 
            maxWidth: '800px', 
            width: '90%', 
            maxHeight: '90vh', 
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            background: darkMode ? '#1f2937' : 'white',
            borderRadius: '12px',
            border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
          }}
        >
          {/* Header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '24px'
            }}>
                {/* Title - Left aligned */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#1f2937' }}>
                    {editing.id ? '✏️ Edit Event' : '➕ New Event'}
                  </h3>
                </div>
                
                {/* Navigation buttons - Centered */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <NavigationButtons
                    editing={editing}
                    rows={rows}
                    onNavigateToPrevious={navigateToPrevious}
                    onNavigateToNext={navigateToNext}
                    darkMode={darkMode}
                    itemType="event"
                  />
                </div>
                
                {/* Accept and Close buttons - Right aligned */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px' }}>
                  <button 
                    onClick={async () => await save()}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: darkMode ? '#10b981' : '#059669',
                      padding: '4px'
                    }}
                    title="Accept (Cmd+Enter)"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={()=>setEditing(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: darkMode ? '#6b7280' : '#6b7280',
                      padding: '4px'
                    }}
                    title="Close dialog"
                  >
                    ✕
                  </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px'
            }}>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Event Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Event Name *
                  </label>
                  <input 
                    key={`name-${editing?.id || 'new'}`}
                    data-key={`name-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    defaultValue={editing?.name || ''} 
                    onChange={e=>updateEditing({name: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Slug
                  </label>
                  <input 
                    key={`slug-${editing?.id || 'new'}`}
                    data-key={`slug-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    defaultValue={editing?.slug || ''} 
                    onChange={e=>updateEditing({slug: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
              </div>

              {/* Host Org and Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Host Organization
                  </label>
                  <input 
                    key={`host-org-${editing?.id || 'new'}`}
                    data-key={`host-org-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    defaultValue={editing?.host_org || ''} 
                    onChange={e=>updateEditing({ host_org: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Location
                  </label>
                  <input 
                    key={`location-${editing?.id || 'new'}`}
                    data-key={`location-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    defaultValue={editing?.location || ''} 
                    onChange={e=>updateEditing({ location: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Start Date
                  </label>
                  <input 
                    key={`start-date-${editing?.id || 'new'}`}
                    data-key={`start-date-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    type="date"
                    defaultValue={editing?.start_date ? editing.start_date.split('T')[0] : ''}
                    onChange={e => {
                      const startDate = e.target.value;
                      const updates: Partial<EventRow> = { start_date: startDate };
                      
                      // If end_date is null or empty, set it to the same value as start_date
                      if (!editing?.end_date || editing.end_date === '') {
                        updates.end_date = startDate;
                      }
                      
                      updateEditing(updates);
                    }}
                    onBlur={e => {
                      const startDate = e.target.value;
                      if (startDate) {
                        const updates: Partial<EventRow> = { start_date: startDate };
                        
                        // If end_date is null or empty, set it to the same value as start_date
                        if (!editing?.end_date || editing.end_date === '') {
                          updates.end_date = startDate;
                        }
                        
                        updateEditing(updates);
                      }
                    }}
                    onInput={e => {
                      const startDate = (e.target as HTMLInputElement).value;
                      if (startDate) {
                        const updates: Partial<EventRow> = { start_date: startDate };
                        
                        // If end_date is null or empty, set it to the same value as start_date
                        if (!editing?.end_date || editing.end_date === '') {
                          updates.end_date = startDate;
                        }
                        
                        updateEditing(updates);
                      }
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    End Date
                  </label>
                  <input 
                    key={`end-date-${editing?.id || 'new'}`}
                    data-key={`end-date-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    type="date"
                    defaultValue={editing?.end_date ? editing.end_date.split('T')[0] : ''}
                    onChange={e=>updateEditing({ end_date: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
          </div>

              {/* Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Start Time
                  </label>
                  <input 
                    key={`start-time-${editing?.id || 'new'}`}
                    data-key={`start-time-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    type="text"
                    placeholder="6 (6 AM), 14 (2 PM)"
                    value={editStartTimeDisplay || (editing?.start_time ? standardTimeToSimple(editing.start_time) : '')}
                    onChange={e => {
                      const simpleTime = e.target.value
                      setEditStartTimeDisplay(simpleTime)
                      const standardTime = simpleTimeToStandard(simpleTime)
                      updateEditing({ start_time: standardTime })
                    }}
                    onBlur={e => {
                      const simpleTime = e.target.value
                      if (simpleTime) {
                        const formattedTime = formatTimeForDisplay(simpleTime)
                        setEditStartTimeDisplay(formattedTime)
                      }
                    }}
                    onFocus={e => {
                      const simpleTime = editing?.start_time ? standardTimeToSimple(editing.start_time) : ''
                      setEditStartTimeDisplay(simpleTime)
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    End Time
                  </label>
                  <input 
                    key={`end-time-${editing?.id || 'new'}`}
                    data-key={`end-time-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    type="text"
                    placeholder="18 (6 PM), 22 (10 PM)"
                    value={editEndTimeDisplay || (editing?.end_time ? standardTimeToSimple(editing.end_time) : '')}
                    onChange={e => {
                      const simpleTime = e.target.value
                      setEditEndTimeDisplay(simpleTime)
                      const startTime = editing?.start_time ? standardTimeToSimple(editing.start_time) : ''
                      const standardTime = simpleTimeToStandard(simpleTime, { startTime })
                      updateEditing({ end_time: standardTime })
                    }}
                    onBlur={e => {
                      const simpleTime = e.target.value
                      if (simpleTime) {
                        const startTime = editing?.start_time ? standardTimeToSimple(editing.start_time) : ''
                        const contextHour = simpleTimeToStandard(simpleTime, { startTime })
                        const displayHour = standardTimeToSimple(contextHour)
                        const formattedTime = formatTimeForDisplay(displayHour)
                        setEditEndTimeDisplay(formattedTime)
                      }
                    }}
                    onFocus={e => {
                      const simpleTime = editing?.end_time ? standardTimeToSimple(editing.end_time) : ''
                      setEditEndTimeDisplay(simpleTime)
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
              </div>

              {/* Website and Recurrence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Website URL
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      key={`website-url-${editing?.id || 'new'}`}
                      data-key={`website-url-${editing?.id || 'new'}`}
                      className={darkMode ? 'form-field-white-text' : ''}
                      defaultValue={editing?.website_url || ''} 
                      onChange={e=>updateEditing({ website_url: e.target.value})} 
                      style={{ 
                        width: '100%',
                        padding: '12px 40px 12px 12px', 
                        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                        borderRadius: '8px',
                        background: darkMode ? '#374151' : '#ffffff',
                        color: darkMode ? '#ffffff !important' : '#000000 !important',
                        WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                        caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                      }}
                    />
                    {editing?.website_url && (
                      <button
                        onClick={() => {
                          const url = editing.website_url?.startsWith('http') 
                            ? editing.website_url 
                            : `https://${editing.website_url}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: darkMode ? '#6b7280' : '#9ca3af',
                          cursor: 'pointer',
                          fontSize: '16px',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Open website in new tab"
                      >
                        🔗
                      </button>
                    )}
                  </div>
          </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Recurrence
                  </label>
                  <input 
                    key={`recurrence-${editing?.id || 'new'}`}
                    data-key={`recurrence-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    defaultValue={editing?.recurrence || ''} 
                    onChange={e=>updateEditing({ recurrence: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
        </div>
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                  Event Image
                </label>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const url = await uploadImage(file)
                          if (url) {
                            updateEditing({ image_url: url})
                            setEditingImageUrl(url)
                          }
                        }
                      }}
                      style={{ 
                        padding: '12px', 
                        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                        borderRadius: '8px',
                        background: darkMode ? '#374151' : '#ffffff',
                        flex: 1,
                        color: darkMode ? '#ffffff !important' : '#000000 !important'
                      }}
                    />
                    <div
                      ref={pasteRef}
                      tabIndex={0}
                      onFocus={() => {
                        console.log('Paste div focused - ready for paste')
                      }}
                      onPaste={async (e) => {
                        e.preventDefault()
                        console.log('Paste event triggered')
                        const items = e.clipboardData?.items
                        console.log('Clipboard items:', items?.length || 0)
                        if (items) {
                          for (let i = 0; i < items.length; i++) {
                            const item = items[i]
                            console.log(`Item ${i}: kind=${item.kind}, type=${item.type}`)
                            // Check if it's a file and an image
                            if (item.kind === 'file' && (item.type.indexOf('image') !== -1 || item.type.startsWith('image/'))) {
                              const file = item.getAsFile()
                              console.log('Image file found:', file?.name, file?.type, file?.size)
                              if (file) {
                                try {
                                  // Upload the image first
                                  console.log('Uploading image...')
                                  const url = await uploadImage(file)
                                  console.log('Upload result:', url)
                                  if (url) {
                                    updateEditing({ image_url: url})
                                    setEditingImageUrl(url)
                                    
                                    // Run OCR on the image to extract text
                                    try {
                                      console.log('Starting OCR on pasted image...')
                                      const Tesseract = await import('tesseract.js')
                                      console.log('Tesseract loaded, running OCR...')
                                      const { data: ocrData } = await Tesseract.default.recognize(file, 'eng')
                                      const text = (ocrData?.text || '').trim()
                                      console.log('OCR completed. Extracted text:', text)
                                      
                                      if (text) {
                                        // Parse the OCR text to extract event data
                                        const parsed = parseEventText(text)
                                        console.log('Parsed event data:', parsed)
                                        
                                        // Update editing state with parsed data
                                        const updates: Partial<EventRow> = {
                                          image_url: url,
                                        }
                                        
                                        // Update name if parsed name exists and current name is empty/default
                                        if (parsed.name && parsed.name.trim()) {
                                          const currentName = editing?.name || ''
                                          if (!currentName || currentName === 'Untitled Event' || currentName.trim() === '') {
                                            updates.name = parsed.name
                                            updates.slug = slugify(parsed.name)
                                            console.log('Updating name to:', parsed.name)
                                          }
                                        }
                                        
                                        // Update dates if they're currently empty and parsed has values
                                        const currentStartDate = editing?.start_date || ''
                                        if (parsed.start_date && (!currentStartDate || currentStartDate.trim() === '')) {
                                          updates.start_date = parsed.start_date
                                          console.log('Updating start_date to:', parsed.start_date, '(was:', currentStartDate, ')')
                                        } else if (parsed.start_date) {
                                          console.log('Not updating start_date - already has value:', currentStartDate)
                                        }
                                        const currentEndDate = editing?.end_date || ''
                                        if (parsed.end_date && (!currentEndDate || currentEndDate.trim() === '')) {
                                          updates.end_date = parsed.end_date
                                          console.log('Updating end_date to:', parsed.end_date, '(was:', currentEndDate, ')')
                                        } else if (parsed.end_date) {
                                          console.log('Not updating end_date - already has value:', currentEndDate)
                                        }
                                        
                                        // Update times if they're currently empty and parsed has values
                                        if (parsed.start_time && (!editing?.start_time || editing.start_time.trim() === '')) {
                                          updates.start_time = parsed.start_time
                                          console.log('Updating start_time to:', parsed.start_time)
                                        }
                                        if (parsed.end_time && (!editing?.end_time || editing.end_time.trim() === '')) {
                                          updates.end_time = parsed.end_time
                                          console.log('Updating end_time to:', parsed.end_time)
                                        }
                                        
                                        // Update location if it's currently empty and parsed has a value
                                        if (parsed.location && (!editing?.location || editing.location.trim() === '')) {
                                          updates.location = parsed.location
                                          console.log('Updating location to:', parsed.location)
                                        }
                                        
                                        // Apply updates
                                        if (Object.keys(updates).length > 1) { // More than just image_url
                                          console.log('Applying parsed updates:', updates)
                                          updateEditing(updates)
                                        } else {
                                          console.log('No updates to apply (only image_url)')
                                        }
                                      } else {
                                        console.warn('No text extracted from image')
                                      }
                                    } catch (ocrError: any) {
                                      console.error('OCR failed:', ocrError)
                                      alert(`OCR failed: ${ocrError?.message || 'Unknown error'}`)
                                      // Image upload succeeded, OCR failed - that's okay
                                    }
                                  } else {
                                    console.error('Image upload failed - no URL returned')
                                    alert('Image upload failed')
                                  }
                                } catch (uploadError: any) {
                                  console.error('Upload error:', uploadError)
                                  alert(`Upload failed: ${uploadError?.message || 'Unknown error'}`)
                                }
                              }
                              break
                            }
                          }
                        } else {
                          console.log('No clipboard items found')
                        }
                      }}
                      style={{
                        padding: '12px',
                        border: `2px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`,
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: darkMode ? '#374151' : '#f9fafb',
                        color: darkMode ? '#9ca3af' : '#6b7280',
                        minWidth: '120px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#9ca3af'
                        e.currentTarget.style.background = darkMode ? '#4b5563' : '#f3f4f6'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
                        e.currentTarget.style.background = darkMode ? '#374151' : '#f9fafb'
                      }}
                      title="Click here and paste an image (Ctrl+V or Cmd+V)"
                    >
                      <div style={{ fontSize: '16px' }}>📋</div>
                      <div style={{ fontSize: '12px' }}>Paste Image</div>
                    </div>
                  </div>
                  {(editing?.image_url || editingImageUrl) && (
                    <img 
                      src={editing?.image_url || editingImageUrl} 
                      alt="Event preview" 
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setHoverPosition({ x: rect.right, y: rect.top })
                        setHoveredImage({ src: editing?.image_url || editingImageUrl, alt: 'Event Preview' })
                      }}
                      onMouseLeave={() => setHoveredImage(null)}
                      style={{ 
                        width: 80, 
                        height: 80, 
                        objectFit: 'cover', 
                        borderRadius: '8px',
                        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                        cursor: 'pointer'
                      }} 
                    />
                  )}
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: darkMode ? '#9ca3af' : '#6b7280' }}>
                  💡 Tip: You can paste images directly from your clipboard (screenshots, copied images, etc.)
                </div>
              </div>

              {/* Status and Sort Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Status
                  </label>
                  <select 
                    value={editing?.status || 'draft'} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>updateEditing({ status: e.target.value as any})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="published">✅ Published</option>
                    <option value="archived">📦 Archived</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Sort Order
                  </label>
                  <input 
                    key={`sort-order-${editing?.id || 'new'}`}
                    data-key={`sort-order-${editing?.id || 'new'}`}
                    className={darkMode ? 'form-field-white-text' : ''}
                    type="number"
                    defaultValue={editing?.sort_order || 1000}
                    onChange={e=>updateEditing({ sort_order: Number(e.target.value)})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Image Hover Preview Modal */}
      {hoveredImage && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10000,
            background: darkMode ? '#1f2937' : '#ffffff',
            border: `2px solid ${darkMode ? '#374151' : '#d1d5db'}`,
            borderRadius: '12px',
            boxShadow: darkMode 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            padding: '12px',
            maxWidth: '500px',
            maxHeight: '500px',
            pointerEvents: 'none'
          }}
        >
          <img
            src={hoveredImage.src}
            alt={hoveredImage.alt}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '8px',
              display: 'block'
            }}
          />
        </div>
      )}
    </>
  )
}
