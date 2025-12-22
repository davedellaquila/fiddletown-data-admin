/**
 * Events Feature Component
 * 
 * Admin interface for managing event data (concerts, festivals, markets, etc.).
 * 
 * Features:
 * - CRUD operations (Create, Read, Update, Delete)
 * - OCR image-to-event conversion (scan event flyers/images)
 * - CSV import/export
 * - Bulk actions (publish, archive, delete, duplicate)
 * - Advanced filtering (date range, keywords, search)
 * - Sortable columns
 * - Image upload and management
 * - Keyword tagging system
 * - Soft delete support
 * - Status management (draft, published, archived)
 * - Weekend date quick filters
 * - Image hover previews
 * 
 * Data Model:
 * - Events are stored in Supabase 'events' table
 * - Keywords are stored in 'keywords' table with many-to-many relationship via 'event_keywords'
 * - Images are stored in Supabase Storage 'events' bucket
 * - Uses soft deletes (deleted_at timestamp)
 * - Slug is auto-generated from name if not provided
 * 
 * OCR Integration:
 * - Uses Tesseract.js for OCR processing
 * - Parses event flyers/images to extract event details
 * - Auto-fills form fields from OCR results
 * 
 * @module Events
 */
import { useEffect, useState, useRef } from 'react'
import dupIcon from '../assets/duplicate.svg'
import trashIcon from '../assets/trash.svg'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'
import KeywordSelector from '../shared/components/KeywordSelector'
import ActionMenu, { ActionMenuItem } from '../shared/components/ActionMenu'
import { parseEventText as parseEventTextImproved } from '../shared/utils/ocrParser'
import { slugify } from '../../shared/utils/slugify'
import { normalizeUrl, formatTimeToAMPM, convertTo24Hour, formatISO } from '../../shared/utils/dateUtils'
import type { EventRow } from '../../shared/types/models'


/**
 * Run OCR on an image file using optimized Tesseract settings
 * 
 * Uses the same configuration as the OCR test page for consistent results.
 * Optimized for event flyer text recognition.
 * 
 * Configuration:
 * - PSM 6: Uniform block of text (good for flyers)
 * - OEM 3: Default engine (LSTM + Legacy)
 * 
 * @param file - Image file to process
 * @returns Extracted text from the image
 */
async function runOptimizedOCR(file: File): Promise<string> {
  const Tesseract = await import('tesseract.js')
  
  // Create worker with optimized configuration (same as test page)
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        // Progress logging if needed
      }
    }
  })

  // Set page segmentation mode and OCR engine mode (same defaults as test page)
  // PSM 6 = Uniform block of text, OEM 3 = Default (LSTM + Legacy)
  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    tessedit_ocr_engine_mode: '3',
  } as any)

  // Run OCR with optimized settings
  const { data } = await worker.recognize(file, {
    rectangle: undefined, // Process entire image
  })

  await worker.terminate()

  return (data?.text || '').trim()
}

/**
 * Parse OCR text and convert to event data format
 * 
 * Uses the improved OCR parser to extract event information from text.
 * Maps parsed data to the EventRow format expected by the component.
 * 
 * @param text - Raw OCR text from image processing
 * @returns Event data object with parsed fields
 */
function parseEventText(text: string) {
  console.log('Parsing OCR text with improved parser:', text)
  
  // Use the improved parser
  const parsed = parseEventTextImproved(text)
  console.log('Improved parser result:', parsed)
  
  // Map to the format expected by Events.tsx (add default fields)
  const result = {
    name: parsed.name || '',
    start_date: parsed.start_date || null,
    end_date: parsed.end_date || null,
    start_time: parsed.start_time || null,
    end_time: parsed.end_time || null,
    location: parsed.location || null,
    host_org: parsed.host_org || null,
    website_url: parsed.website_url || null,
    recurrence: parsed.recurrence || null,
    description: parsed.description || null,
    status: 'draft' as const,
    time_all_day: (!parsed.start_time && !parsed.end_time) as any
  }
  
  console.log('Final parsed result for Events.tsx:', result)
  console.log('Date values:', { 
    start_date: result.start_date, 
    end_date: result.end_date,
    start_time: result.start_time,
    end_time: result.end_time
  })
  
  return result
}

/**
 * Parse CSV text into a 2D array of strings
 * 
 * Handles quoted fields and commas within quotes.
 * Filters out empty rows.
 * 
 * @param text - Raw CSV text content
 * @returns 2D array where each inner array is a row of cells
 */
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

/**
 * Convert data rows to CSV format
 * 
 * Escapes values containing commas, quotes, or newlines.
 * Uses standard CSV escaping (wrap in quotes, double internal quotes).
 * 
 * @param rows - Array of data objects
 * @param headers - Column names to include in CSV
 * @returns CSV-formatted string
 */
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

/**
 * Download CSV template file
 * 
 * Provides a template CSV with column headers to help users
 * understand the expected format for imports.
 */
