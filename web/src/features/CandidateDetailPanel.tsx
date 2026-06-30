import FormField from '../shared/components/FormField'
import KeywordSelector from '../shared/components/KeywordSelector'
import ModalDialog from '../shared/components/ModalDialog'
import type { EventCandidate, CandidatePriority } from '../../shared/types/models'
import { CANDIDATE_PRIORITY_VALUES } from '../../shared/types/index'
import {
  getMissingPublishFields,
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
  showPublishConfirm: boolean
  canPublish: boolean
  keywords: string[]
  existingKeywords: string[]
  keywordsAutoSuggested?: boolean
  onKeywordsChange: (keywords: string[]) => void
  onDraftChange: (draft: EventCandidate) => void
  onClose: () => void
  onSave: () => void
  onRejectClick: () => void
  onRejectConfirm: () => void
  onRejectCancel: () => void
  onApproveClick: () => void
  onApproveConfirm: () => void
  onApproveCancel: () => void
  onPublishClick: () => void
  onPublishConfirm: () => void
  onPublishCancel: () => void
}

function fieldWarn(missing: PublishFieldKey[], key: PublishFieldKey): boolean {
  return missing.includes(key)
}

function warnLabel(label: string, missing: PublishFieldKey[], key: PublishFieldKey): string {
  return fieldWarn(missing, key) ? `${label} ⚠` : label
}

const PUBLISH_FIELD_HINT = 'Needed before publish'

function normalizeExternalUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function openExternalUrl(url: string | null | undefined) {
  const normalized = normalizeExternalUrl(url)
  if (!normalized) return
  window.open(normalized, '_blank', 'noopener,noreferrer')
}

