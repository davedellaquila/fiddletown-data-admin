import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

type Location = {
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

interface LocationsProps {
  darkMode?: boolean
}

export default function Locations({ darkMode = false }: LocationsProps) {
  const [rows, setRows] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Location | null>(null)
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
    let query = supabase.from('locations').select('name,slug,region,short_description,website_url,status,sort_order').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    if (error) { alert(error.message); return }
    const headers = ['name','slug','region','short_description','website_url','status','sort_order']
    const csv = toCSV(data || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'locations-export.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

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
      .from('locations')
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
    let query = supabase.from('locations').select('*').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (q.trim()) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query
    
    console.log('Load query result:', { data, error })
    console.log('Records found:', data?.length || 0)
    if (data) {
      console.log('Record names:', data.map(r => ({ id: r.id, name: r.name, deleted_at: r.deleted_at, created_by: r.created_by })))
    }
    
    if (error) alert(error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q])

  // Handle Escape key to close edit dialog
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
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('locations')
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
    const { error } = await supabase.from('locations').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

  const archiveRow = async (id: string) => {
    const { error } = await supabase.from('locations').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else load()
  }

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
          
          <button 
            className="btn" 
            onClick={load} 
            disabled={loading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Refresh locations list"
          >
            <span>{loading ? '⏳' : '🔄'}</span>
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
          
          <button 
            className="btn" 
            onClick={exportCSV}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Export all locations to CSV"
          >
            <span>📤</span>
            <span>Export</span>
          </button>
          
          <button 
            className="btn" 
            onClick={downloadTemplate}
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
          
          <label 
            className="btn" 
            style={{ 
              display: 'inline-flex', 
              cursor: 'pointer',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Import locations from CSV file"
          >
            <span>📥</span>
            <span>Import</span>
            <input type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
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

      {!editing ? (
        <div>
          <table>
          <thead>
            <tr>
              <th>Website</th>
              <th>Name</th>
              <th>Region</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
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
                <td style={{ background: 'transparent' }}>
                  {r.website_url ? (
                    <a 
                      href={r.website_url} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: 4,
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        textDecoration: 'none',
                        color: darkMode ? '#3b82f6' : '#1976d2',
                        fontSize: 16,
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(25, 118, 210, 0.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                      title="Open URL in new tab"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>🔗</span>
                    </a>
                  ) : (
                    <span style={{ color: '#bbb', fontSize: '12px' }}>—</span>
                  )}
                </td>
                <td style={{ background: 'transparent' }}>{r.name}</td>
                <td style={{ background: 'transparent' }}>{r.region}</td>
                <td style={{ background: 'transparent' }}>
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
                <td style={{ textAlign: 'right', background: 'transparent' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
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
                        title="Publish location"
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
                        title="Archive location"
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
                      title="Delete location"
                    >
                      <span>🗑️</span>
                      Delete
                    </button>
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
      ) : (
        <AutoSaveEditDialog
          key="location-dialog"
          isOpen={editing !== null}
          onClose={() => setEditing(null)}
          title={editing?.id ? '✏️ Edit Location' : '➕ New Location'}
          maxWidth="600px"
          darkMode={darkMode}
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
      )}
    </div>
  )
}
