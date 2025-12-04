# API Contracts

This document defines the Supabase API query patterns and contracts that both the web (TypeScript) and iOS (Swift) applications must follow.

## Table of Contents

1. [Base Query Patterns](#base-query-patterns)
2. [Fetch Operations](#fetch-operations)
3. [Save Operations](#save-operations)
4. [Delete Operations](#delete-operations)
5. [Filtering Patterns](#filtering-patterns)
6. [Sorting Patterns](#sorting-patterns)
7. [Error Handling](#error-handling)

---

## Base Query Patterns

### Non-Deleted Records Filter

**Contract**: All queries must exclude soft-deleted records.

**Pattern**:
```typescript
// TypeScript
query.is('deleted_at', null)
```

```swift
// Swift
query.is("deleted_at", value: nil)
```

**Rule**: Always apply this filter first, before any other filters.

---

## Fetch Operations

### Standard Fetch Pattern

**Contract**: Fetch all non-deleted records with optional search.

**Locations**:
```typescript
// TypeScript
let query = supabase
  .from('locations')
  .select('*')
  .is('deleted_at', null)

if (searchTerm) {
  query = query.ilike('name', `%${searchTerm}%`)
}

query = query
  .order('sort_order', { ascending: true })
  .order('name', { ascending: true })
```

```swift
// Swift
var filterQuery = client
  .from("locations")
  .select()
  .is("deleted_at", value: nil)

if let searchTerm = searchTerm, !searchTerm.isEmpty {
  filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
}

let response: [Location] = try await filterQuery
  .order("sort_order", ascending: true)
  .order("name", ascending: true)
  .execute()
  .value
```

**Events**:
```typescript
// TypeScript
let query = supabase
  .from('events')
  .select('id, name, slug, description, host_org, start_date, end_date, start_time, end_time, location, recurrence, website_url, image_url, status, sort_order, created_by, created_at, updated_at, deleted_at')
  .is('deleted_at', null)

// Date filtering
if (from) {
  query = query.or(`start_date.gte.${from},end_date.gte.${from},and(start_date.is.null,end_date.is.null)`)
}
if (to) {
  query = query.lte('start_date', to)
}

query = query
  .order('sort_order', { ascending: true })
  .order('start_date', { ascending: true })
```

```swift
// Swift
var filterQuery = client
  .from("events")
  .select()
  .is("deleted_at", value: nil)

if let fromDate = fromDate {
  // Implement OR logic for date filtering
  filterQuery = filterQuery.gte("start_date", value: fromDate)
}

if let toDate = toDate {
  filterQuery = filterQuery.lte("start_date", value: toDate)
}

let response: [Event] = try await filterQuery
  .order("start_date", ascending: true)
  .order("name", ascending: true)
  .execute()
  .value
```

**Routes**:
```typescript
// TypeScript
let query = supabase
  .from('routes')
  .select('*')
  .is('deleted_at', null)

if (searchTerm) {
  query = query.ilike('name', `%${searchTerm}%`)
}

query = query
  .order('sort_order', { ascending: true })
  .order('name', { ascending: true })
```

```swift
// Swift
var filterQuery = client
  .from("routes")
  .select()
  .is("deleted_at", value: nil)

if let searchTerm = searchTerm, !searchTerm.isEmpty {
  filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
}

let response: [Route] = try await filterQuery
  .order("sort_order", ascending: true)
  .order("name", ascending: true)
  .execute()
  .value
```

---

## Save Operations

### Create Pattern

**Contract**: Insert a new record and return the created record.

**Locations**:
```typescript
// TypeScript
const { data, error } = await supabase
  .from('locations')
  .insert({
    name: location.name,
    slug: location.slug || slugify(location.name),
    region: location.region,
    short_description: location.short_description,
    website_url: location.website_url ? normalizeUrl(location.website_url) : null,
    status: location.status || 'draft',
    sort_order: location.sort_order,
    created_by: userId
  })
  .select()
  .single()
```

```swift
// Swift
let insertData = LocationInsertData(
  name: location.name,
  slug: location.slug ?? slugify(location.name),
  region: location.region,
  short_description: location.shortDescription,
  website_url: location.websiteUrl.map { normalizeUrl($0) },
  status: location.status.rawValue,
  sort_order: location.sortOrder,
  created_by: location.createdBy
)

let response: Location = try await client
  .from("locations")
  .insert(insertData)
  .select()
  .single()
  .execute()
  .value
```

### Update Pattern

**Contract**: Update an existing record and return the updated record.

**Locations**:
```typescript
// TypeScript
const { data, error } = await supabase
  .from('locations')
  .update({
    name: location.name,
    slug: location.slug || slugify(location.name),
    region: location.region,
    short_description: location.short_description,
    website_url: location.website_url ? normalizeUrl(location.website_url) : null,
    status: location.status,
    sort_order: location.sort_order
  })
  .eq('id', location.id)
  .select()
  .single()
```

```swift
// Swift
let updateData = LocationUpdateData(
  name: location.name,
  slug: location.slug ?? slugify(location.name),
  region: location.region,
  short_description: location.shortDescription,
  website_url: location.websiteUrl.map { normalizeUrl($0) },
  status: location.status.rawValue,
  sort_order: location.sortOrder
)

let response: Location = try await client
  .from("locations")
  .update(updateData)
  .eq("id", value: location.id)
  .select()
  .single()
  .execute()
  .value
```

### Upsert Pattern (Create or Update)

**Contract**: Determine if record exists (has ID), then create or update accordingly.

**Rule**: 
- If `id` is empty/null or doesn't exist in DB → Create
- If `id` exists → Update

---

## Delete Operations

### Soft Delete Pattern

**Contract**: Never physically delete records. Set `deleted_at` timestamp instead.

```typescript
// TypeScript
const { error } = await supabase
  .from('locations')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', id)
```

```swift
// Swift
try await client
  .from("locations")
  .update(["deleted_at": ISO8601DateFormatter().string(from: Date())])
  .eq("id", value: id)
  .execute()
```

**Rule**: Always use ISO 8601 format for timestamps.

---

## Filtering Patterns

### Search Filter

**Contract**: Case-insensitive partial match on name field.

```typescript
// TypeScript
if (searchTerm?.trim()) {
  query = query.ilike('name', `%${searchTerm}%`)
}
```

```swift
// Swift
if let searchTerm = searchTerm, !searchTerm.isEmpty {
  filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
}
```

**Rule**: Only apply if search term is non-empty after trimming.

### Date Range Filter

**Contract**: Filter events by date range.

**From Date** (inclusive):
- Include events where `start_date >= from` OR `end_date >= from`
- Also include events with no dates (undated events)

**To Date** (inclusive):
- Include events where `start_date <= to`

```typescript
// TypeScript
if (from) {
  query = query.or(`start_date.gte.${from},end_date.gte.${from},and(start_date.is.null,end_date.is.null)`)
}
if (to) {
  query = query.lte('start_date', to)
}
```

### Status Filter

**Contract**: Filter by status value.

```typescript
// TypeScript
if (status) {
  query = query.eq('status', status)
}
```

```swift
// Swift
if let status = status {
  filterQuery = filterQuery.eq("status", value: status)
}
```

---

## Sorting Patterns

### Standard Sorting

**Contract**: Primary sort by `sort_order`, secondary sort by `name` or `start_date`.

**Locations/Routes**:
```typescript
// TypeScript
query = query
  .order('sort_order', { ascending: true })
  .order('name', { ascending: true })
```

```swift
// Swift
query = query
  .order("sort_order", ascending: true)
  .order("name", ascending: true)
```

**Events**:
```typescript
// TypeScript
query = query
  .order('sort_order', { ascending: true })
  .order('start_date', { ascending: true })
```

```swift
// Swift
query = query
  .order("sort_order", ascending: true)
  .order("start_date", ascending: true)
```

**Rule**: Always sort by `sort_order` first, then by a meaningful field (name or date).

---

## Error Handling

### Standard Error Handling Pattern

**Contract**: Handle errors consistently across platforms.

**TypeScript**:
```typescript
try {
  const { data, error } = await query
  if (error) throw error
  return data
} catch (error) {
  console.error('Query failed:', error)
  throw error
}
```

**Swift**:
```swift
do {
  let response: [Location] = try await query.execute().value
  return response
} catch {
  print("Error loading locations: \(error)")
  throw error
}
```

**Rules**:
1. Always check for errors
2. Log errors with context
3. Re-throw errors to allow caller to handle
4. Provide user-friendly error messages in UI layer

### Common Error Scenarios

1. **Network Errors**: Handle timeout and connection failures
2. **Authentication Errors**: Redirect to login if session expired
3. **Validation Errors**: Display field-specific error messages
4. **Not Found Errors**: Handle missing records gracefully
5. **Permission Errors**: Show appropriate access denied message

---

## Query Builder Helpers

### Base Query Helper

**Contract**: Start all queries with non-deleted filter.

```typescript
// TypeScript
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
```

```swift
// Swift
func baseQuery(table: String, select: String = "*") -> PostgrestQueryBuilder {
  return client
    .from(table)
    .select(columns: select)
    .is("deleted_at", value: nil)
}
```

### Search Helper

**Contract**: Apply search filter if term provided.

```typescript
// TypeScript
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
```

```swift
// Swift
func withSearch(_ query: PostgrestQueryBuilder, searchTerm: String?, field: String = "name") -> PostgrestQueryBuilder {
  guard let searchTerm = searchTerm, !searchTerm.isEmpty else {
    return query
  }
  return query.ilike(field, pattern: "%\(searchTerm)%")
}
```

### Ordering Helper

**Contract**: Apply primary and optional secondary ordering.

```typescript
// TypeScript
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
```

---

## Pagination (Future)

**Contract**: For large datasets, implement pagination.

**Pattern** (to be implemented):
```typescript
// TypeScript
query = query
  .range(from, to)
  .limit(limit)
```

```swift
// Swift
query = query
  .range(from: from, to: to)
  .limit(count: limit)
```

**Default**: Currently fetch all records. Consider pagination for datasets > 1000 records.

---

## Testing Requirements

Both platforms must test:

- [ ] Fetch operations return non-deleted records only
- [ ] Search filter works case-insensitively
- [ ] Date range filters work correctly
- [ ] Sorting applies correctly (primary then secondary)
- [ ] Create operations return the created record
- [ ] Update operations return the updated record
- [ ] Soft delete sets `deleted_at` timestamp
- [ ] Error handling provides useful error messages

---

## Maintenance Notes

- When adding new query patterns, document them here
- Both platforms must implement the same patterns
- Review this document during API-related code reviews
- Update examples when patterns change

