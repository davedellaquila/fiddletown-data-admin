# Smarter Repeat Events

| Field | Value |
|-------|-------|
| **ID** | FE-002 |
| **Status** | Specced |
| **Priority** | TBD (after Event Triage M1) |
| **Effort** | Medium |
| **Platforms** | Web admin + public event-list + iOS |
| **Product area** | Events |
| **Created** | 2026-06-15 (imported; upgraded from idea) |
| **Original source** | `~/.cursor/plans/implement_repeating_events_functionality_14eb70ac.plan.md` |
| **Related** | [docs/to-do](../to-do) (migrated), [TODO.md](../../TODO.md) |

---

## Summary

Expand recurring events (`weekly`, `monthly`, `daily`) client-side into multiple instances from `start_date` through `end_date`. Shared `recurrenceUtils.ts` + Swift `RecurrenceUtils.swift`; apply in Events admin, public `event-list.js`, and iOS EventsView.

---

## Implementation checklist

- [ ] `web/shared/utils/recurrenceUtils.ts` — `expandRecurringEvent()`
- [ ] `docs/SHARED_LOGIC.md` — recurrence contract
- [ ] `web/shared/types/models.ts` — recurrence JSDoc
- [ ] `web/src/features/Events.tsx` — expansion in load()
- [ ] `web/code-snippets/events/event-list.js` (+ public copies)
- [ ] `ios/.../RecurrenceUtils.swift` + EventsView.swift
- [ ] Cross-platform test cases (weekly Jan 1–31 → ~4 instances)

---

## Promotion criteria

- [ ] Event Triage M1 shipped
- [ ] Editing behavior for recurring parents agreed (MVP: edit parent, re-expand on load)

---

# Implement Repeating Events Feature

## Overview

Currently, events with a `recurrence` field (e.g., "weekly", "monthly") are stored as single records and only display the recurrence text. This feature will expand recurring events into multiple instances based on their recurrence pattern, so a weekly event will appear every week from `start_date` to `end_date`.

## Architecture

The expansion will happen **client-side** after fetching events from the database. This approach:

- Keeps the database schema simple (no need for a separate recurring_events table)
- Allows flexible recurrence patterns without database migrations
- Works consistently across web and iOS platforms

## Implementation Steps

### 1. Create Shared Recurrence Expansion Utility

**File**: `web/shared/utils/recurrenceUtils.ts` (new file)

Create a utility function that expands a single event into multiple instances:

```typescript
/**
 * Expand a recurring event into multiple instances
 * 
 * @param event - EventRow with recurrence pattern
 * @param fromDate - Optional start date for filtering (only generate instances >= this date)
 * @param toDate - Optional end date for filtering (only generate instances <= this date)
 * @returns Array of expanded event instances
 */
export function expandRecurringEvent(
  event: EventRow,
  fromDate?: string | null,
  toDate?: string | null
): EventRow[]
```

**Supported recurrence patterns**:

- `"weekly"` - Every week on the same day
- `"monthly"` - Every month on the same date
- `"daily"` - Every day (if needed)
- `null` or empty - No expansion (return single event)

**Logic for weekly events**:

- Start from `event.start_date`
- Generate instances every 7 days
- Stop when date exceeds `event.end_date` (if provided)
- Each instance gets a calculated `start_date` and `end_date` (shifted by the recurrence interval)
- Preserve all other event fields (name, location, time, etc.)

### 2. Update Documentation

**File**: `docs/SHARED_LOGIC.md`

Add a new section documenting the recurrence expansion contract:

- Input/output format
- Supported recurrence patterns
- Date calculation rules
- Edge cases (missing dates, invalid patterns, etc.)

### 3. Update Web Admin Events Feature

**File**: `web/src/features/Events.tsx`

Modify the `load()` function to expand recurring events after fetching from database:

1. After fetching events and loading keywords (around line 601)
2. Import and use `expandRecurringEvent()` utility
3. Process each event: if it has a recurrence pattern, expand it; otherwise keep as-is
4. Flatten the results into a single array
5. Update the date filtering logic to work with expanded instances

**Considerations**:

- Preserve original event IDs for editing (may need to track which instances belong to which parent)
- Handle date filters correctly with expanded instances
- Ensure sorting still works correctly

### 4. Update public event widget

**Files** (hosted on GitHub Pages — see [EVENTS_PUBLISHING.md](../EVENTS_PUBLISHING.md)):

- `web/code-snippets/events/event-list.js`
- `web/public/code-snippets/events/event-list.js`

Add the same expansion logic to the public-facing event list:

1. After fetching events from the API
2. Expand recurring events using the same utility
3. Display all instances in the list/calendar views

Copy recurrence helpers inline or into the widget bundle as needed; production loads a single `event-list.js` file.

### 5. Update TypeScript Types Documentation

**File**: `web/shared/types/models.ts`

Update the JSDoc comment for `recurrence` field to document:

- Supported values: "weekly", "monthly", "daily", etc.
- How recurrence interacts with `start_date` and `end_date`
- That events with recurrence will be expanded into multiple instances

### 6. Implement Swift Version

**File**: `ios/SSA-Admin/Shared/Utils/RecurrenceUtils.swift` (new file)

Create Swift implementation matching the TypeScript contract:

- Same function signature and behavior
- Same recurrence pattern support
- Same date calculation logic
- Document in `ios/SSA-Admin/Shared/Utils/README.md`

### 7. Update iOS Events View

**File**: `ios/SSA-Admin/Features/Events/EventsView.swift`

Apply the same expansion logic when loading events:

- After fetching from Supabase
- Expand recurring events using Swift utility
- Display expanded instances in the list

### 8. Testing Considerations

Test cases to verify:

- Weekly event from Jan 1 to Jan 31 generates ~4 instances
- Monthly event generates correct monthly instances
- Events without recurrence remain unchanged
- Date filters work correctly with expanded instances
- Edge cases: missing end_date, invalid recurrence patterns, timezone handling

## Files to Modify

### New Files

- `web/shared/utils/recurrenceUtils.ts` - Recurrence expansion utility (TypeScript)
- `ios/SSA-Admin/Shared/Utils/RecurrenceUtils.swift` - Recurrence expansion utility (Swift)

### Modified Files

- `docs/SHARED_LOGIC.md` - Add recurrence expansion contract
- `web/shared/types/models.ts` - Update recurrence field documentation
- `web/src/features/Events.tsx` - Add expansion logic to load function
- `web/code-snippets/events/event-list.js` - Add expansion to public event list
- `web/public/code-snippets/events/event-list.js` - Synced deploy copy
- `ios/SSA-Admin/Shared/Utils/README.md` - Document Swift utility
- `ios/SSA-Admin/Features/Events/EventsView.swift` - Add expansion logic

## Implementation Notes

1. **Date Handling**: Use the existing `dateUtils.ts` functions and be careful with timezones. Parse dates as `YYYY-MM-DD` and calculate using date arithmetic.
2. **Performance**: Expansion happens client-side, so consider:
  - Only expand events that have a recurrence pattern
  - Apply date filters before expansion when possible
  - Cache expanded results if needed
3. **Editing**: When editing a recurring event, consider:
  - Should editing the parent event update all instances?
  - Or should instances become independent after expansion?
  - For MVP, keep it simple: editing the parent event updates all instances on next load
4. **Backward Compatibility**: Events without recurrence patterns continue to work as before.

