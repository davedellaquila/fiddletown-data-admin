/**
 * Shared Supabase query utilities
 * 
 * Common query patterns used across features. These helpers ensure consistent
 * query construction across the application. Both TypeScript and Swift implementations
 * should follow the same patterns documented in docs/API_CONTRACTS.md.
 * 
 * @see docs/API_CONTRACTS.md - API query contracts and patterns
 * @see docs/API_PATTERNS.md - Detailed query pattern examples
 */

import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Base query builder for fetching non-deleted records
 * 
 * All queries should start with this helper to ensure soft-deleted records
 * are excluded. This is the foundation for all fetch operations.
 * 
 * @param client - Supabase client instance
 * @param table - Table name to query
 * @param select - Columns to select (default: '*')
 * @returns Query builder with deleted_at filter applied
 * 
 * @example
 * ```typescript
 * const query = baseQuery(supabase, 'locations')
 * const { data } = await query.select('id, name').execute()
 * ```
 * 
 * @see docs/API_CONTRACTS.md#base-query-patterns
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
 * 
 * Applies a case-insensitive partial match filter on the specified field.
 * Only applies the filter if searchTerm is non-empty after trimming.
 * 
 * @param query - Query builder to apply search to
 * @param searchTerm - Search term to filter by
 * @param field - Field name to search in (default: 'name')
 * @returns Query builder with search filter applied (or unchanged if searchTerm is empty)
 * 
 * @example
 * ```typescript
 * let query = baseQuery(supabase, 'locations')
 * query = withSearch(query, 'winery', 'name')
 * ```
 * 
 * @see docs/API_CONTRACTS.md#filtering-patterns
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
 * 
 * Applies primary and optional secondary ordering to a query.
 * This ensures consistent sorting across the application.
 * 
 * @param query - Query builder to apply ordering to
 * @param primaryOrder - Primary sort column and direction
 * @param secondaryOrder - Optional secondary sort column and direction
 * @returns Query builder with ordering applied
 * 
 * @example
 * ```typescript
 * let query = baseQuery(supabase, 'locations')
 * query = withOrdering(
 *   query,
 *   { column: 'sort_order', ascending: true },
 *   { column: 'name', ascending: true }
 * )
 * ```
 * 
 * @see docs/API_CONTRACTS.md#sorting-patterns
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

/**
 * Query with status filter
 * 
 * Filters records by status value. Only applies filter if status is provided.
 * 
 * @param query - Query builder to apply status filter to
 * @param status - Status value to filter by ('draft', 'published', 'archived')
 * @returns Query builder with status filter applied (or unchanged if status is null)
 * 
 * @example
 * ```typescript
 * let query = baseQuery(supabase, 'locations')
 * query = withStatus(query, 'published')
 * ```
 * 
 * @see docs/API_CONTRACTS.md#filtering-patterns
 */
export function withStatus(
  query: any,
  status: string | null
) {
  if (status) {
    return query.eq('status', status)
  }
  return query
}

/**
 * Soft delete helper
 * 
 * Performs a soft delete by setting the deleted_at timestamp.
 * Never physically deletes records from the database.
 * 
 * @param client - Supabase client instance
 * @param table - Table name
 * @param id - Record ID to soft delete
 * @returns Promise that resolves when delete is complete
 * 
 * @example
 * ```typescript
 * await softDelete(supabase, 'locations', locationId)
 * ```
 * 
 * @see docs/API_CONTRACTS.md#delete-operations
 */
export async function softDelete(
  client: SupabaseClient,
  table: string,
  id: string
) {
  return client
    .from(table)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Update status helper
 * 
 * Updates the status field of a record.
 * 
 * @param client - Supabase client instance
 * @param table - Table name
 * @param id - Record ID to update
 * @param status - New status value
 * @returns Promise that resolves when update is complete
 * 
 * @example
 * ```typescript
 * await updateStatus(supabase, 'locations', locationId, 'published')
 * ```
 * 
 * @see docs/API_CONTRACTS.md#save-operations
 */
export async function updateStatus(
  client: SupabaseClient,
  table: string,
  id: string,
  status: string
) {
  return client
    .from(table)
    .update({ status })
    .eq('id', id)
}




