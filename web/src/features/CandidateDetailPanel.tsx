import FormField from '../shared/components/FormField'
import ModalDialog from '../shared/components/ModalDialog'
import type { EventCandidate, CandidatePriority } from '../../shared/types/models'
import { CANDIDATE_PRIORITY_VALUES } from '../../shared/types/index'
import {
  getMissingPublishFields,
  publishFieldLabel,
  type PublishFieldKey,
} from '../../shared/utils/candidatePublishFields'
import { generateEventSlug } from '../../shared/utils/eventSlug'

interface CandidateDetailPanelProps {
  darkMode: boolean
  candidate: EventCandidate | null
  draft: EventCandidate | null
  isMobile: boolean
  busy: boolean
  showReject: boolean
  showApproveConfirm: boolean
  onDraftChange: (draft: EventCandidate) => void
  onClose: () => void
  onSave: () => void
  onRejectClick: () => void
  onRejectConfirm: () => void
  onRejectCancel: () => void
  onApproveClick: () => void
  onApproveConfirm: () => void
  onApproveCancel: () => void
}

function fieldWarn(missing: PublishFieldKey[], key: PublishFieldKey): boolean {
  return missing.includes(key)
}

function warnLabel(label: string, missing: PublishFieldKey[], key: PublishFieldKey): string {
  return fieldWarn(missing, key) ? `${label} ⚠` : label
}

