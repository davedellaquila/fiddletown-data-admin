/**
 * Routes Feature Component
 * 
 * Admin interface for managing hiking/walking routes.
 * 
 * Features:
 * - CRUD operations (Create, Read, Update, Delete)
 * - CSV/TSV import/export (auto-detects delimiter)
 * - GPX file upload for route tracks
 * - Bulk actions (publish, archive, delete)
 * - Search and filtering
 * - Sortable columns
 * - Soft delete support
 * - Status management (draft, published, archived)
 * - Difficulty levels (easy, moderate, challenging)
 * 
 * Data Model:
 * - Routes are stored in Supabase 'routes' table
 * - GPX files are stored in Supabase Storage 'routes' bucket
 * - Uses soft deletes (deleted_at timestamp)
 * - Slug is auto-generated from name if not provided
 * 
 * @module Routes
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import ModalDialog from '../shared/components/ModalDialog'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'
import ActionMenu, { ActionMenuItem } from '../shared/components/ActionMenu'
import IconActionButton from '../shared/components/IconActionButton'
import archiveIcon from '../assets/archive.svg'
import trashIcon from '../assets/trash.svg'
import { slugify } from '../../shared/utils/slugify'
import type { RouteRow, Difficulty, Status } from '../../shared/types/models'

/**
 * CSV/TSV Parser
 * 
 * Auto-detects delimiter (tab vs comma) by counting occurrences in header line.
 * Supports quoted fields with escaped quotes (standard CSV format).
 * Handles both CSV and TSV formats seamlessly.
 * 
 * @param text - Raw CSV/TSV text content
 * @returns 2D array where each inner array is a row of cells
 */
function parseCSV(text: string): string[][] {
  // Auto-detect delimiter from header line (tab vs comma)
  const firstLineEnd = text.indexOf('\n') === -1 ? text.length : text.indexOf('\n')
  const headerSlice = text.slice(0, firstLineEnd)
  const tabCount = (headerSlice.match(/\t/g) || []).length
  const commaCount = (headerSlice.match(/,/g) || []).length
  const delim = tabCount > commaCount ? '\t' : ','

  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else { inQuotes = false }
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === delim) { cur.push(cell); cell = '' }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
      else if (ch === '\r') { /* skip */ }
      else cell += ch
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
 * Provides a template CSV with sample data showing expected format.
 * Helps users understand the required columns and data types.
 */
