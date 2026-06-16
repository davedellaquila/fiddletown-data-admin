/**
 * Sync event ↔ keyword junction rows (matches Events module behavior).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchAllKeywordNames(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('keywords').select('name').order('name')
  if (error) throw error
  return (data ?? []).map((row) => String(row.name).toLowerCase())
}

export async function syncEventKeywords(
  client: SupabaseClient,
  eventId: string,
  keywordNames: string[]
): Promise<string[]> {
  const normalized = [...new Set(keywordNames.map((k) => k.trim().toLowerCase()).filter(Boolean))]

  const keywordIds: string[] = []
  for (const keywordName of normalized) {
    const { data: existingKeyword } = await client
      .from('keywords')
      .select('id')
      .eq('name', keywordName)
      .maybeSingle()

    if (existingKeyword?.id) {
      keywordIds.push(existingKeyword.id)
      continue
    }

    const { data: newKeyword, error: createError } = await client
      .from('keywords')
      .insert({ name: keywordName })
      .select('id')
      .single()

    if (createError) throw createError
    keywordIds.push(newKeyword.id)
  }

  const { error: deleteError } = await client.from('event_keywords').delete().eq('event_id', eventId)
  if (deleteError) throw deleteError

  if (keywordIds.length > 0) {
    const junctionRecords = keywordIds.map((keywordId) => ({
      event_id: eventId,
      keyword_id: keywordId,
    }))
    const { error: insertError } = await client.from('event_keywords').insert(junctionRecords)
    if (insertError) throw insertError
  }

  return normalized
}
