# Weather and Regional Events Plan

Date: 2026-06-28
Status: Phase 1 implemented; regional architecture proposed for review

## Summary

Add weather context to the public Sports Car Adventures events widget and introduce region separation so visitors can view events for a specific market, such as Gold Country, Bay Area, Santa Cruz, or Central Valley.

The recommended build order is:

1. Add weather display for the existing Gold Country events experience. Implemented 2026-06-28.
2. Add a formal region data model.
3. Add a public region selector.
4. Extend candidate review, sources, and publishing so new regions have cleanly separated content pipelines.

## Goals

- Show a brief forecast under each day header when events are grouped by day.
- Keep weather tied to the selected region, not to the entire site globally.
- Keep each region's events separate so a visitor looking at one region does not see another region's events.
- Preserve Gold Country as the default current experience.
- Make future regions configurable through data rather than hard-coding every region in the widget.

## Non-Goals For First Pass

- Do not forecast every individual event venue separately.
- Do not redesign the full event discovery pipeline before weather can ship.
- Do not mix events across regions in one public view unless a future "All regions" mode is explicitly designed.
- Do not show stale or unavailable weather as if it is current.

## User-Facing Requirements

### Weather

- Weather appears only when `Group by Day` is selected.
- Weather appears directly below each day header and above that day's event cards.
- Weather appears only for days where forecast data is available.
- Weather should be short and scannable.
- Suggested format: `Sunny, 86 / 58. Light wind. Good driving weather.`
- Include high/low temperature where available.
- Include precipitation chance where available.
- Include one short driving-relevant note when possible.
- If weather cannot be fetched, the events list should still render normally.

### Regions

- Add a top-level region selector above or near the current date/filter controls.
- Default region should be `Gold Country`.
- Selecting a region should show only events assigned to that region.
- Region selection should update weather to that region's forecast area.
- Region selection should clear or recompute keyword choices if the previous region's keywords do not apply.
- The selected region should persist during the session.
- Optional later enhancement: encode selected region in the URL so links can open directly to a region.

## Data Requirements

### New Table: `public.regions`

Recommended columns:

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `name` | Display name, e.g. `Gold Country` |
| `slug` | Stable public identifier, e.g. `gold-country` |
| `description` | Optional short public/admin description |
| `forecast_lat` | Representative latitude for regional weather |
| `forecast_lng` | Representative longitude for regional weather |
| `timezone` | Region timezone, default likely `America/Los_Angeles` |
| `sort_order` | Public selector ordering |
| `status` | `draft`, `published`, or similar |
| `created_at` / `updated_at` | Audit timestamps |

Initial seed:

| Name | Slug | Forecast Point |
|---|---|---|
| Gold Country | `gold-country` | Representative point near Amador/Plymouth/Sutter Creek |

Future seeds:

| Name | Slug | Forecast Point |
|---|---|---|
| Bay Area | `bay-area` | Representative point TBD |
| Santa Cruz | `santa-cruz` | Representative point TBD |
| Central Valley | `central-valley` | Representative point TBD |

### Event Changes

Add `region_id` to:

- `public.events`
- `public.event_candidates`
- Possibly `public.event_sources`

Recommended behavior:

- Existing published events should be backfilled to `Gold Country`.
- New candidate events should inherit region from their source when possible.
- Publish validation should require a region once the region model is active.
- The candidate publish RPC should copy `event_candidates.region_id` to `events.region_id`.

## Weather Data Approach

### Recommended First Provider

Use the National Weather Service API for US regions if coverage and terms are acceptable:

- No API key required.
- Suitable for public client-side fetches.
- Provides forecast periods from latitude/longitude.

Potential flow:

1. Widget reads selected region with `forecast_lat` and `forecast_lng`.
2. Widget calls weather provider for that forecast point.
3. Widget normalizes forecast periods into per-date summaries.
4. Widget renders summaries under matching day headers.
5. Widget caches weather briefly in `sessionStorage`.

### Caching

Use client-side cache for the first implementation:

- Cache key: `ssa_weather:<region_slug>:<forecast_date>`
- TTL: 30-60 minutes
- If fetch fails, do not block events.

Later, if provider limits or consistency become an issue, add a Supabase Edge Function or scheduled weather cache table.

## Public Widget Requirements

### Fetching Events

