/**
 * Slug generation utilities
 */

/**
 * Generates a URL-friendly slug from a text string
 */
export function generateSlug(text: string): string {
  if (!text) return ''
  
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Ensures a slug is unique by appending a number if needed
 */
export function ensureUniqueSlug(
  existingSlugs: string[],
  baseSlug: string,
  excludeSlug?: string
): string {
  // Filter out the excluded slug from the existing slugs list
  const filteredSlugs = excludeSlug 
    ? existingSlugs.filter(slug => slug !== excludeSlug)
    : existingSlugs
  
  if (!filteredSlugs.includes(baseSlug)) {
    return baseSlug
  }
  
  let counter = 1
  let uniqueSlug = `${baseSlug}-${counter}`
  
  while (filteredSlugs.includes(uniqueSlug)) {
    counter++
    uniqueSlug = `${baseSlug}-${counter}`
  }
  
  return uniqueSlug
}

/**
 * Validates if a slug is properly formatted
 */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false
  
  // Slug should only contain lowercase letters, numbers, and hyphens
  const slugRegex = /^[a-z0-9-]+$/
  return slugRegex.test(slug) && !slug.startsWith('-') && !slug.endsWith('-')
}
