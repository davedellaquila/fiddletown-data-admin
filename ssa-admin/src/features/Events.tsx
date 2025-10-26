import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
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

function parseEventText(text: string) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const dateMarker = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|\b20\d{2}\b/i
  const titleLines: string[] = []
  let dateLine = ''
  for (const ln of lines) {
    if (dateMarker.test(ln)) { dateLine = ln; break }
    titleLines.push(ln)
  }
  const name = (titleLines.join(' ') || lines[0] || '').replace(/\s+/g, ' ').trim()

  const allDay = /all\s*day/i.test(dateLine)
  const cleaned = dateLine.replace(/,?\s*All\s*day/i, '').replace(/\s{2,}/g, ' ').replace(/\s*,\s*/g, ', ').trim()

  const tryParse = (s: string) => {
    const d = new Date(s.replace(/,/g, ''))
    return isNaN(d.getTime()) ? null : d
  }

  let iso: string | null = null
  const d = cleaned ? tryParse(cleaned) : null
  if (d) iso = formatISO(d)

  return {
    name,
    start_date: iso,
    end_date: iso,
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
  const getButtonStyle = (baseStyle: any = {}) => ({
    ...baseStyle,
    background: darkMode ? '#374151' : '#ffffff',
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

  // Helper function to update editing state safely
  const updateEditing = (updates: Partial<EventRow>) => {
    if (editing) {
      setEditing({...editing, ...updates});
    } else {
      setEditing({
        name: '',
        status: 'draft',
        sort_order: 1000,
        ...updates
      });
    }
  }

  // Handle escape key and click outside to cancel editing
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
      }
    }

    if (editing || ocrOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editing, ocrOpen])

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
      <h2 style={{ 
        color: darkMode ? '#f9fafb' : '#1f2937',
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '600'
      }}>📅 Events</h2>
      

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
              background: darkMode ? '#374151' : '#ffffff',
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
              background: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              maxWidth: '900px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                📷 Add Event from Image
              </h3>
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
                  color: '#6b7280',
                  padding: '4px'
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Image Upload Section */}
              <div style={{ 
                border: '1px dashed #c8b68a',
                padding: '20px',
                borderRadius: '8px',
                background: '#fff9ef',
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
                        style={{ 
                          maxWidth: 120, 
                          maxHeight: 120, 
                          objectFit: 'contain', 
                          borderRadius: 6, 
                          border: '1px solid #eee' 
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
                    <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                      Paste an image here (⌘/Ctrl+V) or choose a file. We'll OCR the text, parse it, and let you verify before saving.
                    </p>
                    <small style={{ color: '#8b6b34' }}>
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
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                      Event Details
                    </h4>
                    <div style={{ display: 'grid', gap: '16px' }}>
                      {/* Name and Slug row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Event Name *
                          </label>
                          <input 
                            value={ocrDraft?.name ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), name: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                            placeholder="Enter event name"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Slug
                          </label>
                          <input 
                            value={(ocrDraft as any)?.slug ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), slug: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                            placeholder="event-slug"
                          />
                        </div>
                      </div>

                      {/* Host Org and Location row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Host Organization
                          </label>
                          <input 
                            value={ocrDraft?.host_org ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), host_org: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                            placeholder="Host organization"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Location
                          </label>
                          <input 
                            value={ocrDraft?.location ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), location: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                            placeholder="Event location"
                          />
                        </div>
                      </div>

                      {/* Date and Time row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Start Date
                          </label>
                          <input 
                            type="date" 
                            value={ocrDraft?.start_date ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), start_date: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            End Date
                          </label>
                          <input 
                            type="date" 
                            value={ocrDraft?.end_date ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), end_date: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Start Time
                          </label>
                          <input 
                            type="time" 
                            value={ocrDraft?.start_time ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), start_time: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            End Time
                          </label>
                          <input 
                            type="time" 
                            value={ocrDraft?.end_time ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), end_time: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                          />
                        </div>
                      </div>

                      {/* Website and Status row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Website URL
                          </label>
                          <input 
                            type="url" 
                            value={ocrDraft?.website_url ?? ''} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), website_url: e.target.value })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
                            }} 
                            placeholder="https://example.com"
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                            Status
                          </label>
                          <select 
                            value={ocrDraft?.status ?? 'draft'} 
                            onChange={e=>setOcrDraft({ ...(ocrDraft||{}), status: e.target.value as any })} 
                            style={{ 
                              width: '100%', 
                              padding: '12px', 
                              border: '1px solid #d1d5db', 
                              borderRadius: '8px',
                              fontSize: '14px'
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
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', color: '#374151' }}>
                      Raw OCR Text
                    </h4>
                    <textarea 
                      value={ocrRawText} 
                      onChange={e=>{ setOcrRawText(e.target.value); setOcrDraft(parseEventText(e.target.value) as any) }} 
                      style={{ 
                        width: '100%', 
                        height: 300, 
                        padding: '12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        background: '#f9fafb'
                      }} 
                      placeholder="OCR text will appear here..."
                    />
                    <div style={{ 
                      marginTop: 12, 
                      padding: 12, 
                      background: '#f3f4f6', 
                      borderRadius: 8, 
                      fontSize: '12px', 
                      color: '#6b7280' 
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
                borderTop: '1px solid #e5e7eb'
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
                    background: '#f9fafb',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    color: '#374151'
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
              <td style={{ 
                padding: '8px 6px', 
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: darkMode ? '#1f2937' : '#ffffff'
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
                borderBottom: `1px solid ${darkMode ? '#374151' : '#f1f1f1'}`,
                background: darkMode ? '#1f2937' : '#ffffff'
              }}>
                <div style={{ fontWeight: 600, color: darkMode ? '#f9fafb' : '#1f2937' }}>{r.name}</div>
                {r.host_org ? (
                  <div style={{ fontSize: 12, color: darkMode ? '#9ca3af' : '#666' }}>Host: {r.host_org}</div>
                ) : null}
                {r.recurrence ? (
                  <div style={{ fontSize: 12, color: '#666' }}>{r.recurrence}</div>
                ) : null}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                {r.start_date ? new Date(r.start_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                {r.end_date ? new Date(r.end_date + 'T00:00:00').toLocaleDateString() : ''}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                {r.start_time || '—'}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                {r.end_time || '—'}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>{r.location ?? ''}</td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: r.status === 'published' ? '#e8f5e8' : r.status === 'archived' ? '#fff3e0' : '#f5f5f5',
                  color: r.status === 'published' ? '#2e7d32' : r.status === 'archived' ? '#f57c00' : '#666',
                  border: `1px solid ${r.status === 'published' ? '#c8e6c9' : r.status === 'archived' ? '#ffcc02' : '#e0e0e0'}`
                }}>
                  {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                  {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                </span>
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
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
                      background: '#e3f2fd',
                      border: '1px solid #bbdefb',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      color: '#1976d2',
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
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
                {r.image_url ? (
                  <img 
                    src={r.image_url} 
                    alt={r.name} 
                    style={{ 
                      width: 40, 
                      height: 40, 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      border: '1px solid #ddd'
                    }} 
                  />
                ) : (
                  <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                )}
              </td>
              <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f1f1' }}>
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
                      borderRadius: '4px'
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
                      borderRadius: '4px'
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
                      borderRadius: '4px'
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

      {editing && (
        <div 
          onClick={() => setEditing(null)}
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
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              maxWidth: '800px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                {editing.id ? '✏️ Edit Event' : '➕ New Event'}
              </h3>
              <button 
                onClick={()=>setEditing(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '4px'
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Event Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Event Name *
                  </label>
                  <input 
                    value={editing?.name || ''} 
                    onChange={e=>updateEditing({name: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Enter event name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Slug
                  </label>
                  <input 
                    value={editing?.slug || ''} 
                    onChange={e=>updateEditing({slug: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="event-slug"
                  />
                </div>
              </div>

              {/* Host Org and Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Host Organization
                  </label>
                  <input 
                    value={editing?.host_org || ''} 
                    onChange={e=>updateEditing({ host_org: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Organization name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Location
                  </label>
                  <input 
                    value={editing?.location || ''} 
                    onChange={e=>updateEditing({ location: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Event location"
                  />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Start Date
            </label>
                  <input 
                    type="date" 
                    value={editing?.start_date || ''} 
                    onChange={e=>updateEditing({ start_date: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    End Date
                  </label>
                  <input 
                    type="date" 
                    value={editing?.end_date || ''} 
                    onChange={e=>updateEditing({ end_date: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>
          </div>

              {/* Times */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Start Time
          </label>
                  <input 
                    type="time" 
                    value={editing?.start_time || ''} 
                    onChange={e=>updateEditing({ start_time: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    End Time
                  </label>
                  <input 
                    type="time" 
                    value={editing?.end_time || ''} 
                    onChange={e=>updateEditing({ end_time: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  />
                </div>
              </div>

              {/* Website and Recurrence */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Website URL
                  </label>
                  <input 
                    value={editing?.website_url || ''} 
                    onChange={e=>updateEditing({ website_url: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="https://example.com"
                  />
          </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Recurrence
                  </label>
                  <input 
                    value={editing?.recurrence || ''} 
                    onChange={e=>updateEditing({ recurrence: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Annual, Monthly, etc."
                  />
        </div>
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
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
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        flex: 1
                      }}
                    />
                    <div
                      ref={pasteRef}
                      onPaste={async (e) => {
                        e.preventDefault()
                        const items = e.clipboardData?.items
                        if (items) {
                          for (let i = 0; i < items.length; i++) {
                            const item = items[i]
                            if (item.type.indexOf('image') !== -1) {
                              const file = item.getAsFile()
                              if (file) {
                                const url = await uploadImage(file)
                                if (url) {
                                  updateEditing({ image_url: url})
                                  setEditingImageUrl(url)
                                }
                              }
                              break
                            }
                          }
                        }
                      }}
                      style={{
                        padding: '12px',
                        border: `2px dashed ${darkMode ? '#4b5563' : '#d1d5db'}`,
                        borderRadius: '8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: darkMode ? '#9ca3af' : '#6b7280',
                        background: darkMode ? '#374151' : '#f9fafb',
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
                      style={{ 
                        width: 80, 
                        height: 80, 
                        objectFit: 'cover', 
                        borderRadius: '8px',
                        border: '1px solid #d1d5db'
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
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Status
                  </label>
                  <select 
                    value={editing?.status || 'draft'} 
                    onChange={e=>updateEditing({ status: e.target.value as any})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                  >
                    <option value="draft">📝 Draft</option>
                    <option value="published">✅ Published</option>
                    <option value="archived">📦 Archived</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Sort Order
                  </label>
                  <input 
                    type="number" 
                    value={editing?.sort_order || 1000} 
                    onChange={e=>updateEditing({ sort_order: Number(e.target.value)})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="1000"
                  />
                </div>
              </div>
            </div>

            <div style={{ 
              marginTop: '32px', 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <button 
                className="btn" 
                onClick={()=>setEditing(null)}
                style={{ 
                  padding: '12px 24px', 
                  fontSize: '14px',
                  background: '#f9fafb',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
              <button 
                className="btn primary" 
                onClick={save}
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
      )}
    </div>
  )
}