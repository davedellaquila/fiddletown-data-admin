/**
 * Supabase queries for event candidate triage.
 * @see docs/API_CONTRACTS.md#event-candidates
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EventCandidate, EventCandidateStatus } from '../types/models'
import { normalizeCandidateDescriptions } from '../utils/normalizeCandidateText'

const CANDIDATE_SELECT = `
  id,
  source_id,
  source_name,
  source_url,
  candidate_key,
  title,
  host_org,
  start_date,
  end_date,
  start_time,
  end_time,
  location,
  short_description,
  description,
  image_url,
  website_url,
  raw_text,
  extraction_confidence,
  priority,
  status,
  duplicate_event_id,
  reviewed_at,
  review_notes,
  discovered_at,
  last_seen_at,
  created_at,
  updated_at,
  duplicate_event:events!event_candidates_duplicate_event_id_fkey(name)
`

type CandidateRow = Omit<EventCandidate, 'duplicate_event_name'> & {
  duplicate_event?: { name: string } | { name: string }[] | null
}

function mapCandidate(row: CandidateRow): EventCandidate {
  const dup = row.duplicate_event
  const duplicate_event_name = Array.isArray(dup) ? dup[0]?.name ?? null : dup?.name ?? null
  const { duplicate_event: _dup, ...rest } = row
  return normalizeCandidateDescriptions({ ...rest, duplicate_event_name })
}

export async function fetchEventCandidates(
  client: SupabaseClient,
  statuses?: EventCandidateStatus[]
): Promise<EventCandidate[]> {
  let query = client.from('event_candidates').select(CANDIDATE_SELECT)
  if (statuses?.length) {
    query = query.in('status', statuses)
  }
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as CandidateRow[]).map(mapCandidate)
}

export async function fetchEventSources(client: SupabaseClient) {
  const { data, error } = await client
    .from('event_sources')
    .select('id, name, active')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export type CandidateUpdatePayload = Pick<
  EventCandidate,
  | 'title'
  | 'host_org'
  | 'start_date'
  | 'end_date'
  | 'start_time'
  | 'end_time'
  | 'location'
  | 'short_description'
  | 'description'
  | 'image_url'
  | 'website_url'
  | 'priority'
  | 'review_notes'
>

export async function updateEventCandidate(
  client: SupabaseClient,
  id: string,
  payload: CandidateUpdatePayload
): Promise<EventCandidate> {
  const { data, error } = await client
    .from('event_candidates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CANDIDATE_SELECT)
    .single()
  if (error) throw error
  return mapCandidate(data as unknown as CandidateRow)
}

export async function rejectEventCandidate(
  client: SupabaseClient,
  id: string,
  reviewNotes: string | null
): Promise<EventCandidate> {
  const { data, error } = await client
    .from('event_candidates')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(CANDIDATE_SELECT)
    .single()
  if (error) throw error
  return mapCandidate(data as unknown as CandidateRow)
}

export async function approveEventCandidateAsDraft(
  client: SupabaseClient,
  candidateId: string
): Promise<string> {
  const { data, error } = await client.rpc('approve_event_candidate_as_draft', {
    p_candidate_id: candidateId,
  })
  if (error) throw error
  return data as string
}

export async function fetchEventById(client: SupabaseClient, eventId: string) {
  const { data, error } = await client
    .from('events')
    .select('id, name, slug, status')
    .eq('id', eventId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function verifyCandidateStatus(
  client: SupabaseClient,
  candidateId: string,
  expectedStatus: EventCandidateStatus
) {
  const { data, error } = await client
    .from('event_candidates')
    .select('id, status, reviewed_at')
    .eq('id', candidateId)
    .single()
  if (error) throw error
  return data?.status === expectedStatus
}