function downloadTemplateCSV() {
  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order','keywords','is_signature_event']
  const csv = toCSV([], headers) + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'events_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

/**
 * Props for Events component
 */
interface EventsProps {
  darkMode?: boolean // Whether dark mode is enabled
  sidebarCollapsed?: boolean // Whether sidebar is collapsed (affects dialog positioning)
}

/**
 * Events component
 * 
 * Main component for managing event data. Handles CRUD operations,
 * OCR processing, import/export, bulk actions, filtering, and keyword management.
 */
export default function Events({ darkMode = false, sidebarCollapsed = false }: EventsProps) {
  // Data state
  const [rows, setRows] = useState<EventRow[]>([]) // Filtered events (displayed in table)
  const [allRows, setAllRows] = useState<EventRow[]>([]) // All events (for client-side filtering)
  const [loading, setLoading] = useState(true) // Loading indicator
  const [error, setError] = useState<string | null>(null) // Error message
  
  // Import/export state
  const [importing, setImporting] = useState(false) // Whether import preview dialog is open
  const [navigating, setNavigating] = useState(false) // Whether navigating between records
  const [importPreview, setImportPreview] = useState<any[] | null>(null) // Parsed CSV data for preview

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
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const [imageHover, setImageHover] = useState(false)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [q, setQ] = useState('')
  const [from, setFrom] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    return new Date().toISOString().slice(0, 10)
  })
  const [to, setTo] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoverThumbId, setHoverThumbId] = useState<number | null>(null)
  const [hoverPreviewStyle, setHoverPreviewStyle] = useState<{ top: number, left: number, height: number, width: number } | null>(null)
  const [sortBy, setSortBy] = useState<'start_date' | 'end_date' | 'name' | 'location' | 'status' | 'start_time' | 'end_time' | 'created_at'>('start_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [existingKeywords, setExistingKeywords] = useState<string[]>([])
  const [selectedKeywordFilters, setSelectedKeywordFilters] = useState<string[]>([])
  const [showSignatureEventsOnly, setShowSignatureEventsOnly] = useState(false)

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

  /**
   * Calculate upcoming weekend dates (Friday, Saturday, and Sunday)
   * 
   * Returns the date range for the current or next weekend based on today's date.
   * Used for quick filtering to show weekend events.
   * 
   * Logic:
   * - If today is Friday-Sunday: returns this weekend
   * - If today is Monday-Thursday: returns this coming weekend
   * 
   * @returns Object with 'from' (Friday) and 'to' (Sunday) dates in YYYY-MM-DD format
   */
  const getUpcomingWeekend = () => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
    
    let friday: Date
    let sunday: Date
    
    if (dayOfWeek === 5) {
      // If today is Friday, use this weekend (today through Sunday)
      friday = new Date(today)
      sunday = new Date(today)
      sunday.setDate(today.getDate() + 2) // This Sunday
    } else if (dayOfWeek === 6) {
      // If today is Saturday, use this weekend (yesterday through tomorrow)
      friday = new Date(today)
      friday.setDate(today.getDate() - 1) // Yesterday (Friday)
      sunday = new Date(today)
      sunday.setDate(today.getDate() + 1) // Tomorrow (Sunday)
    } else if (dayOfWeek === 0) {
      // If today is Sunday, use this weekend (Friday through today)
      friday = new Date(today)
      friday.setDate(today.getDate() - 2) // Friday (2 days ago)
      sunday = new Date(today)
    } else {
      // Monday-Thursday: use this coming weekend
      const daysUntilFriday = 5 - dayOfWeek // 1=Mon(4), 2=Tue(3), 3=Wed(2), 4=Thu(1)
      friday = new Date(today)
      friday.setDate(today.getDate() + daysUntilFriday)
      sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2) // Sunday (2 days after Friday)
    }
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      from: formatLocalDate(friday),
      to: formatLocalDate(sunday)
    }
  }

  /**
   * Calculate next weekend dates (Friday, Saturday, and Sunday)
   * 
   * Returns the date range for the weekend after the upcoming one.
   * Used for quick filtering to show next weekend's events.
   * 
   * @returns Object with 'from' (Friday) and 'to' (Sunday) dates in YYYY-MM-DD format
   */
  const getNextWeekend = () => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
    
    let friday: Date
    let sunday: Date
    
    if (dayOfWeek === 5) {
      // If today is Friday, next weekend is 7 days from today
      friday = new Date(today)
      friday.setDate(today.getDate() + 7) // Next Friday
      sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2) // Next Sunday
    } else if (dayOfWeek === 6) {
      // If today is Saturday, next weekend is 6 days from today
      friday = new Date(today)
      friday.setDate(today.getDate() + 6) // Next Friday
      sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2) // Next Sunday
    } else if (dayOfWeek === 0) {
      // If today is Sunday, next weekend is 5 days from today
      friday = new Date(today)
      friday.setDate(today.getDate() + 5) // Next Friday
      sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2) // Next Sunday
    } else {
      // Monday-Thursday: next weekend is the weekend after this coming one
      const daysUntilThisFriday = 5 - dayOfWeek // Days until this Friday
      friday = new Date(today)
      friday.setDate(today.getDate() + daysUntilThisFriday + 7) // Next Friday (this Friday + 7 days)
      sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2) // Next Sunday
    }
    
    // Format dates as YYYY-MM-DD using local time to avoid timezone issues
    const formatLocalDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return {
      from: formatLocalDate(friday),
      to: formatLocalDate(sunday)
    }
  }

  const setWeekendFilter = () => {
    const weekend = getUpcomingWeekend()
    setFrom(weekend.from)
    setTo(weekend.to)
  }

  const setNextWeekendFilter = () => {
    const weekend = getNextWeekend()
    setFrom(weekend.from)
    setTo(weekend.to)
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
  const imagePasteRef = useRef<HTMLDivElement | null>(null)
  const [imagePasteStatus, setImagePasteStatus] = useState<string>('Paste image here')
  const [imagePasteActive, setImagePasteActive] = useState<boolean>(false)

  const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order','keywords','is_signature_event']

  // Dynamic sticky offset for table headers to sit right under the toolbar
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const theadRef = useRef<HTMLTableSectionElement | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState<number>(0)
  const [theadHeight, setTheadHeight] = useState<number>(0)
  useEffect(() => {
    function updateHeight() {
      const h = toolbarRef.current?.offsetHeight ?? 0
      setToolbarHeight(h)
      const th = theadRef.current?.offsetHeight ?? 0
      setTheadHeight(th)
    }
    updateHeight()
    const ro = new ResizeObserver(updateHeight)
    if (toolbarRef.current) ro.observe(toolbarRef.current)
    if (theadRef.current) ro.observe(theadRef.current)
    window.addEventListener('resize', updateHeight)
    return () => { window.removeEventListener('resize', updateHeight); ro.disconnect() }
  }, [])

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

  // Load all existing keywords for autocomplete
  const loadKeywords = async () => {
    try {
      const { data, error } = await supabase
        .from('keywords')
        .select('name')
        .order('name', { ascending: true })
      
      if (error) throw error
      setExistingKeywords((data ?? []).map(k => k.name))
    } catch (e: any) {
      console.error('Failed to load keywords:', e)
    }
  }

  /**
   * Apply client-side filters to events
   * 
   * Filters events by:
   * - Search query (name contains query, case-insensitive)
   * - Keywords (event must have ANY of the selected keywords - OR logic)
   * - Signature events (when toggle is active, show only signature events)
   * 
   * Note: Date filtering is done server-side for performance.
   * 
   * @param events - Array of events to filter
   */
  const applyFilters = (events: EventRow[]) => {
    let filtered = events
    
    // Apply search filter
    if (q) {
      filtered = filtered.filter(event => 
        event.name.toLowerCase().includes(q.toLowerCase())
      )
    }
    
    // Apply keyword filter (OR logic - event must have ANY of the selected keywords)
    if (selectedKeywordFilters.length > 0) {
      filtered = filtered.filter(event => {
        if (!event.keywords || event.keywords.length === 0) return false
        return selectedKeywordFilters.some(filterKeyword => 
          event.keywords!.includes(filterKeyword)
        )
      })
    }
    
    // Apply signature event filter
    // When checked (showSignatureEventsOnly = true): show ONLY signature events
    // When unchecked (showSignatureEventsOnly = false): show ALL events
    if (showSignatureEventsOnly) {
      // Filter to show only signature events (is_signature_event === true)
      filtered = filtered.filter(event => event.is_signature_event === true)
    }
    // When unchecked, don't filter - show all events
    
    setRows(filtered)
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
    let query = supabase
      .from('events')
        .select('id, name, slug, description, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, image_url, status, sort_order, created_by, created_at, updated_at, deleted_at, is_signature_event')
      .is('deleted_at', null)
        .order('sort_order', { ascending: true })
      .order(sortBy, { ascending: sortOrder === 'asc' })

      // Only apply date filters server-side, not search
      // For 'from' date: include events that:
      //   - Start on/after the date, OR
      //   - End on/after the date (even if they start before)
      // This ensures events that span across or end exactly on the selected start date are included
      if (from) {
        // Use OR to include events where either start_date or end_date meets the criteria
        // Also include events with no dates (undated events)
        query = query.or(`start_date.gte.${from},end_date.gte.${from},and(start_date.is.null,end_date.is.null)`)
      }
      // For 'to' date: only include events that start on/before the date
      if (to) query = query.lte('start_date', to)

    const { data, error } = await query
      if (error) throw error
      const allEvents = (data ?? []) as EventRow[]
      
      // Load keywords for each event
      const eventIds = allEvents.map(e => e.id).filter((id): id is number => id !== undefined)
      if (eventIds.length > 0) {
        // Fetch event_keywords relationships
        const { data: keywordRelations, error: relationError } = await supabase
          .from('event_keywords')
          .select('event_id, keyword_id')
          .in('event_id', eventIds)
        
        if (relationError) {
          console.error('Error loading keyword relationships:', relationError)
        }
        
        if (keywordRelations && keywordRelations.length > 0) {
          // Get unique keyword IDs
          const keywordIds = [...new Set(keywordRelations.map((r: any) => r.keyword_id))]
          
          // Fetch keyword names
          const { data: keywords, error: keywordError } = await supabase
            .from('keywords')
            .select('id, name')
            .in('id', keywordIds)
          
          if (keywordError) {
            console.error('Error loading keywords:', keywordError)
          }
          
          if (keywords) {
            // Create a map of keyword_id to keyword name
            const keywordMap = new Map<string, string>()
            keywords.forEach((kw: any) => {
              keywordMap.set(kw.id, kw.name.toLowerCase())
            })
            
            // Group keywords by event_id
            const keywordsByEventId = new Map<number | string, string[]>()
            keywordRelations.forEach((relation: any) => {
              const eventId = relation.event_id
              const keywordName = keywordMap.get(relation.keyword_id)
              if (keywordName) {
                if (!keywordsByEventId.has(eventId)) {
                  keywordsByEventId.set(eventId, [])
                }
                keywordsByEventId.get(eventId)!.push(keywordName)
              }
            })
            
            // Attach keywords to events
            allEvents.forEach(event => {
              if (event.id) {
                event.keywords = keywordsByEventId.get(event.id) || []
              }
            })
            
            console.log('Loaded keywords for events:', keywordsByEventId)
          }
        } else {
          // No keywords found, initialize empty arrays
          allEvents.forEach(event => {
            if (event.id) {
              event.keywords = []
            }
          })
        }
      }
      
      setAllRows(allEvents)
      
      // Load all keywords for autocomplete
      await loadKeywords()
      
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
      slug: slugify('Untitled Event'),
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
      sort_order: 1000,
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      keywords: []
    })
  }

  const exportCSV = () => {
    // Format rows for CSV export - convert keywords array to comma-separated string
    const formattedRows = rows.map(row => ({
      ...row,
      keywords: row.keywords ? row.keywords.join(', ') : ''
    }))
    const csv = toCSV(formattedRows, headers)
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

      const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order','keywords','is_signature_event']
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
          sort_order: r.sort_order ? Number(r.sort_order) : null,
          keywords: r.keywords ? r.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0) : [],
          is_signature_event: r.is_signature_event === 'true' || r.is_signature_event === '1' || r.is_signature_event === true
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

    // Separate keywords from event data
    const eventsPayload = importPreview.map(({ keywords, ...r }) => ({
      ...r,
      created_by: uid
    }))

    const { data: insertedEvents, error } = await supabase
      .from('events')
      .upsert(eventsPayload, { onConflict: 'slug' })
      .select('id, slug')

    if (error) { setImportErrors([error.message]); return }

    // Handle keywords for imported events
    if (insertedEvents) {
      // Create a map of slug to event ID
      const slugToIdMap = new Map<string, number>()
      insertedEvents.forEach((e: any) => {
        if (e.slug) slugToIdMap.set(e.slug, e.id)
      })

      // Process keywords for each imported event
      for (const previewItem of importPreview) {
        if (!previewItem.keywords || previewItem.keywords.length === 0) continue
        
        const eventId = previewItem.slug ? slugToIdMap.get(previewItem.slug) : null
        if (!eventId) continue

        // Get or create keyword IDs
        const keywordIds: string[] = []
        for (const keywordName of previewItem.keywords) {
          const normalizedKeyword = keywordName.trim().toLowerCase()
          if (!normalizedKeyword) continue

          // Check if keyword exists
          const { data: existingKeyword } = await supabase
            .from('keywords')
            .select('id')
            .eq('name', normalizedKeyword)
            .single()
          
          let keywordId: string
          if (existingKeyword) {
            keywordId = existingKeyword.id
          } else {
            // Create new keyword
            const { data: newKeyword, error: createError } = await supabase
              .from('keywords')
              .insert({ name: normalizedKeyword })
              .select('id')
              .single()
            
            if (createError) {
              console.error('Error creating keyword:', createError)
              continue
            }
            keywordId = newKeyword.id
          }
          keywordIds.push(keywordId)
        }

        // Delete old event_keywords relationships
        await supabase
          .from('event_keywords')
          .delete()
          .eq('event_id', eventId)

        // Create new event_keywords relationships
        if (keywordIds.length > 0) {
          const junctionRecords = keywordIds.map(keywordId => ({
            event_id: eventId,
            keyword_id: keywordId
          }))
          
          await supabase
            .from('event_keywords')
            .insert(junctionRecords)
        }
      }
    }

    setImporting(false)
    setImportPreview(null)
    setImportErrors([])
    await load()
    alert(`Imported ${eventsPayload.length} events`)
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
    // Exclude keywords from insertable since it's not a column but a relationship
    const { id, created_at, updated_at, deleted_at, keywords, ...insertable } = copy
    const payload: any = { ...insertable, slug: newSlug, name: r.name + ' (copy)', status: 'draft', created_at: undefined, updated_at: undefined, deleted_at: null }
    const { data: newEvent, error } = await supabase.from('events').insert(payload).select().single()
    if (error) { alert(error.message); return }
    
    // Copy keyword relationships if the original event had keywords
    if (newEvent && r.id && keywords && keywords.length > 0) {
      // Fetch the keyword IDs for the original event
      const { data: originalRelations } = await supabase
        .from('event_keywords')
        .select('keyword_id')
        .eq('event_id', r.id)
      
      if (originalRelations && originalRelations.length > 0) {
        // Create the same relationships for the new event
        const junctionRecords = originalRelations.map(rel => ({
          event_id: newEvent.id,
          keyword_id: rel.keyword_id
        }))
        
        const { error: keywordError } = await supabase
          .from('event_keywords')
          .insert(junctionRecords)
        
        if (keywordError) {
          console.error('Error copying keyword relationships:', keywordError)
        }
      }
    }
    
    await load();
  }


  const exportCSVFiltered = async () => {
    let query = supabase
      .from('events')
      .select('id, name, slug, description, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, status, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: true })

    if (q) query = query.ilike('name', `%${q}%`)
    if (from) query = query.gte('start_date', from)
    if (to) query = query.lte('start_date', to)

    const { data, error } = await query
    if (error) { alert(error.message); return }
    
    // Load keywords for exported events
    const eventIds = (data || []).map((e: any) => e.id).filter((id: any): id is number => id !== undefined)
    const eventsWithKeywords = [...(data || [])]
    
    if (eventIds.length > 0) {
      const { data: keywordData } = await supabase
        .from('event_keywords')
        .select('event_id, keywords(name)')
        .in('event_id', eventIds)
      
      if (keywordData) {
        const keywordsByEventId = new Map<number, string[]>()
        keywordData.forEach((item: any) => {
          const eventId = item.event_id
          const keywordName = item.keywords?.name?.toLowerCase()
          if (keywordName) {
            if (!keywordsByEventId.has(eventId)) {
              keywordsByEventId.set(eventId, [])
            }
            keywordsByEventId.get(eventId)!.push(keywordName)
          }
        })
        
        eventsWithKeywords.forEach((event: any) => {
          event.keywords = keywordsByEventId.get(event.id)?.join(', ') || ''
        })
      }
    } else {
      eventsWithKeywords.forEach((event: any) => {
        event.keywords = ''
      })
    }
    
    const headers = ['name','slug','host_org','start_date','end_date','start_time','end_time','location','recurrence','website_url','status','sort_order','keywords','is_signature_event']
    const csv = toCSV(eventsWithKeywords, headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'events_export.csv'; a.click()
    URL.revokeObjectURL(url)
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
      const text = await runOptimizedOCR(file)
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
      image_url: (ocrDraft as any).image_url ?? null,
      ocr_text: ocrRawText || null,
      status: (ocrDraft.status as any) || 'draft',
      sort_order: ocrDraft.sort_order ?? 1000,
      created_by: uid
    }

    console.log('Payload being sent:', payload)

    if (!payload.name) { alert('Name is required'); return }
    
    // Ensure slug exists and is unique
    const slugValue = payload.slug?.trim() || ''
    if (!slugValue) {
      // Slug is empty/null/undefined, generate from name
      const baseSlug = slugify(payload.name)
      payload.slug = await ensureUniqueSlug(baseSlug)
    } else {
      payload.slug = await ensureUniqueSlug(slugValue)
    }

    const { error } = await supabase.from('events').insert(payload)
    if (error) { alert(error.message); return }
    setOcrOpen(false); setOcrDraft(null); setOcrRawText(''); setOcrImageUrl(null)
    localStorage.removeItem('events-ocr-draft')
    localStorage.removeItem('events-ocr-text')
    localStorage.setItem('events-ocr-open', 'false')
    await load()
  }

  // Helper function to ensure slug is unique
  const ensureUniqueSlug = async (baseSlug: string, excludeId?: number): Promise<string> => {
    if (!baseSlug || !baseSlug.trim()) {
      throw new Error('Base slug cannot be empty')
    }
    
    let candidateSlug = baseSlug.trim()
    let counter = 1
    const maxAttempts = 100 // Safety limit
    
    while (counter <= maxAttempts) {
      // Check if slug exists (excluding current event if updating)
      // Note: We check ALL records (including soft-deleted) because the unique constraint applies to all rows
      let query = supabase
        .from('events')
        .select('id')
        .eq('slug', candidateSlug)
      
      if (excludeId) {
        query = query.neq('id', excludeId)
      }
      
      const { data, error } = await query.maybeSingle()
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is expected, other errors are real problems
        console.error('Error checking slug uniqueness:', error)
        throw error
      }
      
      // If no data found, slug is unique
      if (!data) {
        console.log(`Found unique slug: ${candidateSlug}`)
        return candidateSlug
      }
      
      // Slug exists, try with counter suffix
      console.log(`Slug ${candidateSlug} exists, trying ${baseSlug}-${counter + 1}`)
      counter++
      candidateSlug = `${baseSlug}-${counter}`
    }
    
    throw new Error(`Could not find unique slug after ${maxAttempts} attempts`)
  }

  const save = async (options?: { suppressClose?: boolean }) => {
    if (!editing) return
    const payload = { ...editing }
    const keywordsToSave = payload.keywords || []

    console.log('Save function - editing state:', editing)
    console.log('Save function - start_date:', payload.start_date, 'type:', typeof payload.start_date)
    console.log('Save function - end_date:', payload.end_date, 'type:', typeof payload.end_date)
    console.log('Save function - start_time:', payload.start_time, 'type:', typeof payload.start_time)
    console.log('Save function - end_time:', payload.end_time, 'type:', typeof payload.end_time)
    console.log('Save function - full payload:', payload)

    if (!payload.name) return alert('Name is required')
    
    // Ensure slug exists and is unique
    try {
      const slugValue = payload.slug?.trim() || ''
      console.log('Slug check - slugValue:', slugValue, 'hasId:', !!payload.id, 'isNew:', !payload.id)
      
      if (!slugValue) {
        // Slug is empty/null/undefined, generate from name
        const baseSlug = slugify(payload.name)
        console.log('Generating slug from name:', baseSlug)
        payload.slug = await ensureUniqueSlug(baseSlug, payload.id || undefined)
      } else if (!payload.id) {
        // For new events, ensure the provided slug is unique
        console.log('Checking uniqueness of provided slug:', slugValue)
        payload.slug = await ensureUniqueSlug(slugValue)
      } else {
        // For updates, ensure slug is still unique (excluding current event)
        console.log('Updating event, checking slug uniqueness:', slugValue)
        payload.slug = await ensureUniqueSlug(slugValue, payload.id)
      }
      
      console.log('Final slug before save:', payload.slug)
    } catch (error: any) {
      console.error('Error ensuring unique slug:', error)
      alert(`Error checking slug uniqueness: ${error?.message || 'Unknown error'}`)
      return
    }

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
        image_url: payload.image_url,
        ocr_text: payload.ocr_text,
        status: payload.status,
        sort_order: payload.sort_order,
        is_signature_event: payload.is_signature_event ?? false
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
      const { id, created_at, updated_at, deleted_at, keywords, ...insertable } = payload
      const { data, error } = await supabase.from('events').insert(insertable).select().single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }

    // Handle keywords: create missing keywords and update relationships
    if (payload.id) {
      // Normalize keywords to lowercase
      const normalizedKeywords = keywordsToSave.map(k => k.trim().toLowerCase()).filter(k => k.length > 0)
      
      // Get or create keyword IDs
      const keywordIds: string[] = []
      for (const keywordName of normalizedKeywords) {
        // Check if keyword exists
        const { data: existingKeyword } = await supabase
          .from('keywords')
          .select('id')
          .eq('name', keywordName)
          .single()
        
        let keywordId: string
        if (existingKeyword) {
          keywordId = existingKeyword.id
        } else {
          // Create new keyword
          const { data: newKeyword, error: createError } = await supabase
            .from('keywords')
            .insert({ name: keywordName })
            .select('id')
            .single()
          
          if (createError) {
            console.error('Error creating keyword:', createError)
            continue
          }
          keywordId = newKeyword.id
          
          // Update existing keywords list for autocomplete
          setExistingKeywords(prev => [...prev, keywordName].sort())
        }
        keywordIds.push(keywordId)
      }
      
      // Delete old event_keywords relationships
      const { error: deleteError } = await supabase
        .from('event_keywords')
        .delete()
        .eq('event_id', payload.id)
      
      if (deleteError) {
        console.error('Error deleting old keywords:', deleteError)
      }
      
      // Create new event_keywords relationships
      if (keywordIds.length > 0) {
        const junctionRecords = keywordIds.map(keywordId => ({
          event_id: payload.id,
          keyword_id: keywordId
        }))
        
        const { error: insertError } = await supabase
          .from('event_keywords')
          .insert(junctionRecords)
        
        if (insertError) {
          console.error('Error creating keyword relationships:', insertError)
        } else {
          console.log('Successfully saved keyword relationships:', junctionRecords)
        }
      }
    }

    if (!options?.suppressClose) setEditing(null)
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

  // Apply client-side search filtering when search query or keyword filters change
  useEffect(() => {
    applyFilters(allRows)
  }, [q, selectedKeywordFilters, allRows])

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

  // Global paste support for adding an image (works for new and existing events)
  useEffect(() => {
    async function handleWindowPaste(ev: ClipboardEvent) {
      if (!editing) return
      const items = ev.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file') {
          const file = it.getAsFile()
          if (file && file.type.startsWith('image/')) {
            ev.preventDefault()
            
            // Upload the image first
            const base = (editing.slug || slugify(editing.name)) || crypto.randomUUID()
            const path = `${base}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
            const { error } = await supabase.storage.from('event-images').upload(path, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            })
            if (error) { alert(`Upload failed: ${error.message}`); return }
            const { data } = supabase.storage.from('event-images').getPublicUrl(path)
            
            // Run OCR on the image to extract text
            console.log('Starting OCR on pasted image...')
            try {
              console.log('Running optimized OCR...')
              const text = await runOptimizedOCR(file)
              console.log('OCR completed. Extracted text:', text)
              
              if (!text) {
                console.warn('No text extracted from image')
                setEditing({ ...editing, image_url: data.publicUrl })
                return
              }
              
              // Parse the OCR text to extract event data
              const parsed = parseEventText(text)
              console.log('Parsed event data:', parsed)
              
              // Update the editing state with parsed data and image URL
              // Always update image_url and ocr_text
              const updates: Partial<EventRow> = {
                image_url: data.publicUrl,
                ocr_text: text,
              }
              
              // Update name if parsed name exists and current name is default/empty
              if (parsed.name && parsed.name.trim()) {
                const shouldUpdateName = !editing.name || editing.name === 'Untitled Event' || (editing.name && editing.name.trim() === '')
                if (shouldUpdateName) {
                  updates.name = parsed.name
                  updates.slug = slugify(parsed.name)
                  console.log('Updating name to:', parsed.name)
                }
              }
              
              // Only update fields if they are currently empty AND a value was parsed
              // Dates and times
              if (parsed.start_date && (!editing.start_date || editing.start_date === '')) {
                updates.start_date = parsed.start_date
                console.log('Setting start_date to:', parsed.start_date)
              }
              if (parsed.end_date && (!editing.end_date || editing.end_date === '')) {
                updates.end_date = parsed.end_date
                console.log('Setting end_date to:', parsed.end_date)
              }
              if (parsed.start_time && (!editing.start_time || editing.start_time === '')) {
                updates.start_time = parsed.start_time
                console.log('Setting start_time to:', parsed.start_time)
              }
              if (parsed.end_time && (!editing.end_time || editing.end_time === '')) {
                updates.end_time = parsed.end_time
                console.log('Setting end_time to:', parsed.end_time)
              }
              
              // String fields - only update if empty
              if (parsed.location && (!editing.location || editing.location.trim() === '')) {
                updates.location = parsed.location
                console.log('Setting location to:', parsed.location)
              }
              if (parsed.host_org && (!editing.host_org || editing.host_org.trim() === '')) {
                updates.host_org = parsed.host_org
                console.log('Setting host_org to:', parsed.host_org)
              }
              if (parsed.website_url && (!editing.website_url || editing.website_url.trim() === '')) {
                updates.website_url = parsed.website_url
                console.log('Setting website_url to:', parsed.website_url)
              }
              if (parsed.recurrence && (!editing.recurrence || editing.recurrence.trim() === '')) {
                updates.recurrence = parsed.recurrence
                console.log('Setting recurrence to:', parsed.recurrence)
              }
              if (parsed.description && (!editing.description || editing.description.trim() === '')) {
                updates.description = parsed.description
                console.log('Setting description to:', parsed.description)
              }
              
              console.log('Final updates to apply:', updates)
              setEditing({ ...editing, ...updates })
              console.log('State updated successfully')
            } catch (ocrError: any) {
              console.error('OCR failed:', ocrError)
              alert(`OCR failed: ${ocrError?.message || 'Unknown error'}`)
              // Still set the image URL even if OCR fails
              setEditing({ ...editing, image_url: data.publicUrl })
            }
            break
          }
        }
      }
    }
    window.addEventListener('paste', handleWindowPaste as any)
    return () => window.removeEventListener('paste', handleWindowPaste as any)
  }, [editing])

  // Note: Do not early-return on loading/error to avoid flicker under the dialog.
  // Instead, show lightweight banners inline while keeping the list rendered.

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
          zIndex: 120,
          background: darkMode ? '#1f2937' : '#f8f9fa',
          padding: '12px',
          borderBottom: `1px solid ${darkMode ? '#374151' : '#dee2e6'}`,
          borderRadius: '4px'
        }}
        ref={toolbarRef}
      >
        {/* {loading && (
          <div style={{
            marginBottom: 8,
            fontSize: 12,
            color: darkMode ? '#d1d5db' : '#6b7280'
          }}>
            Loading events…
          </div>
        )} */}
        {error && (
          <div style={{
            marginBottom: 8,
            fontSize: 12,
            color: '#b91c1c'
          }}>
            Error loading events: {error}
          </div>
        )}
        {/* Top row: Module title and Action buttons */}
        <div
          className="responsive-toolbar-row"
          style={{ 
            display: 'flex',
            flexWrap: 'nowrap',
            gap: 8,
            alignItems: 'center',
            width: '100%',
            marginBottom: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
          </div>
          
          <div className="responsive-toolbar-controls" style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn"
              onClick={exportCSV}
              disabled={importing}
              title="Export"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                color: darkMode ? '#f9fafb' : '#374151',
                borderRadius: '6px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px',
                opacity: importing ? 0.6 : 1
              }}
            >
              ⬇️
            </button>
            <button
              className="btn"
              onClick={() => importFileInputRef.current?.click()}
              disabled={importing}
              title="Import"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                color: darkMode ? '#f9fafb' : '#374151',
                borderRadius: '6px',
                cursor: importing ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px',
                opacity: importing ? 0.6 : 1
              }}
            >
              ⬆️
            </button>
            <ActionMenu
          items={[
            {
              id: 'ocr',
              label: 'OCR',
              icon: '🔍',
              onClick: () => setOcrOpen(true),
              disabled: importing
            },
            {
              id: 'refresh',
              label: loading ? 'Loading…' : 'Refresh',
              icon: loading ? '⏳' : '🔄',
              onClick: load,
              disabled: loading || importing
            },
            {
              id: 'template',
              label: 'Template',
              icon: '📋',
              onClick: downloadTemplateCSV,
              disabled: importing
            },
            {
              id: 'auto-status',
              label: 'Auto Status',
              icon: '🤖',
              onClick: bulkSetStatusFromDates
            },
            {
              id: 'fill-dates',
              label: 'Fill Dates',
              icon: '📅',
              onClick: bulkFillEndDates
            },
            {
              id: 'gen-slugs',
              label: 'Gen Slugs',
              icon: '🔗',
              onClick: bulkGenerateSlugs
            },
            {
              id: 'publish',
              label: 'Publish',
              icon: '🚀',
              onClick: bulkPublish,
              requiresSelection: true,
              variant: 'success'
            },
            {
              id: 'archive',
              label: 'Archive',
              icon: '📦',
              onClick: bulkArchive,
              requiresSelection: true,
              variant: 'warning'
            },
            {
              id: 'delete',
              label: 'Delete',
              icon: '🗑️',
              onClick: bulkDelete,
              requiresSelection: true,
              variant: 'danger'
            }
          ]}
          selectedCount={selectedIds.size}
          darkMode={darkMode}
          disabled={importing}
        />
          </div>
        
        <input ref={importFileInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImportFile} style={{ display: 'none' }} disabled={importing} />
        </div>

        {/* Bottom row: Search and filter controls */}
        <div
          className="responsive-filters"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <div className="responsive-search" style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <input 
              placeholder="Search events..." 
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
          
          {/* Date filters grouped together */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <label style={{ color: darkMode ? '#f9fafb' : '#374151', whiteSpace: 'nowrap' }}>
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
            
            <label style={{ color: darkMode ? '#f9fafb' : '#374151', whiteSpace: 'nowrap' }}>
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
          </div>

          {/* Weekend buttons grouped together */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
            <button
              onClick={setWeekendFilter}
              title="Set date range to upcoming weekend"
              style={{
                padding: '6px 12px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkMode ? '#4b5563' : '#f3f4f6'
                e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkMode ? '#374151' : '#ffffff'
                e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
              }}
            >
              📅 This Weekend
            </button>
            <button
              type="button"
              onClick={setNextWeekendFilter}
              title="Set date range to next weekend"
              style={{
                padding: '6px 12px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = darkMode ? '#4b5563' : '#f3f4f6'
                e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#9ca3af'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = darkMode ? '#374151' : '#ffffff'
                e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
              }}
            >
              📅 Next Weekend
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setQ('')
              setFrom(new Date().toISOString().slice(0, 10))
              setTo('')
              setSelectedKeywordFilters([])
              setShowSignatureEventsOnly(false)
            }}
            title="Clear all filters"
            style={{
              padding: '6px 12px',
              background: darkMode ? '#374151' : '#ffffff',
              border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
              borderRadius: '6px',
              color: darkMode ? '#f9fafb' : '#374151',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = darkMode ? '#4b5563' : '#f3f4f6'
              e.currentTarget.style.borderColor = darkMode ? '#6b7280' : '#9ca3af'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = darkMode ? '#374151' : '#ffffff'
              e.currentTarget.style.borderColor = darkMode ? '#4b5563' : '#d1d5db'
            }}
          >
            Clear
          </button>

          {/* Signature Event Filter Toggle */}
          <label style={{ color: darkMode ? '#f9fafb' : '#374151', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={showSignatureEventsOnly}
              onChange={(e) => {
                const newValue = e.target.checked
                setShowSignatureEventsOnly(newValue)
                // Apply filters immediately with the new value
                // Create a temporary filtered array with the new filter state
                let tempFiltered = allRows
                if (newValue) {
                  // When checked: show ONLY signature events
                  tempFiltered = allRows.filter(event => event.is_signature_event === true)
                }
                // Apply other filters (search, keywords) to the temp filtered array
                if (q) {
                  tempFiltered = tempFiltered.filter(event => 
                    event.name.toLowerCase().includes(q.toLowerCase())
                  )
                }
                if (selectedKeywordFilters.length > 0) {
                  tempFiltered = tempFiltered.filter(event => {
                    if (!event.keywords || event.keywords.length === 0) return false
                    return selectedKeywordFilters.some(filterKeyword => 
                      event.keywords!.includes(filterKeyword)
                    )
                  })
                }
                setRows(tempFiltered)
              }}
              style={{
                accentColor: darkMode ? '#3b82f6' : '#3b82f6',
                cursor: 'pointer',
                width: '16px',
                height: '16px'
              }}
            />
            <span style={{ fontSize: '14px' }}>⭐ Signature Events Only</span>
          </label>

          {/* Keyword Filter */}
          <div style={{ position: 'relative', minWidth: '200px' }}>
            <select
              value=""
              onChange={(e) => {
                const keyword = e.target.value
                if (keyword && !selectedKeywordFilters.includes(keyword)) {
                  setSelectedKeywordFilters([...selectedKeywordFilters, keyword])
                }
                e.target.value = ''
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                borderRadius: '6px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                fontSize: '14px'
              }}
            >
              <option value="">Filter by keyword...</option>
              {existingKeywords
                .filter(kw => !selectedKeywordFilters.includes(kw))
                .map(kw => (
                  <option key={kw} value={kw}>{kw}</option>
                ))}
            </select>
          </div>

          {/* Selected keyword filters as chips */}
          {selectedKeywordFilters.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {selectedKeywordFilters.map(keyword => (
                <span
                  key={keyword}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    background: darkMode ? '#3b82f6' : '#3b82f6',
                    color: '#ffffff',
                    borderRadius: '16px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => setSelectedKeywordFilters(selectedKeywordFilters.filter(k => k !== keyword))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: '0',
                      marginLeft: '4px',
                      fontSize: '16px',
                      lineHeight: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                    title="Remove filter"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          
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
      {/* OCR panel removed per request */}

      {/* Desktop table view */}
      <div style={{ position: 'relative' }}>
      <table className="table responsive-table" style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        background: darkMode ? '#1f2937' : '#ffffff',
        color: darkMode ? '#f9fafb' : '#1f2937'
      }}>
          <thead ref={theadRef} style={{
            position: 'sticky',
            top: toolbarHeight,
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
              top: toolbarHeight,
              left: 0,
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
              padding: '8px 2px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              position: 'sticky',
              top: toolbarHeight,
              left: 40,
              zIndex: 110,
              width: 40
            }}>Img</th>
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
                top: toolbarHeight,
                left: 84,
                zIndex: 110
              }}
            >
              Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            {/* Website column removed; website icon moved into thumbnail column */}
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
                top: toolbarHeight,
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
                top: toolbarHeight,
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
                top: toolbarHeight,
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
                top: toolbarHeight,
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
                top: toolbarHeight,
                zIndex: 110
              }}
            >
              Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th style={{ 
              textAlign: 'center', 
              padding: '8px 6px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              position: 'sticky',
              top: toolbarHeight,
              zIndex: 110,
              width: '80px'
            }}>
              ⭐ Signature
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
                top: toolbarHeight,
                zIndex: 110
              }}
            >
              Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            
            <th style={{ 
              textAlign: 'left', 
              padding: '8px 0 8px 6px', 
              borderBottom: `1px solid ${darkMode ? '#374151' : '#ddd'}`,
              background: darkMode ? '#374151' : '#f8f9fa',
              color: darkMode ? '#f9fafb' : '#1f2937',
              minWidth: '140px' 
            }}>Actions</th>
            {/* Spacer column removed to allow Actions to be flush with viewport edge */}
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
                  background: 'transparent',
                  position: 'sticky',
                  left: 0,
                  zIndex: 5
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
                padding: '8px 2px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent',
                width: 40,
                position: 'sticky',
                left: 40,
                zIndex: 5
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  {/* Link icon intentionally omitted in thumbnail column */}
                  <div
                    onMouseEnter={(e) => {
                      if (!r.id) return
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                      const gap = 8
                      const viewportH = window.innerHeight
                      const viewportW = window.innerWidth
                      const maxH = Math.min(800, viewportH - gap * 2)
                      const maxW = Math.min(800, viewportW - gap * 2)
                      let top = rect.top
                      // Decide alignment based on thumbnail position
                      if (rect.top < 120) {
                        // near top – align tops
                        top = Math.max(gap, rect.top)
                      } else if (rect.bottom > viewportH - 120) {
                        // near bottom – align bottoms
                        top = Math.max(gap, rect.bottom - maxH)
                      } else {
                        // middle – center vertically
                        top = rect.top + rect.height / 2 - maxH / 2
                      }
                      // Clamp inside viewport
                      const stickyOffset = (toolbarHeight || 0) + (theadHeight || 0)
                      top = Math.max(stickyOffset + gap, Math.min(top, viewportH - maxH - gap))
                      // Horizontal placement: prefer to the right; fall back to left; otherwise center
                      const previewW = maxW
                      const spaceRight = viewportW - rect.right - gap
                      const spaceLeft = rect.left - gap
                      let left = rect.right + gap
                      if (spaceRight >= previewW) {
                        left = rect.right + gap
                      } else if (spaceLeft >= previewW) {
                        left = rect.left - gap - previewW
                      } else {
                        // Center horizontally within viewport
                        left = Math.max(gap, Math.min(rect.left + rect.width / 2 - previewW / 2, viewportW - previewW - gap))
                      }
                      setHoverPreviewStyle({ top, left, height: maxH, width: previewW })
                      setHoverThumbId(r.id)
                    }}
                    onMouseLeave={() => { setHoverThumbId(null); setHoverPreviewStyle(null) }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'inline-block', cursor: 'pointer' }}
                  >
                    {/* Thumbnail only (no link icon here) */}
                    {r.image_url ? (
                      <img src={r.image_url} alt="thumb" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`, marginTop: 6 }} />
                    ) : null}
                    {hoverThumbId === r.id && (
                      <div
                        style={{
                          position: 'fixed',
                          top: hoverPreviewStyle?.top ?? 8,
                          left: hoverPreviewStyle?.left ?? 52,
                          zIndex: 9999,
                          padding: 6,
                          background: darkMode ? 'rgba(31,41,55,0.98)' : 'rgba(255,255,255,0.98)',
                          border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                          borderRadius: 8,
                          boxShadow: '0 10px 30px rgba(0,0,0,.25)',
                          width: hoverPreviewStyle?.width ?? undefined
                        }}
                      >
                        <img
                          src={r.image_url}
                          alt="preview"
                          style={{
                            width: 'auto',
                            height: 'auto',
                            maxWidth: hoverPreviewStyle?.width ?? 800,
                            maxHeight: hoverPreviewStyle?.height ?? 'calc(100vh - 48px)',
                            borderRadius: 6,
                            display: 'block'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent',
                position: 'sticky',
                left: 84,
                zIndex: 4
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, color: darkMode ? '#f9fafb' : '#1f2937' }}>{r.name}</div>
                  {r.website_url && r.website_url.trim() ? (
                    <a
                      href={normalizeUrl(r.website_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Open URL in new tab"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        color: darkMode ? '#3b82f6' : '#1976d2',
                        textDecoration: 'none'
                      }}
                    >
                      <span>🔗</span>
                    </a>
                  ) : null}
                </div>
                {r.host_org ? (
                  <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#666', marginBottom: 10 }}>Host: {r.host_org}</div>
                ) : null}
                {r.recurrence ? (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{r.recurrence}</div>
                ) : null}
              </td>
              {/* Website cell removed; icon shown in thumbnail column */}
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
              <td 
                style={{ 
                  padding: '8px 6px', 
                  borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                  background: 'transparent',
                  textAlign: 'center'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={r.is_signature_event === true}
                  onChange={async (e) => {
                    e.stopPropagation()
                    const newValue = e.target.checked
                    // Optimistically update the UI
                    const updatedRows = rows.map(row => 
                      row.id === r.id ? { ...row, is_signature_event: newValue } : row
                    )
                    const updatedAllRows = allRows.map(row => 
                      row.id === r.id ? { ...row, is_signature_event: newValue } : row
                    )
                    setRows(updatedRows)
                    setAllRows(updatedAllRows)
                    
                    // Save to database
                    try {
                      const { error } = await supabase
                        .from('events')
                        .update({ is_signature_event: newValue })
                        .eq('id', r.id)
                      
                      if (error) {
                        console.error('Error updating signature event:', error)
                        alert(`Failed to update signature event: ${error.message}`)
                        // Revert optimistic update
                        setRows(rows)
                        setAllRows(allRows)
                      }
                    } catch (err: any) {
                      console.error('Error updating signature event:', err)
                      alert(`Failed to update signature event: ${err.message}`)
                      // Revert optimistic update
                      setRows(rows)
                      setAllRows(allRows)
                    }
                  }}
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6',
                    cursor: 'pointer',
                    width: '18px',
                    height: '18px'
                  }}
                  title={r.is_signature_event ? 'Signature event (click to unmark)' : 'Click to mark as signature event'}
                />
              </td>
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                <div style={{
                  all: 'unset', // Hard reset styles
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: r.status === 'published'
                    ? (darkMode ? '#10b981' : '#2e7d32')
                    : (darkMode ? '#e5e7eb' : '#374151')
                }}>
                  {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                  {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                </div>
              </td>
              
              <td style={{ 
                padding: '8px 0 8px 12px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: 'transparent'
              }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 0 }}>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); copyEvent(r) }}
                    title="Duplicate"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: 'transparent',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      color: darkMode ? '#e5e7eb' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    <img src={dupIcon} alt="duplicate" width={16} height={16} />
                  </button>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); softDelete(r.id!.toString()) }}
                    title="Delete"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: 'transparent',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      color: darkMode ? '#e5e7eb' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    <img src={trashIcon} alt="delete" width={16} height={16} />
                  </button>
                </div>
                </td>
              {/* Spacer cell removed to allow Actions to be flush with viewport edge */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="responsive-card-layout">
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
            <div
              key={r.id ?? r.slug ?? r.name}
              className="data-card"
              onClick={() => setEditing(r)}
              style={{
                cursor: 'pointer',
                background: darkMode ? '#1f2937' : '#ffffff',
                border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
              }}
            >
              <div className="data-card-header">
                <input 
                  type="checkbox" 
                  checked={selectedIds.has(r.id!.toString())} 
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleSelect(r.id!.toString(), e.target.checked)
                  }}
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6',
                    marginTop: '4px'
                  }}
                />
                {r.image_url && (
                  <img 
                    src={r.image_url} 
                    alt="event" 
                    style={{ 
                      width: '64px', 
                      height: '64px', 
                      objectFit: 'cover', 
                      borderRadius: '6px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}` 
                    }} 
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: '16px',
                    color: darkMode ? '#f9fafb' : '#1f2937',
                    marginBottom: '8px'
                  }}>
                    {r.name}
                    {r.website_url && r.website_url.trim() && (
                      <a
                        href={normalizeUrl(r.website_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          marginLeft: '8px',
                          fontSize: '16px',
                          color: darkMode ? '#3b82f6' : '#1976d2',
                          textDecoration: 'none'
                        }}
                      >
                        🔗
                      </a>
                    )}
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: r.status === 'published' 
                      ? (darkMode ? '#065f46' : '#d1fae5')
                      : r.status === 'archived'
                      ? (darkMode ? '#78350f' : '#fef3c7')
                      : (darkMode ? '#374151' : '#f3f4f6'),
                    color: r.status === 'published'
                      ? (darkMode ? '#10b981' : '#2e7d32')
                      : (darkMode ? '#e5e7eb' : '#374151')
                  }}>
                    {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                    {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); copyEvent(r) }}
                    title="Duplicate"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: 'transparent',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      color: darkMode ? '#e5e7eb' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    <img src={dupIcon} alt="duplicate" width={16} height={16} />
                  </button>
                  <button
                    className="btn"
                    onClick={(e) => { e.stopPropagation(); softDelete(r.id!.toString()) }}
                    title="Delete"
                    style={{
                      width: 32,
                      height: 32,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      background: 'transparent',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      color: darkMode ? '#e5e7eb' : '#374151',
                      cursor: 'pointer'
                    }}
                  >
                    <img src={trashIcon} alt="delete" width={16} height={16} />
                  </button>
                </div>
              </div>
              <div className="data-card-content">
                {r.start_date && (
                  <div className="data-card-field">
                    <div className="data-card-label">Start Date</div>
                    <div className="data-card-value">
                      {new Date(r.start_date + 'T00:00:00').toLocaleDateString()}
                    </div>
                  </div>
                )}
                {r.end_date && (
                  <div className="data-card-field">
                    <div className="data-card-label">End Date</div>
                    <div className="data-card-value">
                      {new Date(r.end_date + 'T00:00:00').toLocaleDateString()}
                    </div>
                  </div>
                )}
                {(r.start_time || r.end_time) && (
                  <div className="data-card-field">
                    <div className="data-card-label">Time</div>
                    <div className="data-card-value">
                      {formatTimeToAMPM(r.start_time)}
                      {r.start_time && r.end_time ? ' - ' : ''}
                      {formatTimeToAMPM(r.end_time)}
                    </div>
                  </div>
                )}
                {r.location && (
                  <div className="data-card-field">
                    <div className="data-card-label">Location</div>
                    <div className="data-card-value">{r.location}</div>
                  </div>
                )}
                {r.host_org && (
                  <div className="data-card-field">
                    <div className="data-card-label">Host</div>
                    <div className="data-card-value">{r.host_org}</div>
                  </div>
                )}
                {r.recurrence && (
                  <div className="data-card-field">
                    <div className="data-card-label">Recurrence</div>
                    <div className="data-card-value">{r.recurrence}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

        <AutoSaveEditDialog
          key="event-dialog"
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          title={editing?.id ? '✏️ Edit Event' : '➕ New Event'}
          maxWidth="800px"
          darkMode={darkMode}
          overlayLeftOffsetPx={sidebarCollapsed ? 60 : 220}
          editing={editing}
          rows={rows}
          saveFunction={save}
          setEditing={(item) => setEditing(item as EventRow | null)}
          itemType="event"
        >
          <div style={{ padding: '32px' }}>
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Event Image (upload/paste + preview) */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                  Event Image
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    ref={imagePasteRef}
                    onClick={() => {
                      setImagePasteActive(true)
                      setImagePasteStatus('Press ⌘V / Ctrl+V to paste image…')
                      // focus so keyboard paste works
                      imagePasteRef.current?.focus()
                    }}
                    onBlur={() => {
                      setImagePasteActive(false)
                      setImagePasteStatus('Paste image here')
                    }}
                    onPaste={async (ev) => {
                      const items = ev.clipboardData?.items
                      if (!items || !editing) return
                      ev.preventDefault()
                      setImagePasteStatus('Uploading…')
                      for (let i = 0; i < items.length; i++) {
                        const it = items[i]
                        if (it.kind === 'file') {
                          const file = it.getAsFile()
                          if (file && file.type.startsWith('image/')) {
                            const base = (editing.slug || slugify(editing.name)) || crypto.randomUUID()
                            const path = `${base}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
                            const { error } = await supabase.storage.from('event-images').upload(path, file, {
                              cacheControl: '3600',
                              upsert: false,
                              contentType: file.type
                            })
                            if (error) { setImagePasteStatus('Upload failed'); alert(`Upload failed: ${error.message}`); return }
                            const { data } = supabase.storage.from('event-images').getPublicUrl(path)
                            
                            // Run OCR on the image to extract text
                            setImagePasteStatus('Processing OCR…')
                            console.log('Starting OCR on pasted image in paste area...')
                            try {
                              console.log('Running optimized OCR...')
                              const text = await runOptimizedOCR(file)
                              console.log('OCR completed. Extracted text:', text)
                              
                              if (!text) {
                                console.warn('No text extracted from image')
                                setImagePasteStatus('No text found')
                                setEditing({ ...editing, image_url: data.publicUrl })
                                setTimeout(() => { setImagePasteActive(false); setImagePasteStatus('Paste image here') }, 1500)
                                return
                              }
                              
                              const parsed = parseEventText(text)
                              console.log('Parsed event data:', parsed)
                              
                              const updates: Partial<EventRow> = {
                                image_url: data.publicUrl,
                                ocr_text: text,
                              }
                              
                              if (parsed.name && parsed.name.trim()) {
                                const shouldUpdateName = !editing.name || editing.name === 'Untitled Event' || (editing.name && editing.name.trim() === '')
                                if (shouldUpdateName) {
                                  updates.name = parsed.name
                                  updates.slug = slugify(parsed.name)
                                  console.log('Updating name to:', parsed.name)
                                }
                              }
                              // Always apply parsed dates/times when they exist
                              console.log('Parsed data:', parsed)
                              if (parsed.start_date) {
                                updates.start_date = parsed.start_date
                                console.log('Setting start_date to:', parsed.start_date)
                              }
                              if (parsed.end_date) {
                                updates.end_date = parsed.end_date
                                console.log('Setting end_date to:', parsed.end_date)
                              }
                              if (parsed.start_time) {
                                updates.start_time = parsed.start_time
                                console.log('Setting start_time to:', parsed.start_time)
                              }
                              if (parsed.end_time) {
                                updates.end_time = parsed.end_time
                                console.log('Setting end_time to:', parsed.end_time)
                              }
                              if (parsed.location) {
                                updates.location = parsed.location
                              }
                              if (parsed.host_org) {
                                updates.host_org = parsed.host_org
                              }
                              if (parsed.website_url) {
                                updates.website_url = parsed.website_url
                              }
                              
                              console.log('Final updates to apply:', updates)
                              setEditing({ ...editing, ...updates })
                              console.log('State updated successfully')
                            } catch (ocrError: any) {
                              console.error('OCR failed:', ocrError)
                              setImagePasteStatus('OCR failed')
                              alert(`OCR failed: ${ocrError?.message || 'Unknown error'}`)
                              setEditing({ ...editing, image_url: data.publicUrl })
                            }
                            
                            setImagePasteStatus('Uploaded ✓')
                            setTimeout(() => { setImagePasteActive(false); setImagePasteStatus('Paste image here') }, 1500)
                            break
                          }
                        }
                      }
                    }}
                    title="Click and press ⌘V to paste image"
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      minHeight: '40px',
                      padding: '8px 12px',
                      border: `1px dashed ${imagePasteActive ? (darkMode ? '#60a5fa' : '#3b82f6') : (darkMode ? '#4b5563' : '#9ca3af')}`,
                      borderRadius: '6px',
                      color: darkMode ? '#9ca3af' : '#6b7280',
                      outline: 'none'
                    }}
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    role="textbox"
                    aria-label="Paste image area"
                    tabIndex={0}
                  >
                    {imagePasteStatus}
                  </div>
                  <label
                    className="btn"
                    style={{
                      display: 'inline-flex',
                      cursor: 'pointer',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: darkMode ? '#374151' : '#ffffff',
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                      color: darkMode ? '#f9fafb' : '#374151',
                      borderRadius: '6px'
                    }}
                    title="Upload event image"
                  >
                    <span>📁</span>
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file || !editing) return
                        try {
                          const base = (editing.slug || slugify(editing.name)) || crypto.randomUUID()
                          const path = `${base}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
                          const { error } = await supabase.storage.from('event-images').upload(path, file, {
                            cacheControl: '3600',
                            upsert: false,
                            contentType: file.type || 'image/*'
                          })
                          if (error) { alert(`Upload failed: ${error.message}`); return }
                          const { data } = supabase.storage.from('event-images').getPublicUrl(path)
                          
                          // Run OCR on the image to extract text
                          console.log('Starting OCR on uploaded image...')
                          try {
                            console.log('Running optimized OCR...')
                            const text = await runOptimizedOCR(file)
                            console.log('OCR completed. Extracted text:', text)
                            
                            if (!text) {
                              console.warn('No text extracted from image')
                              setEditing({ ...editing, image_url: data.publicUrl })
                              return
                            }
                            
                            const parsed = parseEventText(text)
                            console.log('Parsed event data:', parsed)
                            
                            const updates: Partial<EventRow> = {
                              image_url: data.publicUrl,
                              ocr_text: text,
                            }
                            
                            if (parsed.name && parsed.name.trim()) {
                              const shouldUpdateName = !editing.name || editing.name === 'Untitled Event' || (editing.name && editing.name.trim() === '')
                              if (shouldUpdateName) {
                                updates.name = parsed.name
                                updates.slug = slugify(parsed.name)
                                console.log('Updating name to:', parsed.name)
                              }
                            }
                            // Always apply parsed dates/times when they exist
                            console.log('Parsed data:', parsed)
                            if (parsed.start_date) {
                              updates.start_date = parsed.start_date
                              console.log('Setting start_date to:', parsed.start_date)
                            }
                            if (parsed.end_date) {
                              updates.end_date = parsed.end_date
                              console.log('Setting end_date to:', parsed.end_date)
                            }
                            if (parsed.start_time) {
                              updates.start_time = parsed.start_time
                              console.log('Setting start_time to:', parsed.start_time)
                            }
                            if (parsed.end_time) {
                              updates.end_time = parsed.end_time
                              console.log('Setting end_time to:', parsed.end_time)
                            }
                            if (parsed.location) {
                              updates.location = parsed.location
                            }
                            if (parsed.host_org) {
                              updates.host_org = parsed.host_org
                            }
                            if (parsed.website_url) {
                              updates.website_url = parsed.website_url
                            }
                            
                            console.log('Final updates to apply:', updates)
                            setEditing({ ...editing, ...updates })
                            console.log('State updated successfully')
                          } catch (ocrError: any) {
                            console.error('OCR failed:', ocrError)
                            alert(`OCR failed: ${ocrError?.message || 'Unknown error'}`)
                            setEditing({ ...editing, image_url: data.publicUrl })
                          }
                        } finally {
                          e.currentTarget.value = ''
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {editing?.image_url && (
                    <div
                      style={{ display: 'inline-block' }}
                      onMouseEnter={() => setImageHover(true)}
                      onMouseLeave={() => setImageHover(false)}
                    >
                      <img
                        src={editing.image_url}
                        alt="Event"
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}` }}
                      />
                      {imageHover && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0,
                            zIndex: 20,
                            padding: '12px',
                            pointerEvents: 'none',
                            background: 'transparent',
                            display: 'flex',
                            alignItems: 'stretch',
                            justifyContent: 'center'
                          }}
                        >
                          <div style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: '8px',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                            background: darkMode ? 'rgba(31,41,55,0.96)' : 'rgba(255,255,255,0.96)',
                            border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img
                              src={editing.image_url}
                              alt="Event preview"
                              style={{
                                maxWidth: 'calc(100% - 24px)',
                                maxHeight: 'calc(100% - 24px)',
                                objectFit: 'contain',
                                borderRadius: '6px',
                                display: 'block'
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Signature Event and Status - At the top */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  background: darkMode ? '#374151' : '#f3f4f6',
                  borderRadius: '8px',
                  border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`
                }}>
                  <input
                    type="checkbox"
                    id="is_signature_event_top"
                    checked={editing?.is_signature_event === true}
                    onChange={(e) => setEditing({...editing!, is_signature_event: e.target.checked})}
                    style={{
                      accentColor: darkMode ? '#3b82f6' : '#3b82f6',
                      cursor: 'pointer',
                      width: '20px',
                      height: '20px',
                      margin: 0
                    }}
                  />
                  <label
                    htmlFor="is_signature_event_top"
                    style={{
                      color: darkMode ? '#f9fafb' : '#374151',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      flex: 1
                    }}
                  >
                    ⭐ Signature Event
                  </label>
                </div>
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
              </div>

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
                resize="vertical"
                editingId={editing?.id?.toString()}
                darkMode={darkMode}
              />

              <KeywordSelector
                label="Keywords"
                value={editing?.keywords || []}
                onChange={(keywords) => setEditing({...editing!, keywords})}
                existingKeywords={existingKeywords}
                darkMode={darkMode}
                editingId={editing?.id?.toString()}
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
                  endIcon={<span style={{ fontSize: '16px' }}>📍</span>}
                  onEndIconClick={() => {
                    const location = editing?.location?.trim();
                    if (location) {
                      const encodedLocation = encodeURIComponent(location);
                      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`;
                      window.open(mapUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  endIconTitle="Open location in Google Maps"
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
                  <div>
                    <FormField
                      label=""
                      name="website_url"
                      value={editing?.website_url || ''}
                      onChange={(value) => setEditing({...editing!, website_url: value as string})}
                      type="url"
                      editingId={editing?.id?.toString()}
                      darkMode={darkMode}
                      endIcon={editing?.website_url ? '🔗' : undefined}
                      endIconTitle="Open URL in new tab"
                      onEndIconClick={editing?.website_url ? () => {
                        const url = editing.website_url
                        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                          window.open(url, '_blank', 'noopener,noreferrer')
                        } else if (url) {
                          window.open(`https://${url}`, '_blank', 'noopener,noreferrer')
                        }
                      } : undefined}
                    />
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

              {/* Sort Order */}
              <FormField
                label="Sort Order"
                name="sort_order"
                value={editing?.sort_order ?? 1000}
                onChange={(value) => setEditing({...editing!, sort_order: value as number})}
                type="number"
                editingId={editing?.id?.toString()}
                darkMode={darkMode}
              />

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