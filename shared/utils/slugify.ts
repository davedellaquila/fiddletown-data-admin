/**
 * Shared slugify utility function
 * Converts a string to a URL-friendly slug
 */

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, '') // Remove apostrophes and similar characters
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/(^-|-$)/g, '') // Remove leading/trailing hyphens
}



