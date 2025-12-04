/**
 * Shared URL utility functions
 * 
 * These functions must behave identically in both TypeScript and Swift implementations.
 * See docs/SHARED_LOGIC.md for business logic contracts.
 * 
 * @see docs/SHARED_LOGIC.md - Business logic contracts
 * @see web/shared/utils/README.md - Detailed documentation and test cases
 */

/**
 * Normalize URL string (add https:// if missing)
 * 
 * Ensures URLs have a protocol prefix. If the URL already has http:// or https://,
 * it is returned as-is. Otherwise, https:// is prepended.
 * 
 * @param u - URL string to normalize, or null/undefined
 * @returns Normalized URL string with protocol, or empty string for null/empty input
 * 
 * @example
 * ```typescript
 * normalizeUrl("example.com") // "https://example.com"
 * normalizeUrl("https://example.com") // "https://example.com"
 * normalizeUrl("http://example.com") // "http://example.com"
 * normalizeUrl("  example.com  ") // "https://example.com"
 * normalizeUrl(null) // ""
 * ```
 * 
 * Rules:
 * 1. Return empty string for null/empty input
 * 2. Trim whitespace
 * 3. If URL already has http:// or https://, return as-is
 * 4. Otherwise, prepend https://
 * 
 * @see docs/SHARED_LOGIC.md#url-normalization
 */
export function normalizeUrl(u?: string | null): string {
  if (!u) return ''
  const s = u.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return `https://${s}`
}

