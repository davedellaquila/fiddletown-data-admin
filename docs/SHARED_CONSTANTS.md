# Shared Constants Reference

This document lists all shared constants used across both web and iOS applications.

## Status Constants

### Status Values

**TypeScript**: `web/shared/constants/index.ts`  
**Swift**: `ios/SSA-Admin/Shared/Constants/AppConstants.swift`

```typescript
export const STATUS_VALUES = ['draft', 'published', 'archived']
```

```swift
static let statusValues = ["draft", "published", "archived"]
```

**Values**:
- `"draft"` - Work in progress, not visible to public
- `"published"` - Live and visible to public
- `"archived"` - No longer active, historical record

### Default Status

```typescript
export const DEFAULT_STATUS = 'draft'
```

```swift
static let defaultStatus = "draft"
```

## Difficulty Constants

### Difficulty Values

**TypeScript**: `web/shared/constants/index.ts`  
**Swift**: `ios/SSA-Admin/Shared/Constants/AppConstants.swift`

```typescript
export const DIFFICULTY_VALUES = ['easy', 'moderate', 'challenging']
```

```swift
static let difficultyValues = ["easy", "moderate", "challenging"]
```

**Values**:
- `"easy"` - Suitable for beginners
- `"moderate"` - Requires some experience
- `"challenging"` - Requires advanced skills

## Table Names

### Database Table Names

**TypeScript**: `web/shared/constants/index.ts`  
**Swift**: `ios/SSA-Admin/Shared/Constants/AppConstants.swift`

```typescript
export const TABLES = {
  locations: 'locations',
  events: 'events',
  routes: 'routes',
  keywords: 'keywords'
}
```

```swift
static let tables = [
    "locations": "locations",
    "events": "events",
    "routes": "routes",
    "keywords": "keywords"
]
```

## Validation Constants

### Maximum Field Lengths

**TypeScript**: `web/shared/constants/index.ts`  
**Swift**: `ios/SSA-Admin/Shared/Constants/AppConstants.swift`

```typescript
export const MAX_LENGTHS = {
  name: 255,
  slug: 255,
  description: 5000,
  shortDescription: 500
}
```

```swift
static let maxLengths = [
    "name": 255,
    "slug": 255,
    "description": 5000,
    "shortDescription": 500
]
```

### Default Sort Order

```typescript
export const DEFAULT_SORT_ORDER = 0
```

```swift
static let defaultSortOrder = 0
```

## Sync Process

When updating constants:

1. Update TypeScript constants in `web/shared/constants/index.ts`
2. Update Swift constants in `ios/SSA-Admin/Shared/Constants/AppConstants.swift`
3. Ensure values match exactly (case-sensitive)
4. Update this documentation if adding new constants

## See Also

- `web/shared/constants/index.ts` - TypeScript constants
- `ios/SSA-Admin/Shared/Constants/AppConstants.swift` - Swift constants

