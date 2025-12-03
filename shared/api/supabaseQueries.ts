/**
 * Shared Supabase query utilities
 * Common query patterns used across features
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Base query builder for fetching non-deleted records
 */
export function baseQuery<T>(
  client: SupabaseClient,
  table: string,
  select: string = '*'
) {
  return client
    .from(table)
    .select(select)
    .is('deleted_at', null)
}

/**
 * Query with search filter
 */
export function withSearch(
  query: any,
  searchTerm: string,
  field: string = 'name'
) {
  if (searchTerm.trim()) {
    return query.ilike(field, `%${searchTerm}%`)
  }
  return query
}

/**
 * Query with ordering
 */
export function withOrdering(
  query: any,
  primaryOrder: { column: string; ascending: boolean },
  secondaryOrder?: { column: string; ascending: boolean }
) {
  let ordered = query.order(primaryOrder.column, { ascending: primaryOrder.ascending })
  if (secondaryOrder) {
    ordered = ordered.order(secondaryOrder.column, { ascending: secondaryOrder.ascending })
  }
  return ordered
}



