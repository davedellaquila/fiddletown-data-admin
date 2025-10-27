import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useDarkModeRowReset } from '../shared/hooks/useDarkModeRowReset'
import { useNavigationWithAutoSave } from '../shared/hooks/useNavigationWithAutoSave'
import { NavigationButtons } from '../shared/components/NavigationButtons'
import { STICKY_HEADER_TOP_OFFSETS } from '../shared/constants/layout'

type Difficulty = 'easy' | 'moderate' | 'challenging'
type Status = 'draft' | 'published' | 'archived'

type RouteRow = {
  id: string
  name: string
  slug: string | null
  gpx_url: string | null
  duration_minutes: number | null
  start_point: string | null
  end_point: string | null
  difficulty: Difficulty | null
  notes: string | null
  status: Status
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// --- CSV helpers (CSV/TSV, quoted fields supported) ---
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

interface RoutesProps {
  darkMode?: boolean
}

export default function Routes({ darkMode = false }: RoutesProps) {
  const [rows, setRows] = useState<RouteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<RouteRow | null>(null)
  const [q, setQ] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'info', msg: string } | null>(null)

  // Import/Export state
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])

  // Handle escape key and click outside to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editing) {
        setEditing(null)
      }
    }

    if (editing) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editing])

  // Reset table row styling when dark mode changes to prevent artifacts
  useDarkModeRowReset(darkMode)

  // Use shared navigation hook with auto-save functionality
  const { navigateToNext, navigateToPrevious } = useNavigationWithAutoSave(
    editing,
    rows,
    save,
    setEditing
  )

  function pushToast(msg: string, type: 'ok' | 'err' | 'info' = 'info') {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 2500)
  }

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

  // Export/Import handlers
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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const grid = parseCSV(text)
    if (grid.length < 2) { alert('CSV/TSV must include a header and at least one row'); return }

    // Map headers (allow some aliases)
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

  async function uploadGpx(file: File): Promise<string | null> {
    // ensure user is signed in (uploads are blocked for anon by RLS)
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) { pushToast('Please sign in again to upload.', 'err'); return null }

    const base = (editing?.slug || slugify(editing?.name || 'route')) || crypto.randomUUID()
    const path = `${base}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`

    const { error } = await supabase.storage.from('routes').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/gpx+xml'
    })
    if (error) { pushToast(`Upload failed: ${error.message}`, 'err'); return null }

    const { data } = supabase.storage.from('routes').getPublicUrl(path)
    return data.publicUrl
  }

  const save = async () => {
    if (!editing) return
    setBusy(true)
    try {
      const payload = { ...editing }

      if (!payload.name) { pushToast('Name is required', 'err'); return }
      if (!payload.slug) payload.slug = slugify(payload.name)

      // If a file is selected, upload first and set gpx_url
      const file = fileRef.current?.files?.[0]
      if (file) {
        pushToast('Uploading GPX…', 'info')
        const url = await uploadGpx(file)
        if (!url) return
        payload.gpx_url = url
        pushToast('GPX uploaded', 'ok')
      }

      if (payload.id) {
        // UPDATE – send only editable columns
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
        // INSERT – strip id/timestamps so Postgres generates them
        const { id, created_at, updated_at, deleted_at, ...insertable } = payload
        const { data, error } = await supabase.from('routes').insert(insertable).select().single()
        if (error) { pushToast(error.message, 'err'); return }
        payload.id = data!.id
      }

      setEditing(null)
      fileRef.current && (fileRef.current.value = '')
      await load()
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
      <h2 style={{ 
        color: darkMode ? '#f9fafb' : '#1f2937',
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '600'
      }}>🗺️ Routes</h2>

      <div style={{ 
        marginBottom: 12,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: darkMode ? '#1f2937' : '#f8f9fa',
        padding: '12px',
        borderBottom: `1px solid ${darkMode ? '#374151' : '#dee2e6'}`,
        borderRadius: '4px',
        border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`
      }}>
        {/* Action Buttons Row */}
        <div className="stack" style={{ 
          flexWrap: 'wrap',
          marginBottom: '12px'
        }}>
          <button 
            className="btn" 
            onClick={startNew} 
            disabled={busy || importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Create new route"
          >
            <span>➕</span>
            <span>New</span>
          </button>
          
          <button 
            className="btn" 
            onClick={load} 
            disabled={loading || busy || importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Refresh routes list"
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
          
          <button 
            className="btn" 
            onClick={downloadTemplateCSV} 
            disabled={busy || importing}
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
            disabled={busy || importing}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Export all routes to CSV"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
          
          <label 
            className="btn" 
            style={{ 
              display: 'inline-flex', 
              cursor: 'pointer', 
              opacity: importing ? 0.6 : 1,
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Import routes from CSV/TSV file"
          >
            <span>📥</span>
            <span>Import</span>
            <input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={handleImportFile} style={{ display: 'none' }} disabled={busy || importing} />
          </label>
        </div>

        {/* Search Controls Row */}
        <div className="stack" style={{ 
          flexWrap: 'wrap',
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

      {!editing ? (
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          position: 'relative'
        }}>
          <thead style={{
            position: 'sticky',
            top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
            zIndex: 110,
            background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)'
          }}>
            <tr>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}>Name</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}>Duration</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}>Difficulty</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}>GPX</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}>Status</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.ROUTES,
                zIndex: 110
              }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
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
                <td>{r.name}</td>
                <td>{r.duration_minutes ? `${r.duration_minutes} min` : '—'}</td>
                <td>{r.difficulty ?? '—'}</td>
                <td>
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
                <td>
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
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn" 
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
                        background: '#f8f9fa',
                        border: '1px solid #dee2e6',
                        borderRadius: '4px'
                      }}
                      title="Edit route"
                    >
                      <span>✏️</span>
                      Edit
                    </button>
                    {r.status !== 'published' && (
                      <button 
                        className="btn" 
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
                        title="Publish route"
                      >
                        <span>🚀</span>
                        Publish
                      </button>
                    )}
                    {r.status !== 'archived' && (
                      <button 
                        className="btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          archiveRow(r.id)
                        }}
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: '#fff3e0',
                          border: '1px solid #ffcc02',
                          borderRadius: '4px',
                          color: '#f57c00'
                        }}
                        title="Archive route"
                      >
                        <span>📦</span>
                        Archive
                      </button>
                    )}
                    <button 
                      className="btn" 
                      onClick={(e) => {
                        e.stopPropagation()
                        softDelete(r.id)
                      }}
                      style={{ 
                        padding: '6px 10px', 
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#ffebee',
                        border: '1px solid #ffcdd2',
                        borderRadius: '4px',
                        color: '#c62828'
                      }}
                      title="Delete route"
                    >
                      <span>🗑️</span>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6}>No records.</td></tr>
            )}
          </tbody>
        </table>
      ) : (
        <div 
          onClick={async () => await save()}
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
              background: darkMode ? '#1f2937' : 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              maxWidth: '700px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              {/* Title - Left aligned */}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: darkMode ? '#f9fafb' : '#1f2937' }}>
                  {editing.id ? '✏️ Edit Route' : '➕ New Route'}
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
                  itemType="route"
                />
              </div>

              {/* Close button - Right aligned */}
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={()=>{ if (!busy) { setEditing(null); fileRef.current && (fileRef.current.value='') }}}
                  disabled={busy}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    color: busy ? '#9ca3af' : '#6b7280',
                    padding: '4px'
                  }}
                  title="Close dialog"
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Route Name *
                  </label>
                  <input 
                    value={editing.name} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, name: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                    placeholder="Enter route name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Slug
                  </label>
                  <input 
                    value={editing.slug ?? ''} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, slug: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                    placeholder="route-slug"
                  />
                </div>
              </div>

              {/* Duration and Difficulty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Duration (minutes)
                  </label>
                  <input 
                    type="number" 
                    value={editing.duration_minutes ?? 120} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, duration_minutes: Number(e.target.value)})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                    placeholder="120"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Difficulty
                  </label>
                  <select 
                    value={editing.difficulty ?? 'moderate'} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, difficulty: e.target.value as Difficulty})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                  >
                    <option value="easy">🟢 Easy</option>
                    <option value="moderate">🟡 Moderate</option>
                    <option value="challenging">🔴 Challenging</option>
                  </select>
                </div>
              </div>

              {/* Start and End Points */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    Start Point
                  </label>
                  <input 
                    value={editing.start_point ?? ''} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, start_point: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                    placeholder="Starting location"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                    End Point
                  </label>
                  <input 
                    value={editing.end_point ?? ''} 
                    className={darkMode ? 'form-field-white-text' : ''} 
                    onChange={e=>setEditing({...editing, end_point: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      color: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitTextFillColor: darkMode ? '#ffffff !important' : '#000000 !important',
                      WebkitOpacity: 1,
                      caretColor: darkMode ? '#ffffff !important' : '#000000 !important'
                    }}
                    placeholder="Ending location"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: darkMode ? '#f9fafb' : '#374151' }}>
                  Notes
                </label>
                <textarea 
                  value={editing.notes ?? ''} 
                  className={darkMode ? 'form-field-white-text' : ''} 
                  onChange={e=>setEditing({...editing, notes: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`, 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: darkMode ? '#e0e0e0' : '#000000',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Route description and notes"
                />
              </div>

              {/* GPX File Upload */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
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
                    background: darkMode ? '#374151' : '#ffffff'
                  }}
                />
                {editing.gpx_url && (
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
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Status
                  </label>
                  <select 
                    value={editing.status} 
                    onChange={e=>setEditing({...editing, status: e.target.value as Status})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      background: darkMode ? '#374151' : '#ffffff'
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
                    value={editing.sort_order ?? 1000} 
                    onChange={e=>setEditing({...editing, sort_order: Number(e.target.value)})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      background: darkMode ? '#374151' : '#ffffff',
                      background: darkMode ? '#374151' : '#ffffff'
                    }}
                    placeholder="1000"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}