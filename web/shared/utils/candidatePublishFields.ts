import type { EventCandidate } from '../types/models'

export type PublishFieldKey =
  | 'title'
  | 'start_date'
  | 'location'
  | 'short_description'
  | 'website_url'

const FIELD_LABELS: Record<PublishFieldKey, string> = {
  title: 'Title',
  start_date: 'Start date',
  location: 'Location',
  short_description: 'Short description',
  website_url: 'Website or source URL',
}

/**
 * Fields missing for M2 publish validation; informational only for M1 drafts.
 * @see docs/features/event-candidate-review.md AC-11
 */
export function getMissingPublishFields(candidate: Partial<EventCandidate>): PublishFieldKey[] {
  const missing: PublishFieldKey[] = []
  if (!candidate.title?.trim()) missing.push('title')
  if (!candidate.start_date) missing.push('start_date')
  if (!candidate.location?.trim()) missing.push('location')
  if (!candidate.short_description?.trim()) missing.push('short_description')
  const hasUrl = Boolean(candidate.website_url?.trim() || candidate.source_url?.trim())
  if (!hasUrl) missing.push('website_url')
  return missing
}

export function publishFieldLabel(key: PublishFieldKey): string {
  return FIELD_LABELS[key]
}
