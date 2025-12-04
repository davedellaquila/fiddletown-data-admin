# Type Synchronization Guide

This guide documents how to keep Swift models synchronized with TypeScript types, which serve as the source of truth.

## Table of Contents

1. [Overview](#overview)
2. [Field Mapping Rules](#field-mapping-rules)
3. [Type Mapping](#type-mapping)
4. [Enum Mapping](#enum-mapping)
5. [Sync Checklist](#sync-checklist)
6. [Examples](#examples)

---

## Overview

**Source of Truth**: `web/shared/types/models.ts` (TypeScript)

**Target**: `ios/SSA-Admin/Shared/Models/DataModels.swift` (Swift)

**Process**: When TypeScript types change, manually update Swift models to match.

---

## Field Mapping Rules

### Naming Convention

- **TypeScript**: Uses `snake_case` for database fields
- **Swift**: Uses `camelCase` for properties, maps to `snake_case` via `CodingKeys`

### Mapping Pattern

```typescript
// TypeScript
export interface Location {
  id: string
  name: string
  short_description: string | null
  website_url: string | null
  created_at: string
  updated_at: string
}
```

```swift
// Swift
struct Location: Identifiable, Codable {
    let id: String
    var name: String
    var shortDescription: String?  // snake_case → camelCase
    var websiteUrl: String?         // snake_case → camelCase
    var createdAt: String           // snake_case → camelCase
    var updatedAt: String            // snake_case → camelCase
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case shortDescription = "short_description"  // Map to snake_case
        case websiteUrl = "website_url"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}
```

---

## Type Mapping

### Primitive Types

| TypeScript | Swift | Notes |
|------------|-------|-------|
| `string` | `String` | Direct mapping |
| `number` | `Int` or `Double` | Use `Int` for integers, `Double` for decimals |
| `boolean` | `Bool` | Direct mapping |
| `null` | `nil` | Use optional types (`Type?`) |

### Optional Types

| TypeScript | Swift |
|------------|-------|
| `string \| null` | `String?` |
| `number \| null` | `Int?` or `Double?` |
| `string \| undefined` | `String?` |

### Array Types

| TypeScript | Swift |
|------------|-------|
| `string[]` | `[String]` |
| `number[]` | `[Int]` or `[Double]` |

### Special Cases

- **ID Fields**: Always `String` in Swift (even if number in TypeScript)
- **Timestamps**: Always `String` (ISO 8601 format)
- **Dates**: Store as `String` (ISO date format: YYYY-MM-DD)
- **Times**: Store as `String` (HH:MM format)

---

## Enum Mapping

### Status Enum

**TypeScript**:
```typescript
export type Status = 'draft' | 'published' | 'archived'
```

**Swift**:
```swift
enum Status: String, Codable, CaseIterable {
    case draft = "draft"
    case published = "published"
    case archived = "archived"
    
    var displayName: String {
        switch self {
        case .draft: return "📝 Draft"
        case .published: return "✅ Published"
        case .archived: return "📦 Archived"
        }
    }
}
```

**Rules**:
1. Enum raw values must match TypeScript string literals exactly
2. Add `Codable` conformance for JSON encoding/decoding
3. Add `CaseIterable` for iteration support
4. Optionally add computed properties for display names

### Difficulty Enum

**TypeScript**:
```typescript
export type Difficulty = 'easy' | 'moderate' | 'challenging'
```

**Swift**:
```swift
enum Difficulty: String, Codable, CaseIterable {
    case easy = "easy"
    case moderate = "moderate"
    case challenging = "challenging"
    
    var displayName: String {
        switch self {
        case .easy: return "🟢 Easy"
        case .moderate: return "🟡 Moderate"
        case .challenging: return "🔴 Challenging"
        }
    }
}
```

---

## Sync Checklist

When TypeScript types change, follow this checklist:

### 1. Review Changes

- [ ] Read the updated TypeScript type definition
- [ ] Identify new fields, removed fields, or changed types
- [ ] Check for new enums or enum value changes

### 2. Update Swift Model

- [ ] Add/remove/update properties in Swift struct
- [ ] Update `CodingKeys` enum to map snake_case ↔ camelCase
- [ ] Ensure optional types match (`Type?` for nullable fields)
- [ ] Update enum definitions if needed

### 3. Update Service Layer

- [ ] Check `SupabaseService.swift` for affected methods
- [ ] Update insert/update data structures if fields changed
- [ ] Update query select statements if fields changed

### 4. Update Views/Components

- [ ] Check feature views (LocationsView, EventsView, etc.)
- [ ] Update form fields if new fields added
- [ ] Update display logic if field types changed

### 5. Test

- [ ] Test create operation with new/updated fields
- [ ] Test update operation
- [ ] Test fetch operation returns all fields
- [ ] Verify JSON encoding/decoding works correctly

---

## Examples

### Example 1: Adding a New Field

**TypeScript Change**:
```typescript
export interface Location {
  // ... existing fields
  phone_number: string | null  // NEW FIELD
}
```

**Swift Update**:
```swift
struct Location: Identifiable, Codable {
    // ... existing fields
    var phoneNumber: String?  // NEW FIELD
    
    enum CodingKeys: String, CodingKey {
        // ... existing cases
        case phoneNumber = "phone_number"  // NEW CASE
    }
}
```

**Service Layer Update**:
```swift
struct LocationInsertData: Encodable {
    // ... existing fields
    let phone_number: String?  // NEW FIELD
}
```

### Example 2: Changing Field Type

**TypeScript Change**:
```typescript
export interface Location {
  // ... existing fields
  sort_order: number  // Changed from number | null
}
```

**Swift Update**:
```swift
struct Location: Identifiable, Codable {
    // ... existing fields
    var sortOrder: Int  // Changed from Int? to Int
    
    enum CodingKeys: String, CodingKey {
        // ... existing cases
        case sortOrder = "sort_order"
    }
}
```

### Example 3: Adding Enum Value

**TypeScript Change**:
```typescript
export type Status = 'draft' | 'published' | 'archived' | 'scheduled'  // NEW VALUE
```

**Swift Update**:
```swift
enum Status: String, Codable, CaseIterable {
    case draft = "draft"
    case published = "published"
    case archived = "archived"
    case scheduled = "scheduled"  // NEW CASE
    
    var displayName: String {
        switch self {
        case .draft: return "📝 Draft"
        case .published: return "✅ Published"
        case .archived: return "📦 Archived"
        case .scheduled: return "📅 Scheduled"  // NEW CASE
        }
    }
}
```

---

## Field Reference

### Location Model

| TypeScript Field | Swift Property | Type | Optional |
|------------------|----------------|------|----------|
| `id` | `id` | `String` | No |
| `name` | `name` | `String` | No |
| `slug` | `slug` | `String?` | Yes |
| `region` | `region` | `String?` | Yes |
| `short_description` | `shortDescription` | `String?` | Yes |
| `website_url` | `websiteUrl` | `String?` | Yes |
| `status` | `status` | `Status` | No |
| `sort_order` | `sortOrder` | `Int?` | Yes |
| `created_by` | `createdBy` | `String?` | Yes |
| `created_at` | `createdAt` | `String` | No |
| `updated_at` | `updatedAt` | `String` | No |
| `deleted_at` | `deletedAt` | `String?` | Yes |

### Event Model

| TypeScript Field | Swift Property | Type | Optional |
|------------------|----------------|------|----------|
| `id` | `id` | `String?` | Yes |
| `name` | `name` | `String` | No |
| `slug` | `slug` | `String?` | Yes |
| `description` | `description` | `String?` | Yes |
| `host_org` | `hostOrg` | `String?` | Yes |
| `start_date` | `startDate` | `String?` | Yes |
| `end_date` | `endDate` | `String?` | Yes |
| `start_time` | `startTime` | `String?` | Yes |
| `end_time` | `endTime` | `String?` | Yes |
| `location` | `location` | `String?` | Yes |
| `recurrence` | `recurrence` | `String?` | Yes |
| `website_url` | `websiteUrl` | `String?` | Yes |
| `image_url` | `imageUrl` | `String?` | Yes |
| `ocr_text` | `ocrText` | `String?` | Yes |
| `status` | `status` | `String?` | Yes |
| `sort_order` | `sortOrder` | `Int?` | Yes |
| `created_by` | `createdBy` | `String?` | Yes |
| `created_at` | `createdAt` | `String?` | Yes |
| `updated_at` | `updatedAt` | `String?` | Yes |
| `deleted_at` | `deletedAt` | `String?` | Yes |
| `keywords` | `keywords` | `[String]?` | Yes |

### Route Model

| TypeScript Field | Swift Property | Type | Optional |
|------------------|----------------|------|----------|
| `id` | `id` | `String` | No |
| `name` | `name` | `String` | No |
| `slug` | `slug` | `String?` | Yes |
| `gpx_url` | `gpxUrl` | `String?` | Yes |
| `duration_minutes` | `durationMinutes` | `Int?` | Yes |
| `start_point` | `startPoint` | `String?` | Yes |
| `end_point` | `endPoint` | `String?` | Yes |
| `difficulty` | `difficulty` | `Difficulty?` | Yes |
| `notes` | `notes` | `String?` | Yes |
| `status` | `status` | `Status` | No |
| `sort_order` | `sortOrder` | `Int?` | Yes |
| `created_by` | `createdBy` | `String?` | Yes |
| `created_at` | `createdAt` | `String` | No |
| `updated_at` | `updatedAt` | `String` | No |
| `deleted_at` | `deletedAt` | `String?` | Yes |

---

## Common Pitfalls

1. **Forgetting CodingKeys**: Always update `CodingKeys` enum when adding fields
2. **Optional Mismatch**: Ensure `Type?` in Swift matches `Type | null` in TypeScript
3. **Enum Raw Values**: Must match exactly (case-sensitive)
4. **Array Types**: Use `[Type]` not `Array<Type>` in Swift
5. **ID Types**: Always `String` in Swift, even if number in database

---

## Maintenance Notes

- Review this guide when syncing types
- Update field reference tables when types change
- Add examples for new patterns discovered
- Keep CodingKeys mapping clear and consistent

