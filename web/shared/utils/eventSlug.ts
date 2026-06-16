import { slugify } from './slugify'

/**
 * Generate event slug from candidate title + start date (Event Triage approve flow).
 * @see docs/SHARED_LOGIC.md#candidate-approve-slug
 */
export function generateEventSlug(title: string, startDate: string | null | undefined): string {
  const datePart = startDate?.trim() || 'undated'
  const base = slugify(title || 'untitled')
  return base ? `${base}-${datePart}` : `untitled-${datePart}`
}
