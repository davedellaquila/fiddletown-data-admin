# Project Context

## Overview
SSA Admin is a dual-platform admin application for managing Sierra Sacramento Valley data, available as both a web application (React/TypeScript) and iOS application (Swift/SwiftUI).

## Key Architecture Decisions

### Shared Logic Architecture
- **TypeScript types are the source of truth** for data models
- Swift models must be synced with TypeScript types
- Business logic is shared and documented in `docs/SHARED_LOGIC.md`
- Utility functions are implemented in both languages to match behavior

### Why This Architecture?
- Ensures consistency between web and iOS apps
- Single source of truth reduces sync errors
- Shared documentation makes maintenance easier
- Both platforms benefit from shared logic improvements

## Technology Stack

### Web
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Backend**: Supabase (PostgreSQL + PostgREST)
- **Styling**: CSS (no framework)

### iOS
- **Framework**: SwiftUI
- **Language**: Swift
- **Backend**: Supabase Swift client
- **Architecture**: MVVM pattern

## Key Features

### Current Features
- **Locations**: CRUD operations for wineries and locations
- **Events**: CRUD operations with date filtering and image display
- **Routes**: CRUD operations for hiking routes
- **OCR Test**: Text extraction from images

### Data Models
- Locations (name, slug, region, website, status)
- Events (name, dates, times, location, description, image, keywords)
- Routes (name, GPX URL, duration, difficulty, start/end points)

## Development Workflow

### Adding Features
1. Plan feature and identify shared logic
2. Update TypeScript types (source of truth)
3. Implement web feature
4. Sync Swift models
5. Implement iOS feature
6. Test both platforms

### Updating Shared Logic
1. Update `docs/SHARED_LOGIC.md`
2. Update TypeScript implementation
3. Update Swift implementation
4. Test both platforms

## Important Files

### Documentation
- `docs/SHARED_LOGIC.md` - Business logic contracts
- `docs/API_CONTRACTS.md` - API query patterns
- `docs/TYPE_SYNC.md` - Type synchronization guide
- `docs/DEVELOPMENT_WORKFLOW.md` - Development process

### Type Definitions
- `web/shared/types/models.ts` - **Source of truth** for all types
- `ios/SSA-Admin/Shared/Models/DataModels.swift` - Swift models (synced)

### Utilities
- `web/shared/utils/` - TypeScript utilities
- `ios/SSA-Admin/Shared/Utils/` - Swift utilities (synced)

### API
- `web/shared/api/supabaseQueries.ts` - TypeScript query helpers
- `ios/SSA-Admin/Shared/Services/SupabaseService.swift` - Swift service layer

## Common Issues & Solutions

### Date Filtering
- PostgREST interprets dates in UTC
- Use `gt` (day before) and `lte` (day after) for inclusive ranges
- Parse dates manually: `new Date(year, month - 1, day)` to avoid timezone shifts

### Type Sync
- Run `scripts/validate-types.ts` before committing type changes
- Check `docs/TYPE_SYNC.md` for field mapping rules
- Ensure CodingKeys map snake_case ↔ camelCase correctly

### Authentication
- Development mode bypasses auth (see `docs/DEVELOPMENT_AUTH.md`)
- Production requires Supabase magic link authentication
- Never mock auth in dev/prod code

## Project Goals

1. **Consistency**: Both platforms behave identically
2. **Maintainability**: Shared logic documented and synced
3. **Simplicity**: Prefer simple solutions over complex ones
4. **Quality**: Clean, organized codebase under 200-300 lines per file

