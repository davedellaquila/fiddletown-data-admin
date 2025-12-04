# Model Synchronization Guide

This guide provides step-by-step instructions for keeping Swift models synchronized with TypeScript types.

## Source of Truth

**TypeScript Types**: `web/shared/types/models.ts`  
**Swift Models**: `ios/SSA-Admin/Shared/Models/DataModels.swift`

## Quick Reference

See `docs/TYPE_SYNC.md` for complete type synchronization documentation.

## Sync Process

### Step 1: Review TypeScript Changes

1. Open `web/shared/types/models.ts`
2. Identify what changed:
   - New fields added?
   - Fields removed?
   - Field types changed?
   - New enums or enum values?

### Step 2: Update Swift Model

1. Open `ios/SSA-Admin/Shared/Models/DataModels.swift`
2. Update the struct definition:
   - Add/remove/update properties
   - Ensure optional types match (`Type?` for nullable fields)
   - Update property names to camelCase

3. Update `CodingKeys` enum:
   - Add/remove/update cases
   - Map camelCase properties to snake_case database fields

### Step 3: Update Service Layer

1. Check `ios/SSA-Admin/Shared/Services/SupabaseService.swift`
2. Update insert/update data structures:
   - `LocationInsertData`
   - `LocationUpdateData`
   - `EventInsertData` (if exists)
   - `RouteInsertData` (if exists)

3. Update query select statements if fields changed

### Step 4: Update Views

1. Check feature views:
   - `LocationsView.swift`
   - `EventsView.swift`
   - `RoutesView.swift`

2. Update form fields if new fields added
3. Update display logic if field types changed

### Step 5: Test

- [ ] Test create operation with new/updated fields
- [ ] Test update operation
- [ ] Test fetch operation returns all fields
- [ ] Verify JSON encoding/decoding works correctly

## Field Mapping Reference

### Location Model

| TypeScript | Swift Property | CodingKey |
|------------|----------------|-----------|
| `id` | `id` | `id` |
| `name` | `name` | `name` |
| `slug` | `slug` | `slug` |
| `region` | `region` | `region` |
| `short_description` | `shortDescription` | `short_description` |
| `website_url` | `websiteUrl` | `website_url` |
| `status` | `status` | `status` |
| `sort_order` | `sortOrder` | `sort_order` |
| `created_by` | `createdBy` | `created_by` |
| `created_at` | `createdAt` | `created_at` |
| `updated_at` | `updatedAt` | `updated_at` |
| `deleted_at` | `deletedAt` | `deleted_at` |

### Event Model

| TypeScript | Swift Property | CodingKey |
|------------|----------------|-----------|
| `id` | `id` | `id` |
| `name` | `name` | `name` |
| `slug` | `slug` | `slug` |
| `description` | `description` | `description` |
| `host_org` | `hostOrg` | `host_org` |
| `start_date` | `startDate` | `start_date` |
| `end_date` | `endDate` | `end_date` |
| `start_time` | `startTime` | `start_time` |
| `end_time` | `endTime` | `end_time` |
| `location` | `location` | `location` |
| `recurrence` | `recurrence` | `recurrence` |
| `website_url` | `websiteUrl` | `website_url` |
| `image_url` | `imageUrl` | `image_url` |
| `ocr_text` | `ocrText` | `ocr_text` |
| `status` | `status` | `status` |
| `sort_order` | `sortOrder` | `sort_order` |
| `created_by` | `createdBy` | `created_by` |
| `created_at` | `createdAt` | `created_at` |
| `updated_at` | `updatedAt` | `updated_at` |
| `deleted_at` | `deletedAt` | `deleted_at` |
| `keywords` | `keywords` | `keywords` |

### Route Model

| TypeScript | Swift Property | CodingKey |
|------------|----------------|-----------|
| `id` | `id` | `id` |
| `name` | `name` | `name` |
| `slug` | `slug` | `slug` |
| `gpx_url` | `gpxUrl` | `gpx_url` |
| `duration_minutes` | `durationMinutes` | `duration_minutes` |
| `start_point` | `startPoint` | `start_point` |
| `end_point` | `endPoint` | `end_point` |
| `difficulty` | `difficulty` | `difficulty` |
| `notes` | `notes` | `notes` |
| `status` | `status` | `status` |
| `sort_order` | `sortOrder` | `sort_order` |
| `created_by` | `createdBy` | `created_by` |
| `created_at` | `createdAt` | `created_at` |
| `updated_at` | `updatedAt` | `updated_at` |
| `deleted_at` | `deletedAt` | `deleted_at` |

## Enum Mapping

### Status Enum

**TypeScript**: `'draft' | 'published' | 'archived'`  
**Swift**: `enum Status: String` with cases `draft`, `published`, `archived`

### Difficulty Enum

**TypeScript**: `'easy' | 'moderate' | 'challenging'`  
**Swift**: `enum Difficulty: String` with cases `easy`, `moderate`, `challenging`

## Common Pitfalls

1. **Forgetting CodingKeys**: Always update `CodingKeys` enum when adding fields
2. **Optional Mismatch**: Ensure `Type?` in Swift matches `Type | null` in TypeScript
3. **Enum Raw Values**: Must match exactly (case-sensitive)
4. **ID Types**: Always `String` in Swift, even if number in database

## See Also

- `docs/TYPE_SYNC.md` - Complete type synchronization guide
- `docs/SHARED_LOGIC.md` - Business logic contracts
- `docs/API_CONTRACTS.md` - API query patterns

