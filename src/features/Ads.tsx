import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import FormField from '../shared/components/FormField'
import AutoSaveEditDialog from '../shared/components/AutoSaveEditDialog'
import ActionMenu, { ActionMenuItem } from '../shared/components/ActionMenu'

type AdVendor = {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  status: 'draft' | 'published' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type Ad = {
  id: string
  vendor_id: string
  name: string
  image_url: string
  target_url: string
  mobile_image_url: string | null
  position: 'header' | 'body'
  priority: number
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'published' | 'archived'
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  vendor?: AdVendor
}

type AdImpression = {
  id: string
  ad_id: string
  impressed_at: string
  user_agent: string | null
  ip_address: string | null
  device_type: string | null
}

type AdClick = {
  id: string
  ad_id: string
  clicked_at: string
  user_agent: string | null
  ip_address: string | null
  device_type: string | null
}

interface AdsProps {
  darkMode?: boolean
  sidebarCollapsed?: boolean
}

type Tab = 'vendors' | 'ads' | 'tracking'

export default function Ads({ darkMode = false, sidebarCollapsed = false }: AdsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('vendors')
  
  // Vendor state
  const [vendors, setVendors] = useState<AdVendor[]>([])
  const [vendorLoading, setVendorLoading] = useState(false)
  const [editingVendor, setEditingVendor] = useState<AdVendor | null>(null)
  const [vendorQ, setVendorQ] = useState('')
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set())
  
  // Ad state
  const [ads, setAds] = useState<Ad[]>([])
  const [adLoading, setAdLoading] = useState(false)
  const [editingAd, setEditingAd] = useState<Ad | null>(null)
  const [adQ, setAdQ] = useState('')
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set())
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all')
  
  // Tracking state
  const [trackingData, setTrackingData] = useState<{
    impressions: AdImpression[]
    clicks: AdClick[]
    ads: Ad[]
  }>({ impressions: [], clicks: [], ads: [] })
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingDateRange, setTrackingDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

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

  // Load vendors
  const loadVendors = async () => {
    setVendorLoading(true)
    let query = supabase.from('ad_vendors').select('*').is('deleted_at', null).order('name')
    if (vendorQ.trim()) query = query.ilike('name', `%${vendorQ}%`)
    const { data, error } = await query
    if (error) alert(error.message)
    setVendors(data ?? [])
    setVendorLoading(false)
  }

  useEffect(() => { if (activeTab === 'vendors') loadVendors() }, [vendorQ, activeTab])

  // Load ads
  const loadAds = async () => {
    setAdLoading(true)
    let query = supabase.from('ads').select('*, vendor:ad_vendors(*)').is('deleted_at', null).order('sort_order', { ascending: true }).order('name')
    if (adQ.trim()) query = query.ilike('name', `%${adQ}%`)
    if (selectedVendorFilter !== 'all') query = query.eq('vendor_id', selectedVendorFilter)
    const { data, error } = await query
    if (error) alert(error.message)
    setAds(data ?? [])
    setAdLoading(false)
  }

  useEffect(() => { if (activeTab === 'ads') loadAds() }, [adQ, selectedVendorFilter, activeTab])

  // Load tracking data
  const loadTracking = async () => {
    setTrackingLoading(true)
    const { data: adsData } = await supabase.from('ads').select('*, vendor:ad_vendors(*)').is('deleted_at', null)
    
    const { data: impressionsData } = await supabase
      .from('ad_impressions')
      .select('*')
      .gte('impressed_at', trackingDateRange.start)
      .lte('impressed_at', trackingDateRange.end + 'T23:59:59')
      .order('impressed_at', { ascending: false })
    
    const { data: clicksData } = await supabase
      .from('ad_clicks')
      .select('*')
      .gte('clicked_at', trackingDateRange.start)
      .lte('clicked_at', trackingDateRange.end + 'T23:59:59')
      .order('clicked_at', { ascending: false })
    
    setTrackingData({
      ads: adsData ?? [],
      impressions: impressionsData ?? [],
      clicks: clicksData ?? []
    })
    setTrackingLoading(false)
  }

  useEffect(() => { if (activeTab === 'tracking') loadTracking() }, [trackingDateRange, activeTab])

  // Vendor CRUD
  const startNewVendor = async () => {
    const { data: session } = await supabase.auth.getSession()
    setEditingVendor({
      id: '',
      name: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
      status: 'draft',
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
  }

  const saveVendor = async (options?: { suppressClose?: boolean }) => {
    if (!editingVendor) return
    const payload = { ...editingVendor }
    
    if (payload.id) {
      const { error } = await supabase.from('ad_vendors')
        .update({
          name: payload.name,
          contact_email: payload.contact_email || null,
          contact_phone: payload.contact_phone || null,
          notes: payload.notes || null,
          status: payload.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.id)
      if (error) { alert(error.message); return }
    } else {
      const { id, created_at, updated_at, deleted_at, ...insertable } = payload
      const { data, error } = await supabase.from('ad_vendors')
        .insert(insertable)
        .select()
        .single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }
    
    if (!options?.suppressClose) setEditingVendor(null)
    await loadVendors()
  }

  const publishVendor = async (id: string) => {
    const { error } = await supabase.from('ad_vendors').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else loadVendors()
  }

  const archiveVendor = async (id: string) => {
    const { error } = await supabase.from('ad_vendors').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else loadVendors()
  }

  const softDeleteVendor = async (id: string) => {
    if (!confirm('Delete this vendor? (soft delete)')) return
    const { error } = await supabase.from('ad_vendors')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) alert(error.message); else loadVendors()
  }

  // Ad CRUD
  const startNewAd = async () => {
    const { data: session } = await supabase.auth.getSession()
    setEditingAd({
      id: '',
      vendor_id: selectedVendorFilter !== 'all' ? selectedVendorFilter : '',
      name: '',
      image_url: '',
      target_url: '',
      mobile_image_url: '',
      position: 'header',
      priority: 100,
      start_date: null,
      end_date: null,
      status: 'draft',
      sort_order: 1000,
      created_by: session.session?.user.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    })
  }

  const saveAd = async (options?: { suppressClose?: boolean }) => {
    if (!editingAd) return
    const payload = { ...editingAd }
    
    if (payload.id) {
      const { error } = await supabase.from('ads')
        .update({
          vendor_id: payload.vendor_id,
          name: payload.name,
          image_url: payload.image_url,
          target_url: payload.target_url,
          mobile_image_url: payload.mobile_image_url || null,
          position: payload.position,
          priority: payload.priority,
          start_date: payload.start_date || null,
          end_date: payload.end_date || null,
          status: payload.status,
          sort_order: payload.sort_order,
          updated_at: new Date().toISOString()
        })
        .eq('id', payload.id)
      if (error) { alert(error.message); return }
    } else {
      const { id, created_at, updated_at, deleted_at, vendor, ...insertable } = payload
      const { data, error } = await supabase.from('ads')
        .insert(insertable)
        .select()
        .single()
      if (error) { alert(error.message); return }
      payload.id = data!.id
    }
    
    if (!options?.suppressClose) setEditingAd(null)
    await loadAds()
  }

  const publishAd = async (id: string) => {
    const { error } = await supabase.from('ads').update({ status: 'published' }).eq('id', id)
    if (error) alert(error.message); else loadAds()
  }

  const archiveAd = async (id: string) => {
    const { error } = await supabase.from('ads').update({ status: 'archived' }).eq('id', id)
    if (error) alert(error.message); else loadAds()
  }

  const softDeleteAd = async (id: string) => {
    if (!confirm('Delete this ad? (soft delete)')) return
    const { error } = await supabase.from('ads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) alert(error.message); else loadAds()
  }

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (editingVendor || editingAd)) {
        setEditingVendor(null)
        setEditingAd(null)
      }
    }
    if (editingVendor || editingAd) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingVendor, editingAd])

  // Tracking calculations
  const getAdStats = (adId: string) => {
    const impressions = trackingData.impressions.filter(i => i.ad_id === adId).length
    const clicks = trackingData.clicks.filter(c => c.ad_id === adId).length
    const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00'
    return { impressions, clicks, ctr }
  }

  const totalStats = {
    impressions: trackingData.impressions.length,
    clicks: trackingData.clicks.length,
    ctr: trackingData.impressions.length > 0 
      ? ((trackingData.clicks.length / trackingData.impressions.length) * 100).toFixed(2)
      : '0.00'
  }

  return (
    <div style={{ 
      background: darkMode ? '#111827' : '#ffffff',
      color: darkMode ? '#f9fafb' : '#1f2937'
    }}>
      {/* Toolbar */}
      <div
        ref={toolbarRef}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <h2 style={{ 
            color: darkMode ? '#f9fafb' : '#1f2937',
            margin: 0,
            fontSize: '24px',
            fontWeight: '600'
          }}>📢 Ads</h2>
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={() => setActiveTab('vendors')}
              style={{
                padding: '8px 16px',
                background: activeTab === 'vendors' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
                border: `1px solid ${activeTab === 'vendors' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
                color: activeTab === 'vendors' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Vendors
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              style={{
                padding: '8px 16px',
                background: activeTab === 'ads' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
                border: `1px solid ${activeTab === 'ads' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
                color: activeTab === 'ads' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Ads
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              style={{
                padding: '8px 16px',
                background: activeTab === 'tracking' ? (darkMode ? '#3b82f6' : '#3b82f6') : (darkMode ? '#374151' : '#ffffff'),
                border: `1px solid ${activeTab === 'tracking' ? '#3b82f6' : (darkMode ? '#4b5563' : '#d1d5db')}`,
                color: activeTab === 'tracking' ? 'white' : (darkMode ? '#f9fafb' : '#374151'),
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Tracking
            </button>
          </div>
        </div>

        {/* Search/Filter row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeTab === 'vendors' && (
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <input 
                placeholder="Search vendors…" 
                value={vendorQ} 
                onChange={(e)=>setVendorQ(e.target.value)} 
                style={{ 
                  width: '100%',
                  padding: '8px 32px 8px 8px',
                  background: darkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }} 
              />
              {vendorQ && (
                <button
                  type="button"
                  onClick={() => setVendorQ('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    color: darkMode ? '#d1d5db' : '#6b7280',
                    cursor: 'pointer',
                    padding: 4
                  }}
                >
                  ◯◼︎
                </button>
              )}
            </div>
          )}
          
          {activeTab === 'ads' && (
            <>
              <select
                value={selectedVendorFilter}
                onChange={(e) => setSelectedVendorFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: darkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              >
                <option value="all">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <input 
                  placeholder="Search ads…" 
                  value={adQ} 
                  onChange={(e)=>setAdQ(e.target.value)} 
                  style={{ 
                    width: '100%',
                    padding: '8px 32px 8px 8px',
                    background: darkMode ? '#374151' : '#ffffff',
                    border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                    borderRadius: '6px',
                    color: darkMode ? '#f9fafb' : '#1f2937'
                  }} 
                />
                {adQ && (
                  <button
                    type="button"
                    onClick={() => setAdQ('')}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: darkMode ? '#d1d5db' : '#6b7280',
                      cursor: 'pointer',
                      padding: 4
                    }}
                  >
                    ◯◼︎
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'tracking' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date"
                value={trackingDateRange.start}
                onChange={(e) => setTrackingDateRange({...trackingDateRange, start: e.target.value})}
                style={{
                  padding: '8px',
                  background: darkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              />
              <span>to</span>
              <input
                type="date"
                value={trackingDateRange.end}
                onChange={(e) => setTrackingDateRange({...trackingDateRange, end: e.target.value})}
                style={{
                  padding: '8px',
                  background: darkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#f9fafb' : '#1f2937'
                }}
              />
              <button
                onClick={loadTracking}
                style={{
                  padding: '8px 12px',
                  background: darkMode ? '#374151' : '#ffffff',
                  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
                  borderRadius: '6px',
                  color: darkMode ? '#f9fafb' : '#374151',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </div>
          )}

          {/* New button */}
          {activeTab === 'vendors' && (
            <button 
              className="btn" 
              onClick={startNewVendor}
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
            >
              <span>✨</span>
              <span>New Vendor</span>
            </button>
          )}
          
          {activeTab === 'ads' && (
            <button 
              className="btn" 
              onClick={startNewAd}
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
            >
              <span>✨</span>
              <span>New Ad</span>
            </button>
          )}
        </div>
      </div>

      {/* Vendors Tab */}
      {activeTab === 'vendors' && (
        <div>
          <table>
            <thead style={{ position: 'sticky', top: toolbarHeight, zIndex: 110, background: darkMode ? '#374151' : '#f8f9fa' }}>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th style={{ padding: '8px 4px', width: '1%' }}>Status</th>
                <th style={{ padding: '8px 4px', width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr 
                  key={v.id}
                  onClick={() => setEditingVendor(v)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f8f9fa'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#1f2937' : '#ffffff'
                  }}
                >
                  <td>{v.name}</td>
                  <td>{v.contact_email || v.contact_phone || '—'}</td>
                  <td style={{ padding: '8px 24px 8px 4px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: v.status === 'published'
                        ? (darkMode ? '#10b981' : '#2e7d32')
                        : v.status === 'archived'
                          ? (darkMode ? '#f59e0b' : '#f57c00')
                          : (darkMode ? '#e5e7eb' : '#666')
                    }}>
                      {v.status === 'published' ? '✅' : v.status === 'archived' ? '📦' : '📝'}
                      {v.status === 'published' ? 'Published' : v.status === 'archived' ? 'Archived' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {v.status !== 'published' && (
                        <button 
                          className="btn" 
                          onClick={(e) => {
                            e.stopPropagation()
                            publishVendor(v.id)
                          }}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '12px',
                            background: '#e8f5e8',
                            border: '1px solid #c8e6c9',
                            borderRadius: '4px',
                            color: '#2e7d32'
                          }}
                        >
                          🚀 Publish
                        </button>
                      )}
                      {v.status !== 'archived' && (
                        <button 
                          className="btn" 
                          onClick={(e) => {
                            e.stopPropagation()
                            archiveVendor(v.id)
                          }}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '12px',
                            background: darkMode ? '#374151' : '#fff3e0',
                            border: `1px solid ${darkMode ? '#4b5563' : '#ffcc02'}`,
                            borderRadius: '4px',
                            color: darkMode ? '#f9fafb' : '#f57c00'
                          }}
                        >
                          📦 Archive
                        </button>
                      )}
                      <button 
                        className="btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          softDeleteVendor(v.id)
                        }}
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '12px',
                          background: darkMode ? '#7f1d1d' : '#ffebee',
                          border: `1px solid ${darkMode ? '#991b1b' : '#ffcdd2'}`,
                          borderRadius: '4px',
                          color: darkMode ? '#ffffff' : '#c62828'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vendors.length === 0 && !vendorLoading && (
                <tr><td colSpan={4}>No vendors.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Ads Tab */}
      {activeTab === 'ads' && (
        <div>
          <table>
            <thead style={{ position: 'sticky', top: toolbarHeight, zIndex: 110, background: darkMode ? '#374151' : '#f8f9fa' }}>
              <tr>
                <th>Name</th>
                <th>Vendor</th>
                <th>Position</th>
                <th>Priority</th>
                <th style={{ padding: '8px 4px', width: '1%' }}>Status</th>
                <th style={{ padding: '8px 4px', width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {ads.map(a => (
                <tr 
                  key={a.id}
                  onClick={() => setEditingAd(a)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#374151' : '#f8f9fa'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = darkMode ? '#1f2937' : '#ffffff'
                  }}
                >
                  <td>{a.name}</td>
                  <td>{a.vendor?.name || '—'}</td>
                  <td>{a.position}</td>
                  <td>{a.priority}</td>
                  <td style={{ padding: '8px 24px 8px 4px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: a.status === 'published'
                        ? (darkMode ? '#10b981' : '#2e7d32')
                        : a.status === 'archived'
                          ? (darkMode ? '#f59e0b' : '#f57c00')
                          : (darkMode ? '#e5e7eb' : '#666')
                    }}>
                      {a.status === 'published' ? '✅' : a.status === 'archived' ? '📦' : '📝'}
                      {a.status === 'published' ? 'Published' : a.status === 'archived' ? 'Archived' : 'Draft'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 4px' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {a.status !== 'published' && (
                        <button 
                          className="btn" 
                          onClick={(e) => {
                            e.stopPropagation()
                            publishAd(a.id)
                          }}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '12px',
                            background: '#e8f5e8',
                            border: '1px solid #c8e6c9',
                            borderRadius: '4px',
                            color: '#2e7d32'
                          }}
                        >
                          🚀 Publish
                        </button>
                      )}
                      {a.status !== 'archived' && (
                        <button 
                          className="btn" 
                          onClick={(e) => {
                            e.stopPropagation()
                            archiveAd(a.id)
                          }}
                          style={{ 
                            padding: '6px 10px', 
                            fontSize: '12px',
                            background: darkMode ? '#374151' : '#fff3e0',
                            border: `1px solid ${darkMode ? '#4b5563' : '#ffcc02'}`,
                            borderRadius: '4px',
                            color: darkMode ? '#f9fafb' : '#f57c00'
                          }}
                        >
                          📦 Archive
                        </button>
                      )}
                      <button 
                        className="btn" 
                        onClick={(e) => {
                          e.stopPropagation()
                          softDeleteAd(a.id)
                        }}
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '12px',
                          background: darkMode ? '#7f1d1d' : '#ffebee',
                          border: `1px solid ${darkMode ? '#991b1b' : '#ffcdd2'}`,
                          borderRadius: '4px',
                          color: darkMode ? '#ffffff' : '#c62828'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {ads.length === 0 && !adLoading && (
                <tr><td colSpan={6}>No ads.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tracking Tab */}
      {activeTab === 'tracking' && (
        <div>
          <div style={{ marginBottom: 20, padding: 16, background: darkMode ? '#374151' : '#f8f9fa', borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Overall Statistics</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalStats.impressions}</div>
                <div style={{ fontSize: '14px', color: darkMode ? '#d1d5db' : '#6b7280' }}>Total Impressions</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalStats.clicks}</div>
                <div style={{ fontSize: '14px', color: darkMode ? '#d1d5db' : '#6b7280' }}>Total Clicks</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalStats.ctr}%</div>
                <div style={{ fontSize: '14px', color: darkMode ? '#d1d5db' : '#6b7280' }}>Click-Through Rate</div>
              </div>
            </div>
          </div>

          <table>
            <thead style={{ position: 'sticky', top: toolbarHeight, zIndex: 110, background: darkMode ? '#374151' : '#f8f9fa' }}>
              <tr>
                <th>Ad Name</th>
                <th>Vendor</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
              </tr>
            </thead>
            <tbody>
              {trackingData.ads.map(ad => {
                const stats = getAdStats(ad.id)
                return (
                  <tr key={ad.id}>
                    <td>{ad.name}</td>
                    <td>{ad.vendor?.name || '—'}</td>
                    <td>{stats.impressions}</td>
                    <td>{stats.clicks}</td>
                    <td>{stats.ctr}%</td>
                  </tr>
                )
              })}
              {trackingData.ads.length === 0 && !trackingLoading && (
                <tr><td colSpan={5}>No ads found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Vendor Edit Dialog */}
      <AutoSaveEditDialog
        isOpen={editingVendor !== null}
        onClose={() => setEditingVendor(null)}
        title={editingVendor?.id ? '✏️ Edit Vendor' : '➕ New Vendor'}
        maxWidth="600px"
        darkMode={darkMode}
        overlayLeftOffsetPx={sidebarCollapsed ? 60 : 220}
        editing={editingVendor}
        rows={vendors}
        saveFunction={saveVendor}
        setEditing={(item) => setEditingVendor(item as AdVendor | null)}
        itemType="vendor"
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <FormField
            label="Vendor Name"
            name="name"
            value={editingVendor?.name || ''}
            onChange={(value) => setEditingVendor({...editingVendor!, name: value as string})}
            required
            editingId={editingVendor?.id}
            darkMode={darkMode}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField
              label="Contact Email"
              name="contact_email"
              value={editingVendor?.contact_email || ''}
              onChange={(value) => setEditingVendor({...editingVendor!, contact_email: value as string})}
              type="email"
              editingId={editingVendor?.id}
              darkMode={darkMode}
            />
            <FormField
              label="Contact Phone"
              name="contact_phone"
              value={editingVendor?.contact_phone || ''}
              onChange={(value) => setEditingVendor({...editingVendor!, contact_phone: value as string})}
              editingId={editingVendor?.id}
              darkMode={darkMode}
            />
          </div>
          <FormField
            label="Notes"
            name="notes"
            value={editingVendor?.notes || ''}
            onChange={(value) => setEditingVendor({...editingVendor!, notes: value as string})}
            type="textarea"
            editingId={editingVendor?.id}
            darkMode={darkMode}
          />
          <FormField
            label="Status"
            name="status"
            value={editingVendor?.status || 'draft'}
            onChange={(value) => setEditingVendor({...editingVendor!, status: value as any})}
            type="select"
            options={[
              { value: 'draft', label: '📝 Draft' },
              { value: 'published', label: '✅ Published' },
              { value: 'archived', label: '📦 Archived' }
            ]}
            editingId={editingVendor?.id}
            darkMode={darkMode}
          />
        </div>
      </AutoSaveEditDialog>

      {/* Ad Edit Dialog */}
      <AutoSaveEditDialog
        isOpen={editingAd !== null}
        onClose={() => setEditingAd(null)}
        title={editingAd?.id ? '✏️ Edit Ad' : '➕ New Ad'}
        maxWidth="700px"
        darkMode={darkMode}
        overlayLeftOffsetPx={sidebarCollapsed ? 60 : 220}
        editing={editingAd}
        rows={ads}
        saveFunction={saveAd}
        setEditing={(item) => setEditingAd(item as Ad | null)}
        itemType="ad"
      >
        <div style={{ display: 'grid', gap: '20px' }}>
          <FormField
            label="Vendor"
            name="vendor_id"
            value={editingAd?.vendor_id || ''}
            onChange={(value) => setEditingAd({...editingAd!, vendor_id: value as string})}
            type="select"
            options={[
              { value: '', label: 'Select vendor...' },
              ...vendors.map(v => ({ value: v.id, label: v.name }))
            ]}
            required
            editingId={editingAd?.id}
            darkMode={darkMode}
          />
          <FormField
            label="Ad Name"
            name="name"
            value={editingAd?.name || ''}
            onChange={(value) => setEditingAd({...editingAd!, name: value as string})}
            required
            editingId={editingAd?.id}
            darkMode={darkMode}
          />
          <FormField
            label="Image URL"
            name="image_url"
            value={editingAd?.image_url || ''}
            onChange={(value) => setEditingAd({...editingAd!, image_url: value as string})}
            type="url"
            required
            editingId={editingAd?.id}
            darkMode={darkMode}
          />
          {editingAd?.image_url && (
            <div style={{ marginTop: -10 }}>
              <img 
                src={editingAd.image_url} 
                alt="Preview" 
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}` }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
          <FormField
            label="Mobile Image URL (Optional)"
            name="mobile_image_url"
            value={editingAd?.mobile_image_url || ''}
            onChange={(value) => setEditingAd({...editingAd!, mobile_image_url: value as string})}
            type="url"
            editingId={editingAd?.id}
            darkMode={darkMode}
          />
          {editingAd?.mobile_image_url && (
            <div style={{ marginTop: -10 }}>
              <img 
                src={editingAd.mobile_image_url} 
                alt="Mobile Preview" 
                style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}` }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}
          <FormField
            label="Target URL"
            name="target_url"
            value={editingAd?.target_url || ''}
            onChange={(value) => setEditingAd({...editingAd!, target_url: value as string})}
            type="url"
            required
            editingId={editingAd?.id}
            darkMode={darkMode}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField
              label="Position"
              name="position"
              value={editingAd?.position || 'header'}
              onChange={(value) => setEditingAd({...editingAd!, position: value as any})}
              type="select"
              options={[
                { value: 'header', label: 'Header' },
                { value: 'body', label: 'Body' }
              ]}
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
            <FormField
              label="Priority"
              name="priority"
              value={editingAd?.priority ?? 100}
              onChange={(value) => setEditingAd({...editingAd!, priority: value as number})}
              type="number"
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField
              label="Start Date (Optional)"
              name="start_date"
              value={editingAd?.start_date || ''}
              onChange={(value) => setEditingAd({...editingAd!, start_date: value as string || null})}
              type="date"
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
            <FormField
              label="End Date (Optional)"
              name="end_date"
              value={editingAd?.end_date || ''}
              onChange={(value) => setEditingAd({...editingAd!, end_date: value as string || null})}
              type="date"
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField
              label="Status"
              name="status"
              value={editingAd?.status || 'draft'}
              onChange={(value) => setEditingAd({...editingAd!, status: value as any})}
              type="select"
              options={[
                { value: 'draft', label: '📝 Draft' },
                { value: 'published', label: '✅ Published' },
                { value: 'archived', label: '📦 Archived' }
              ]}
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
            <FormField
              label="Sort Order"
              name="sort_order"
              value={editingAd?.sort_order ?? 1000}
              onChange={(value) => setEditingAd({...editingAd!, sort_order: value as number})}
              type="number"
              editingId={editingAd?.id}
              darkMode={darkMode}
            />
          </div>
        </div>
      </AutoSaveEditDialog>
    </div>
  )
}

