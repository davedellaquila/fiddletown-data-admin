/**
 * Event candidate triage — queue + detail panel (M1).
 * @see docs/features/event-candidate-review.md
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSupabaseSession } from '../hooks/useSupabaseSession'
import { IS_DEVELOPMENT_MODE } from '../lib/devMode'
import { supabase } from '../lib/supabaseClient'
import DevSignInPrompt from '../shared/components/DevSignInPrompt'
import CandidateDetailPanel from './CandidateDetailPanel'
import type { EventCandidate, EventCandidateStatus } from '../../shared/types/models'
import { CANDIDATE_PRIORITY_VALUES } from '../../shared/types/index'
import {
  approveEventCandidateAsDraft,
  fetchEventById,
  fetchEventCandidates,
  fetchEventSources,
  rejectEventCandidate,
  updateEventCandidate,
  verifyCandidateStatus,
  type CandidateUpdatePayload,
} from '../../shared/api/eventCandidateQueries'
import { sortCandidates } from '../../shared/utils/candidateSort'

type TabKey = 'actionable' | 'approved' | 'rejected' | 'duplicates' | 'all'

const TAB_STATUSES: Record<TabKey, EventCandidateStatus[] | undefined> = {
  actionable: ['new', 'needs_review'],
  approved: ['approved'],
  rejected: ['rejected'],
  duplicates: ['duplicate'],
  all: undefined,
}

const TAB_LABELS: Record<TabKey, string> = {
  actionable: 'Actionable',
  approved: 'Approved',
  rejected: 'Rejected',
  duplicates: 'Duplicates',
  all: 'All',
}

interface EventCandidatesProps {
  darkMode: boolean
  sidebarCollapsed: boolean
}

function toPayload(draft: EventCandidate): CandidateUpdatePayload {
  return {
    title: draft.title,
    host_org: draft.host_org ?? null,
    start_date: draft.start_date ?? null,
    end_date: draft.end_date ?? null,
    start_time: draft.start_time ?? null,
    end_time: draft.end_time ?? null,
    location: draft.location ?? null,
    short_description: draft.short_description ?? null,
    description: draft.description ?? null,
    image_url: draft.image_url ?? null,
    website_url: draft.website_url ?? null,
    priority: draft.priority,
    review_notes: draft.review_notes ?? null,
  }
}

export default function EventCandidates({ darkMode }: EventCandidatesProps) {
  const { isAuthenticated, loading: authLoading } = useSupabaseSession()
  const needsDevSignIn = IS_DEVELOPMENT_MODE && !authLoading && !isAuthenticated
  const [tab, setTab] = useState<TabKey>('actionable')
  const [rows, setRows] = useState<EventCandidate[]>([])
  const [sources, setSources] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<EventCandidate | null>(null)
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [mobileDetail, setMobileDetail] = useState(false)

  const border = darkMode ? '#374151' : '#e5e7eb'
  const muted = darkMode ? '#9ca3af' : '#6b7280'

  const pushToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    window.setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (IS_DEVELOPMENT_MODE && !isAuthenticated) {
      setLoading(false)
      setRows([])
      setSources([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const statuses = TAB_STATUSES[tab]
      const [candidates, sourceRows] = await Promise.all([
        fetchEventCandidates(supabase, statuses),
        fetchEventSources(supabase),
      ])
      setRows(sortCandidates(candidates))
      setSources(sourceRows.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load candidates'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [tab, isAuthenticated])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (sourceFilter && r.source_id !== sourceFilter) return false
      if (priorityFilter && r.priority !== priorityFilter) return false
      if (!q) return true
      const hay = [r.title, r.source_name, r.location, r.short_description].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, sourceFilter, priorityFilter, sources])

  const selected = filtered.find((r) => r.id === selectedId) ?? null

  useEffect(() => {
    if (selected) setDraft({ ...selected })
    else setDraft(null)
    setShowReject(false)
    setShowApproveConfirm(false)
  }, [selectedId, selected?.updated_at])

  const selectRow = (id: string) => {
    setSelectedId(id)
    if (isMobile) setMobileDetail(true)
  }

  const handleSave = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const updated = await updateEventCandidate(supabase, draft.id, toPayload(draft))
      pushToast('Candidate saved.')
      setRows((prev) => sortCandidates(prev.map((r) => (r.id === updated.id ? updated : r))))
      setDraft(updated)
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : 'Save failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const handleRejectConfirm = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const updated = await rejectEventCandidate(supabase, draft.id, draft.review_notes ?? null)
      const ok = await verifyCandidateStatus(supabase, draft.id, 'rejected')
      if (!ok) throw new Error('Reject verification failed')
      pushToast('Candidate rejected.')
      setShowReject(false)
      setSelectedId(null)
      setMobileDetail(false)
      await load()
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : 'Reject failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const handleApproveConfirm = async () => {
    if (!draft) return
    setBusy(true)
    try {
      const eventId = await approveEventCandidateAsDraft(supabase, draft.id)
      const event = await fetchEventById(supabase, eventId)
      if (!event || event.status !== 'draft') throw new Error('Approve verification failed')
      const ok = await verifyCandidateStatus(supabase, draft.id, 'approved')
      if (!ok) throw new Error('Candidate status verification failed')
      pushToast(`Draft event created${event.slug ? ` (${event.slug})` : ''}.`)
      setShowApproveConfirm(false)
      setSelectedId(null)
      setMobileDetail(false)
      await load()
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : 'Approve failed', 'err')
    } finally {
      setBusy(false)
    }
  }

  const showQueue = !isMobile || !mobileDetail
  const showPanel = !isMobile || mobileDetail

  if (needsDevSignIn) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh' }}>
        <header style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${border}` }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Candidates</h1>
        </header>
        <DevSignInPrompt darkMode={darkMode} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxHeight: '100vh' }}>
      <header style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 10, background: darkMode ? '#111827' : '#fff' }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 22 }}>Candidates</h1>
        {error && (
          <div role="alert" style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
            {error}
            <button type="button" className="btn" style={{ marginLeft: 12 }} onClick={load}>Retry</button>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
            <button
              key={key}
              type="button"
              className="btn"
              onClick={() => { setTab(key); setSelectedId(null); setMobileDetail(false) }}
              style={{
                background: tab === key ? '#3b82f6' : (darkMode ? '#374151' : '#fff'),
                color: tab === key ? '#fff' : (darkMode ? '#f9fafb' : '#374151'),
                borderColor: tab === key ? '#3b82f6' : border,
              }}
            >
              {TAB_LABELS[key]}{tab === key && filtered.length > 0 ? ` (${filtered.length})` : ''}
            </button>
          ))}
        </div>
        <div className="responsive-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input
            className="input"
            placeholder="Search title, source, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 200px', minWidth: 160 }}
          />
          <select className="input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">All sources</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">All priorities</option>
            {CANDIDATE_PRIORITY_VALUES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </header>

      {toast && (
        <div role="status" style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000, padding: '12px 16px', borderRadius: 8, background: toast.type === 'ok' ? '#16a34a' : '#dc2626', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {showQueue && (
          <div style={{ width: isMobile ? '100%' : '35%', minWidth: isMobile ? undefined : 280, borderRight: `1px solid ${border}`, overflow: 'auto' }}>
            {loading ? (
              <p style={{ padding: 16, color: muted }}>Loading candidates…</p>
            ) : filtered.length === 0 ? (
              <p style={{ padding: 16, color: muted }}>No candidates in this view.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {filtered.map((row) => {
                  const active = row.id === selectedId
                  const link = row.website_url || row.source_url
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => selectRow(row.id)}
                        aria-selected={active}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          border: 'none',
                          borderBottom: `1px solid ${border}`,
                          borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
                          background: active ? (darkMode ? '#1f2937' : '#eff6ff') : 'transparent',
                          cursor: 'pointer',
                          color: darkMode ? '#f9fafb' : '#111827',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ flex: 1 }}>{row.title}</strong>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: darkMode ? '#374151' : '#e5e7eb' }}>{row.priority}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: darkMode ? '#1e3a5f' : '#dbeafe' }}>{row.status}</span>
                        </div>
                        <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
                          {row.source_name ?? 'Unknown source'}
                          {row.start_date ? ` · ${row.start_date}` : ''}
                          {row.start_time ? ` ${row.start_time.slice(0, 5)}` : ''}
                        </div>
                        {row.short_description && (
                          <div style={{ fontSize: 12, color: muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.short_description}</div>
                        )}
                        <div style={{ fontSize: 12, color: muted, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {row.extraction_confidence != null && <span>{Math.round(Number(row.extraction_confidence) * 100)}% confidence</span>}
                          {link && <span>↗ link</span>}
                        </div>
                        {row.duplicate_event_id && (
                          <div style={{ fontSize: 12, color: '#d97706', marginTop: 6 }}>⚠ Possible duplicate</div>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {showPanel && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <CandidateDetailPanel
              darkMode={darkMode}
              candidate={selected}
              draft={draft}
              isMobile={isMobile}
              busy={busy}
              showReject={showReject}
              showApproveConfirm={showApproveConfirm}
              onDraftChange={setDraft}
              onClose={() => setMobileDetail(false)}
              onSave={handleSave}
              onRejectClick={() => setShowReject(true)}
              onRejectConfirm={handleRejectConfirm}
              onRejectCancel={() => setShowReject(false)}
              onApproveClick={() => setShowApproveConfirm(true)}
              onApproveConfirm={handleApproveConfirm}
              onApproveCancel={() => setShowApproveConfirm(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
