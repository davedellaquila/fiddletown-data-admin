/**
 * Suggest keywords by matching the known keyword catalog against event/candidate text.
 * @see docs/SHARED_LOGIC.md — Keyword suggestions
 */
import type { EventCandidate, EventRow } from '../types/models'
import { normalizeScrapedText } from './normalizeCandidateText'

const MIN_KEYWORD_LENGTH = 2

/** Text fields used for keyword matching (candidates and events). */
export type KeywordSuggestSource = Pick<
  EventCandidate,
  | 'title'
  | 'host_org'
  | 'location'
  | 'short_description'
  | 'description'
  | 'source_name'
  | 'raw_text'
  | 'website_url'
>

/** Skip price-only tokens unless they appear verbatim in the haystack. */
function isNoiseKeyword(keyword: string): boolean {
  const k = keyword.trim()
  if (k.length < MIN_KEYWORD_LENGTH) return true
  if (k === '$') return true
  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildHaystackFromSource(source: Partial<KeywordSuggestSource>): string {
  const title = normalizeScrapedText(source.title)
    ?.replace(/&#0*38;/gi, '&')
    ?.replace(/&#8217;/gi, "'")

  const parts = [
    title,
    source.host_org,
    source.location,
    normalizeScrapedText(source.short_description),
    normalizeScrapedText(source.description),
    source.source_name,
    source.website_url,
    normalizeScrapedText(source.raw_text),
  ]

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function keywordTokens(keyword: string): string[] {
  return keyword
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
}

function allKeywordTokensInHaystack(haystack: string, keyword: string): boolean {
  const tokens = keywordTokens(keyword)
  if (tokens.length < 2) return false
  return tokens.every((token) => {
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i')
    return re.test(haystack)
  })
}

/** Category-style titles from directory scrapes with little body text. */
const TITLE_CATEGORY_HINTS: Array<{ pattern: RegExp; keywords: string[] }> = [
  { pattern: /\bfarmers?\s+markets?\b/i, keywords: ['market', 'flea market'] },
  { pattern: /\bfood\s*(?:&|and)\s*wine\b/i, keywords: ['food', 'wine event', 'winery'] },
  { pattern: /\bwineries\b/i, keywords: ['winery', 'wine event', 'amador wine'] },
  { pattern: /\bparade\b/i, keywords: ['parade'] },
  { pattern: /\bconcert\b/i, keywords: ['concert', 'live music'] },
  { pattern: /\bcraft\s+fair\b/i, keywords: ['craft fair', 'crafts'] },
  { pattern: /\bart\s+show\b/i, keywords: ['art show', 'arts and crafts'] },
  { pattern: /\bcar\s+show\b/i, keywords: ['car show', 'automotive'] },
]

function applyTitleCategoryHints(
  title: string | null | undefined,
  catalogSet: Set<string>,
  matched: string[],
  matchedSet: Set<string>
): void {
  if (!title?.trim()) return
  for (const { pattern, keywords } of TITLE_CATEGORY_HINTS) {
    if (!pattern.test(title)) continue
    for (const keyword of keywords) {
      const normalized = keyword.toLowerCase()
      if (!catalogSet.has(normalized) || matchedSet.has(normalized)) continue
      matched.push(normalized)
      matchedSet.add(normalized)
    }
  }
}

function shouldSkipKeyword(keyword: string, haystack: string): boolean {
  if (isNoiseKeyword(keyword)) return true
  if (/^\$/.test(keyword) && !haystack.includes(keyword.toLowerCase())) return true
  return false
}

function keywordMatches(haystack: string, keyword: string): boolean {
  const normalized = keyword.toLowerCase().trim()
  if (!normalized) return false

  if (normalized.includes(' ') || normalized.length >= 5) {
    return haystack.includes(normalized)
  }

  const re = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i')
  return re.test(haystack)
}

function suggestKeywordsFromSource(
  source: Partial<KeywordSuggestSource>,
  knownKeywords: string[],
  titleForHints: string | null | undefined
): string[] {
  const haystack = buildHaystackFromSource(source)
  if (!haystack) return []

  const catalog = [...new Set(knownKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean))]
    .filter((k) => !shouldSkipKeyword(k, haystack))
    .sort((a, b) => b.length - a.length)

  const catalogSet = new Set(catalog)
  const matched: string[] = []
  const matchedSet = new Set<string>()

  for (const keyword of catalog) {
    if (matchedSet.has(keyword)) continue
    if (!keywordMatches(haystack, keyword)) continue
    matched.push(keyword)
    matchedSet.add(keyword)
  }

  for (const keyword of catalog) {
    if (matchedSet.has(keyword)) continue
    if (!allKeywordTokensInHaystack(haystack, keyword)) continue
    matched.push(keyword)
    matchedSet.add(keyword)
  }

  applyTitleCategoryHints(titleForHints, catalogSet, matched, matchedSet)

  return matched.sort()
}

/**
 * Returns keyword names from `knownKeywords` that appear to apply to this candidate.
 */
export function suggestCandidateKeywords(
  candidate: Partial<EventCandidate>,
  knownKeywords: string[]
): string[] {
  return suggestKeywordsFromSource(
    {
      title: candidate.title,
      host_org: candidate.host_org,
      location: candidate.location,
      short_description: candidate.short_description,
      description: candidate.description,
      source_name: candidate.source_name,
      raw_text: candidate.raw_text,
      website_url: candidate.website_url,
    },
    knownKeywords,
    candidate.title
  )
}

/**
 * Suggest keywords for an event from name, descriptions, location, and OCR text.
 */
export function suggestEventKeywords(
  event: Partial<EventRow>,
  knownKeywords: string[]
): string[] {
  return suggestKeywordsFromSource(
    {
      title: event.name,
      host_org: event.host_org,
      location: event.location,
      short_description: event.short_description,
      description: event.description,
      raw_text: event.ocr_text,
      website_url: event.website_url,
    },
    knownKeywords,
    event.name
  )
}

/** Build a lookup of suggested keywords for many candidates (e.g. actionable queue). */
export function suggestKeywordsForCandidates(
  candidates: EventCandidate[],
  knownKeywords: string[]
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const candidate of candidates) {
    map.set(candidate.id, suggestCandidateKeywords(candidate, knownKeywords))
  }
  return map
}