export default function CandidateDetailPanel({
  darkMode,
  candidate,
  draft,
  isMobile,
  busy,
  showReject,
  showApproveConfirm,
  showPublishConfirm,
  canPublish,
  keywords,
  existingKeywords,
  keywordsAutoSuggested = false,
  onKeywordsChange,
  onDraftChange,
  onClose,
  onSave,
  onRejectClick,
  onRejectConfirm,
  onRejectCancel,
  onApproveClick,
  onApproveConfirm,
  onApproveCancel,
  onPublishClick,
  onPublishConfirm,
  onPublishCancel,
}: CandidateDetailPanelProps) {
  const border = darkMode ? '#374151' : '#e5e7eb'
  const muted = darkMode ? '#9ca3af' : '#6b7280'
  const warnBg = darkMode ? '#78350f' : '#fffbeb'
  const warnBorder = darkMode ? '#d97706' : '#f59e0b'
  const mobileHalfAction = isMobile ? { flex: '1 1 calc(50% - 4px)', justifyContent: 'center' } : undefined
  const mobileFullAction = isMobile ? { flex: '1 1 100%', justifyContent: 'center' } : undefined

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
  const imagePreviewUrl = normalizeExternalUrl(draft.image_url)

  const set = <K extends keyof EventCandidate>(key: K, value: EventCandidate[K]) => {
    onDraftChange({ ...draft, [key]: value })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: darkMode ? '#111827' : '#fff',
        borderLeft: isMobile ? 'none' : `1px solid ${border}`,
      }}
    >
      {isMobile && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <button type="button" className="btn" onClick={onClose}>
            ← Back to queue
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
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
          <FormField darkMode={darkMode} editingId={draft.id} label={warnLabel('Title', missing, 'title')} name="title" value={draft.title} onChange={(v) => set('title', String(v))} required warning={fieldWarn(missing, 'title')} warningHint={PUBLISH_FIELD_HINT} />
          <FormField darkMode={darkMode} editingId={draft.id} label="Host organization" name="host_org" value={draft.host_org ?? ''} onChange={(v) => set('host_org', String(v) || null)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField darkMode={darkMode} editingId={draft.id} label={warnLabel('Start date', missing, 'start_date')} name="start_date" type="date" value={draft.start_date ?? ''} onChange={(v) => set('start_date', String(v) || null)} warning={fieldWarn(missing, 'start_date')} warningHint={PUBLISH_FIELD_HINT} />
            <FormField darkMode={darkMode} editingId={draft.id} label="End date" name="end_date" type="date" value={draft.end_date ?? ''} onChange={(v) => set('end_date', String(v) || null)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField darkMode={darkMode} editingId={draft.id} label="Start time" name="start_time" type="text" value={draft.start_time?.slice(0, 5) ?? ''} onChange={(v) => set('start_time', String(v) || null)} placeholder="HH:MM" />
            <FormField darkMode={darkMode} editingId={draft.id} label="End time" name="end_time" type="text" value={draft.end_time?.slice(0, 5) ?? ''} onChange={(v) => set('end_time', String(v) || null)} placeholder="HH:MM" />
          </div>
          <FormField darkMode={darkMode} editingId={draft.id} label={warnLabel('Location', missing, 'location')} name="location" value={draft.location ?? ''} onChange={(v) => set('location', String(v) || null)} warning={fieldWarn(missing, 'location')} warningHint={PUBLISH_FIELD_HINT} />
          <FormField darkMode={darkMode} editingId={draft.id} label={warnLabel('Short description', missing, 'short_description')} name="short_description" type="textarea" value={draft.short_description ?? ''} onChange={(v) => set('short_description', String(v) || null)} minHeight="60px" warning={fieldWarn(missing, 'short_description')} warningHint={PUBLISH_FIELD_HINT} />
          <FormField darkMode={darkMode} editingId={draft.id} label="Description" name="description" type="textarea" value={draft.description ?? ''} onChange={(v) => set('description', String(v) || null)} minHeight="100px" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: imagePreviewUrl ? 'minmax(0, 1fr) 74px' : '1fr',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <FormField darkMode={darkMode} editingId={draft.id} label="Image URL" name="image_url" type="url" value={draft.image_url ?? ''} onChange={(v) => set('image_url', String(v) || null)} />
            {imagePreviewUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(draft.image_url)}
                title="Open image in new tab"
                aria-label="Open image preview"
                style={{
                  width: 74,
                  height: 74,
                  padding: 0,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  background: darkMode ? '#1f2937' : '#f9fafb',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={imagePreviewUrl}
                  alt="Candidate thumbnail"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </button>
            )}
          </div>
          <FormField
            darkMode={darkMode}
            editingId={draft.id}
            label={warnLabel('Website URL', missing, 'website_url')}
            name="website_url"
            type="url"
            value={draft.website_url ?? ''}
            onChange={(v) => set('website_url', String(v) || null)}
            warning={fieldWarn(missing, 'website_url')}
            warningHint={PUBLISH_FIELD_HINT}
            endIcon={draft.website_url?.trim() ? '🔗' : undefined}
            endIconTitle="Open URL in new tab"
            onEndIconClick={draft.website_url?.trim() ? () => openExternalUrl(draft.website_url) : undefined}
          />
          <KeywordSelector
            label="Keywords"
            value={keywords}
            onChange={onKeywordsChange}
            existingKeywords={existingKeywords}
            darkMode={darkMode}
          />
          {keywordsAutoSuggested && keywords.length > 0 && (
            <p style={{ margin: '-4px 0 0', fontSize: 12, color: muted }}>
              Suggested from title and description — edit before publishing if needed.
            </p>
          )}
          <FormField
            darkMode={darkMode}
            editingId={draft.id}
            label="Priority"
            name="priority"
            type="select"
            value={draft.priority}
            onChange={(v) => set('priority', String(v) as CandidatePriority)}
            options={CANDIDATE_PRIORITY_VALUES.map((p) => ({ value: p, label: p }))}
          />
          <FormField darkMode={darkMode} editingId={draft.id} label="Review notes" name="review_notes" type="textarea" value={draft.review_notes ?? ''} onChange={(v) => set('review_notes', String(v) || null)} minHeight="60px" />
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
      </div>

      <div style={{ padding: isMobile ? '16px 16px max(16px, env(safe-area-inset-bottom))' : 16, flexShrink: 0, borderTop: `1px solid ${border}`, display: 'flex', flexWrap: 'wrap', gap: 8, background: darkMode ? '#1f2937' : '#f9fafb' }}>
        {!showReject ? (
          <>
            <button type="button" className="btn" onClick={onSave} disabled={busy} style={mobileHalfAction}>Save</button>
            <button type="button" className="btn" onClick={onRejectClick} disabled={busy} style={{ ...mobileHalfAction, borderColor: '#dc2626', color: '#dc2626' }}>Reject</button>
            <button type="button" className="btn" onClick={onApproveClick} disabled={busy} style={{ ...mobileFullAction, marginLeft: isMobile ? 0 : 'auto', background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>Approve as Draft</button>
            <button
              type="button"
              className="btn"
              onClick={onPublishClick}
              disabled={busy || !canPublish}
              title={canPublish ? 'Create a published event on the public site' : 'Fill all required publish fields first'}
              style={{ ...mobileFullAction, background: canPublish ? '#16a34a' : undefined, color: canPublish ? '#fff' : undefined, borderColor: canPublish ? '#16a34a' : undefined }}
            >
              Approve & Publish
            </button>
          </>
        ) : (
          <>
            <p style={{ width: '100%', margin: 0, fontSize: 14 }}>Reject this candidate? Notes are optional.</p>
            <button type="button" className="btn" onClick={onRejectCancel} disabled={busy} style={mobileHalfAction}>Cancel</button>
            <button type="button" className="btn" onClick={onRejectConfirm} disabled={busy} style={{ ...mobileHalfAction, background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}>Reject candidate</button>
          </>
        )}
      </div>

      <ModalDialog isOpen={showPublishConfirm} onClose={onPublishCancel} title="Approve and Publish" busy={busy}>
        <p style={{ marginTop: 0 }}>
          Creates a <strong>published</strong> event — it will appear on the public site immediately.
        </p>
        <p style={{ fontSize: 14, color: muted }}>Slug preview: <code>{slugPreview}</code></p>
        {keywords.length > 0 && (
          <p style={{ fontSize: 14, color: muted }}>
            Keywords: {keywords.join(', ')}
          </p>
        )}
        {linkUrl && <p style={{ fontSize: 13 }}>Link: <a href={linkUrl} target="_blank" rel="noopener noreferrer">{linkUrl}</a></p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn" onClick={onPublishCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn" onClick={onPublishConfirm} disabled={busy} style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>Publish event</button>
        </div>
      </ModalDialog>

      <ModalDialog isOpen={showApproveConfirm} onClose={onApproveCancel} title="Approve as Draft" busy={busy}>
        <p style={{ marginTop: 0 }}>
          Creates a <strong>draft</strong> event only — it will not appear on the public site until published in Events.
        </p>
        <p style={{ fontSize: 14, color: muted }}>Slug preview: <code>{slugPreview}</code></p>
        {keywords.length > 0 && (
          <p style={{ fontSize: 14, color: muted }}>Keywords: {keywords.join(', ')}</p>
        )}
        {linkUrl && <p style={{ fontSize: 13 }}>Link: <a href={linkUrl} target="_blank" rel="noopener noreferrer">{linkUrl}</a></p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn" onClick={onApproveCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn" onClick={onApproveConfirm} disabled={busy} style={{ background: '#2563eb', color: '#fff', borderColor: '#2563eb' }}>Create draft event</button>
        </div>
      </ModalDialog>
    </div>
  )
}
