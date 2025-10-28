import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'

type EventRow = {
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
  ocr_text?: string | null
  status?: string | null
  sort_order?: number | null
  created_by?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

const slugify = (s: string) => s
  .toLowerCase()
    .replace(/[''`]/g, '') // Remove apostrophes and similar characters
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, '') // Remove leading/trailing hyphens

  const formatTimeToAMPM = (timeStr: string | null) => {
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

  const convertTo24Hour = (timeStr: string | null, isEndTime: boolean = false, startTime?: string | null) => {
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
        // AM: 12 becomes 0, others stay the same
        if (hours === 12) hours = 0
      } else { // PM
        // PM: 1-11 add 12, 12 stays 12
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
      
      // Convert all numbers to proper time format
      if (hours >= 1 && hours <= 9) {
        // For start_time: assume AM (4 → 04:00)
        // For end_time: be smart about AM/PM based on start_time
        if (isEndTime) {
          // End time: be smart about AM/PM based on start_time
          if (startTime && startTime !== null) {
            const startHour = parseInt(startTime.split(':')[0])
            // For end times, we need to be smarter:
            // - If start_time is in the morning (0-11) and end_time number is less than start_time, assume PM
            // - If start_time is in the morning (0-11) and end_time number is >= start_time, assume AM
            // - If start_time is in the afternoon/evening (12-23), assume end_time is also PM
            if (startHour >= 0 && startHour <= 11) {
              // Start time is AM
              if (hours < startHour) {
                // End time number is less than start time, assume PM
                hours += 12
              } else {
                // End time number is >= start time, assume AM
                // No conversion needed for AM times
              }
            } else {
              // Start time is PM, so end time should also be PM
              hours += 12
            }
          } else {
            // No start_time context, default to PM for end_time
            hours += 12
          }
        } else {
          // Start time: assume AM for 1-9, keep 12 as 12
          // No conversion needed for AM times
        }
        return `${hours.toString().padStart(2, '0')}:00`
      } else if (hours === 10 || hours === 11) {
        // For 10 and 11: format as time and apply context logic
        if (isEndTime) {
          // End time: be smart about AM/PM based on start_time
          if (startTime && startTime !== null) {
            const startHour = parseInt(startTime.split(':')[0])
            // For end times, we need to be smarter:
            // - If start_time is in the morning (0-11) and end_time number is less than start_time, assume PM
            // - If start_time is in the morning (0-11) and end_time number is >= start_time, assume AM
            // - If start_time is in the afternoon/evening (12-23), assume end_time is also PM
            if (startHour >= 0 && startHour <= 11) {
              // Start time is AM
              if (hours < startHour) {
                // End time number is less than start time, assume PM
                hours += 12
              } else {
                // End time number is >= start time, assume AM
                // No conversion needed for AM times
              }
            } else {
              // Start time is PM, so end time should also be PM
              hours += 12
            }
          } else {
            // No start_time context, default to PM for end_time
            hours += 12
          }
        } else {
          // Start time: assume AM (10 → 10:00, 11 → 11:00)
          // No conversion needed for AM times
        }
        return `${hours.toString().padStart(2, '0')}:00`
      } else if (hours === 12) {
        // For 12: keep as 12 (noon/midnight)
        return `${hours.toString().padStart(2, '0')}:00`
      }
    }
    
    return timeStr // Return as-is if no pattern matches
  }

const formatISO = (d: Date) => d.toISOString().slice(0, 10)

function parseEventText(text: string) {
  console.log('Parsing OCR text:', text)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  console.log('OCR lines:', lines)
  
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
  let foundDate = false
  
  // First pass: find the first line with a date pattern
  for (const ln of lines) {
    if (!foundDate) {
      for (const pattern of datePatterns) {
        if (pattern.test(ln)) {
          dateLine = ln
          foundDate = true
          console.log('Found date line:', dateLine)
          break
        }
      }
    }
    if (!foundDate) {
    titleLines.push(ln)
  }
  }
  
  // If no date found in first pass, try a more aggressive search
  if (!foundDate) {
    console.log('No date found in first pass, trying aggressive search...')
    for (const ln of lines) {
      // Look for any numeric patterns that might be dates
      const numericPatterns = [
        /\d{1,2}\/\d{1,2}\/\d{2,4}/,
        /\d{1,2}-\d{1,2}-\d{2,4}/,
        /\d{4}-\d{1,2}-\d{1,2}/,
        /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i,
        /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*/i
      ]
      
      for (const pattern of numericPatterns) {
        if (pattern.test(ln)) {
          dateLine = ln
          foundDate = true
          console.log('Found date line (aggressive search):', dateLine)
          break
        }
      }
      if (foundDate) break
    }
  }
  
  const name = (titleLines.join(' ') || lines[0] || '').replace(/\s+/g, ' ').trim()
  console.log('Extracted name:', name)

  const allDay = /all\s*day/i.test(dateLine)
  const cleaned = dateLine.replace(/,?\s*All\s*day/i, '').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim()
  console.log('Cleaned date line:', cleaned)

  // Extract time information
  const timePattern = /(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)(?:\s*[-–—]\s*(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?))?/i
  const timeMatch = cleaned.match(timePattern)
  console.log('Time match:', timeMatch)
  
  let startTime = null
  let endTime = null
  
  if (timeMatch) {
    const startTimeStr = timeMatch[1]
    const endTimeStr = timeMatch[2]
    
    console.log('Extracted start time string:', startTimeStr)
    console.log('Extracted end time string:', endTimeStr)
    
    // Convert to 24-hour format for HTML time inputs
    const convertTo24Hour = (timeStr: string) => {
      const cleanTime = timeStr.trim()
      const isPM = /[Pp][Mm]/.test(cleanTime)
      const isAM = /[Aa][Mm]/.test(cleanTime)
      
      let [hours, minutes] = cleanTime.replace(/[AaPp][Mm]/gi, '').split(':').map(Number)
      
      if (isPM && hours !== 12) hours += 12
      if (isAM && hours === 12) hours = 0
      
      const result = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      console.log('Converted time:', cleanTime, '->', result)
      return result
    }
    
    startTime = convertTo24Hour(startTimeStr)
    if (endTimeStr) {
      endTime = convertTo24Hour(endTimeStr)
    } else {
      console.log('No end time found in time match')
    }
    
    console.log('Final start time:', startTime)
    console.log('Final end time:', endTime)
  }

  // Enhanced date parsing with multiple attempts
  const tryParseDate = (s: string) => {
    console.log('Attempting to parse date:', s)
    
    // Try different parsing approaches
    const attempts = [
      s, // Original string
      s.replace(/,/g, ''), // Remove commas
      s.replace(/\s+/g, ' ').trim(), // Normalize spaces
      s.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*,?\s*/i, ''), // Remove day names
      s.replace(/(?:st|nd|rd|th)/gi, ''), // Remove ordinal suffixes
      s.replace(/\bof\s+/gi, ''), // Remove "of" from "15th of March"
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
        const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(monthName.substring(0, 3))
        if (monthIndex !== -1) {
          const d = new Date(parseInt(year), monthIndex, parseInt(day))
          if (!isNaN(d.getTime())) {
            console.log('Manual month parse successful:', d.toISOString())
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

  let startDate: string | null = null
  let endDate: string | null = null
  
  if (cleaned) {
    const parsedDate = tryParseDate(cleaned)
    if (parsedDate) {
      startDate = formatISO(parsedDate)
      endDate = formatISO(parsedDate) // Default to same date for single-day events
    }
  }
  
  console.log('Parsed dates - start:', startDate, 'end:', endDate)

  return {
    name,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
    status: 'draft' as const,
    recurrence: 'Annual',
    website_url: null as string | null,
    location: null as string | null,
    time_all_day: allDay as any
  }
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

function toCSV(rows: any[], headers: string[]): string {
  const esc = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(headers.map(h => esc(r[h])).join(','))
  return lines.join('\n')
}

function downloadTemplateCSV() {
  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order']
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
  const [allRows, setAllRows] = useState<EventRow[]>([]) // Store all events for client-side filtering
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[] | null>(null)

  // Helper function for button styles
  const getButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#374151' : '#ffffff',
    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
    color: darkMode ? '#f9fafb' : '#374151',
    borderRadius: '6px'
  })

  // Helper function for success button styles
  const getSuccessButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#065f46' : '#10b981',
    border: `1px solid ${darkMode ? '#047857' : '#059669'}`,
    color: '#ffffff',
    borderRadius: '6px'
  })

  // Helper function for warning button styles (muted in dark mode)
  const getWarningButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#374151' : '#f59e0b',
    border: `1px solid ${darkMode ? '#4b5563' : '#d97706'}`,
    color: darkMode ? '#f9fafb' : '#ffffff',
    borderRadius: '6px',
    fontWeight: '500'
  })

  // Helper function for danger button styles (muted in dark mode)
  const getDangerButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#7f1d1d' : '#ef4444',
    border: `1px solid ${darkMode ? '#991b1b' : '#dc2626'}`,
    color: '#ffffff',
    borderRadius: '6px',
    fontWeight: '500'
  })

  // Helper function for primary button styles
  const getPrimaryButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#1e40af' : '#3b82f6',
    border: `1px solid ${darkMode ? '#1d4ed8' : '#2563eb'}`,
    color: '#ffffff',
    borderRadius: '6px'
  })

  // Helper function for secondary button styles
  const getSecondaryButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#4b5563' : '#6b7280',
    border: `1px solid ${darkMode ? '#6b7280' : '#9ca3af'}`,
    color: '#ffffff',
    borderRadius: '6px'
  })
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'start_date' | 'end_date' | 'name' | 'location' | 'status' | 'start_time' | 'end_time' | 'created_at'>('start_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const handleSort = (column: 'start_date' | 'end_date' | 'name' | 'location' | 'status' | 'start_time' | 'end_time' | 'created_at') => {
    if (sortBy === column) {
      // If clicking the same column, toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // If clicking a different column, set it as sort column and default to asc
      setSortBy(column)
      setSortOrder('asc')
    }
  }

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
  const [ocrDraft, setOcrDraft] = useState<Partial<EventRow> | null>(() => {
    const saved = localStorage.getItem('events-ocr-draft')
    return saved ? JSON.parse(saved) : null
  })
  const [ocrImageUrl, setOcrImageUrl] = useState<string | null>(null)
  const [ocrImageUploading, setOcrImageUploading] = useState(false)
  const [ocrPasteReady, setOcrPasteReady] = useState(false)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const ocrPasteRef = useRef<HTMLDivElement | null>(null)

  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order']

  // Reset OCR image states when OCR dialog opens
  useEffect(() => {
    if (ocrOpen) {
      // Reset OCR image states when opening OCR dialog
      setOcrImageUrl(null)
      setOcrImageUploading(false)
    }
  }, [ocrOpen])

  // Close edit dialog with ESC key
  useEffect(() => {
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape' && editing) {
        setEditing(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing])

  // Client-side filtering function
  const applyFilters = (events: EventRow[]) => {
    let filtered = events
    
    // Apply search filter
    if (q) {
      filtered = filtered.filter(event => 
        event.name.toLowerCase().includes(q.toLowerCase())
      )
    }
    
    setRows(filtered)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
    let query = supabase
      .from('events')
        .select('id, name, slug, description, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, status, sort_order, created_by, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
        .order('sort_order', { ascending: true })
      .order(sortBy, { ascending: sortOrder === 'asc' })

      // Only apply date filters server-side, not search
      if (from) query = query.gte('start_date', from)
      if (to) query = query.lte('start_date', to)

    const { data, error } = await query
      if (error) throw error
      const allEvents = (data ?? []) as EventRow[]
      setAllRows(allEvents)
      
      // Apply client-side search filtering
      applyFilters(allEvents)
    } catch (e: any) {
      console.error(e)
      setError(e?.message || 'Failed to load events')
    } finally {
    setLoading(false)
    }
  }

  const startNew = async () => {
    const { data: session } = await supabase.auth.getSession()
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
      status: 'draft',
      sort_order: 1000,
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
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

      const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order']
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
      .select('id, name, slug, description, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, status, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (q) query = query.ilike('name', `%${q}%`)
    if (from) query = query.gte('start_date', from)
    if (to) query = query.lte('start_date', to)

    query.then(async ({ data, error }) => {
    if (error) { alert(error.message); return }
    const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order']
    const csv = toCSV(data || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
      a.href = url; a.download = 'events_export.csv'; a.click()
      URL.revokeObjectURL(url)
    })
  }

  async function handlePaste(ev: React.ClipboardEvent<HTMLDivElement>) {
    console.log('OCR handlePaste triggered')
    console.log('OCR handlePaste event:', ev)
    console.log('OCR handlePaste target:', ev.target)
    ev.preventDefault()
    setOcrPasteReady(false) // Reset ready state when paste happens
    setOcrProcessing(true) // Show processing state
    const items = ev.clipboardData?.items
    console.log('OCR clipboard items:', items)
    if (!items) {
      console.log('No clipboard items found')
      setOcrProcessing(false)
      return
    }
    
    for (let i=0; i<items.length; i++) {
      const it = items[i]
      console.log(`OCR item ${i}:`, it.kind, it.type)
      
      // Check for file items
      if (it.kind === 'file') {
        const file = it.getAsFile()
        console.log('OCR file item:', file)
        if (file && file.type.startsWith('image/')) {
          console.log('OCR image file found:', file.name, file.size, file.type)
          setOcrImageUrl(URL.createObjectURL(file))
          setOcrImageUploading(true)
          await runOCRFromFile(file)
          setOcrImageUploading(false)
          setOcrProcessing(false) // Hide processing state when done
          break
        }
      }
    }
    setOcrProcessing(false) // Hide processing state if no image found
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
        setOcrDraft(parsed as Partial<EventRow>)
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

    console.log('OCR Draft before save:', ocrDraft)

    const payload: any = {
      name: ocrDraft.name || '',
      slug: (ocrDraft as any).slug || (ocrDraft.name ? slugify(ocrDraft.name) : ''),
      description: ocrDraft.description ?? null,
      host_org: ocrDraft.host_org ?? null,
      start_date: ocrDraft.start_date ?? null,
      end_date: ocrDraft.end_date ?? ocrDraft.start_date ?? null,
      start_time: ocrDraft.start_time ?? null,
      end_time: ocrDraft.end_time ?? null,
      location: ocrDraft.location ?? null,
      recurrence: ocrDraft.recurrence ?? null,
      website_url: ocrDraft.website_url ?? null,
      ocr_text: ocrRawText || null,
      status: (ocrDraft.status as any) || 'draft',
      sort_order: ocrDraft.sort_order ?? 1000,
      created_by: uid
    }

    console.log('Payload being sent:', payload)

    if (!payload.name) { alert('Name is required'); return }
    if (!payload.slug) { alert('Slug is required'); return }

    const { error } = await supabase.from('events').insert(payload)
    if (error) { alert(error.message); return }
    setOcrOpen(false); setOcrDraft(null); setOcrRawText(''); setOcrImageUrl(null)
    localStorage.removeItem('events-ocr-draft')
    localStorage.removeItem('events-ocr-text')
    localStorage.setItem('events-ocr-open', 'false')
    await load()
  }

  const save = async () => {
    if (!editing) return
    const payload = { ...editing }

    console.log('Save function - editing state:', editing)
    console.log('Save function - start_date:', payload.start_date, 'type:', typeof payload.start_date)
    console.log('Save function - end_date:', payload.end_date, 'type:', typeof payload.end_date)
    console.log('Save function - start_time:', payload.start_time, 'type:', typeof payload.start_time)
    console.log('Save function - end_time:', payload.end_time, 'type:', typeof payload.end_time)
    console.log('Save function - full payload:', payload)

    if (!payload.name) return alert('Name is required')
    if (!payload.slug) payload.slug = slugify(payload.name)

    if (payload.id) {
      const updateData = {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        host_org: payload.host_org,
        start_date: payload.start_date,
        end_date: payload.end_date,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        location: payload.location,
        recurrence: payload.recurrence,
        website_url: payload.website_url,
        ocr_text: payload.ocr_text,
        status: payload.status,
        sort_order: payload.sort_order
      }
      
      console.log('Database update data:', updateData)
      console.log('Updating event with ID:', payload.id)
      
      const { error } = await supabase.from('events').update(updateData).eq('id', payload.id)
      if (error) { 
        console.error('Database update error:', error)
        alert(`Update error: ${error.message}`); 
        return 
      }
      console.log('Database update successful')
    } else {
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('events').insert(insertable).select().single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }

    setEditing(null)
    await load()
  }

  const softDelete = async (id: string) => {
    if (!confirm('Delete this event? (soft delete)')) return
    const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  useEffect(() => {
    load()
  }, [])

  // Trigger server reload when date filters or sorting changes
  useEffect(() => {
    load()
  }, [from, to, sortBy, sortOrder])

  // Apply client-side search filtering when search query changes
  useEffect(() => {
    applyFilters(allRows)
  }, [q, allRows])

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
    <div style={{ 
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      {/* Two-row toolbar layout */}
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
          borderRadius: '4px'
        }}
      >
        {/* Top row: Module title and Action buttons */}
        <div
          style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginBottom: 12
          }}
        >
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
          <span style={{ 
            fontSize: '16px',
            filter: darkMode ? 'brightness(1.2) contrast(1.1)' : 'none',
            textShadow: darkMode ? '0 0 2px rgba(255,255,255,0.3)' : 'none'
          }}>✨</span>
          <span>New</span>
        </button>
        
        <button 
          className="btn" 
          onClick={() => setOcrOpen(true)} 
          disabled={importing}
          style={getButtonStyle({
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px'
          })}
          title="Add event from image using OCR"
        >
          <span>🔍</span>
          <span>OCR</span>
        </button>
        
        <button 
          className="btn" 
          onClick={load} 
          disabled={loading || importing}
          style={getButtonStyle({ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          })}
          title="Refresh events list"
        >
          <span>{loading ? '⏳' : '🔄'}</span>
          <span>{loading ? 'Loading…' : 'Refresh'}</span>
        </button>
        
        <button 
          className="btn" 
          onClick={downloadTemplateCSV} 
          disabled={importing}
          style={getButtonStyle({ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          })}
          title="Download CSV template"
        >
          <span>📋</span>
          <span>Template</span>
        </button>
        
        <button 
          className="btn" 
          onClick={exportCSV} 
          disabled={importing}
          style={getButtonStyle({ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '8px 12px'
          })}
          title="Export all events to CSV"
        >
          <span>📤</span>
          <span>Export</span>
        </button>
          
        <label 
          className="btn" 
          style={getButtonStyle({ 
            cursor: 'pointer', 
            opacity: importing ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px'
          })}
          title="Import events from CSV file"
        >
          <span>📥</span>
          <span>Import</span>
          <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImportFile} style={{ display: 'none' }} disabled={importing} />
        </label>
          
          <button 
            className="btn" 
            onClick={bulkSetStatusFromDates} 
            title="Set status to upcoming/ongoing/past based on dates"
            style={getButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>🤖</span>
            <span>Auto Status</span>
          </button>
          
          <button 
            className="btn" 
            onClick={bulkFillEndDates} 
            title="Fill missing end_date = start_date"
            style={getButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>📅</span>
            <span>Fill Dates</span>
          </button>
          
          <button 
            className="btn" 
            onClick={bulkGenerateSlugs} 
            title="Create slugs for rows missing them"
            style={getButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>🔗</span>
            <span>Gen Slugs</span>
          </button>
          
          <button 
            className="btn success" 
            onClick={bulkPublish} 
            title="Publish selected"
            style={getSuccessButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>🚀</span>
            <span>Publish</span>
          </button>
          
          <button 
            className="btn warning" 
            onClick={bulkArchive} 
            title="Archive selected"
            style={getWarningButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>📦</span>
            <span>Archive</span>
          </button>
          
          <button 
            className="btn danger" 
            onClick={bulkDelete} 
            title="Soft delete selected"
            style={getDangerButtonStyle({ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            })}
          >
            <span>🗑️</span>
            <span>Delete</span>
          </button>
        </div>

        {/* Bottom row: Search and filter controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <input 
              placeholder="Search name…" 
              value={q} 
              onChange={(e)=>setQ(e.target.value)} 
              style={{ 
                width: '100%',
                padding: '8px 32px 8px 8px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937'
              }} 
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                title="Clear (circle.square)"
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: darkMode ? '#d1d5db' : '#6b7280',
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1
                }}
              >
                {/* X mark with circle around it, hollow */}
                ⨂
              </button>
            )}
          </div>
          
          <label style={{ color: darkMode ? '#f9fafb' : '#374151' }}>
            From <input 
              type="date" 
              value={from} 
              onChange={e=>setFrom(e.target.value)} 
              style={{
                background: darkMode ? '#374151' : '#ffffff',
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
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                padding: '4px'
              }}
            />
          </label>
          
          <label style={{ color: darkMode ? '#f9fafb' : '#374151', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Sort by
            <select 
              value={sortBy} 
              onChange={e=>setSortBy(e.target.value as any)} 
              style={{
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                padding: '4px 8px',
                fontSize: '12px'
              }}
            >
              <option value="start_date">Start Date</option>
              <option value="name">Name</option>
              <option value="created_at">Created</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
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
            <button 
              className="btn success" 
              onClick={confirmImport} 
              disabled={importErrors.length>0}
              style={getSuccessButtonStyle({ padding: '8px 16px' })}
            >
              Confirm Import
            </button>{' '}
            <button 
              className="btn secondary" 
              onClick={()=>{ setImporting(false); setImportPreview(null); setImportErrors([]) }}
              style={getSecondaryButtonStyle({ padding: '8px 16px' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {ocrOpen && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, marginBottom: 12, background: '#fbfbfb' }}>
          <h3 style={{ marginTop: 0 }}>Add Event from Image</h3>
          <p>Paste an image here (⌘/Ctrl+V) or choose a file. We'll OCR the text, parse it, and let you verify before saving.</p>

          {/* Image upload/paste UI removed as requested */}

          {ocrLoading && (
            <div style={{ marginTop: 12 }}>Running OCR…</div>
          )}
          {ocrError && (
            <div style={{ marginTop: 12, color: '#b91c1c' }}>Error: {ocrError}</div>
          )}

          {(ocrRawText || ocrDraft) && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
                {/* Left side - Form fields */}
              <div>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>Event Details</h4>
                  <div style={{ display: 'grid', gap: 16 }}>
                    {/* Name and Slug row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Event Name *
                  </label>
                        <input 
                          value={ocrDraft?.name ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), name: e.target.value, slug: slugify(e.target.value) })} 
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="Enter event name"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Slug
                        </label>
                        <input 
                          value={(ocrDraft as any)?.slug ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), slug: slugify(e.target.value) })} 
                          onPaste={e=>{
                            e.preventDefault()
                            const pastedText = e.clipboardData.getData('text')
                            setOcrDraft({ ...(ocrDraft||{}), slug: slugify(pastedText) })
                          }}
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="event-slug"
                        />
                      </div>
                </div>

                    {/* Description */}
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                        Description
                      </label>
                      <textarea 
                        value={ocrDraft?.description ?? ''} 
                        onChange={e=>setOcrDraft({ ...(ocrDraft||{}), description: e.target.value })} 
                        style={{ 
                          width: '100%', 
                          padding: '8px 12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          fontSize: '14px',
                          minHeight: '80px',
                          resize: 'vertical'
                        }} 
                        placeholder="Enter event description"
                      />
                </div>

                    {/* Host Org and Location row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Host Organization
                        </label>
                        <input 
                          value={ocrDraft?.host_org ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), host_org: e.target.value })} 
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="Organization name"
                        />
                </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Location
                        </label>
                        <input 
                          value={ocrDraft?.location ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), location: e.target.value })} 
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="Event location"
                        />
              </div>
                    </div>

                    {/* Date row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Start Date
                        </label>
                        <input 
                          type="date" 
                          value={ocrDraft?.start_date ?? ''} 
                          onChange={e=>{
                            const newStartDate = e.target.value
                            const currentEndDate = ocrDraft?.end_date
                            const today = new Date().toISOString().slice(0, 10)
                            
                            let updatedEndDate = currentEndDate
                            
                            // If end date is today, blank, or null, set it to the start date
                            if (!currentEndDate || currentEndDate === '' || currentEndDate === today) {
                              updatedEndDate = newStartDate
                              console.log('OCR End date is today/blank/null, setting to start date:', newStartDate)
                            }
                            // If end date exists and is before the new start date, set it to the start date
                            else if (currentEndDate && newStartDate && currentEndDate < newStartDate) {
                              updatedEndDate = newStartDate
                              console.log('OCR End date is before start date, adjusting to start date')
                            }
                            
                            setOcrDraft({
                              ...(ocrDraft||{}),
                              start_date: newStartDate,
                              end_date: updatedEndDate
                            })
                          }}
                          onInput={e=>{
                            const newStartDate = e.currentTarget.value
                            const currentEndDate = ocrDraft?.end_date
                            
                            // If end date exists and is before the new start date, set it to the start date
                            let updatedEndDate = currentEndDate
                            if (currentEndDate && newStartDate && currentEndDate < newStartDate) {
                              updatedEndDate = newStartDate
                            }
                            
                            setOcrDraft({
                              ...(ocrDraft||{}),
                              start_date: newStartDate,
                              end_date: updatedEndDate
                            })
                          }}
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                        />
              </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          End Date
                        </label>
                        <input 
                          type="date" 
                          value={ocrDraft?.end_date ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), end_date: e.target.value })} 
                          onInput={e=>setOcrDraft({ ...(ocrDraft||{}), end_date: e.currentTarget.value })}
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                        />
            </div>
        </div>

                    {/* Time row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Start Time
                        </label>
                        <input 
                          type="text" 
                          value={ocrDraft?.start_time ?? ''} 
                          onChange={e=>{
                            const inputValue = e.target.value
                            console.log('OCR Start time input:', inputValue)
                            
                            // Store the raw input value without conversion, convert empty string to null
                            setOcrDraft({
                              ...(ocrDraft||{}),
                              start_time: inputValue === '' ? null : inputValue
                            })
                          }}
                          onBlur={e=>{
                            const inputValue = e.target.value
                            const convertedTime = convertTo24Hour(inputValue, false)
                            console.log('OCR Start time blur - converting:', inputValue, 'to:', convertedTime)
                            
                            // If end time exists and is before the new start time, set it to the start time
                            const currentEndTime = ocrDraft?.end_time
                            let updatedEndTime = currentEndTime
                            if (currentEndTime && convertedTime && currentEndTime < convertedTime) {
                              console.log('OCR End time is before new start time, adjusting end time to start time')
                              updatedEndTime = convertedTime
                            }
                            
                            setOcrDraft({
                              ...(ocrDraft||{}),
                              start_time: convertedTime,
                              end_time: updatedEndTime
                            })
                          }}
                          placeholder="HH:MM (e.g., 14:30)"
                          pattern="[0-9]{2}:[0-9]{2}"
                          title="Enter time in HH:MM format (24-hour)"
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: '#fff',
                            cursor: 'pointer'
                          }} 
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          End Time
                        </label>
                        <input 
                          type="text" 
                          value={ocrDraft?.end_time ?? ''} 
                          onChange={e=>{
                            const inputValue = e.target.value
                            console.log('OCR End time input:', inputValue)
                            
                            // Store the raw input value without conversion, convert empty string to null
                            setOcrDraft({
                              ...(ocrDraft||{}),
                              end_time: inputValue === '' ? null : inputValue
                            })
                          }}
                          onBlur={e=>{
                            const inputValue = e.target.value
                            const convertedTime = convertTo24Hour(inputValue, true, ocrDraft?.start_time)
                            console.log('OCR End time blur - converting:', inputValue, 'to:', convertedTime)
                            
                            // Check if end time is before start time
                            const startTime = ocrDraft?.start_time
                            if (startTime && convertedTime && convertedTime < startTime) {
                              console.log('OCR End time is before start time, adjusting...')
                              setOcrDraft({ ...(ocrDraft||{}), end_time: startTime })
                            } else {
                              setOcrDraft({ ...(ocrDraft||{}), end_time: convertedTime })
                            }
                          }}
                          placeholder="HH:MM (e.g., 16:30)"
                          pattern="[0-9]{2}:[0-9]{2}"
                          title="Enter time in HH:MM format (24-hour)"
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px',
                            background: '#fff',
                            cursor: 'pointer'
                          }} 
                        />
                      </div>
                    </div>

                    {/* Website and Recurrence row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Website URL
                        </label>
                        <input 
                          value={ocrDraft?.website_url ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), website_url: e.target.value })} 
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="https://example.com"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                          Recurrence
                        </label>
                        <input 
                          value={ocrDraft?.recurrence ?? ''} 
                          onChange={e=>setOcrDraft({ ...(ocrDraft||{}), recurrence: e.target.value })} 
                          style={{ 
                            width: '100%', 
                            padding: '8px 12px', 
                            border: '1px solid #d1d5db', 
                            borderRadius: '6px',
                            fontSize: '14px'
                          }} 
                          placeholder="Annual, Monthly, etc."
                        />
                      </div>
                    </div>

                    {/* OCR Text Display */}
                    <div>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>OCR Text</h4>
                      <div style={{ 
                        background: '#ffffff', 
                            border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        padding: '16px',
                        minHeight: '200px',
                            fontSize: '14px',
                        lineHeight: '1.5',
                        color: '#374151',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {ocrRawText || 'No OCR text available'}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                        Status
              </label>
                      <select 
                        value={(ocrDraft?.status as any) ?? 'draft'} 
                        onChange={e=>setOcrDraft({ ...(ocrDraft||{}), status: e.target.value as any })}
                        style={{ 
                          width: '100%', 
                          padding: '8px 12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '6px',
                          fontSize: '14px',
                          backgroundColor: 'white'
                        }}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
              </div>

            </div>

                  <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                    <button 
                      className="btn success" 
                      onClick={confirmOcrInsert} 
                      disabled={!ocrDraft || !ocrDraft.name}
                      style={getSuccessButtonStyle({ padding: '10px 20px', fontSize: '14px', fontWeight: '500' })}
                    >
                      Create Event
                    </button>
                    <button 
                      className="btn secondary" 
                      onClick={()=>{ 
                        setOcrOpen(false); 
                        setOcrDraft(null); 
                        setOcrRawText(''); 
                        setOcrImageUrl(null); 
                        setOcrError(null);
                        localStorage.removeItem('events-ocr-draft');
                        localStorage.removeItem('events-ocr-text');
                        localStorage.setItem('events-ocr-open', 'false');
                      }}
                      style={getSecondaryButtonStyle({ padding: '10px 20px', fontSize: '14px' })}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Right side - OCR Text */}
                <div>
                  {/* OCR Text Display */}

                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>OCR Text</h4>
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      value={ocrRawText} 
                      onChange={e=>{ setOcrRawText(e.target.value); setOcrDraft(parseEventText(e.target.value) as any) }} 
                      style={{ 
                        width: '100%', 
                        minHeight: '400px', 
                        padding: '12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        lineHeight: '1.5',
                        resize: 'vertical'
                      }} 
                      placeholder="OCR text will appear here..."
                    />
                    <div style={{ 
                      position: 'absolute', 
                      top: '8px', 
                      right: '8px', 
                      background: '#f3f4f6', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      {ocrRawText.length} characters
                    </div>
                  </div>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                    Edit the text above to refine the parsed event details. Changes will automatically update the form fields.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <table className="table" style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        background: darkMode ? '#1f2937' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937'
      }}>
          <thead style={{
            position: 'sticky',
            top: '176px',
            zIndex: 110,
            background: darkMode ? '#374151' : '#f8f9fa'
          }}>
            <tr>
            <th style={{ 
              textAlign: 'left', 
              padding: '8px 6px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              position: 'sticky',
              top: '176px',
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
            <th 
              onClick={() => handleSort('name')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('start_date')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              Start {sortBy === 'start_date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('end_date')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              End {sortBy === 'end_date' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('start_time')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              Start Time {sortBy === 'start_time' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('end_time')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              End Time {sortBy === 'end_time' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('location')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th 
              onClick={() => handleSort('status')}
              style={{ 
                textAlign: 'left', 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
                background: darkMode ? '#374151' : '#f8f9fa',
                color: darkMode ? '#f9fafb' : '#1f2937',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'sticky',
                top: '176px',
                zIndex: 110
              }}
            >
              Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={{ 
              textAlign: 'left', 
              padding: '8px 6px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              position: 'sticky',
              top: '176px',
              zIndex: 110
            }}>Website</th>
            <th style={{ 
              textAlign: 'left', 
              padding: '8px 6px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              position: 'sticky',
              top: '176px',
              zIndex: 110,
              minWidth: '200px' 
            }}>Actions</th>
            </tr>
          </thead>
          <tbody>
          {rows
            .sort((a, b) => {
              let aVal = a[sortBy]
              let bVal = b[sortBy]
              
              // Handle null/undefined values
              if (aVal == null && bVal == null) return 0
              if (aVal == null) return sortOrder === 'asc' ? 1 : -1
              if (bVal == null) return sortOrder === 'asc' ? -1 : 1
              
              // Handle date sorting
              if (sortBy === 'start_date' || sortBy === 'end_date') {
                const aTime = new Date(aVal).getTime()
                const bTime = new Date(bVal).getTime()
                if (aTime < bTime) return sortOrder === 'asc' ? -1 : 1
                if (aTime > bTime) return sortOrder === 'asc' ? 1 : -1
                return 0
              }
              
              // Handle string sorting
              if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortOrder === 'asc' 
                  ? aVal.localeCompare(bVal)
                  : bVal.localeCompare(aVal)
              }
              
              // Handle numeric sorting
              if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
              if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
              return 0
            })
            .map((r) => (
            <tr 
              key={r.id ?? r.slug ?? r.name}
              onClick={() => setEditing(r)}
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
              <td 
                style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                  background: 'transparent'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(r.id!.toString())} 
                  onChange={e=>toggleSelect(r.id!.toString(), e.target.checked)} 
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6'
                  }}
                />
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                <div style={{ fontWeight: 600, color: darkMode ? '#f9fafb' : '#1f2937' }}>{r.name}</div>
                {r.host_org ? (
                  <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#666' }}>Host: {r.host_org}</div>
                ) : null}
                {r.recurrence ? (
                  <div style={{ fontSize: 12, color: '#666' }}>{r.recurrence}</div>
                ) : null}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                {r.start_date ? new Date(r.start_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                {r.end_date ? new Date(r.end_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                {formatTimeToAMPM(r.start_time)}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                {formatTimeToAMPM(r.end_time)}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>{r.location ?? ''}</td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  background: 'transparent !important',
                  border: 'none !important',
                  padding: '0 !important',
                  borderRadius: '0 !important',
                  color: r.status === 'published' 
                    ? (darkMode ? '#10b981' : '#2e7d32')
                    : (darkMode ? '#e5e7eb' : '#374151')
                }}>
                  {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                  {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                </span>
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                {r.website_url && r.website_url.trim() ? (
                  <a 
                    href={r.website_url} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{
                      textDecoration: 'underline',
                      color: darkMode ? '#93c5fd' : '#1d4ed8',
                      background: 'transparent !important',
                      border: 'none !important',
                      padding: '0 !important',
                      borderRadius: '0 !important',
                      boxShadow: 'none !important'
                    }}
                    title="Open link in new tab"
                  >
                    {(() => {
                      try {
                        const u = new URL(r.website_url!)
                        return u.hostname.replace(/^www\./, '')
                      } catch {
                        return r.website_url
                      }
                    })()}
                  </a>
                ) : (
                  <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                )}
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button 
                    className="btn primary" 
                    onClick={(e) => {
                      e.stopPropagation()
                      copyEvent(r)
                    }} 
                    style={getPrimaryButtonStyle({ 
                      padding: '6px 10px', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '4px'
                    })}
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
                    style={getDangerButtonStyle({ 
                      padding: '6px 10px', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '4px'
                    })}
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

        <AutoSaveEditDialog
          key="event-dialog"
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          title={editing?.id ? '✏️ Edit Event' : '➕ New Event'}
          maxWidth="800px"
          darkMode={darkMode}
          editing={editing}
          rows={rows}
          saveFunction={save}
          setEditing={(item) => setEditing(item as EventRow | null)}
          itemType="event"
        >
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Event Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <FormField
                  label="Event Name"
                  name="name"
                  value={editing?.name || ''}
                  onChange={(value) => setEditing({...editing!, name: value as string, slug: slugify(value as string)})}
                  required
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
                <FormField
                  label="Slug"
                  name="slug"
                  value={editing?.slug || ''}
                  onChange={(value) => setEditing({...editing!, slug: slugify(value as string)})}
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              <FormField
                label="Description"
                name="description"
                value={editing?.description || ''}
                onChange={(value) => setEditing({...editing!, description: value as string})}
                type="textarea"
                minHeight="100px"
                editingId={editing?.id?.toString()}
                darkMode={darkMode}
              />

              {/* Host Org and Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Host Organization"
                  name="host_org"
                  value={editing?.host_org || ''}
                  onChange={(value) => setEditing({...editing!, host_org: value as string})}
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
                <FormField
                  label="Location"
                  name="location"
                  value={editing?.location || ''}
                  onChange={(value) => setEditing({...editing!, location: value as string})}
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Start Date"
                  name="start_date"
                  value={editing?.start_date || ''}
                  onChange={(value) => {
                    const newStartDate = value as string
                    const currentEndDate = editing?.end_date
                    const today = new Date().toISOString().slice(0, 10)
                    
                    console.log('Start date changed to:', newStartDate)
                    
                    let updatedEndDate = currentEndDate
                    
                    // If end date is today, blank, or null, set it to the start date
                    if (!currentEndDate || currentEndDate === '' || currentEndDate === today) {
                      updatedEndDate = newStartDate
                      console.log('End date is today/blank/null, setting to start date:', newStartDate)
                    }
                    // If end date exists and is before the new start date, set it to the start date
                    else if (currentEndDate && newStartDate && currentEndDate < newStartDate) {
                      updatedEndDate = newStartDate
                      console.log('End date is before start date, adjusting to start date')
                    }
                    
                    setEditing({
                      ...editing!,
                      start_date: newStartDate,
                      end_date: updatedEndDate
                    })
                  }}
                  onInput={(value) => {
                    const newStartDate = value as string
                    const currentEndDate = editing?.end_date
                    
                    console.log('Start date input to:', newStartDate)
                    
                    // If end date exists and is before the new start date, set it to the start date
                    let updatedEndDate = currentEndDate
                    if (currentEndDate && newStartDate && currentEndDate < newStartDate) {
                      updatedEndDate = newStartDate
                    }
                    
                    setEditing({
                      ...editing!,
                      start_date: newStartDate,
                      end_date: updatedEndDate
                    })
                  }}
                  type="date"
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
                <FormField
                  label="End Date"
                  name="end_date"
                  value={editing?.end_date || ''}
                  onChange={(value) => {
                    console.log('End date changed to:', value)
                    setEditing({...editing!, end_date: value as string})
                  }}
                  onInput={(value) => {
                    console.log('End date input to:', value)
                    setEditing({...editing!, end_date: value as string})
                  }}
                  type="date"
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              {/* Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Start Time"
                  name="start_time"
                  value={editing?.start_time ?? ''}
                  onChange={(value) => {
                    const inputValue = value as string
                    console.log('Start time input:', inputValue)
                    
                    // Store the raw input value without conversion, convert empty string to null
                    setEditing({
                      ...editing!,
                      start_time: inputValue === '' ? null : inputValue
                    })
                  }}
                  onBlur={(value) => {
                    const inputValue = value as string
                    const convertedTime = convertTo24Hour(inputValue, false)
                    console.log('Start time blur - converting:', inputValue, 'to:', convertedTime)
                    
                    // If end time exists and is before the new start time, set it to the start time
                    const currentEndTime = editing?.end_time
                    let updatedEndTime = currentEndTime
                    if (currentEndTime && convertedTime && currentEndTime < convertedTime) {
                      console.log('End time is before new start time, adjusting end time to start time')
                      updatedEndTime = convertedTime
                    }
                    
                    setEditing({
                      ...editing!,
                      start_time: convertedTime,
                      end_time: updatedEndTime
                    })
                  }}
                  placeholder="HH:MM (e.g., 14:30)"
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
                <FormField
                  label="End Time"
                  name="end_time"
                  value={editing?.end_time ?? ''}
                  onChange={(value) => {
                    const inputValue = value as string
                    console.log('End time input:', inputValue)
                    
                    // Store the raw input value without conversion, convert empty string to null
                    setEditing({
                      ...editing!,
                      end_time: inputValue === '' ? null : inputValue
                    })
                  }}
                  onBlur={(value) => {
                    const inputValue = value as string
                    const convertedTime = convertTo24Hour(inputValue, true, editing?.start_time)
                    console.log('End time blur - converting:', inputValue, 'to:', convertedTime)
                    
                    // Check if end time is before start time
                    const startTime = editing?.start_time
                    if (startTime && convertedTime && convertedTime < startTime) {
                      console.log('End time is before start time, adjusting...')
                      setEditing({...editing!, end_time: startTime})
                    } else {
                      setEditing({...editing!, end_time: convertedTime})
                    }
                  }}
                  placeholder="HH:MM (e.g., 16:30)"
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              {/* Website and Recurrence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Website URL
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <FormField
                      label=""
                      name="website_url"
                      value={editing?.website_url || ''}
                      onChange={(value) => setEditing({...editing!, website_url: value as string})}
                      type="url"
                      editingId={editing?.id?.toString()}
                      darkMode={darkMode}
                    />
                    {editing?.website_url && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = editing.website_url
                          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                            window.open(url, '_blank', 'noopener,noreferrer')
                          } else if (url) {
                            window.open(`https://${url}`, '_blank', 'noopener,noreferrer')
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title="Open URL in new tab"
                      >
                        🔗 Open
                      </button>
                    )}
                  </div>
                </div>
                <FormField
                  label="Recurrence"
                  name="recurrence"
                  value={editing?.recurrence || ''}
                  onChange={(value) => setEditing({...editing!, recurrence: value as string})}
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              {/* Status and Sort Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Status"
                  name="status"
                  value={editing?.status || 'draft'}
                  onChange={(value) => setEditing({...editing!, status: value as any})}
                  type="select"
                  options={[
                    { value: 'draft', label: '📝 Draft' },
                    { value: 'published', label: '✅ Published' },
                    { value: 'archived', label: '📦 Archived' }
                  ]}
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
                <FormField
                  label="Sort Order"
                  name="sort_order"
                  value={editing?.sort_order ?? 1000}
                  onChange={(value) => setEditing({...editing!, sort_order: value as number})}
                  type="number"
                  editingId={editing?.id?.toString()}
                  darkMode={darkMode}
                />
              </div>

              {/* OCR Text Display Section */}
              {editing?.ocr_text && (
              <div style={{ 
                marginTop: '24px', 
                padding: '16px', 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px' 
              }}>
                <h4 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  📝 Original OCR Text
                </h4>
                <div style={{ 
                  background: '#ffffff', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px', 
                  padding: '12px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  <pre style={{ 
                    margin: '0', 
                    fontSize: '12px', 
                    fontFamily: 'monospace',
                    lineHeight: '1.4',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {editing.ocr_text}
                  </pre>
                </div>
                <p style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: '12px', 
                  color: '#6b7280' 
                }}>
                  Original text extracted from the image
                </p>
              </div>
              )}
            </div>
          </div>
        </AutoSaveEditDialog>
    </div>
  )
}