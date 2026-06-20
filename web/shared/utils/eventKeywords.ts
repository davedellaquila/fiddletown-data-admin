/**
 * Sync event ↔ keyword junction rows (matches Events module behavior).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const PRICE_KEYWORDS = ['$', '$$', '$$$'] as const
export type PriceKeyword = (typeof PRICE_KEYWORDS)[number]
export type DerivedPriceKeyword = PriceKeyword | 'free'

export interface PriceKeywordSource {
  name?: string | null
  title?: string | null
  host_org?: string | null
  location?: string | null
  short_description?: string | null
  description?: string | null
  recurrence?: string | null
  website_url?: string | null
  ocr_text?: string | null
  raw_text?: string | null
  source_name?: string | null
}

const PRICE_KEYWORD_SET = new Set<string>([...PRICE_KEYWORDS, 'free'])

const ATTENDEE_PRICE_CUE =
  /\b(ticket|tickets|admission|reservation|reservations|required|per person|per guest|\/person|pp|entry|cover|registration|cost|price|fastpass|vip|general admission)\b/i

const NON_ATTENDEE_PRICE_CUE =
  /\b(prize|prizes|valued at|value of|discount|slush|taco|sandwich|food truck|vendor|booth|raffle|donation suggested)\b/i

const FREE_EVENT_CUE =
  /\b(free admission|free event|free entry|free to attend|admission is free|no admission|free show|free concert|free festival|free faire|free market|free family|free all day|free two-day)\b/i

function normalizeKeywordNames(keywordNames: string[]): string[] {
  return [...new Set(keywordNames.map((k) => k.trim().toLowerCase()).filter(Boolean))].sort()
}

function buildPriceHaystack(source: PriceKeywordSource): string {
  return [
    source.name,
    source.title,
    source.host_org,
    source.location,
    source.short_description,
    source.description,
    source.recurrence,
    source.website_url,
    source.ocr_text,
    source.raw_text,
    source.source_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function derivePriceKeyword(source: PriceKeywordSource): DerivedPriceKeyword | null {
  const haystack = buildPriceHaystack(source)
  if (!haystack) return null
  if (FREE_EVENT_CUE.test(haystack)) return 'free'

  const amounts: number[] = []
  const amountPattern = /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/g
  let match: RegExpExecArray | null
  while ((match = amountPattern.exec(haystack)) !== null) {
    const context = haystack.slice(
      Math.max(0, match.index - 80),
      Math.min(haystack.length, match.index + match[0].length + 110)
    )

    if (!ATTENDEE_PRICE_CUE.test(context)) continue
    if (NON_ATTENDEE_PRICE_CUE.test(context)) continue

    const amount = Number.parseFloat(match[1])
    if (Number.isFinite(amount)) amounts.push(amount)
  }

  if (amounts.length === 0) return null

  const maxAmount = Math.max(...amounts)
  if (maxAmount > 50) return '$$$'
  if (maxAmount >= 25) return '$$'
  return '$'
}

export function applyDerivedPriceKeyword(
  keywordNames: string[],
  source?: PriceKeywordSource | null
): string[] {
  const normalized = normalizeKeywordNames(keywordNames)
  if (!source) return normalized

  const derived = derivePriceKeyword(source)
  const withoutPriceKeywords = normalized.filter((keyword) => !PRICE_KEYWORD_SET.has(keyword))

  if (!derived) return withoutPriceKeywords
  return normalizeKeywordNames([...withoutPriceKeywords, derived])
}

export async function fetchAllKeywordNames(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('keywords').select('name').order('name')
  if (error) throw error
  return (data ?? []).map((row) => String(row.name).toLowerCase())
}

export async function syncEventKeywords(
  client: SupabaseClient,
  eventId: string,
  keywordNames: string[],
  priceSource?: PriceKeywordSource | null
): Promise<string[]> {
  const normalized = applyDerivedPriceKeyword(keywordNames, priceSource)

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
