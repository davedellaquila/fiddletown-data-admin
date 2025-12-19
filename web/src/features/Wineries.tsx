/**
 * Wineries Feature Component
 * 
 * NOTE: This appears to be a legacy/duplicate component.
 * The Locations component provides the same functionality with more features.
 * Consider using Locations.tsx instead, or remove this if it's no longer needed.
 * 
 * Admin interface for managing winery data.
 * Provides basic CRUD operations for winery locations.
 * 
 * Features:
 * - CRUD operations (Create, Read, Update, Delete)
 * - CSV import/export
 * - Search and filtering
 * - Soft delete support
 * 
 * @deprecated Consider using Locations.tsx instead
 * @module Wineries
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Convert string to URL-friendly slug
 * 
 * Simple slugify implementation (consider using shared slugify utility instead)
 */
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/**
 * Winery data model
 * 
 * Matches the Location model structure.
 * Consider using the shared Location type instead.
 */
type Winery = {
  id: string
  name: string
  slug: string | null
  region: string | null
  short_description: string | null
  website_url: string | null
  status: 'draft' | 'published' | 'archived'
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

/**
 * Wineries component
 * 
 * Legacy component for managing winery data.
 * Consider migrating to Locations.tsx for better feature parity.
 */
export default function Wineries() {
  const [rows, setRows] = useState<Winery[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Winery | null>(null)
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any[] | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const fileInputRef = useState<HTMLInputElement | null>(null)[0]

  // Tiny CSV parser supporting quotes and commas
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

  const exportCSV = async () => {
    // fetch fresh rows (respect current filter)
    let query = supabase.from('wineries').select('name,slug,region,short_description,website_url,status,sort_order').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) { alert(error.message); return }
    const headers = ['name','slug','region','short_description','website_url','status','sort_order']
    const csv = toCSV(data || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'wineries-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const grid = parseCSV(text)
    if (grid.length < 2) {
      alert('CSV must have header + at least one data row')
      return
    }
    const headers = grid[0].map(h => h.trim().toLowerCase())
    const rows = grid.slice(1).map((cols, i) => {
      const obj: Record<string, any> = {}
      headers.forEach((h, idx) => obj[h] = (cols[idx] ?? '').trim())
      return obj
    })
  
    const preview = rows.map((r, idx) => {
      const name = r.name || ''
      const slug = r.slug || (name ? slugify(name) : '')
      const region = r.region || null
      const short_description = r.short_description || null
      const website_url = r.website_url || null
      let status = (r.status || '').toLowerCase()
      if (!['draft','published','archived'].includes(status)) status = 'draft'
      const sort_order = r.sort_order ? parseInt(r.sort_order, 10) : null
  
      return { name, slug, region, short_description, website_url, status, sort_order }
    })
  
    // Basic validation
    const errors: string[] = []
    preview.forEach((r, i) => {
      if (!r.name) errors.push(`Row ${i+2}: missing name`)
      if (!r.slug) errors.push(`Row ${i+2}: cannot derive slug`)
    })
  
    setImportPreview(preview)
    setImportErrors(errors)
    setImporting(true)
    e.target.value = ''  // clear the file input
  }  

  async function confirmImport() {
    if (!importPreview) return
    if (importErrors.length > 0) {
      alert('Fix errors before import')
      return
    }
    const { data: session } = await supabase.auth.getSession()
    const uid = session.session?.user.id || null
  
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
  
    const { error } = await supabase
      .from('wineries')
      .upsert(payload, { onConflict: 'slug' })
  
    if (error) {
      setImportErrors([error.message])
      return
    }
    setImportPreview(null)
    setImportErrors([])
    setImporting(false)
    await load()
    alert('Import successful')
  }

  const load = async () => {
    setLoading(true)
    let query = supabase.from('wineries').select('*').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) alert(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q])

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

  const save = async () => {
    if (!editing) return
    const payload = { ...editing }
  
    if (!payload.slug && payload.name) {
      payload.slug = payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    }
  
    if (payload.id) {
      const { error } = await supabase.from('wineries')
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
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('wineries')
        .insert(insertable)
        .select()
        .single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }
  
    setEditing(null)
    await load()
  }

  const publishRow = async (id: string) => {
    const { error } = await supabase.from('wineries').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  const archiveRow = async (id: string) => {
    const { error } = await supabase.from('wineries').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  const softDelete = async (id: string) => {
    if (!confirm('Delete this winery? (soft delete)')) return
    const { error } = await supabase.from('wineries').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  return (
    <div>
      <h2>Wineries</h2>

      <div className="stack" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Search name…" value={q} onChange={(e)=>setQ(e.target.value)} style={{ flex: 1, minWidth: 220, padding: 8 }} />
        <button className="btn" onClick={startNew}>New</button>
        <button className="btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
        <button className="btn" onClick={exportCSV}>Export CSV</button>
        <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
          Import CSV
          <input type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
        </label>
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

      {!editing ? (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Region</th>
              <th>Status</th>
              <th>Website</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.region}</td>
                <td>{r.status}</td>
                <td>{r.website_url ? <a href={r.website_url} target="_blank">link</a> : '—'}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn" onClick={() => setEditing(r)}>Edit</button>{' '}
                  {r.status !== 'published' && <button className="btn" onClick={() => publishRow(r.id)}>Publish</button>}{' '}
                  {r.status !== 'archived' && <button className="btn" onClick={() => archiveRow(r.id)}>Archive</button>}{' '}
                  <button className="btn" onClick={() => softDelete(r.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5}>No records.</td></tr>
            )}
          </tbody>
        </table>
      ) : (
        <div style={{ maxWidth: 720 }}>
          <h3>{editing.id ? 'Edit Winery' : 'New Winery'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>Name <input value={editing.name} onChange={e=>setEditing({...editing, name:e.target.value})} /></label>
            <label>Slug <input value={editing.slug ?? ''} onChange={e=>setEditing({...editing, slug:e.target.value})} /></label>
            <label>Region <input value={editing.region ?? ''} onChange={e=>setEditing({...editing, region:e.target.value})} /></label>
            <label>Website <input value={editing.website_url ?? ''} onChange={e=>setEditing({...editing, website_url:e.target.value})} /></label>
            <label>Sort Order <input type="number" value={editing.sort_order ?? 1000} onChange={e=>setEditing({...editing, sort_order:Number(e.target.value)})} /></label>
            <label>Status
              <select value={editing.status} onChange={e=>setEditing({...editing, status: e.target.value as any})}>
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>
          </div>
          <label>Short Description
            <textarea value={editing.short_description ?? ''} onChange={e=>setEditing({...editing, short_description:e.target.value})} />
          </label>
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={save}>Save</button>{' '}
            <button className="btn" onClick={()=>setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
