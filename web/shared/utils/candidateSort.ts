import type { CandidatePriority, EventCandidate } from '../types/models'

const PRIORITY_ORDER: Record<CandidatePriority, number> = {
  A: 0,
  B: 1,
  C: 2,
  Watch: 3,
}

/**
 * Default queue sort: start_date asc nulls last, priority asc, discovered_at desc.
 * @see docs/features/event-candidate-review.md AC-3
 */
export function sortCandidates(rows: EventCandidate[]): EventCandidate[] {
  return [...rows].sort((a, b) => {
    const aDate = a.start_date ?? ''
    const bDate = b.start_date ?? ''
    if (!aDate && bDate) return 1
    if (aDate && !bDate) return -1
    if (aDate !== bDate) return aDate.localeCompare(bDate)

    const pa = PRIORITY_ORDER[a.priority] ?? 99
    const pb = PRIORITY_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb

    return (b.discovered_at ?? '').localeCompare(a.discovered_at ?? '')
  })
}