Current widget fetches:

```text
public.events where status = published
```

Future widget should fetch:

```text
public.events where status = published and region_id = selected_region_id
```

or, if using slugs:

```text
selected region slug -> region id -> events for that region
```

### Region Selector Placement

Recommended placement:

- Top-level selector above date filters.
- Keep it visually separate from date presets, layout, group by, and keywords.
- Label should be clear: `Region`.

### Weather Placement

When grouped by day:

```text
Saturday, July 4th                       7 events
Sunny, 88 / 59. Light afternoon breeze. Low rain chance.

[event cards...]
```

When grouped by month:

- Do not show per-day weather under month headers.
- Optional later: show weather only inside expanded day sections if those are added.

When calendar view is selected:

- No first-pass weather requirement.
- Optional later: show weather icon/high temperature in calendar cells.

## Admin Requirements

### Events Admin

- Add region field to event create/edit.
- Default to `Gold Country` for existing workflows.
- Allow filtering events by region in admin.

### Candidate Review

- Add region field to candidate detail panel.
- Show region in candidate list cards/rows.
- Allow candidate queue filtering by region.
- Candidate publish requires region.
- Publish RPC copies region to the published event.

### Event Sources

- Add region to `event_sources`.
- Discovery should attach source region to candidates.
- This is important before adding Bay Area/Santa Cruz/Central Valley sources.

## Suggested Implementation Phases

### Phase 1: Gold Country Weather Only

Purpose: Add immediate weather value without changing the event architecture yet.

Status: Implemented in the public widget on 2026-06-28.

Work:

- Added a small weather fetch/normalize layer to `event-list.js`.
- Defaulted Gold Country to a representative Plymouth/Sutter Creek forecast point.
- Kept an option seam for future `weatherRegion` values.
- Rendered weather under day headers when `groupBy === 'day'`.
- Cached weather in `sessionStorage`.
- Failed silently if weather is unavailable.

Risk:

- If hard-coded too deeply, it may need refactor during region work.

Mitigation:

- Shape code around a `region` object from day one, even if only Gold Country exists.

### Phase 2: Region Schema

Purpose: Make regions real data.

Work:

- Create `public.regions`.
- Seed `Gold Country`.
- Add `region_id` to events, candidates, and sources.
- Backfill existing events/candidates/sources to Gold Country.
- Update RLS/policies so public widget can read published regions.
- Update TypeScript types and shared models.

Risk:

- Publish RPC and admin forms may break if `region_id` is required too early.

Mitigation:

- Add nullable column first, backfill, then enforce requirements in a later migration.

### Phase 3: Public Region Selector

Purpose: Let visitors switch regions cleanly.

Work:

- Widget fetches published regions.
- Render top-level region selector.
- Default to Gold Country.
- On change: reset page state as needed, fetch region events, fetch region weather, recompute keywords.
- Persist selection in session storage.
- Optional: support `?region=santa-cruz`.

Risk:

- Existing Squarespace page may need minor option updates.

Mitigation:

- Keep `SSWidgets.renderEvents({ mount, url, key, limit })` backward compatible.

### Phase 4: Region-Aware Admin And Sources

Purpose: Support ongoing content operations across multiple markets.

Work:

- Add region filtering to Events and Candidates admin screens.
- Add region to event source management.
- Ensure discovery workers assign candidate region.
- Update candidate publish RPC to preserve region.
- Add QA views for each region.

Risk:

- Content quality varies by region if source setup is incomplete.

Mitigation:

- Launch one new region at a time with curated sources.

## Open Questions

1. Which weather provider should be used first: National Weather Service, Open-Meteo, Apple WeatherKit, or another provider?
2. What representative forecast point should define Gold Country weather?
3. Should region selection persist only in session storage, or should it also appear in the URL?
4. Should there ever be an `All Regions` view, or should the public experience always show one region at a time?
5. Should an event be allowed to belong to multiple regions?
6. How should borderline events be handled, such as Tahoe, Sacramento, or Napa?
7. Should weather appear in grid/calendar views later, or only list/day grouping?

## Recommended Decision

Approve Phase 1 and Phase 2 together as the next implementation package:

- Phase 1 gives visible user value quickly.
- Phase 2 prevents the weather work from becoming a one-off Gold Country hack.

Then review the public region selector design before building Phase 3.