export default function CandidateDetailPanel({
  darkMode,
  candidate,
  draft,
  isMobile,
  busy,
  showReject,
  showApproveConfirm,
  onDraftChange,
  onClose,
  onSave,
  onRejectClick,
  onRejectConfirm,
  onRejectCancel,
  onApproveClick,
  onApproveConfirm,
  onApproveCancel,
}: CandidateDetailPanelProps) {
  const border = darkMode ? '#374151' : '#e5e7eb'
  const muted = darkMode ? '#9ca3af' : '#6b7280'
  const warnBg = darkMode ? '#78350f' : '#fffbeb'
  const warnBorder = darkMode ? '#d97706' : '#f59e0b'

  if (!candidate || !draft) {
    return (
      <div style={{ padding: 24, color: muted, flex: 1 }}>
        Select a candidate from the queue to review details.
      </div>
    )
  }

  const missing = getMissingPublishFields(draft)
  const slugPreview = generateEventSlug(draft.title, draft.start_date)
  const linkUrl = draft.website_url?.trim() || draft.source_url

  const set = <K extends keyof EventCandidate>(key: K, value: EventCandidate[K]) => {
    onDraftChange({ ...draft, [key]: value })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: isMobile ? '100vh' : 0,
        background: darkMode ? '#111827' : '#fff',
        borderLeft: isMobile ? 'none' : `1px solid ${border}`,
      }}
    >
      {isMobile && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
          <button type="button" className="btn" onClick={onClose}>
            ← Back to queue
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Edit candidate</h2>
        <p style={{ margin: '0 0 16px', color: muted, fontSize: 13 }}>
          Confidence: {draft.extraction_confidence != null ? `${Math.round(Number(draft.extraction_confidence) * 100)}%` : '—'}
        </p>

        {draft.duplicate_event_id && (
          <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: warnBg, border: `1px solid ${warnBorder}`, fontSize: 14 }}>
            Possible duplicate of {draft.duplicate_event_name ? `"${draft.duplicate_event_name}"` : 'an existing event'}.
          </div>
        )}

        {missing.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: warnBg, border: `1px solid ${warnBorder}`, fontSize: 14 }}>
            <strong>{missing.length} field{missing.length === 1 ? '' : 's'} missing for publish</strong>
            <div style={{ marginTop: 4, color: muted }}>Draft can still be created.</div>
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          <FormField darkMode={darkMode} label={warnLabel('Title', missing, 'title')} name="title" value={draft.title} onChange={(v) => set('title', String(v))} required />
          <FormField darkMode={darkMode} label="Host organization" name="host_org" value={draft.host_org ?? ''} onChange={(v) => set('host_org', String(v) || null)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField darkMode={darkMode} label={warnLabel('Start date', missing, 'start_date')} name="start_date" type="date" value={draft.start_date ?? ''} onChange={(v) => set('start_date', String(v) || null)} />
            <FormField darkMode={darkMode} label="End date" name="end_date" type="date" value={draft.end_date ?? ''} onChange={(v) => set('end_date', String(v) || null)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField darkMode={darkMode} label="Start time" name="start_time" type="text" value={draft.start_time?.slice(0, 5) ?? ''} onChange={(v) => set('start_time', String(v) || null)} placeholder="HH:MM" />
            <FormField darkMode={darkMode} label="End time" name="end_time" type="text" value={draft.end_time?.slice(0, 5) ?? ''} onChange={(v) => set('end_time', String(v) || null)} placeholder="HH:MM" />
          </div>
          <FormField darkMode={darkMode} label={warnLabel('Location', missing, 'location')} name="location" value={draft.location ?? ''} onChange={(v) => set('location', String(v) || null)} />
          <FormField darkMode={darkMode} label={warnLabel('Short description', missing, 'short_description')} name="short_description" type="textarea" value={draft.short_description ?? ''} onChange={(v) => set('short_description', String(v) || null)} minHeight="60px" />
          <FormField darkMode={darkMode} label="Description" name="description" type="textarea" value={draft.description ?? ''} onChange={(v) => set('description', String(v) || null)} minHeight="100px" />
          <FormField darkMode={darkMode} label="Image URL" name="image_url" type="url" value={draft.image_url ?? ''} onChange={(v) => set('image_url', String(v) || null)} />
          <FormField darkMode={darkMode} label={warnLabel('Website URL', missing, 'website_url')} name="website_url" type="url" value={draft.website_url ?? ''} onChange={(v) => set('website_url', String(v) || null)} />
          <FormField
            darkMode={darkMode}
            label="Priority"
            name="priority"
            type="select"
            value={draft.priority}
            onChange={(v) => set('priority', String(v) as CandidatePriority)}
            options={CANDIDATE_PRIORITY_VALUES.map((p) => ({ value: p, label: p }))}
          />
          <FormField darkMode={darkMode} label="Review notes" name="review_notes" type="textarea" value={draft.review_notes ?? ''} onChange={(v) => set('review_notes', String(v) || null)} minHeight="60px" />
        </div>

        <section style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${border}` }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Source context</h3>
          <dl style={{ margin: 0, fontSize: 13, color: muted, display: 'grid', gap: 8 }}>
            <div><dt style={{ fontWeight: 600, color: darkMode ? '#e5e7eb' : '#374151' }}>Source</dt><dd style={{ margin: '4px 0 0' }}>{draft.source_name ?? '—'}</dd></div>
            <div>
              <dt style={{ fontWeight: 600, color: darkMode ? '#e5e7eb' : '#374151' }}>Source URL</dt>
              <dd style={{ margin: '4px 0 0' }}>
                <a href={draft.source_url} target="_blank" rel="noopener noreferrer">{draft.source_url}</a>
              </dd>
            </div>
            <div><dt style={{ fontWeight: 600, color: darkMode ? '#e5e7eb' : '#374151' }}>Discovered</dt><dd style={{ margin: '4px 0 0' }}>{new Date(draft.discovered_at).toLocaleString()}</dd></div>
            <div><dt style={{ fontWeight: 600, color: darkMode ? '#e5e7eb' : '#374151' }}>Last seen</dt><dd style={{ margin: '4px 0 0' }}>{new Date(draft.last_seen_at).toLocaleString()}</dd></div>
          </dl>
          {draft.raw_text && (
            <pre style={{ marginTop: 12, padding: 12, fontSize: 12, maxHeight: 160, overflow: 'auto', background: darkMode ? '#1f2937' : '#f9fafb', border: `1px solid ${border}`, borderRadius: 8, whiteSpace: 'pre-wrap' }}>
              {draft.raw_text}
            </pre>
          )}
        </section>

        {missing.map((key) => (
          <p key={key} style={{ fontSize: 12, color: warnBorder, margin: '8px 0 0' }}>
            {publishFieldLabel(key)} — needed before publish
          </p>
        ))}
      </div>

      <div style={{ padding: 16, borderTop: `1px solid ${border}`, display: 'flex', flexWrap: 'wrap', gap: 8, background: darkMode ? '#1f2937' : '#f9fafb' }}>
        {!showReject ? (
          <>
            <button type="button" className="btn" onClick={onSave} disabled={busy}>Save</button>
            <button type="button" className="btn" onClick={onRejectClick} disabled={busy} style={{ borderColor: '#dc2626', color: '#dc2626' }}>Reject</button>
            <button type="button" className="btn" onClick={onApproveClick} disabled={busy} style={{ marginLeft: 'auto', background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>Approve as Draft</button>
          </>
        ) : (
          <>
            <p style={{ width: '100%', margin: 0, fontSize: 14 }}>Reject this candidate? Notes are optional.</p>
            <button type="button" className="btn" onClick={onRejectCancel} disabled={busy}>Cancel</button>
            <button type="button" className="btn" onClick={onRejectConfirm} disabled={busy} style={{ background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>Reject candidate</button>
          </>
        )}
      </div>

      <ModalDialog isOpen={showApproveConfirm} onClose={onApproveCancel} title="Approve as Draft" busy={busy}>
        <p style={{ marginTop: 0 }}>
          Creates a <strong>draft</strong> event only — it will not appear on the public site until published in Events.
        </p>
        <p style={{ fontSize: 14, color: muted }}>Slug preview: <code>{slugPreview}</code></p>
        {linkUrl && <p style={{ fontSize: 13 }}>Link: <a href={linkUrl} target="_blank" rel="noopener noreferrer">{linkUrl}</a></p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn" onClick={onApproveCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn" onClick={onApproveConfirm} disabled={busy} style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>Create draft event</button>
        </div>
      </ModalDialog>
    </div>
  )
}
