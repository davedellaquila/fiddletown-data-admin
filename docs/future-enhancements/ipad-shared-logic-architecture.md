# iPad App with Shared Logic Architecture

| Field | Value |
|-------|-------|
| **ID** | FE-003 |
| **Status** | Specced — foundation complete |
| **Priority** | After Event Triage M1 |
| **Effort** | Large (parity sprint + ongoing sync) |
| **Platforms** | iOS (iPad) + shared web/iOS contracts |
| **Product area** | Platform / cross-platform parity |
| **Created** | 2026-06-15 (imported) |
| **Original source** | `~/.cursor/plans/ipad_app_with_shared_logic_architecture_0e209820.plan.md` |

---

## Summary

Establish and extend a **shared logic architecture** so SSA Admin web and iPad stay in sync: TypeScript types as source of truth, documented business logic contracts, mirrored Swift utilities, and feature parity across Locations, Events, and Routes.

**Much of the foundation already shipped** — see [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md). This enhancement tracks **remaining iPad parity work** and ongoing maintenance of the shared architecture as new web features land (e.g. Event Triage).

---

## Implementation status (plan vs repo)

| Plan item | Status | Notes |
|-----------|--------|-------|
| Shared docs (SHARED_LOGIC, API_*, TYPE_SYNC, etc.) | ✅ Done | See IMPLEMENTATION_SUMMARY |
| TypeScript types + JSDoc + `types/index.ts` | ✅ Done | |
| Utility docs + urlUtils, slugify, dateUtils | ✅ Done | |
| API patterns + supabaseQueries | ✅ Done | |
| `validate-types.ts` + DEVELOPMENT_WORKFLOW | ✅ Done | |
| Swift models, utils, constants | ✅ Done | DataModels, DateUtils, StringUtils, URLUtils, AppConstants |
| iPad navigation (ContentView) | ✅ Done | |
| Locations iPad CRUD | ✅ Done | Basic list/edit |
| Events iPad (list, filters, edit) | ⚠️ Partial | Missing keywords, OCR, image upload, bulk/import/export |
| Routes iPad | ⚠️ Partial | Missing GPX handling, visualization |
| OCR Test feature | ✅ Done | OCRTestView exists |
| QueryBuilders.swift | ❌ Not built | Plan item; SupabaseService used instead |
| Shared Swift components (FormField, ActionMenu, AutoSaveDialog) | ❌ Not built | |
| iOS parity with new web features | ❌ Ongoing | Event Triage M1 is web-only initially |

---

## Remaining work (future sprint)

From plan + [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) next steps:

- [ ] Complete `saveEvent` / `saveRoute`, `deleteEvent` / `deleteRoute` in SupabaseService
- [ ] Events: keyword UI, OCR parsing, image upload on iPad
- [ ] Routes: GPX file handling, route visualization
- [ ] Bulk actions, import/export parity with web (per UX assessment)
- [ ] Enhance `validate-types.ts` parsing
- [ ] Cross-platform unit tests for shared utilities
- [ ] Standardize error handling patterns
- [ ] Optional: offline support, pagination on iPad
- [ ] Sync each new web feature (e.g. Event Triage when iOS scope approved)

---

## Promotion criteria

- [ ] Event Triage M1 shipped on web (D-008)
- [ ] PM defines iPad parity M1 scope (which gaps first)
- [ ] Dev sizes parity sprint vs per-feature iOS follow-up

---

## Relationship to other docs