function downloadTemplateCSV() {
  const headers = ['name','slug','duration_minutes','start_point','end_point','difficulty','notes','status','sort_order']
  const sample = [{
    name: 'Gold Country Scenic Loop',
    slug: 'gold-country-scenic-loop',
    duration_minutes: 180,
    start_point: 'Fiddletown',
    end_point: 'Fiddletown',
    difficulty: 'moderate',
    notes: 'Gentle climbs, great views.',
    status: 'draft',
    sort_order: 1000
  }]
  const csv = toCSV(sample, headers)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'routes-template.csv'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * Props for Routes component
 */
interface RoutesProps {
  darkMode?: boolean // Whether dark mode is enabled
  sidebarCollapsed?: boolean // Whether sidebar is collapsed (affects dialog positioning)
}

/**
 * Routes component
 * 
 * Main component for managing route data. Handles CRUD operations,
 * GPX file uploads, import/export, bulk actions, and filtering.
 */
export default function Routes({ darkMode = false, sidebarCollapsed = false }: RoutesProps) {
  // Data state
  const [rows, setRows] = useState<RouteRow[]>([]) // All loaded routes
  const [loading, setLoading] = useState(false) // Loading indicator
  const [editing, setEditing] = useState<RouteRow | null>(null) // Currently editing route
  const [q, setQ] = useState('') // Search query (filters by name)
  const fileRef = useRef<HTMLInputElement | null>(null) // Ref to GPX file input

  // UI feedback state
  const [busy, setBusy] = useState(false) // Whether a save/upload operation is in progress
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'info', msg: string } | null>(null) // Toast notification

  // Import/Export state
  const [importing, setImporting] = useState(false) // Whether import preview dialog is open
  const [importPreview, setImportPreview] = useState<any[] | null>(null) // Parsed CSV data for preview
  const [importErrors, setImportErrors] = useState<string[]>([]) // Validation errors from import
  const importFileInputRef = useRef<HTMLInputElement>(null) // Ref to hidden file input for CSV import
  
  // Selection and sorting state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()) // IDs of selected rows for bulk actions
  const [sortBy, setSortBy] = useState<'name' | 'duration_minutes' | 'difficulty' | 'status'>('name') // Column to sort by
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc') // Sort direction

  /**
   * Handle column header click for sorting
   * 
   * Behavior:
   * - Clicking same column: toggles sort order (asc ↔ desc)
   * - Clicking different column: sets new sort column, defaults to asc
   */
  const handleSort = (column: 'name' | 'duration_minutes' | 'difficulty' | 'status') => {
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
   * Show a toast notification
   * 
   * Displays a temporary message in the bottom-right corner.
   * Automatically dismisses after 2.5 seconds.
   * 
   * @param msg - Message to display
   * @param type - Toast type ('ok' = success, 'err' = error, 'info' = info)
   */
  function pushToast(msg: string, type: 'ok' | 'err' | 'info' = 'info') {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 2500)
  }

  /**
   * Handle Escape key to close edit dialog
   * 
   * Provides keyboard accessibility - pressing Escape closes the edit dialog
   * and clears any selected GPX file.
   */
  useEffect(() => {
    function handleKeyDown(ev: KeyboardEvent) {
      if (ev.key === 'Escape' && editing) {
        setEditing(null)
        if (fileRef.current) fileRef.current.value = ''
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editing])

  /**
   * Load routes from database
   * 
   * Fetches all non-deleted routes, optionally filtered by search query.
   * Results are sorted by sort_order (ascending), then by name.
   */
  const load = async () => {
    setLoading(true)
    let query = supabase
      .from('routes')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) alert(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q])

  /**
   * Export routes to CSV file
   * 
   * Fetches current filtered data and downloads as CSV.
   * Respects current search filter (q).
   * Only exports non-deleted routes.
   */
  const exportCSV = async () => {
    let query = supabase
      .from('routes')
      .select('name,slug,duration_minutes,start_point,end_point,difficulty,notes,status,sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) { alert(error.message); return }

    const headers = ['name','slug','duration_minutes','start_point','end_point','difficulty','notes','status','sort_order']
    const csv = toCSV(data || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'routes-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  /**
   * Handle CSV/TSV file import
   * 
   * Process:
   * 1. Read file content
   * 2. Parse CSV/TSV (auto-detects delimiter)
   * 3. Map headers with aliases (e.g., "title" → "name")
   * 4. Normalize and validate data
   * 5. Show preview with validation errors
   * 
   * Supports header aliases for common column name variations.
   * Import uses upsert (update existing or insert new) based on slug.
   * 
   * @param e - File input change event
   */
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const grid = parseCSV(text)
    if (grid.length < 2) { alert('CSV/TSV must include a header and at least one row'); return }

    // Map headers (allow some aliases for user convenience)
    const rawHeaders = grid[0].map(h => h.trim().toLowerCase())
    const headerAlias: Record<string, string> = {
      'title': 'name',
      'route': 'name',
      'start': 'start_point',
      'start point': 'start_point',
      'end': 'end_point',
      'end point': 'end_point',
      'duration': 'duration_minutes',
      'minutes': 'duration_minutes',
      'difficulty_level': 'difficulty',
      'desc': 'notes',
      'description': 'notes',
      'sort': 'sort_order',
      'order': 'sort_order'
    }
    const headers = rawHeaders.map(h => headerAlias[h] ?? h)

    const rows = grid.slice(1).map(cols => {
      const obj: Record<string, any> = {}
      headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim() })
      return obj
    })

    const preview = rows.map(r => {
      // normalize + coerce
      const rec: any = {
        name: r.name || '',
        slug: r.slug || (r.name ? slugify(r.name) : ''),
        duration_minutes: r.duration_minutes ? Number(r.duration_minutes) : null,
        start_point: r.start_point || null,
        end_point: r.end_point || null,
        difficulty: (r.difficulty || '').toLowerCase() || null,
        notes: r.notes || null,
        status: (r.status || 'draft').toLowerCase(),
        sort_order: r.sort_order ? Number(r.sort_order) : null
      }
      if (rec.difficulty && !['easy','moderate','challenging'].includes(rec.difficulty)) rec.difficulty = 'moderate'
      if (!['draft','published','archived'].includes(rec.status)) rec.status = 'draft'
      return rec
    })

    // validations
    const errs: string[] = []
    preview.forEach((r, idx) => {
      const row = idx + 2
      if (!r.name) errs.push(`Row ${row}: name is required`)
      if (!r.slug) errs.push(`Row ${row}: slug missing (cannot derive)`)
      if (r.duration_minutes != null && !Number.isFinite(r.duration_minutes)) errs.push(`Row ${row}: duration_minutes must be a number`)
      if (r.sort_order != null && !Number.isInteger(r.sort_order)) errs.push(`Row ${row}: sort_order must be an integer`)
      if (r.difficulty && !['easy','moderate','challenging'].includes(r.difficulty)) errs.push(`Row ${row}: difficulty must be easy|moderate|challenging`)
    })

    setImportPreview(preview)
    setImportErrors(errs)
    setImporting(true)
    e.target.value = '' // clear
  }

  const confirmImport = async () => {
    if (!importPreview) return
    if (importErrors.length) { alert('Fix errors before importing'); return }
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id ?? null

    const payload = importPreview.map(r => ({
      name: r.name,
      slug: r.slug,
      duration_minutes: r.duration_minutes,
      start_point: r.start_point,
      end_point: r.end_point,
      difficulty: r.difficulty,
      notes: r.notes,
      status: r.status,
      sort_order: r.sort_order,
      created_by: uid
    }))

    const { error } = await supabase
      .from('routes')
      .upsert(payload, { onConflict: 'slug' })

    if (error) { setImportErrors([error.message]); return }

    setImporting(false)
    setImportPreview(null)
    setImportErrors([])
    await load()
    alert('Import complete')
  }

  const startNew = async () => {
    const { data: session } = await supabase.auth.getSession()
    setEditing({
      id: '',
      name: '',
      slug: '',
      gpx_url: '',
      duration_minutes: 120,
      start_point: '',
      end_point: '',
      difficulty: 'moderate',
      notes: '',
      status: 'draft',
      sort_order: 1000,
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
  }

  /**
   * Upload GPX file to Supabase Storage
   * 
   * Uploads GPX files to the 'routes' storage bucket.
   * Files are organized by route slug for easy management.
   * 
   * File naming: {slug}/{timestamp}-{filename}
   * 
   * @param file - GPX file to upload
   * @returns Public URL of uploaded file, or null if upload fails
   */
  async function uploadGpx(file: File): Promise<string | null> {
    // Ensure user is signed in (uploads are blocked for anonymous users by RLS)
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) { pushToast('Please sign in again to upload.', 'err'); return null }

    // Generate storage path: {slug}/{timestamp}-{filename}
    const base = (editing?.slug || slugify(editing?.name || 'route')) || crypto.randomUUID()
    const path = `${base}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    // Upload to Supabase Storage
    const { error } = await supabase.storage.from('routes').upload(path, file, {
      cacheControl: '3600',
      upsert: false, // Don't overwrite existing files
      contentType: file.type || 'application/gpx+xml'
    })
    if (error) { pushToast(`Upload failed: ${error.message}`, 'err'); return null }

    // Get public URL for the uploaded file
    const { data } = supabase.storage.from('routes').getPublicUrl(path)
    return data.publicUrl
  }

  /**
   * Save route (create or update)
   * 
   * Handles both insert (new) and update (existing) operations.
   * If a GPX file is selected, uploads it first and sets gpx_url.
   * Auto-generates slug from name if slug is missing.
   * 
   * @param options - Optional configuration
   * @param options.suppressClose - If true, keeps dialog open after save (useful for navigation)
   */
  const save = async (options?: { suppressClose?: boolean }) => {
    if (!editing) return
    setBusy(true)
    try {
    const payload = { ...editing }

      // Validate required fields
      if (!payload.name) { pushToast('Name is required', 'err'); return }
    // Auto-generate slug if missing
    if (!payload.slug) payload.slug = slugify(payload.name)

    // If a GPX file is selected, upload it first and set gpx_url
    const file = fileRef.current?.files?.[0]
    if (file) {
        pushToast('Uploading GPX…', 'info')
      const url = await uploadGpx(file)
      if (!url) return // Upload failed, error already shown
      payload.gpx_url = url
        pushToast('GPX uploaded', 'ok')
    }

    if (payload.id) {
      // UPDATE existing route – send only editable columns
      const { error } = await supabase.from('routes')
        .update({
          name: payload.name,
          slug: payload.slug,
          gpx_url: payload.gpx_url,
          duration_minutes: payload.duration_minutes,
          start_point: payload.start_point,
          end_point: payload.end_point,
          difficulty: payload.difficulty,
          notes: payload.notes,
          status: payload.status,
          sort_order: payload.sort_order
        })
        .eq('id', payload.id)
        if (error) { pushToast(error.message, 'err'); return }
    } else {
      // INSERT new route – strip id/timestamps so Postgres generates them
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('routes').insert(insertable).select().single()
        if (error) { pushToast(error.message, 'err'); return }
      payload.id = data!.id
    }

    // Close dialog unless suppressClose is true
    if (!options?.suppressClose) setEditing(null)
    // Clear file input
    fileRef.current && (fileRef.current.value = '')
    await load() // Reload to show changes
      pushToast('Saved', 'ok')
    } finally {
      setBusy(false)
    }
  }

  const publishRow = async (id: string) => {
    const { error } = await supabase.from('routes').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else load()
  }
  const archiveRow = async (id: string) => {
    const { error } = await supabase.from('routes').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else load()
  }
  const softDelete = async (id: string) => {
    if (!confirm('Delete this route? (soft delete)')) return
    const { error } = await supabase.from('routes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  const bulkPublish = async () => {
    if (!selectedIds.size) { alert('Select at least one route.'); return }
    const { error } = await supabase.from('routes').update({ status: 'published' }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
  }

  const bulkArchive = async () => {
    if (!selectedIds.size) { alert('Select at least one route.'); return }
    const { error } = await supabase.from('routes').update({ status: 'archived' }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
  }

  const bulkDelete = async () => {
    if (!selectedIds.size) { alert('Select at least one route.'); return }
    if (!confirm('Soft delete selected routes?')) return
    const { error } = await supabase.from('routes').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
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
      const next = new Set(prev)
      rows.forEach(r => next.add(r.id))
      return next
    })
  }

  return (
    <div>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 9999,
            padding: '10px 12px',
            borderRadius: 10,
            color: '#111',
            border: '1px solid #e5e7eb',
            background: toast.type === 'ok' ? '#ecfdf5' : toast.type === 'err' ? '#fef2f2' : '#f8fafc',
            boxShadow: '0 4px 14px rgba(0,0,0,.08)'
          }}
        >
          {toast.msg}
        </div>
      )}
      {/* Two-row toolbar layout */}
      <div
        className="routes-toolbar"
        aria-label="Routes toolbar"
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
      >
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
            }}>🗺️ Routes</h2>
            
            <button 
              className="btn" 
              onClick={startNew} 
              disabled={busy || importing}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '8px 12px',
                background: darkMode ? '#374151' : '#ffffff',
                border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                color: darkMode ? '#f9fafb' : '#374151',
                borderRadius: '6px'
              }}
              title="Create new route"
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
              disabled={busy || importing}
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
                cursor: (busy || importing) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px',
                opacity: (busy || importing) ? 0.6 : 1
              }}
            >
              ⬇️
            </button>
            <button
              className="btn"
              onClick={() => importFileInputRef.current?.click()}
              disabled={busy || importing}
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
                cursor: (busy || importing) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px',
                opacity: (busy || importing) ? 0.6 : 1
              }}
            >
              ⬆️
            </button>
            <ActionMenu
            items={[
              {
                id: 'refresh',
                label: loading ? 'Loading…' : 'Refresh',
                icon: loading ? '⏳' : '🔄',
                onClick: load,
                disabled: loading || busy || importing
              },
              {
                id: 'template',
                label: 'Template',
                icon: '📋',
                onClick: downloadTemplateCSV,
                disabled: busy || importing
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
            disabled={busy || importing}
          />
          </div>
          
          <input ref={importFileInputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImportFile} style={{ display: 'none' }} disabled={busy || importing} />
        </div>

        {/* Bottom row: Search controls */}
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
                {/* circle.square symbol */}
                ◯◼︎
              </button>
            )}
          </div>
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
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>duration_minutes</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>start_point</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>end_point</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>difficulty</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>status</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>sort_order</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>notes</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.slice(0,50).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.name}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.slug}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.duration_minutes ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.start_point ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.end_point ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.difficulty ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.status}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.sort_order ?? ''}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.notes ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={confirmImport} disabled={importErrors.length>0}>Confirm Import</button>{' '}
            <button className="btn" onClick={()=>{ setImporting(false); setImportPreview(null); setImportErrors([]) }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Desktop table view */}
      <div className="responsive-table-container">
      <table className="responsive-table">
          <thead>
            <tr>
              <th style={{ width: 28, padding: '8px 6px' }}>
                <input 
                  type="checkbox" 
                  onChange={e=>toggleSelectAllVisible(e.target.checked)} 
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  style={{ cursor: 'pointer' }}
                  title="Select all"
                />
              </th>
              <th
                onClick={() => handleSort('name')}
                style={{
                  textAlign: 'left',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('duration_minutes')}
                style={{
                  textAlign: 'left',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Duration {sortBy === 'duration_minutes' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('difficulty')}
                style={{
                  textAlign: 'left',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Difficulty {sortBy === 'difficulty' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>GPX</th>
              <th
                onClick={() => handleSort('status')}
                style={{
                  textAlign: 'left',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th></th>
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
                
                // Handle string sorting (for name, difficulty, status)
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                  return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal)
                }
                
                // Handle numeric sorting (for duration_minutes)
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
                return 0
              })
              .map(r => (
              <tr 
                key={r.id}
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
                <td style={{ background: 'transparent', width: 28, padding: '0 6px', textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(r.id)} 
                    onChange={e=>toggleSelect(r.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ background: 'transparent' }}>{r.name}</td>
                <td style={{ background: 'transparent' }}>{r.duration_minutes ? `${r.duration_minutes} min` : '—'}</td>
                <td style={{ background: 'transparent' }}>{r.difficulty ?? '—'}</td>
                <td style={{ background: 'transparent' }}>
                  {r.gpx_url ? (
                    <a 
                      href={r.gpx_url} 
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
                      <span>📁</span>
                      GPX
                    </a>
                  ) : (
                    <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ background: 'transparent' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: darkMode
                      ? '#374151'
                      : (r.status === 'published' ? '#e8f5e8' : r.status === 'archived' ? '#fff3e0' : '#f5f5f5'),
                    color: r.status === 'published'
                      ? (darkMode ? '#10b981' : '#2e7d32')
                      : r.status === 'archived'
                        ? (darkMode ? '#f59e0b' : '#f57c00')
                        : (darkMode ? '#e5e7eb' : '#666'),
                    border: darkMode
                      ? '1px solid #4b5563'
                      : (r.status === 'published' ? '#c8e6c9' : r.status === 'archived' ? '#ffcc02' : '#e0e0e0')
                  }}>
                    {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                    {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', background: 'transparent' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {r.status !== 'published' && (
                      <button 
                        className="btn btn-publish" 
                        onClick={(e) => {
                          e.stopPropagation()
                          publishRow(r.id)
                        }}
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: darkMode ? '#065f46' : '#e8f5e8',
                          border: `1px solid ${darkMode ? '#047857' : '#c8e6c9'}`,
                          borderRadius: '4px',
                          color: darkMode ? '#ffffff' : '#2e7d32'
                        }}
                        title="Publish route"
                      >
                        <span>🚀</span>
                        Publish
                      </button>
                    )}
                    {r.status !== 'archived' && (
                      <IconActionButton
                        icon={<img src={archiveIcon} alt="archive" width={16} height={16} />}
                        onClick={(e) => {
                          e.stopPropagation()
                          archiveRow(r.id)
                        }}
                        title="Archive route"
                        darkMode={darkMode}
                      />
                    )}
                    <IconActionButton
                      icon={<img src={trashIcon} alt="delete" width={16} height={16} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        softDelete(r.id)
                      }}
                      title="Delete route"
                      darkMode={darkMode}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7}>No records.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="responsive-card-layout">
        {rows.length === 0 && !loading && (
          <div style={{ padding: '20px', textAlign: 'center', color: darkMode ? '#9ca3af' : '#6b7280' }}>
            No records.
          </div>
        )}
        {rows
          .sort((a, b) => {
            let aVal = a[sortBy]
            let bVal = b[sortBy]
            
            // Handle null/undefined values
            if (aVal == null && bVal == null) return 0
            if (aVal == null) return sortOrder === 'asc' ? 1 : -1
            if (bVal == null) return sortOrder === 'asc' ? -1 : 1
            
            // Handle string sorting (for name, difficulty, status)
            if (typeof aVal === 'string' && typeof bVal === 'string') {
              return sortOrder === 'asc' 
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal)
            }
            
            // Handle numeric sorting (for duration_minutes)
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
            return 0
          })
          .map(r => (
            <div
              key={r.id}
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
                  checked={selectedIds.has(r.id)} 
                  onChange={(e) => {
                    e.stopPropagation()
                    toggleSelect(r.id, e.target.checked)
                  }}
                  style={{
                    accentColor: darkMode ? '#3b82f6' : '#3b82f6',
                    marginTop: '4px'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: '16px',
                    color: darkMode ? '#f9fafb' : '#1f2937',
                    marginBottom: '8px'
                  }}>
                    {r.name}
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
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {r.status !== 'published' && (
                    <button 
                      className="btn btn-publish" 
                      onClick={(e) => {
                        e.stopPropagation()
                        publishRow(r.id)
                      }}
                      style={{ 
                        padding: '6px 10px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: darkMode ? '#065f46' : '#e8f5e8',
                        border: `1px solid ${darkMode ? '#047857' : '#c8e6c9'}`,
                        borderRadius: '4px',
                        color: darkMode ? '#ffffff' : '#2e7d32'
                      }}
                      title="Publish route"
                    >
                      <span>🚀</span>
                      Publish
                    </button>
                  )}
                  {r.status !== 'archived' && (
                    <IconActionButton
                      icon={<img src={archiveIcon} alt="archive" width={16} height={16} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        archiveRow(r.id)
                      }}
                      title="Archive route"
                      darkMode={darkMode}
                    />
                  )}
                  <IconActionButton
                    icon={<img src={trashIcon} alt="delete" width={16} height={16} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      softDelete(r.id)
                    }}
                    title="Delete route"
                    darkMode={darkMode}
                  />
                </div>
              </div>
              <div className="data-card-content">
                {r.duration_minutes && (
                  <div className="data-card-field">
                    <div className="data-card-label">Duration</div>
                    <div className="data-card-value">{r.duration_minutes} min</div>
                  </div>
                )}
                {r.difficulty && (
                  <div className="data-card-field">
                    <div className="data-card-label">Difficulty</div>
                    <div className="data-card-value">{r.difficulty}</div>
                  </div>
                )}
                {r.start_point && (
                  <div className="data-card-field">
                    <div className="data-card-label">Start Point</div>
                    <div className="data-card-value">{r.start_point}</div>
                  </div>
                )}
                {r.end_point && (
                  <div className="data-card-field">
                    <div className="data-card-label">End Point</div>
                    <div className="data-card-value">{r.end_point}</div>
                  </div>
                )}
                {r.gpx_url && (
                  <div className="data-card-field">
                    <div className="data-card-label">GPX File</div>
                    <div className="data-card-value">
                      <a 
                        href={r.gpx_url} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          color: darkMode ? '#3b82f6' : '#1976d2',
                          textDecoration: 'none'
                        }}
                      >
                        📁 View GPX
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      <AutoSaveEditDialog
        key="route-dialog"
        isOpen={editing !== null}
        onClose={() => { if (!busy) { setEditing(null); fileRef.current && (fileRef.current.value='') }}}
        title={editing?.id ? '✏️ Edit Route' : '➕ New Route'}
        maxWidth="600px"
        darkMode={darkMode}
        overlayLeftOffsetPx={sidebarCollapsed ? 60 : 220}
        editing={editing}
        rows={rows}
        saveFunction={save}
        setEditing={(item) => setEditing(item as RouteRow | null)}
        itemType="route"
      >

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <FormField
                  label="Route Name"
                  name="name"
                  value={editing?.name || ''}
                  onChange={(value) => setEditing({...editing!, name: value as string})}
                  required
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
                <FormField
                  label="Slug"
                  name="slug"
                  value={editing?.slug ?? ''}
                  onChange={(value) => setEditing({...editing!, slug: value as string})}
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
              </div>

              {/* Duration and Difficulty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Duration (minutes)"
                  name="duration_minutes"
                  value={editing?.duration_minutes ?? 120}
                  onChange={(value) => setEditing({...editing!, duration_minutes: value as number})}
                  type="number"
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
                <FormField
                  label="Difficulty"
                  name="difficulty"
                  value={editing?.difficulty ?? 'moderate'}
                  onChange={(value) => setEditing({...editing!, difficulty: value as Difficulty})}
                  type="select"
                  options={[
                    { value: 'easy', label: '🟢 Easy' },
                    { value: 'moderate', label: '🟡 Moderate' },
                    { value: 'challenging', label: '🔴 Challenging' }
                  ]}
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
              </div>

              {/* Start and End Points */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Start Point"
                  name="start_point"
                  value={editing?.start_point ?? ''}
                  onChange={(value) => setEditing({...editing!, start_point: value as string})}
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
                <FormField
                  label="End Point"
                  name="end_point"
                  value={editing?.end_point ?? ''}
                  onChange={(value) => setEditing({...editing!, end_point: value as string})}
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
          </div>

              <FormField
                label="Notes"
                name="notes"
                value={editing?.notes ?? ''}
                onChange={(value) => setEditing({...editing!, notes: value as string})}
                type="textarea"
                editingId={editing?.id}
                darkMode={darkMode}
              />

              {/* GPX File Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                  GPX File
                </label>
                <input 
                  ref={fileRef} 
                  type="file" 
                  accept=".gpx,application/gpx+xml,application/xml" 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: '#fff'
                  }}
                />
            {editing?.gpx_url && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: '#f3f4f6', 
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}>
                    <strong>Current:</strong> <a href={editing.gpx_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>{editing.gpx_url}</a>
              </div>
            )}
          </div>

              {/* Status and Sort Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField
                  label="Status"
                  name="status"
                  value={editing?.status || 'draft'}
                  onChange={(value) => setEditing({...editing!, status: value as Status})}
                  type="select"
                  options={[
                    { value: 'draft', label: '📝 Draft' },
                    { value: 'published', label: '✅ Published' },
                    { value: 'archived', label: '📦 Archived' }
                  ]}
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
                <FormField
                  label="Sort Order"
                  name="sort_order"
                  value={editing?.sort_order ?? 1000}
                  onChange={(value) => setEditing({...editing!, sort_order: value as number})}
                  type="number"
                  editingId={editing?.id}
                  darkMode={darkMode}
                />
              </div>
            </div>
      </AutoSaveEditDialog>
    </div>
  )
}