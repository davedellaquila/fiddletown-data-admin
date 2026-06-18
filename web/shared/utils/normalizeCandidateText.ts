/**
 * Normalize scraped HTML / escaped text from event monitor pipelines.
 * Used for display and one-time DB cleanup (migration 005).
 * @see docs/SHARED_LOGIC.md — Scraped text normalization
 */

/**
 * Decode common HTML entities / mojibake, unescape backslash sequences, strip HTML tags.
 * Returns null for empty input after normalization.
 */
export function normalizeScrapedText(input: string | null | undefined): string | null {
  if (input == null) return null
  let t = input
  if (!t.trim()) return null

  t = t.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
  t = t.replace(/\\'/g, "'").replace(/\\"/g, '"')

  t = t
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€�/g, '"')
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/â€¦/g, '...')
    .replace(/â€¢/g, '-')
    .replace(/Â /g, ' ')
    .replace(/Â/g, '')
    .replace(/�/g, '')

  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&#([0-9]{1,6});/g, (_match, code) => {
      const point = Number(code)
      if (!Number.isInteger(point) || point <= 0 || point > 0x10ffff) return ''
      try {
        return String.fromCodePoint(point)
      } catch {
        return ''
      }
    })

  t = t.replace(/<[^>]+>/g, '')
  t = t.replace(/[\r\t ]+/g, ' ')
  t = t.replace(/ *\n */g, '\n')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t.trim()

  return t === '' ? null : t
}

/** Apply normalization to candidate text fields (does not mutate). */
export function normalizeCandidateDescriptions<T extends {
  title?: string | null
  host_org?: string | null
  location?: string | null
  source_name?: string | null
  short_description?: string | null
  description?: string | null
  raw_text?: string | null
  review_notes?: string | null
}>(row: T): T {
  return {
    ...row,
    title: normalizeScrapedText(row.title),
    host_org: normalizeScrapedText(row.host_org),
    location: normalizeScrapedText(row.location),
    source_name: normalizeScrapedText(row.source_name),
    short_description: normalizeScrapedText(row.short_description),
    description: normalizeScrapedText(row.description),
    raw_text: normalizeScrapedText(row.raw_text),
    review_notes: normalizeScrapedText(row.review_notes),
  }
}
