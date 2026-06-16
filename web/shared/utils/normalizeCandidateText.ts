/**
 * Normalize scraped HTML / escaped text from event monitor pipelines.
 * Used for display and one-time DB cleanup (migration 005).
 * @see docs/SHARED_LOGIC.md — Scraped text normalization
 */

/**
 * Decode common HTML entities, unescape backslash sequences, strip HTML tags.
 * Returns null for empty input after normalization.
 */
export function normalizeScrapedText(input: string | null | undefined): string | null {
  if (input == null) return null
  let t = input
  if (!t.trim()) return null

  t = t.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
  t = t.replace(/\\'/g, "'").replace(/\\"/g, '"')

  t = t
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')

  t = t.replace(/<[^>]+>/g, '')
  t = t.trim()

  return t === '' ? null : t
}

/** Apply normalization to candidate description fields (does not mutate). */
export function normalizeCandidateDescriptions<T extends {
  short_description?: string | null
  description?: string | null
}>(row: T): T {
  return {
    ...row,
    short_description: normalizeScrapedText(row.short_description),
    description: normalizeScrapedText(row.description),
  }
}
