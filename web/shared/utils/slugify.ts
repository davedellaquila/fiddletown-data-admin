/**
 * Shared slugify utility function
 * 
 * Converts a string to a URL-friendly slug following these rules:
 * 1. Convert to lowercase
 * 2. Trim whitespace
 * 3. Remove apostrophes and similar characters (`'`, `` ` ``, `'`)
 * 4. Replace non-alphanumeric characters with hyphens (`-`)
 * 5. Remove leading and trailing hyphens
 * 6. Collapse multiple consecutive hyphens into a single hyphen
 * 
 * @param s - The string to convert to a slug
 * @returns A URL-friendly slug string
 * 
 * @example
 * ```typescript
 * slugify("Hello World") // "hello-world"
 * slugify("St. Mary's Winery") // "st-marys-winery"
 * slugify("  Test   ") // "test"
 * slugify("---test---") // "test"
 * slugify("test@#$%test") // "test-test"
 * ```
 * 
 * @see docs/SHARED_LOGIC.md#slug-generation - Business logic contract
 * @see web/shared/utils/README.md#slugify - Detailed documentation and test cases
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, '') // Remove apostrophes and similar characters
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, '') // Remove leading/trailing hyphens
}



