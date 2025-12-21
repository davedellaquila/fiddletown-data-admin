/**
 * Locations Feature Component
 * 
 * Admin interface for managing wineries, parks, and other location data.
 * 
 * Features:
 * - CRUD operations (Create, Read, Update, Delete)
 * - CSV import/export
 * - Bulk actions (publish, archive, delete)
 * - Search and filtering
 * - Sortable columns
 * - Soft delete support (deleted_at field)
 * - Status management (draft, published, archived)
 * 
 * Data Model:
 * - Locations are stored in Supabase 'locations' table
 * - Uses soft deletes (deleted_at timestamp) instead of hard deletes
 * - Slug is auto-generated from name if not provided
 * - Sort order determines display sequence
 * 
 * @module Locations
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'
import ActionMenu, { ActionMenuItem } from '../shared/components/ActionMenu'
import IconActionButton from '../shared/components/IconActionButton'
import archiveIcon from '../assets/archive.svg'
import trashIcon from '../assets/trash.svg'
import { slugify } from '../../shared/utils/slugify'
import type { Location } from '../../shared/types/models'

/**
 * Props for Locations component
 */
interface LocationsProps {
  darkMode?: boolean // Whether dark mode is enabled
  sidebarCollapsed?: boolean // Whether sidebar is collapsed (affects dialog positioning)
}

/**
 * Locations component
 * 
 * Main component for managing location data. Handles all CRUD operations,
 * import/export, bulk actions, and filtering.
 */
