import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { STICKY_HEADER_TOP_OFFSETS } from '../shared/constants/layout'

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

  // Debug: Log when editing state changes
  useEffect(() => {
    console.log('📊 Locations - Editing state changed:', editing);
    console.log('📊 Locations - Editing state type:', typeof editing);
    console.log('📊 Locations - Editing state keys:', editing ? Object.keys(editing) : 'null');
    
    if (editing) {
      console.log('📊 Locations - Form field values:');
      console.log('📊 Locations - Name:', editing.name, 'Type:', typeof editing.name);
      console.log('📊 Locations - Slug:', editing.slug, 'Type:', typeof editing.slug);
      console.log('📊 Locations - Region:', editing.region, 'Type:', typeof editing.region);
      console.log('📊 Locations - Status:', editing.status, 'Type:', typeof editing.status);
      
      // Force field population with multiple attempts
      const populateFields = () => {
        console.log('🔧 Locations - Looking for fields with ID:', editing.id);
        const nameField = document.querySelector(`input[data-key="name-${editing.id}"]`) as HTMLInputElement;
        const slugField = document.querySelector(`input[data-key="slug-${editing.id}"]`) as HTMLInputElement;
        const regionField = document.querySelector(`input[data-key="region-${editing.id}"]`) as HTMLInputElement;
        const websiteField = document.querySelector(`input[data-key="website-${editing.id}"]`) as HTMLInputElement;
        
        console.log('🔧 Locations - Found nameField:', nameField);
        console.log('🔧 Locations - Found slugField:', slugField);
        console.log('🔧 Locations - Found regionField:', regionField);
        console.log('🔧 Locations - Found websiteField:', websiteField);
        
        if (nameField) {
          console.log('🔧 Locations - Manually setting name field value:', editing.name);
          nameField.value = editing.name || '';
          nameField.setAttribute('value', editing.name || '');
          // Trigger change event
          nameField.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('🔧 Locations - Name field value after setting:', nameField.value);
        } else {
          console.log('🔧 Locations - Name field not found!');
        }
        if (slugField) {
          console.log('🔧 Locations - Manually setting slug field value:', editing.slug);
          slugField.value = editing.slug || '';
          slugField.setAttribute('value', editing.slug || '');
          slugField.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('🔧 Locations - Slug field value after setting:', slugField.value);
        } else {
          console.log('🔧 Locations - Slug field not found!');
        }
        if (regionField) {
          console.log('🔧 Locations - Manually setting region field value:', editing.region);
          regionField.value = editing.region || '';
          regionField.setAttribute('value', editing.region || '');
          regionField.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('🔧 Locations - Region field value after setting:', regionField.value);
        } else {
          console.log('🔧 Locations - Region field not found!');
        }
        if (websiteField) {
          console.log('🔧 Locations - Manually setting website field value:', editing.website_url);
          websiteField.value = editing.website_url || '';
          websiteField.setAttribute('value', editing.website_url || '');
          websiteField.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('🔧 Locations - Website field value after setting:', websiteField.value);
        } else {
          console.log('🔧 Locations - Website field not found!');
        }
      };
      
      // Try multiple times with different delays
      setTimeout(populateFields, 10);
      setTimeout(populateFields, 50);
      setTimeout(populateFields, 100);
      setTimeout(populateFields, 200);
    } else {
      console.log('📊 Locations - Editing state is now NULL - something reset it!');
      console.trace('📊 Locations - Call stack when editing became null:');
    }
  }, [editing]);

  // Handle escape key and click outside to cancel editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editing) {
        console.log('⌨️ Locations - Escape key pressed, setting editing to null');
        setEditing(null)
      }
    }

    if (editing) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editing])

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
    console.log('💾 Locations - Save function called');
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
  
    console.log('💾 Locations - About to call setEditing(null) in save function');
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
      <h2 style={{ 
        color: darkMode ? '#f9fafb' : '#1f2937',
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '600'
      }}>📍 Locations</h2>

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
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '8px 12px'
            }}
            title="Create new location"
          >
            <span>➕</span>
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
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          position: 'relative'
        }}>
          <thead style={{
            position: 'sticky',
            top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
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
                top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
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
                top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
                zIndex: 110
              }}>Region</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
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
                top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
                zIndex: 110
              }}>Website</th>
              <th style={{
                padding: '12px 8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                color: darkMode ? '#f9fafb' : '#1f2937',
                background: darkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(249, 250, 251, 0.95)',
                position: 'sticky',
                top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS,
                zIndex: 110
              }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr 
                key={r.id}
                onClick={(e) => {
                e.stopPropagation(); // Prevent click from bubbling to dialog overlay
                console.log('🔍 Locations - Row clicked - Browser:', navigator.userAgent);
                console.log('🔍 Locations - Row data:', r);
                console.log('🔍 Locations - Current editing state before:', editing);
                console.log('🔍 Locations - About to call setEditing with:', r);
                setEditing(r);
                console.log('🔍 Locations - setEditing called, editing should now be:', r);
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
                <td>{r.name}</td>
                <td>{r.region}</td>
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
                <td>
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
                      title="Edit location"
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
      ) : (
        <div 
          onClick={(e) => {
            console.log('🚨 Locations - Dialog overlay clicked!', e.target);
            console.log('🚨 Locations - Event target:', e.target);
            console.log('🚨 Locations - Current target:', e.currentTarget);
            console.log('🚨 Locations - Event type:', e.type);
            setEditing(null);
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
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'white', 
              padding: '32px', 
              borderRadius: '12px', 
              maxWidth: '600px', 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
                {editing.id ? '✏️ Edit Location' : '➕ New Location'}
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
              {/* Debug Info */}
              <div style={{ 
                background: '#f3f4f6', 
                padding: '12px', 
                borderRadius: '8px', 
                fontSize: '12px',
                border: '1px solid #e5e7eb'
              }}>
                <strong>🐛 Locations Debug Info:</strong><br/>
                <strong>Browser:</strong> {navigator.userAgent.includes('Chrome') ? 'Chrome-based' : 'Safari'}<br/>
                <strong>Editing State:</strong> {editing ? 'Set' : 'Null'}<br/>
                <strong>Name Value:</strong> "{editing?.name || 'undefined'}" (Type: {typeof editing?.name})<br/>
                <strong>ID Value:</strong> "{editing?.id || 'undefined'}"<br/>
                <strong>Region Value:</strong> "{editing?.region || 'undefined'}"<br/>
                <strong>Slug Value:</strong> "{editing?.slug || 'undefined'}"<br/>
                <strong>Status Value:</strong> "{editing?.status || 'undefined'}"<br/>
                <strong>Raw Name:</strong> {JSON.stringify(editing?.name)}<br/>
                <strong>Form Field Values (what inputs should show):</strong><br/>
                &nbsp;&nbsp;Name: "{editing?.name ?? ''}"<br/>
                &nbsp;&nbsp;Slug: "{editing?.slug ?? ''}"<br/>
                &nbsp;&nbsp;Region: "{editing?.region ?? ''}"<br/>
                &nbsp;&nbsp;Status: "{editing?.status ?? 'draft'}"<br/>
                <strong>All Keys:</strong> {editing ? Object.keys(editing).join(', ') : 'null'}
              </div>
              
              {/* Name and Slug */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Location Name *
                  </label>
                  <input 
                    key={`name-${editing?.id || 'new'}-${Date.now()}`}
                    data-key={`name-${editing?.id || 'new'}`}
                    value={editing?.name ?? ''}
                    onChange={e=>{
                      console.log('🔧 Locations - Name field changed:', e.target.value);
                      console.log('🔧 Locations - Current editing state:', editing);
                      setEditing({...editing, name: e.target.value});
                    }}
                    onFocus={() => {
                      console.log('🔧 Locations - Name field focused, current value:', editing?.name);
                      console.log('🔧 Locations - Name field value prop:', editing?.name ?? '');
                    }} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Enter location name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Slug
                  </label>
                  <input 
                    key={`slug-${editing?.id || 'new'}-${Date.now()}`}
                    data-key={`slug-${editing?.id || 'new'}`}
                    value={editing?.slug ?? ''} 
                    onChange={e=>setEditing({...editing, slug: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="location-slug"
                  />
                </div>
              </div>

              {/* Region and Website */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Region
                  </label>
                  <input 
                    key={`region-${editing?.id || 'new'}-${Date.now()}`}
                    data-key={`region-${editing?.id || 'new'}`}
                    value={editing?.region ?? ''} 
                    onChange={e=>setEditing({...editing, region: e.target.value})} 
                    style={{ 
                      width: '100%', 
                      padding: '12px', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#fff'
                    }}
                    placeholder="Region name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Website URL
                  </label>
                  <input 
                    key={`website-${editing?.id || 'new'}-${Date.now()}`}
                    data-key={`website-${editing?.id || 'new'}`}
                    value={editing?.website_url ?? ''} 
                    onChange={e=>setEditing({...editing, website_url: e.target.value})} 
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
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                  Short Description
                </label>
                <textarea 
                  key={`description-${editing?.id || 'new'}`}
                  value={editing?.short_description ?? ''} 
                  onChange={e=>setEditing({...editing, short_description: e.target.value})} 
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    border: '1px solid #d1d5db', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    background: '#fff',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Brief description of the location"
                />
              </div>

              {/* Status and Sort Order */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Status
                  </label>
                  <select 
                    key={`status-${editing?.id || 'new'}`}
                    value={editing?.status ?? 'draft'} 
                    onChange={e=>setEditing({...editing, status: e.target.value as any})} 
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
                    key={`sort_order-${editing?.id || 'new'}`}
                    type="number" 
                    value={editing?.sort_order ?? 1000} 
                    onChange={e=>setEditing({...editing, sort_order: Number(e.target.value)})} 
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
                💾 Save Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