- **Living architecture** (already in repo): `docs/DEVELOPMENT_WORKFLOW.md`, `docs/TYPE_SYNC.md`, `.cursorrules`
- **Historical completion record**: [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
- **iOS gaps**: [platform-ux-assessment.md](../backlog/platform-ux-assessment.md) § P2

---

# iPad App with Shared Logic Architecture

## Overview

Create an iPad version of the SSA Admin application with a shared logic architecture that ensures both web and iOS apps benefit from changes. The plan establishes TypeScript as the source of truth, creates clear documentation contracts for shared logic, and sets up a maintainable structure.

## Architecture Principles

1. **TypeScript as Source of Truth**: Type definitions in `web/shared/types/models.ts` are the canonical source
2. **Documentation Contracts**: Shared business logic documented as contracts that both platforms must follow
3. **Consistent Patterns**: API queries, utilities, and business logic follow documented patterns
4. **Sync Process**: Clear process for keeping Swift implementations in sync with TypeScript

## Implementation Steps

### 1. Create Shared Documentation System

**File**: `docs/SHARED_LOGIC.md`

- Document all shared business logic as contracts
- Include validation rules, transformation logic, and business rules
- Examples: slug generation, date formatting, URL normalization, status transitions

**File**: `docs/API_CONTRACTS.md`

- Document Supabase query patterns
- Standardize fetch, save, delete operations
- Document filtering, sorting, and pagination patterns
- Include examples for both TypeScript and Swift

**File**: `docs/TYPE_SYNC.md`

- Document the mapping between TypeScript types and Swift models
- Include field mappings (snake_case ↔ camelCase)
- Document enum mappings
- Provide sync checklist

### 2. Enhance Shared Types Structure

**File**: `web/shared/types/models.ts`

- Add JSDoc comments documenting business rules
- Add validation constraints as comments
- Document field relationships and dependencies
- Add examples and edge cases

**File**: `web/shared/types/index.ts` (new)

- Export all types from a single entry point
- Add type guards and validation helpers
- Include shared constants (status values, difficulty levels, etc.)

### 3. Create Shared Utilities Documentation

**File**: `web/shared/utils/README.md`

- Document each utility function's contract
- Include input/output specifications
- Document edge cases and error handling
- Provide test cases that both platforms should pass

**Enhance existing utilities**:

- `web/shared/utils/dateUtils.ts` - Add comprehensive JSDoc
- `web/shared/utils/slugify.ts` - Add JSDoc with examples
- Create `web/shared/utils/urlUtils.ts` - Extract URL normalization logic

### 4. Enhance API Query Patterns

**File**: `web/shared/api/supabaseQueries.ts`

- Expand query builder utilities
- Add functions for common patterns (soft delete, status updates, etc.)
- Document query patterns in comments
- Create type-safe query builders

**File**: `docs/API_PATTERNS.md`

- Document standard query patterns
- Provide TypeScript and Swift examples side-by-side
- Document error handling patterns
- Include pagination and filtering strategies

### 5. Set Up iPad App Structure

**Directory Structure**:

```javascript
ios/SSA-Admin/
├── App/
│   ├── ContentView.swift (main navigation)
│   └── SSA_AdminApp.swift (app entry)
├── Features/
│   ├── Locations/
│   │   ├── LocationsView.swift
│   │   ├── LocationEditView.swift
│   │   └── LocationRow.swift
│   ├── Events/
│   │   ├── EventsView.swift
│   │   ├── EventEditView.swift
│   │   └── EventRow.swift
│   ├── Routes/
│   │   ├── RoutesView.swift
│   │   ├── RouteEditView.swift
│   │   └── RouteRow.swift
│   └── OCRTest/
│       └── OCRTestView.swift
├── Shared/
│   ├── Models/
│   │   ├── DataModels.swift (sync with TypeScript types)
│   │   └── README.md (sync instructions)
│   ├── Services/
│   │   ├── SupabaseService.swift (API layer)
│   │   └── QueryBuilders.swift (query pattern helpers)
│   ├── Utils/
│   │   ├── DateUtils.swift (sync with TypeScript)
│   │   ├── StringUtils.swift (slugify, etc.)
│   │   └── URLUtils.swift (URL normalization)
│   └── Components/
│       ├── FormField.swift
│       ├── ActionMenu.swift
│       └── AutoSaveDialog.swift
└── Auth/
    └── LoginView.swift
```

### 6. Create Sync Documentation

**File**: `ios/SSA-Admin/Shared/Models/README.md`

- Step-by-step sync process from TypeScript to Swift
- Field mapping reference
- Enum value mapping
- Testing checklist

**File**: `ios/SSA-Admin/Shared/Utils/README.md`

- Utility function sync process
- Test case requirements
- Edge case handling

### 7. Implement iPad App Features

**Priority Order**:

1. **Locations** (most complete in web)

- List view with search
- Create/Edit form
- Status management
- CSV import/export

1. **Events** (complex, but important)

- List view with filters
- Create/Edit form with OCR support
- Keyword management
- Date range filtering

1. **Routes** (simpler)

- List view
- Create/Edit form
- GPX file handling

1. **OCR Test** (utility feature)

- OCR processing
- Text parsing preview

### 8. Create Development Workflow Documentation

**File**: `docs/DEVELOPMENT_WORKFLOW.md`

- Process for adding new features
- How to update shared logic
- Testing requirements for both platforms
- Code review checklist

### 9. Set Up Type Validation

**File**: `scripts/validate-types.ts` (new)

- Script to validate TypeScript types have corresponding Swift models
- Check for missing fields
- Validate enum values match
- Generate sync report

### 10. Create Shared Constants

**File**: `web/shared/constants/index.ts` (new)

- Export all shared constants
- Status values, difficulty levels, etc.
- Document in `docs/SHARED_CONSTANTS.md`

**File**: `ios/SSA-Admin/Shared/Constants/AppConstants.swift` (new)

- Mirror constants from TypeScript
- Document sync process

## Key Files to Create/Modify

### Documentation

- `docs/SHARED_LOGIC.md` - Business logic contracts
- `docs/API_CONTRACTS.md` - API query patterns
- `docs/TYPE_SYNC.md` - Type synchronization guide
- `docs/API_PATTERNS.md` - Query pattern examples
- `docs/DEVELOPMENT_WORKFLOW.md` - Development process
- `docs/SHARED_CONSTANTS.md` - Constants reference

### TypeScript (Source of Truth)

- `web/shared/types/index.ts` - Type exports and helpers
- `web/shared/utils/urlUtils.ts` - URL utilities
- `web/shared/utils/README.md` - Utility documentation
- `web/shared/constants/index.ts` - Shared constants
- Enhance existing files with JSDoc comments

### Swift (iPad App)

- `ios/SSA-Admin/App/ContentView.swift` - Main navigation
- `ios/SSA-Admin/Features/*/` - Feature views (4 features)
- `ios/SSA-Admin/Shared/Services/QueryBuilders.swift` - Query helpers
- `ios/SSA-Admin/Shared/Utils/URLUtils.swift` - URL utilities
- `ios/SSA-Admin/Shared/Constants/AppConstants.swift` - Constants
- `ios/SSA-Admin/Shared/Models/README.md` - Sync guide
- `ios/SSA-Admin/Shared/Utils/README.md` - Utility sync guide

### Scripts

- `scripts/validate-types.ts` - Type validation script

## Success Criteria

1. Both apps share the same business logic (via documentation contracts)
2. Type changes in TypeScript have clear sync process to Swift
3. New features can be developed with clear process for both platforms
4. API query patterns are consistent across platforms
5. Utilities behave identically on both platforms
6. Clear documentation for maintaining sync going forward

## Benefits

- **Single Source of Truth**: TypeScript types are canonical
- **Consistent Behavior**: Both platforms follow same business rules
- **Maintainability**: Changes documented and synchronized