export default function Locations({ darkMode = false, sidebarCollapsed = false }: LocationsProps) {
  // Data state
  const [rows, setRows] = useState<Location[]>([]) // All loaded locations
  const [loading, setLoading] = useState(false) // Loading indicator
  const [editing, setEditing] = useState<Location | null>(null) // Currently editing location (null = not editing)
  
  // Search and filter state
  const [q, setQ] = useState('') // Search query (filters by name)
  
  // Import/export state
  const [importing, setImporting] = useState(false) // Whether import preview dialog is open
  const [importPreview, setImportPreview] = useState<any[] | null>(null) // Parsed CSV data for preview
  const [importErrors, setImportErrors] = useState<string[]>([]) // Validation errors from import
  const fileInputRef = useState<HTMLInputElement | null>(null)[0] // Legacy ref (unused)
  const importFileInputRef = useRef<HTMLInputElement>(null) // Ref to hidden file input for CSV import
  
  // Selection and sorting state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()) // IDs of selected rows for bulk actions
  const [sortBy, setSortBy] = useState<'name' | 'region' | 'status'>('name') // Column to sort by
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc') // Sort direction

  /**
   * Handle column header click for sorting
   * 
   * Behavior:
   * - Clicking same column: toggles sort order (asc ↔ desc)
   * - Clicking different column: sets new sort column, defaults to asc
   */
  const handleSort = (column: 'name' | 'region' | 'status') => {
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
   * Calculate toolbar height for sticky table header positioning
   * 
   * The table header needs to be positioned below the toolbar when scrolling.
   * This effect measures the toolbar height and updates it on resize.
   */
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState<number>(0)
  useEffect(() => {
    const update = () => setToolbarHeight(toolbarRef.current?.offsetHeight ?? 0)
    update()
    const ro = new ResizeObserver(update)
    if (toolbarRef.current) ro.observe(toolbarRef.current)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); ro.disconnect() }
  }, [])

  /**
   * Parse CSV text into a 2D array of strings
   * 
   * Handles:
   * - Quoted fields (with escaped quotes "")
   * - Commas within quoted fields
   * - Newlines within quoted fields
   * - Empty rows (filtered out)
   * 
   * This is a simple parser suitable for the expected CSV format.
   * For more complex CSV files, consider using a library like papaparse.
   * 
   * @param text - Raw CSV text content
   * @returns 2D array where each inner array is a row of cells
   */
  function parseCSV(text: string): string[][] {
    const rows: string[][] = []
    let cur: string[] = []
    let cell = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++ }
          else { inQuotes = false }
        } else {
          cell += ch
        }
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { cur.push(cell); cell = '' }
        else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
        else if (ch === '\r') { /* ignore */ }
        else cell += ch
      }
    }
    if (cell.length || cur.length) { cur.push(cell); rows.push(cur) }
    return rows.filter(r => r.length && r.some(c => c.trim() !== ''))
  }

  /**
   * Convert data rows to CSV format
   * 
   * Escapes values that contain commas, quotes, or newlines by wrapping in quotes
   * and doubling internal quotes (standard CSV escaping).
   * 
   * @param rows - Array of data objects
   * @param headers - Column names to include in CSV
   * @returns CSV-formatted string
   */
  function toCSV(rows: any[], headers: string[]): string {
    // Escape function: wraps values in quotes if they contain special characters
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
   * Export locations to CSV file
   * 
   * Fetches current filtered data and downloads as CSV.
   * Respects current search filter (q).
   * Only exports non-deleted locations.
   * 
   * File is automatically downloaded with name 'locations-export.csv'
   */
  const exportCSV = async () => {
    // Fetch fresh rows (respect current filter)
    let query = supabase.from('locations').select('name,slug,region,short_description,website_url,status,sort_order').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) { alert(error.message); return }
    const headers = ['name','slug','region','short_description','website_url','status','sort_order']
    const csv = toCSV(data || [], headers)
    // Create download link and trigger download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'locations-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  /**
   * Download CSV template file
   * 
   * Provides a template CSV with sample data to help users understand
   * the expected format for imports.
   */
  const downloadTemplate = () => {
    const headers = ['name','slug','region','short_description','website_url','status','sort_order']
    const sampleData = [
      {
        name: 'Sample Winery Name',
        slug: 'sample-winery-name',
        region: 'Napa Valley',
        short_description: 'A beautiful winery with stunning views',
        website_url: 'https://example.com',
        status: 'draft',
        sort_order: 100
      },
      {
        name: 'Another Winery',
        slug: 'another-winery',
        region: 'Sonoma County',
        short_description: 'Family-owned winery specializing in Pinot Noir',
        website_url: 'https://another-winery.com',
        status: 'published',
        sort_order: 200
      }
    ]
    const csv = toCSV(sampleData, headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'locations-template.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  /**
   * Handle CSV file import
   * 
   * Process:
   * 1. Read file content
   * 2. Parse CSV into rows
   * 3. Map headers to data fields
   * 4. Normalize and validate data
   * 5. Show preview with validation errors
   * 
   * The preview allows users to review data before confirming import.
   * Import uses upsert (update existing or insert new) based on slug.
   * 
   * @param e - File input change event
   */
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const grid = parseCSV(text)
    if (grid.length < 2) {
      alert('CSV must have header + at least one data row')
      return
    }
    // Map headers to lowercase for case-insensitive matching
    const headers = grid[0].map(h => h.trim().toLowerCase())
    // Convert rows to objects
    const rows = grid.slice(1).map((cols, i) => {
      const obj: Record<string, any> = {}
      headers.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim())
      return obj
    })
  
    // Normalize and validate each row
    const preview = rows.map((r, idx) => {
      const name = r.name || ''
      const slug = r.slug || (name ? slugify(name) : '') // Auto-generate slug if missing
      const region = r.region || null
      const short_description = r.short_description || null
      const website_url = r.website_url || null
      let status = (r.status || '').toLowerCase()
      // Validate status - default to 'draft' if invalid
      if (!['draft','published','archived'].includes(status)) status = 'draft'
      const sort_order = r.sort_order ? parseInt(r.sort_order, 10) : null
  
      return { name, slug, region, short_description, website_url, status, sort_order }
    })
  
    // Basic validation - collect errors for display
    const errors: string[] = []
    preview.forEach((r, i) => {
      if (!r.name) errors.push(`Row ${i+2}: missing name`)
      if (!r.slug) errors.push(`Row ${i+2}: cannot derive slug`)
    })
  
    setImportPreview(preview)
    setImportErrors(errors)
    setImporting(true)
    e.target.value = ''  // Clear the file input to allow re-selecting same file
  }  

  /**
   * Confirm and execute CSV import
   * 
   * Validates that there are no errors, then upserts all rows.
   * Uses slug as the conflict key (updates existing locations with same slug,
   * creates new ones if slug doesn't exist).
   * 
   * Sets created_by to current user ID for audit trail.
   */
  async function confirmImport() {
    if (!importPreview) return
    if (importErrors.length > 0) {
      alert('Fix errors before import')
      return
    }
    // Get current user for created_by field
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id || null
  
    // Map preview data to database payload
    const payload = importPreview.map(r => ({
      name: r.name,
      slug: r.slug,
      region: r.region,
      short_description: r.short_description,
      website_url: r.website_url,
      status: r.status,
      sort_order: r.sort_order,
      created_by: uid
    }))
  
    // Upsert: update if slug exists, insert if new
    const { error } = await supabase
      .from('locations')
      .upsert(payload, { onConflict: 'slug' })
  
    if (error) {
      setImportErrors([error.message])
      return
    }
    // Clear import state and reload data
    setImportPreview(null)
    setImportErrors([])
    setImporting(false)
    await load()
    alert('Import successful')
  }

  /**
   * Load locations from database
   * 
   * Fetches all non-deleted locations, optionally filtered by search query.
   * Results are sorted by sort_order (ascending), then by name.
   * 
   * Only loads locations where deleted_at is null (soft delete filter).
   */
  const load = async () => {
    setLoading(true)
    let query = supabase.from('locations').select('*').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    // Apply search filter if query exists
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    
    // Debug logging (can be removed in production)
    console.log('Load query result:', { data, error })
    console.log('Records found:', data?.length || 0)
    if (data) {
      console.log('Record names:', data.map(r => ({ id: r.id, name: r.name, deleted_at: r.deleted_at, created_by: r.created_by })))
    }
    
    if (error) alert(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  /**
   * Reload data when search query changes
   * 
   * Automatically refetches locations when user types in search box
   */
  useEffect(() => { load() }, [q])

  /**
   * Handle Escape key to close edit dialog
   * 
   * Provides keyboard accessibility - pressing Escape closes the edit dialog
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editing) {
        setEditing(null)
      }
    }

    if (editing) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editing])

  /**
   * Start creating a new location
   * 
   * Initializes the edit dialog with empty form fields.
   * Sets default values:
   * - status: 'draft'
   * - sort_order: 1000 (appears at end of list)
   * - created_by: current user ID
   */
  const startNew = async () => {
    const { data: session } = await supabase.auth.getSession()
    setEditing({
      id: '',
      name: '',
      slug: '',
      region: '',
      short_description: '',
      website_url: '',
      status: 'draft',
      sort_order: 1000,
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
  }

  /**
   * Save location (create or update)
   * 
   * Handles both insert (new) and update (existing) operations.
   * Auto-generates slug from name if slug is missing.
   * 
   * @param options - Optional configuration
   * @param options.suppressClose - If true, keeps dialog open after save (useful for navigation)
   */
  const save = async (options?: { suppressClose?: boolean }) => {
    if (!editing) return
    const payload = { ...editing }
  
    // Auto-generate slug if missing
    if (!payload.slug && payload.name) {
      payload.slug = slugify(payload.name)
    }
  
    if (payload.id) {
      // UPDATE existing location
      const { error } = await supabase.from('locations')
        .update({
          name: payload.name,
          slug: payload.slug,
          region: payload.region,
          short_description: payload.short_description,
          website_url: payload.website_url,
          status: payload.status,
          sort_order: payload.sort_order,
        })
        .eq('id', payload.id)
      if (error) { alert(error.message); return }
    } else {
      // INSERT new location
      // Remove fields that Postgres will generate
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('locations')
        .insert(insertable)
        .select()
        .single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }
  
    // Close dialog unless suppressClose is true
    if (!options?.suppressClose) setEditing(null)
    await load() // Reload to show changes
  }

  /**
   * Publish a single location
   * 
   * Changes status to 'published' (makes it visible to public)
   */
  const publishRow = async (id: string) => {
    const { error } = await supabase.from('locations').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  /**
   * Archive a single location
   * 
   * Changes status to 'archived' (hides from public but keeps in database)
   */
  const archiveRow = async (id: string) => {
    const { error } = await supabase.from('locations').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  /**
   * Soft delete a location
   * 
   * Sets deleted_at timestamp instead of actually deleting the record.
   * This allows recovery and maintains referential integrity.
   * The location will no longer appear in the list (filtered by deleted_at IS NULL).
   */
  const softDelete = async (id: string) => {
    if (!confirm('Delete this location? (soft delete)')) return
    
    console.log('Deleting location with ID:', id)
    
    const { data, error } = await supabase
      .from('locations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    
    console.log('Delete operation result:', { data, error })
    
    if (error) {
      alert(`Delete failed: ${error.message}`)
    } else {
      console.log('Delete successful, reloading data...')
      // Force a fresh reload to ensure the UI updates
      await load()
    }
  }

  /**
   * Bulk publish selected locations
   * 
   * Updates status to 'published' for all selected locations.
   * Clears selection after successful update.
   */
  const bulkPublish = async () => {
    if (!selectedIds.size) { alert('Select at least one location.'); return }
    const { error } = await supabase.from('locations').update({ status: 'published' }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
  }

  /**
   * Bulk archive selected locations
   * 
   * Updates status to 'archived' for all selected locations.
   * Clears selection after successful update.
   */
  const bulkArchive = async () => {
    if (!selectedIds.size) { alert('Select at least one location.'); return }
    const { error } = await supabase.from('locations').update({ status: 'archived' }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
  }

  /**
   * Bulk soft delete selected locations
   * 
   * Sets deleted_at timestamp for all selected locations.
   * Requires confirmation before proceeding.
   * Clears selection after successful deletion.
   */
  const bulkDelete = async () => {
    if (!selectedIds.size) { alert('Select at least one location.'); return }
    if (!confirm('Soft delete selected locations?')) return
    const { error } = await supabase.from('locations').update({ deleted_at: new Date().toISOString() }).in('id', Array.from(selectedIds))
    if (error) alert(error.message); else { await load(); setSelectedIds(new Set()) }
  }

  /**
   * Toggle selection of a single location
   * 
   * @param id - Location ID to toggle
   * @param checked - Whether location should be selected
   */
  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id); else next.delete(id)
      return next
    })
  }

  /**
   * Toggle selection of all visible locations
   * 
   * @param checked - Whether all locations should be selected
   */
  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedIds(prev => {
      if (!checked) return new Set()
      const next = new Set(prev)
      rows.forEach(r => next.add(r.id))
      return next
    })
  }

  return (
    <div style={{ 
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      {/* Two-row toolbar layout */}
      <div
        className="locations-toolbar"
        aria-label="Locations toolbar"
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
        {/* Top row: Module title and Action buttons */}
        <div
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
            }}>📍 Locations</h2>
            
            <button 
              className="btn" 
              onClick={startNew}
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
              title="Create new location"
            >
              <span style={{ 
                fontSize: '16px',
                filter: darkMode ? 'brightness(1.2) contrast(1.1)' : 'none',
                textShadow: darkMode ? '0 0 2px rgba(255,255,255,0.3)' : 'none'
              }}>✨</span>
              <span>New</span>
            </button>
          </div>
          
          <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn"
              onClick={exportCSV}
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
                cursor: 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px'
              }}
            >
              ⬇️
            </button>
            <button
              className="btn"
              onClick={() => importFileInputRef.current?.click()}
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
                cursor: 'pointer',
                fontSize: '16px',
                minWidth: '32px',
                height: '32px'
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
                disabled: loading
              },
              {
                id: 'template',
                label: 'Template',
                icon: '📋',
                onClick: downloadTemplate
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
          />
          </div>
          
          <input ref={importFileInputRef} type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
        </div>

        {/* Bottom row: Search controls */}
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
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>region</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>website_url</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>status</th>
                  <th style={{ padding: 6, borderBottom: '1px solid #eee' }}>sort_order</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.slice(0,50).map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.name}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.slug}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.region}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.website_url}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.status}</td>
                    <td style={{ padding: 6, borderTop: '1px solid #f3f4f6' }}>{r.sort_order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={confirmImport}>Confirm Import</button>{' '}
            <button className="btn" onClick={()=>{ setImporting(false); setImportPreview(null); setImportErrors([]) }}>Cancel</button>
          </div>
        </div>
      )}

      <div>
        <table>
          <thead style={{ position: 'sticky', top: toolbarHeight, zIndex: 110, background: darkMode ? '#374151' : '#f8f9fa' }}>
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
                onClick={() => handleSort('region')}
                style={{
                  textAlign: 'left',
                  padding: '8px 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Region {sortBy === 'region' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => handleSort('status')}
                style={{
                  padding: '8px 4px',
                  width: '1%',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                Status {sortBy === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ padding: '8px 4px', width: '1%' }}></th>
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
                
                // Handle string sorting
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                  return sortOrder === 'asc' 
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal)
                }
                
                // Handle numeric sorting (for status enum, treat as string)
                if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
                if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
                return 0
              })
              .map(r => (
              <tr 
                key={r.id}
                onClick={(e) => {
                  setEditing(r);
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
                <td style={{ background: 'transparent' }}>{r.region}</td>
                <td style={{ background: 'transparent', padding: '8px 24px 8px 4px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '500',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: r.status === 'published'
                      ? (darkMode ? '#10b981' : '#2e7d32')
                      : r.status === 'archived'
                        ? (darkMode ? '#f59e0b' : '#f57c00')
                        : (darkMode ? '#e5e7eb' : '#666')
                  }}>
                    {r.status === 'published' ? '✅' : r.status === 'archived' ? '📦' : '📝'}
                    {r.status === 'published' ? 'Published' : r.status === 'archived' ? 'Archived' : 'Draft'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', background: 'transparent', padding: '8px 4px' }}>
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
                          background: '#e8f5e8',
                          border: '1px solid #c8e6c9',
                          borderRadius: '4px',
                          color: '#2e7d32'
                        }}
                        title="Publish location"
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
                        title="Archive location"
                        darkMode={darkMode}
                      />
                    )}
                    <IconActionButton
                      icon={<img src={trashIcon} alt="delete" width={16} height={16} />}
                      onClick={(e) => {
                        e.stopPropagation()
                        softDelete(r.id)
                      }}
                      title="Delete location"
                      darkMode={darkMode}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5}>No records.</td></tr>
            )}
          </tbody>
        </table>
      </div>

        <AutoSaveEditDialog
          key="location-dialog"
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          title={editing?.id ? '✏️ Edit Location' : '➕ New Location'}
          maxWidth="600px"
          darkMode={darkMode}
          overlayLeftOffsetPx={sidebarCollapsed ? 60 : 220}
          editing={editing}
          rows={rows}
          saveFunction={save}
          setEditing={(item) => setEditing(item as Location | null)}
          itemType="location"
        >
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* Name and Slug */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <FormField
                label="Location Name"
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
                value={editing?.slug || ''}
                onChange={(value) => setEditing({...editing!, slug: value as string})}
                editingId={editing?.id}
                darkMode={darkMode}
              />
            </div>

            {/* Region and Website */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FormField
                label="Region"
                name="region"
                value={editing?.region || ''}
                onChange={(value) => setEditing({...editing!, region: value as string})}
                editingId={editing?.id}
                darkMode={darkMode}
              />
              <FormField
                label="Website URL"
                name="website_url"
                value={editing?.website_url || ''}
                onChange={(value) => setEditing({...editing!, website_url: value as string})}
                type="url"
                editingId={editing?.id}
                darkMode={darkMode}
              />
            </div>

            <FormField
              label="Short Description"
              name="short_description"
              value={editing?.short_description || ''}
              onChange={(value) => setEditing({...editing!, short_description: value as string})}
              type="textarea"
              editingId={editing?.id}
              darkMode={darkMode}
            />

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
