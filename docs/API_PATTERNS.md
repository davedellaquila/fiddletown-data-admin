# API Query Patterns

This document provides detailed examples of API query patterns used in both the web (TypeScript) and iOS (Swift) applications. These patterns ensure consistent behavior across platforms.

## Table of Contents

1. [Fetch Patterns](#fetch-patterns)
2. [Save Patterns](#save-patterns)
3. [Delete Patterns](#delete-patterns)
4. [Filtering Patterns](#filtering-patterns)
5. [Error Handling Patterns](#error-handling-patterns)

---

## Fetch Patterns

### Standard List Fetch

**Use Case**: Fetch all non-deleted records with optional search.

**TypeScript**:
```typescript
import { baseQuery, withSearch, withOrdering } from '../shared/api/supabaseQueries'

async function fetchLocations(searchTerm?: string) {
  let query = baseQuery(supabase, 'locations')
  
  if (searchTerm) {
    query = withSearch(query, searchTerm, 'name')
  }
  
  query = withOrdering(
    query,
    { column: 'sort_order', ascending: true },
    { column: 'name', ascending: true }
  )
  
  const { data, error } = await query
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func fetchLocations(searchTerm: String? = nil) async throws -> [Location] {
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
    
    return response
}
```

### Fetch with Date Range Filter

**Use Case**: Fetch events within a date range.

**TypeScript**:
```typescript
async function fetchEvents(fromDate?: string, toDate?: string) {
  let query = baseQuery(supabase, 'events')
  
  // From date: include events starting on/after date OR ending on/after date
  if (fromDate) {
    query = query.or(
      `start_date.gte.${fromDate},end_date.gte.${fromDate},and(start_date.is.null,end_date.is.null)`
    )
  }
  
  // To date: only include events starting on/before date
  if (toDate) {
    query = query.lte('start_date', toDate)
  }
  
  query = withOrdering(
    query,
    { column: 'sort_order', ascending: true },
    { column: 'start_date', ascending: true }
  )
  
  const { data, error } = await query
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func fetchEvents(fromDate: String? = nil, toDate: String? = nil) async throws -> [Event] {
    var filterQuery = client
        .from("events")
        .select()
        .is("deleted_at", value: nil)
    
    if let fromDate = fromDate {
        // Note: OR logic may need to be implemented differently in Swift SDK
        filterQuery = filterQuery.gte("start_date", value: fromDate)
    }
    
    if let toDate = toDate {
        filterQuery = filterQuery.lte("start_date", value: toDate)
    }
    
    let response: [Event] = try await filterQuery
        .order("sort_order", ascending: true)
        .order("start_date", ascending: true)
        .execute()
        .value
    
    return response
}
```

### Fetch Single Record

**Use Case**: Fetch a single record by ID.

**TypeScript**:
```typescript
async function fetchLocationById(id: string) {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func fetchLocationById(id: String) async throws -> Location {
    let response: Location = try await client
        .from("locations")
        .select()
        .eq("id", value: id)
        .is("deleted_at", value: nil)
        .single()
        .execute()
        .value
    
    return response
}
```

---

## Save Patterns

### Create New Record

**Use Case**: Insert a new record with auto-generated fields.

**TypeScript**:
```typescript
import { slugify } from '../shared/utils/slugify'
import { normalizeUrl } from '../shared/utils/urlUtils'

async function createLocation(location: Partial<Location>, userId: string) {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name: location.name!,
      slug: location.slug || slugify(location.name!),
      region: location.region || null,
      short_description: location.short_description || null,
      website_url: location.website_url ? normalizeUrl(location.website_url) : null,
      status: location.status || 'draft',
      sort_order: location.sort_order || null,
      created_by: userId
    })
    .select()
    .single()
  
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func createLocation(_ location: Location, userId: String) async throws -> Location {
    let insertData = LocationInsertData(
        name: location.name,
        slug: location.slug ?? slugify(location.name),
        region: location.region,
        short_description: location.shortDescription,
        website_url: location.websiteUrl.map { normalizeUrl($0) },
        status: location.status.rawValue,
        sort_order: location.sortOrder,
        created_by: userId
    )
    
    let response: Location = try await client
        .from("locations")
        .insert(insertData)
        .select()
        .single()
        .execute()
        .value
    
    return response
}
```

### Update Existing Record

**Use Case**: Update an existing record.

**TypeScript**:
```typescript
async function updateLocation(location: Location) {
  const { data, error } = await supabase
    .from('locations')
    .update({
      name: location.name,
      slug: location.slug || slugify(location.name),
      region: location.region || null,
      short_description: location.short_description || null,
      website_url: location.website_url ? normalizeUrl(location.website_url) : null,
      status: location.status,
      sort_order: location.sort_order || null
    })
    .eq('id', location.id)
    .select()
    .single()
  
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func updateLocation(_ location: Location) async throws -> Location {
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
    
    return response
}
```

### Upsert Pattern (Create or Update)

**Use Case**: Create if new, update if exists.

**TypeScript**:
```typescript
async function saveLocation(location: Location, userId: string) {
  if (location.id && location.id.trim() !== '') {
    // Update existing
    return updateLocation(location)
  } else {
    // Create new
    return createLocation(location, userId)
  }
}
```

**Swift**:
```swift
func saveLocation(_ location: Location, userId: String) async throws -> Location {
    if !location.id.isEmpty {
        // Update existing
        return try await updateLocation(location)
    } else {
        // Create new
        return try await createLocation(location, userId: userId)
    }
}
```

---

## Delete Patterns

### Soft Delete

**Use Case**: Mark a record as deleted without removing it.

**TypeScript**:
```typescript
import { softDelete } from '../shared/api/supabaseQueries'

async function deleteLocation(id: string) {
  const { error } = await softDelete(supabase, 'locations', id)
  if (error) throw error
}
```

**Swift**:
```swift
func deleteLocation(id: String) async throws {
    try await client
        .from("locations")
        .update(["deleted_at": ISO8601DateFormatter().string(from: Date())])
        .eq("id", value: id)
        .execute()
}
```

---

## Filtering Patterns

### Multiple Filters Combined

**Use Case**: Apply multiple filters to a query.

**TypeScript**:
```typescript
async function fetchFilteredLocations(
  searchTerm?: string,
  status?: string,
  region?: string
) {
  let query = baseQuery(supabase, 'locations')
  
  if (searchTerm) {
    query = withSearch(query, searchTerm, 'name')
  }
  
  if (status) {
    query = withStatus(query, status)
  }
  
  if (region) {
    query = query.eq('region', region)
  }
  
  query = withOrdering(
    query,
    { column: 'sort_order', ascending: true },
    { column: 'name', ascending: true }
  )
  
  const { data, error } = await query
  if (error) throw error
  return data
}
```

**Swift**:
```swift
func fetchFilteredLocations(
    searchTerm: String? = nil,
    status: String? = nil,
    region: String? = nil
) async throws -> [Location] {
    var filterQuery = client
        .from("locations")
        .select()
        .is("deleted_at", value: nil)
    
    if let searchTerm = searchTerm, !searchTerm.isEmpty {
        filterQuery = filterQuery.ilike("name", pattern: "%\(searchTerm)%")
    }
    
    if let status = status {
        filterQuery = filterQuery.eq("status", value: status)
    }
    
    if let region = region {
        filterQuery = filterQuery.eq("region", value: region)
    }
    
    let response: [Location] = try await filterQuery
        .order("sort_order", ascending: true)
        .order("name", ascending: true)
        .execute()
        .value
    
    return response
}
```

---

## Error Handling Patterns

### Standard Error Handling

**Use Case**: Consistent error handling across all queries.

**TypeScript**:
```typescript
async function fetchLocationsSafely(searchTerm?: string) {
  try {
    const locations = await fetchLocations(searchTerm)
    return { data: locations, error: null }
  } catch (error: any) {
    console.error('Failed to fetch locations:', error)
    return { 
      data: null, 
      error: error.message || 'Failed to fetch locations' 
    }
  }
}
```

**Swift**:
```swift
func fetchLocationsSafely(searchTerm: String? = nil) async -> (data: [Location]?, error: String?) {
    do {
        let locations = try await fetchLocations(searchTerm: searchTerm)
        return (locations, nil)
    } catch {
        print("Error loading locations: \(error)")
        return (nil, "Failed to fetch locations: \(error.localizedDescription)")
    }
}
```

### Error Types

**Common Error Scenarios**:

1. **Network Errors**: Connection timeout, no internet
2. **Authentication Errors**: Session expired, invalid credentials
3. **Validation Errors**: Invalid data format, missing required fields
4. **Not Found Errors**: Record doesn't exist or was deleted
5. **Permission Errors**: Insufficient access rights

**Handling Strategy**:
- Log errors with context
- Return user-friendly error messages
- Handle authentication errors by redirecting to login
- Validate data before sending to API

---

## Best Practices

1. **Always filter deleted records**: Use `baseQuery` or `.is('deleted_at', null)`
2. **Use helpers for common patterns**: Leverage `withSearch`, `withOrdering`, etc.
3. **Handle errors consistently**: Use try/catch and return meaningful errors
4. **Validate before saving**: Check required fields and data types
5. **Use transactions for related operations**: When updating multiple related records
6. **Cache when appropriate**: Store frequently accessed data locally
7. **Paginate large datasets**: Use range/limit for datasets > 1000 records

---

## Testing Patterns

### Unit Test Example

**TypeScript**:
```typescript
describe('fetchLocations', () => {
  it('should exclude deleted records', async () => {
    const locations = await fetchLocations()
    expect(locations.every(loc => loc.deleted_at === null)).toBe(true)
  })
  
  it('should filter by search term', async () => {
    const locations = await fetchLocations('winery')
    expect(locations.every(loc => 
      loc.name.toLowerCase().includes('winery')
    )).toBe(true)
  })
})
```

**Swift**:
```swift
func testFetchLocationsExcludesDeleted() async throws {
    let locations = try await fetchLocations()
    XCTAssertTrue(locations.allSatisfy { $0.deletedAt == nil })
}

func testFetchLocationsFiltersBySearchTerm() async throws {
    let locations = try await fetchLocations(searchTerm: "winery")
    XCTAssertTrue(locations.allSatisfy { 
        $0.name.lowercased().contains("winery") 
    })
}
```

---

## Maintenance Notes

- When adding new query patterns, document them here
- Both platforms must implement the same patterns
- Update examples when patterns change
- Review this document during API-related code reviews

