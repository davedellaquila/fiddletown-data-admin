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
- **Admin hosting (production)**: [Vercel](https://ssa-admin-puce.vercel.app) — project `ssa-admin`, root directory `web/`
- **Public events widget**: GitHub Pages (see `docs/EVENTS_PUBLISHING.md`) — not served from Vercel

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
- `docs/README.md` - **Documentation index** (start here)
- `docs/TEAM_WORKSPACE.md` - Team collaboration and active work
- `docs/DECISIONS.md` - Major project decisions
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
- **Vercel production**: magic link redirect uses `window.location.origin` — add Vercel URLs to Supabase Auth redirect allowlist (see `docs/SUPABASE_CONFIG.md`)

## Deployment (web admin)

| Environment | URL / command | Notes |
|-------------|---------------|-------|
| **Local dev** | `cd web && npm run dev` → `http://localhost:5173` | Optional `VITE_DEV_AUTH_*` in `.env.local` |
| **Vercel production** | https://ssa-admin-puce.vercel.app | Linked project in `web/.vercel/project.json` (gitignored) |
| **GitHub Pages** | `davedellaquila.github.io/fiddletown-data-admin` | Still builds on `main` push when `web/**` changes; hosts **widget JS**, not the admin SPA |

**Vercel project**: `ssa-admin` (`prj_EXNK7wWJbgHeD8lVxm22QTSQqBuc`), team `dave-dellaquilas-projects`.

**Vercel build** (from `web/`): `npm run build` → output `dist/`, Node 24.x.

**Vercel env vars** (Production + Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Do **not** set `VITE_DEV_AUTH_*` on Vercel.

**Deploy**: Git push to `main` auto-deploys via Vercel (`davedellaquila/fiddletown-data-admin`, root `web/`). Manual: from **repo root**, `VERCEL_ORG_ID=team_gVHLPggyEPW7IG46EqMBCeRl VERCEL_PROJECT_ID=prj_EXNK7wWJbgHeD8lVxm22QTSQqBuc npx vercel --prod --yes`.

**Dual publish note**: Pushing `web/**` to `main` still triggers GitHub Pages (`deploy-pages.yml`) for the public widget. Admin app changes on Vercel are a separate deploy path unless Git integration is connected.

## Project Goals

1. **Consistency**: Both platforms behave identically
2. **Maintainability**: Shared logic documented and synced
3. **Simplicity**: Prefer simple solutions over complex ones
4. **Quality**: Clean, organized codebase under 200-300 lines per file

