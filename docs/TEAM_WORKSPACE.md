# Team Workspace

**Single source of truth for cross-role collaboration on SSA Admin.**

All agents (Product, UX, Engineering, QA) read this file at the start of a session and update it before ending work. Keep entries concise and timestamped.

---

## Roles & Responsibilities

| Role | Agent | Owns | Updates in workspace |
|------|-------|------|----------------------|
| **Product Manager** | PM | Requirements, documentation, scope, priorities, acceptance criteria, decision broadcast | All docs index, Active work, DECISIONS, open questions |
| **Lead UX Designer** | UX | User flows, wireframes, interaction patterns, accessibility | Design status, UX notes, review requests |
| **Lead Developer** | Dev | Architecture, implementation, API/types, cross-platform sync | Technical notes, implementation status, blockers |
| **QA** | QA | Test plans, verification against AC, regression notes, ship sign-off | Feature spec §8, Team Log, AC checkboxes |

---

## How to Communicate

### 1. Check in (start of session)

1. Read **Active Work** below — know what's in flight.
2. Read **Team Log** — scan entries since your last session.
3. Open the linked feature spec in `docs/features/` if one is active.

### 2. Leave a message (during or end of session)

Add a row to the **Team Log** using this format:

```markdown
| YYYY-MM-DD | Role | Topic | Message | Action needed |
```

- **Role**: `PM` | `UX` | `Dev` | `QA`
- **Topic**: Short label (e.g. `Events filter`, `Scope cut`)
- **Message**: What changed, decided, or is blocked
- **Action needed**: Who should act next (`PM`, `UX`, `Dev`, `None`)

### 3. Handoffs

| From → To | Handoff artifact | Where it lives |
|-----------|------------------|----------------|
| Dev → QA | Build complete, test environment notes | Feature spec §8 (Test plan) + Team Log |
| QA → PM | Verification results, AC status, blockers | §8 results + AC checkboxes in §3 |
| PM → UX | Problem statement, user stories, acceptance criteria | Feature spec §1–3 |
| UX → Dev | Flows, layout notes, component behavior | Feature spec §4 (Design) |
| Dev → PM | Implementation notes, scope deltas, ship checklist | Feature spec §5 (Engineering) |
| Any → All | Decisions that affect scope or behavior | Feature spec §6 (Decision log) + Team Log |

---

## Active Work

| Field | Value |
|-------|-------|
| **Feature** | Event Triage (Candidate Review) |
| **Spec** | [docs/features/event-candidate-review.md](./features/event-candidate-review.md) |
| **Status** | `Build` — Dev M1 shipped; **QA re-run required** |
| **PM** | Priority locked; **no ship** until QA pass (D-004 draft-only) |
| **UX** | §4 + design QA complete; **v2 style proposal** ready for review |
| **Dev** | M1 **complete** — migration 004 applied, Candidates UI shipped |
| **QA** | **Active** — execute §8 with authenticated session |
| **Target** | M1: list, edit, reject, approve-as-draft |

### Agent assignments (current)

#### QA — active

1. Read spec §3 (AC-1–13) and §8 (test plan).
2. Sign in with **real Supabase auth** (not dev bypass).
3. Run TP-1–TP-10 at `localhost:5173` → **Candidates** (⌘5); use §8 DB queries after approve/reject.
4. Verify **no accidental publish** — TP-5 + TP-6: approved events must be `draft` only (D-004).
5. Check UX vs `event-triage-mockups.pen` / §4.
6. Fill §8 **Pass?** + QA sign-off; log result in Team Log.

#### PM — after QA

- Review §8 results → ship sign-off or send bugs to Dev.
- Do not mark M1 `Done` until TP-5 + TP-6 pass.

#### Dev — on call

- M1 build **complete** (see spec §5 checklist). Fix bugs if QA files failures.

#### UX — on call

- §4 + design QA **complete**. Re-engage only if QA reports visual gaps.

<details>
<summary>Completed pre-build assignments (archive)</summary>

**Dev (pre-Build):** OQ-1–3, §5, migration 004 + UI — all done.

**UX (pre-Build):** §4, OQ-4, Pencil mockups — all done.

</details>

### Current focus

> **PM (2026-06-15):** **Dev M1 build landed.** QA: re-run §8 with authenticated login (dev bypass has no JWT).

### Parked (review before build)

| Item | Doc | Notes |
|------|-----|-------|
| Regional Advertising Manager (FE-001) | [ad-management-system.md](./future-enhancements/ad-management-system.md) | Review M1 placement/pricing scope before promotion to `features/` |
| iPad parity (FE-003) | [ipad-shared-logic-architecture.md](./future-enhancements/ipad-shared-logic-architecture.md) | Foundation shipped; Events/Routes parity + new web features TBD |
| Event selection email (FE-004) | [event-selection-email.md](./future-enhancements/event-selection-email.md) | Squarespace widget + Edge Function |
| Repeat events expansion (FE-002) | [smarter-repeat-events.md](./future-enhancements/smarter-repeat-events.md) | Client-side recurrence expansion |

### Backlog (parallel)

[Platform UX first-pass](./backlog/platform-ux-assessment.md) (P0–P3) — runs parallel to M1; P0 before production-ready.

---

## Team Log

Newest entries at the top.

| Date | Role | Topic | Message | Action needed |
|------|------|-------|---------|---------------|
| 2026-07-03 | Dev | Story Independence Day Party | Published Story Independence Day Party (July 4, 2026, 1–4 PM) from poster asset with keywords: amador wine, food, holiday, live music, music, wine event, winery. Supabase read-back verifies the row and poster image URL. | Dave — refresh widget/admin after deploy |
| 2026-07-02 | Dev | Poster event batch | Published three poster-sourced events: Freedom Festival in the Park (July 4), Singin' in the Vines Karaoke at Mellowood Vineyard (July 5), and Fiddler's Jam 75th Anniversary (Sept 19). Added repo-hosted poster assets and verified published rows/keywords in Supabase. | Dave — refresh widget/admin after deploy |
| 2026-07-02 | Dev | Events widget sticky filter cleanup | Consolidated the compact sticky filter controls into one shared background, reduced vertical padding/control height, and hardened the date clear handlers so clearing dates blanks the To date input after re-render. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-07-02 | Dev | Amador Farmers Market 2026 | Published four 2026 Amador Farmers Market season rows from poster asset: Sutter Creek Saturdays (May 2–Oct 17), Ione Wednesdays (Jun 3–Jul 29), Plymouth Thursdays (Aug 6–Sep 24), and Volcano first/third Sundays (May 17–Dec 20). Shared poster asset added; keywords: community, family friendly, farmers market, food, free, shopping. | Dave — refresh widget/admin after deploy |
| 2026-07-02 | Dev | Jackson July 3 parade event | Treated the new 3rd of July Parade poster as an update to existing published event `adea592a` instead of a duplicate. Updated title, times (9:30 AM–9 PM), Main Street/Detert Park location, host, description, poster URL, and keywords: community, family friendly, fireworks, food, free, holiday, live music, parade. | Dave — refresh widget/admin after deploy |
| 2026-07-02 | Dev | Events widget sticky breakpoint fix | Fixed the compact sticky filter shell at constrained desktop widths by resetting date/menu/summary grid placement to one column; prevents the date panel from collapsing into a left sliver and the summary from detaching. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-07-01 | Dev | Events widget sticky summary | Moved the compact sticky date/weather/count summary below the date and filter control rows and reduced its padding/weather badge height to shorten the sticky section. Source/public widget copies match and JS syntax checks pass; headless Chrome visual probe was blocked by local Chrome crash. | Dave — hard-refresh events page after deploy |
| 2026-07-01 | Dev | Plymouth July 4 parade event | Published event `be249af8` for Plymouth 4th of July Trucks, Tractors & Trikes Parade (July 4, 2026, 10 AM–9 PM) with poster asset and keywords: community, family friendly, fireworks, food, holiday, live music, parade. Public Supabase read-back verifies the row and keyword relationships. | Dave — refresh widget/admin after deploy |
| 2026-07-01 | Dev | Paddle House BluesBerry Jam event | Published past event `1c60c051` for BluesBerry Jam at Paddle House Brews (June 28, 2026, 2–5 PM) with poster asset and keywords: drinks, live music, music. Public Supabase read-back verifies the row and keyword relationships. | Dave — refresh widget/admin after deploy |
| 2026-06-30 | Dev | Events widget desktop filter row | Rebalanced the desktop widget filter toolbar into four measured grid columns plus an embedded-width fallback so Date Presets, View, Group by, and Keywords fit on one row without overflowing. Browser screenshots/measurements verify zero overflowing menus in full-width and constrained previews; source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-30 | Dev | Toogood wine cheese events | Published three Toogood Estate Wine & Cheese Celebration rows for July 11–12, July 18–19, and July 25–26 (11 AM–5 PM) with poster asset and keywords: amador wine, food, wine event, winery. Public Supabase read-back verifies all three rows. | Dave — refresh widget/admin after deploy |
| 2026-06-30 | Dev | Event image repairs | Mirrored the Helwig July 4 weekend source image and a Driven Cellars venue fallback into repo-hosted assets, then updated the two published event rows so their `image_url` values point at raw GitHub URLs. Public Supabase read-back verifies both URLs are set. | Dave — refresh widget/admin after deploy |
| 2026-06-30 | Dev | Candidates mobile detail actions | Fixed the candidate detail panel height so the Save/Reject/Approve action bar stays inside the visible mobile detail pane instead of falling below a clipped 100vh panel; added safe-area bottom padding and mobile-friendly wrapping for the action buttons. TypeScript and Vite production build pass. | Dave — verify Candidates detail actions in iPhone portrait and landscape |
| 2026-06-29 | Dev | Events widget date/menu fixes | Hardened date state so the widget cannot render To before From, bounded From/To pickers with max/min constraints, and changed desktop filter menus to wrap-safe flex sizing so labels do not collide with chevrons. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-29 | Dev | Admin mobile edit dialog | Removed the card-like edit dialog shell on phone layouts, reduced dialog/form padding, corrected the mobile sidebar offset, and stacked event edit form rows so fields use the available width without left-edge clipping. | Dave — verify event edit form on iPhone portrait |
| 2026-06-29 | Dev | Admin mobile filter grid | Improved the Events mobile filter layout so controls use a two-column grid instead of full-width stacked bricks, with search/chips/custom date rows still spanning full width and a tighter Events toolbar header. | Dave — verify Events filter layout on iPhone portrait |
| 2026-06-29 | Dev | Admin event edit validation | Made the event edit save control explicit (`Save`) and replaced alert-only validation with an inline error banner plus red field highlights for missing name, slug problems, date order, time order, and database save errors. | Dave — verify failed event saves show highlighted fields |
| 2026-06-29 | Dev | Admin events filter layout | Compactified the Events filter toolbar: import/export moved into Actions, date presets are one menu, custom From/To fields appear only for Custom Range, keywords/signature/sort/clear are condensed, and signature filtering now flows through the shared filter effect. | Dave — verify Events filters on mobile and desktop |
| 2026-06-29 | Dev | Admin sidebar touch activation | Changed the collapsed sidebar expand/theme controls to activate on pointer release with explicit keyboard support, and gave the collapsed control group a fixed touchable width so iPhone landscape taps register reliably. | Dave — verify top two controls in iPhone landscape |
| 2026-06-29 | Dev | Admin landscape sidebar taps | Fixed the narrow-screen auto-collapse effect so tapping Expand in iPhone landscape is not immediately undone, and raised the collapsed sidebar top controls' touch layer for more reliable theme/expand taps. | Dave — verify on iPhone landscape |
| 2026-06-29 | Dev | Admin collapsed sidebar controls | Changed the collapsed admin sidebar’s top collapse/theme controls from a horizontal pair to a vertical stack while leaving the expanded sidebar layout unchanged. | Dave — refresh admin app and verify collapsed sidebar |
| 2026-06-28 | Dev | Events widget keyword menu min width | Gave the Keywords filter its own minimum grid width at compact breakpoints so labels like `Keywords 1`/`Keywords 2` are sized with the count instead of squeezing into the chevron. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget keyword menu padding | Added keyword-specific right padding at compact breakpoints so the Keywords count and chevron have more breathing room without widening every filter menu. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget weather links | Changed detailed weather links to stable Weather Underground forecast pages, defaulting Gold Country to Sutter Creek and allowing future regions to pass a `weatherUrl` or Weather Underground city/state slug. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget keyword menu width | Let the Keywords dropdown expand left from its button with a viewport cap and raised open filter controls above the summary row so keyword labels remain readable and unobstructed. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget group menu layering | Raised the open filter menu layer above the sticky summary row so Group by dropdown items render visibly instead of appearing as clipped red text underneath the menu. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget dropdown clipping | Let compact filter dropdown panels render outside the control panel and constrained the Keywords dropdown to its own menu width with clipped item text, fixing the clipped Group by panel and over-wide keyword menu. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget sticky keywords | Changed the sticky summary to a two-row grid so date/weather and event count stay on the first row while selected keyword chips render in a contained full-width row below without clipping. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget filter chevrons | Replaced the filter menu text chevron with an internal CSS-drawn chevron and reserved right padding across compact/mobile breakpoints so the icon stays inside each filter button. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget weather links | Replaced Weather.gov-only detail links with smart weather links: iOS attempts the native Weather app, Android attempts the Google app/weather intent, and both fall back to a Google weather result for the forecast point. Source/public widget copies match and JS syntax checks pass. | Dave — verify weather tap behavior on iPhone |
| 2026-06-28 | PM | FE-001 regional ads | Rewrote the ad-management future enhancement as a complete Regional Advertising Manager spec for selling local-business sponsorships by region on the Sports Car Adventures events page. No implementation started. | Dave — review M1 placement/pricing open questions |
| 2026-06-28 | PM | FE-005 event notifications | Added a planning-only future enhancement spec for opt-in new-event email notifications, distinct from FE-004's session-based "email my selected events" feature. No implementation started. | Dave — review open questions before promotion |
| 2026-06-28 | Dev | Events widget sticky weather | Added a compact weather badge beside the sticky current date, with condition icon plus precipitation or sunny likelihood when meaningful. The full sticky date/weather readout and full daily weather tile now link to the detailed weather.gov forecast page. Source/public widget copies match and JS syntax checks pass. | Dave — verify sticky weather/date tap targets on scroll |
| 2026-06-28 | Dev | Events widget date scroll reset | Date range inputs, date chips, and date presets now await the refreshed render and smoothly scroll back to the first visible results section instead of retaining the old scroll position. Source/public widget copies match and JS syntax checks pass. | Dave — verify date-range changes on mobile |
| 2026-06-28 | Dev | Events widget weather phase 1 | Added Gold Country daily weather summaries under day headers when List View is grouped by day, using NWS forecast data with session cache and graceful fallback. Source/public widget copies match, JS syntax checks pass, and NWS smoke test returned forecast data. | Dave — review live day-grouped list after deploy |
| 2026-06-28 | Dev | Events widget refresh contrast | Increased the mobile pull-to-refresh indicator to 112px, used a high-contrast orange fill, added a white border/blue outer ring, and enlarged the glyph to 64px. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget refresh indicator | Enlarged the mobile pull-to-refresh indicator from 40px to 88px with a larger icon and adjusted pull positioning/threshold for the bigger target. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget summary row | Put the visible date and event count on one summary row, with the date on the left and event count aligned to the right. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget weekend preset | Changed the This Weekend preset to show only remaining days once the weekend starts: Fri-Sun on Friday or earlier, Sat-Sun on Saturday, and Sunday only on Sunday. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget keyword divider | Removed the mobile-only divider line above event keyword chips so keywords read as part of the current event card. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-28 | Dev | Events widget mobile filters | Removed the narrow mobile rule that forced Group by to span both toolbar columns, so Group by and Keywords sit on the same row on phone layouts. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget date range guard | Added a widget date-input guard so To cannot be earlier than From; changing To below From snaps To to From, and raising From clamps any earlier To. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Unity Ranch Rib Cook Off event | Published event `8dd1a103` for Unity Ranch Rib Cook Off (June 28, 2026, 2–10 PM) with poster asset and keywords: community, family friendly, food, live music. | Dave — refresh Admin/app calendar to verify |
| 2026-06-27 | Dev | Delta Chicks July 4 event | Published event `f8db6469` for Delta Chicks at the Lube Room Saloon (July 4, 2026, 3–6 PM) with poster asset and keywords: community, family friendly, food, holiday, live music. | Dave — refresh Admin/app calendar to verify |
| 2026-06-27 | Dev | Events widget date clear placement | Moved the date clear button into the From/To label row and made the date inputs a two-column row below it, giving both fields more usable width in compact layouts. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget filter overflow | Removed fixed minimum widths from the compact filter split and toolbar items so the filter menu row stays inside the page content width at medium/desktop sizes. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget content width follow-up | Tightened the shared content max width to 1536px so the filter bar/results align with the visual width of the intro card. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget content width | Normalized the filter shell, intro, summaries, event lists/grid/calendar, and footnote to use one shared content width/gutter so the filter bar aligns with the rest of the page. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget date field controls | Narrowed the date entry fields/panel allocation and changed the date clear icon to clear only the To date, preserve From, and focus/open the From date picker. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget compact filter layout | Rebalanced the compact date/filter split so the widened Group by menu no longer pushes Keywords outside the filter panel; stacks panels below 1280px. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-27 | Dev | Events widget group menu width | Widened the Group by filter menu/toolbar column so "Group by Month" fits, including compact and narrow responsive layouts. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Events widget logo tagline | Added the Sports Car Adventures tagline "Drive the Sierra like a local." below the linked logo, with responsive styling for mobile and desktop. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Events widget logo link | Updated the Sports Car Adventures logo link to navigate directly to the homepage in the current tab and made the logo anchor explicitly clickable. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Events widget logo sizing | Enlarged the Sports Car Adventures logo on desktop/tablet, made it full-width at the top on mobile, and switched to a higher-resolution Squarespace image rendition. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Events widget group labels | Renamed the group filter menu labels from Day/Month to Group by Day/Group by Month in both source and public widget copies. JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Events widget grid cards | Restored image-backed grid cards and removed the mismatched title-strip background so event names render on the same card surface. Source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-26 | Dev | Say Grace fish fry archive event | Added archived past event `ae1a1497` for Say Grace Neighborhood Fish Fry Thursday (June 25, 2026, 2–7 PM) with poster asset and keywords: community, family friendly, food. | Dave — verify in Admin archived/past events if desired |
| 2026-06-26 | Dev | Street Heat image update | Updated published August 29 Gateway Street Heat Car Show event `8171b12f` with poster image asset; public API verifies new `image_url`. | Dave — refresh Admin/app calendar to verify |
| 2026-06-26 | Dev | Foothill Classics image update | Updated published August 14 Foothill Classics Cruise Night event `52628e78` to use the working classic-car photo asset; public API verifies new `image_url`. | Dave — refresh Admin/app calendar to verify |
| 2026-06-26 | Dev | Summer Harvest Days image update | Updated published July 25 Summer Harvest Days event `6e3c17c2` with new harvest-trail image asset; public API verifies new `image_url`. | Dave — refresh Admin/app calendar to verify |
| 2026-06-26 | Dev | Foothill Classics image update | Updated published July 10 Foothill Classics Cruise Night event `58d243f9` with new classic-car photo asset; public API verifies new `image_url`. | Dave — refresh Admin/app calendar to verify |
| 2026-06-26 | Dev | Jackson Independence Day event | Published event `adea592a` for Jackson Lions Club Independence Day Celebration (July 3, 2026, no listed time) with poster asset and keywords: community, family friendly, fireworks, holiday. | Dave — refresh Admin/app calendar to verify |
| 2026-06-25 | Dev | Story Wine Club Party event | Published event `21bd3e44` for Story Wine Club Party (June 28, 2026, 1–4 PM) with poster asset and keywords: amador wine, food, live music, wine event, winery. | Dave — refresh Admin/app calendar to verify |
| 2026-06-25 | Dev | Story Wine Club Party event | Prepared screenshot asset for Story Wine Club Party; initial anonymous insert was blocked by RLS. Superseded by published event row above after Supabase CLI auth. | None |
| 2026-06-25 | Dev | Events widget date readout | Removed "Showing" from the sticky selected-date readout and stacked the date below the event count in the keyword summary section. | Dave — hard-refresh events page after deploy |
| 2026-06-25 | Dev | Events widget sticky summary | Combined event count and current "Showing <date>" readout into the left side of the selected-keyword summary section; keyword chips remain to the right. | Dave — hard-refresh events page after deploy |
| 2026-06-25 | Dev | Events widget keyword summary | Moved the event count and selected keyword chips into their own sticky summary section below the date/filter menus; source/public widget copies match and JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-25 | Dev | Events widget sticky footer fix | Fixed wide sticky layout so selected keyword chips and current date stay full-width below the controls instead of drifting to the right; deployed to `gh-pages`, Pages CDN may serve old JS briefly. | Dave — hard-refresh after cache expires |
| 2026-06-25 | Dev | Events widget sticky footer | Moved selected keyword chips into the sticky filter menu footer and placed the current visible list date below them while scrolled. Source/public widget copies match; JS syntax checks pass. | Dave — hard-refresh events page after deploy |
| 2026-06-25 | Dev | Upcountry Jam archive event | Added archived past event `59320bec` for Second Annual Memorial Day Upcountry Jam with poster asset + 8 keywords; raw GitHub image URL verified. | Dave — verify archive row/image if desired |
| 2026-06-25 | Dev | Events widget sticky date | List view sticky controls now show the current visible event date while scrolled; updated source + public widget copies. JS syntax checks pass; git diff blocked by existing short packfile in `.git/objects/pack`. | Dave — preview/deploy widget when ready |
| 2026-06-18 | QA | Amador Cellars BBQ dupes | Archived duplicate Father's Day BBQ (June 21); keeper `d5f697f7` w/ 5 merged keywords. | Dave — hard-refresh events page |
| 2026-06-18 | QA | Summer Sessions dupes | Archived 2 of 3 published Summer Sessions rows (June 20); keeper `25067e74` w/ 6 merged keywords. Widget fix: renamed shadowed `normalizeEventUrl` → `normalizeEventUrlForDedup`; dedupe on every `renderEvents`; cache key `v20260618`. | Dev — push widget to GH Pages; Dave — hard-refresh events page |
| 2026-06-15 | Dev | Events BUG-006 root cause | Delete failed: RLS `auth_update_events` only allowed `auth.uid() = created_by` (~50 events have null creator; others owned by different users). Applied migration `007_events_admin_update_rls.sql`. Client: UUID-safe delete, no `.single()`, bulk delete id fix. | Dave — verify row delete after rebuild |
| 2026-06-15 | Dev | Events BUG-004/005 | **BUG-004:** `KeywordSelector` arrow/Enter keyboard nav (stale state, case-insensitive filter, Escape no longer closes dialog). **BUG-005:** keyword save on →/← via `editingRef`, `rowsRef`, `getNavigationRows()` in `AutoSaveEditDialog`. **Note:** `npm run preview` requires `npm run build` before refresh; use `npm run dev` for HMR. | Dave — verify BUG-005 (keyword persists after → then ←) |
| 2026-06-15 | Dave | Event Triage BUG-001 data | Requested **one-time cleanup** of existing `new`/`needs_review` candidates — remove HTML entities/escapes from `short_description`/`description` so manual edit not needed. | Dev — apply migration 005 |
| 2026-06-15 | Dave | Events BUG-003 | List-view **signature event** checkbox did not persist / edit panel showed stale value. Dev fix: verified DB update with `.select()`, sync `rows`/`allRows`/`editing`, open edit from latest `allRows`. | Dev — verify in UI |
| 2026-06-15 | Dev | Event Triage BUG-002 | **Field-level publish flags** — `FormField` `warning` prop (amber border + background, label color, inline "Needed before publish" hint). Wired on title, start_date, location, short_description, website_url in `CandidateDetailPanel`. Removed duplicate bottom-of-form list. | Dave — verify in Candidates detail |
| 2026-06-15 | Dave | Event Triage BUG-001 | **Encoded description text** in `short_description` / `description`: shows `&lt;p&gt;`, `\'`, literal `\n` instead of readable copy (e.g. wine cocktail class). Logged §8 BUG-001. | Dev — see handoff row |
| 2026-06-15 | QA | Docs cleanup | Refreshed §8 test plan and Team Workspace assignments — removed pre-build blocked results and stale Dev/UX handoff instructions. §8 ready for authenticated QA run. | QA — execute §8 |
| 2026-06-15 | Dev | Event Triage M1 build | Shipped `EventCandidates.tsx`, `CandidateDetailPanel.tsx`, `eventCandidateQueries.ts`, migration 004 applied (RLS + `approve_event_candidate_as_draft` RPC). `npm run build` passes. Dev verified AC-1–13 in code + live DB policies. **Auth required** — dev bypass cannot query candidates. | QA — re-run §8; UX — visual vs Pencil |
| 2026-06-15 | UX | Style Guide v2 proposal | Assessment + **STYLE_GUIDE_V2_PROPOSAL.md** + Pencil deck `ssa-admin-v2-style-guide.pen` (8 frames, light/dark). Candidates as north star; ghost sidebar; token refresh. **For Dave review — not approved for build.** | PM — review proposal; decide timing vs M1 |
| 2026-06-15 | PM | Event Triage M1 sign-off | **Do not ship** (pre-build QA). Superseded by Dev handoff — PM ship sign-off pending authenticated QA pass on TP-5 + TP-6. | QA — execute §8 |
| 2026-06-15 | QA | Event Triage M1 | Independent QA pass **Blocked**. TP-1–10 not runnable (no Candidates nav/UI, no migration 004, no approve RPC). Static TP-6 checks: no approve code, 0 approved candidates in DB. Regression: Locations/Events/Routes load; Candidates nav missing. Results in spec §8. | Dev — complete M1 build; QA — re-run §8 |
| 2026-06-15 | PM | Team: add QA | Fourth agent **QA** added (D-009). Dev → QA → PM for M1 sign-off. §8 test plan drafted in event-candidate-review spec. | Dev — finish build; QA — stand by |
| 2026-06-15 | UX | Event Triage §4 | §4 complete. OQ-4 closed: **Candidates** nav after Events (⌘5). Pencil: `docs/design/event-triage-mockups.pen` (6 screens). Split-panel desktop; full-screen mobile; non-blocking missing-field flags. | PM — review §4; Dev — implement per §4 + §5 |
| 2026-06-15 | Dev | Event Triage §5 | Live DB check complete. Tables exist (55 candidates). **RLS blocker:** no policies on `event_candidates`/`event_sources`. OQ-1–3 closed in spec §5. Recommend RPC `approve_event_candidate_as_draft`; ~8d M1 estimate. | PM — unblock `Build` after UX §4; Dev — migration 004 before UI |
| 2026-06-15 | Dev | Events publishing docs | Rewrote docs for hosted-script architecture (Squarespace thin loader + GitHub Pages `event-list.js`). Added `docs/EVENTS_PUBLISHING.md`; updated widget README, dev preview HTML, legacy `event-list.html` headers, FE-002/FE-004 file lists. | PM — optional DECISIONS entry if architecture change not yet recorded |
| 2026-06-15 | PM | Cursor plans scan | Reviewed 25 plans in `~/.cursor/plans/`. Imported FE-004 + FE-002 full specs. Audit: `_SCANNED_PLANS.md`. | None |
| 2026-06-15 | PM | Future enhancements | Added FE-003 iPad shared logic & parity plan. Foundation largely complete per IMPLEMENTATION_SUMMARY; remaining work = iOS feature gaps + sync for new web features. | None |
| 2026-06-15 | PM | Decision: priority | **Event Triage M1 first.** Ad Management (FE-001) deferred — PRD review/adjustments before any implementation. See D-008. | UX — triage §4; Dev — schema check |
| 2026-06-15 | PM | Future enhancements | Created `docs/future-enhancements/` registry. Imported Ad Management PRD as FE-001; migrated repeat-events idea as FE-002. | None |
| 2026-06-15 | PM | Decision: doc ownership | PM now maintains all requirements docs. Added `docs/README.md` index, `DOCUMENTATION_MAINTENANCE.md`, `DECISIONS.md`, formalized UX assessment in `backlog/`. Details in DECISIONS.md D-005, D-006. | All — read DECISIONS; route doc changes via Team Log |
| 2026-06-15 | PM | Decision: sequencing | M1 Event Candidate Review is primary; platform UX P0 runs parallel. | UX — §4 candidate review; Dev — schema + sizing |
| 2026-06-15 | PM | Event Candidate Review | Intook Codex spec → `docs/features/event-candidate-review.md`. 8 user stories, 13 M1 acceptance criteria, 5 M2 criteria. Decisions: draft-only M1, web-only, new nav in SSA Admin. | UX — §4 design; Dev — schema check + sizing |
| 2026-06-15 | UX | Dark mode style guide | Expanded STYLE_GUIDE §3.4 (dark tokens, surfaces, states, iOS). Updated `ssa-admin-style-guide.pen` with theme variables, dark gallery, shell preview, light/dark swatch pairs. | Dev — implement CSS variables for both themes |
| 2026-06-15 | UX | Pencil mock-ups | Created `docs/design/ssa-admin-ux-mockups.pen` with 6 screens + reusable components (shell, events, empty state, confirm, feedback, login). Open in Pencil extension. | PM/Dev — review mock-ups in Pencil canvas |
| 2026-06-15 | UX | First-pass assessment | Reviewed web shell + Locations/Events/Routes. Top issues: browser `alert()`/`confirm()` feedback, inconsistent loading/empty states, Events “Clear” sets From=today (bug), dev nav items in prod sidebar, emoji-only icon buttons, ModalDialog ignores dark mode. Full P0–P3 list in chat. | PM — prioritize backlog; Dev — size P0/P1 |
| 2026-06-15 | PM | Workspace | Created `docs/TEAM_WORKSPACE.md`, feature template, and agent collaboration rule. | None |

---

## Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | Do `event_candidates` and `event_sources` tables already exist in Supabase with documented RLS? | Dev | **Closed** — Tables exist; RLS policies + RPC in migration 004 (applied). See spec §5. |
| OQ-2 | Does `events.short_description` exist in DB? Not on current `EventRow` type. | Dev | **Closed** — Column exists in DB; add to `EventRow` before approve mapping. |
| OQ-3 | Approve-as-draft: client-side two-step or Supabase RPC/transaction? | Dev | **Closed** — **Recommend RPC** `approve_event_candidate_as_draft`. See spec §5. |
| OQ-4 | Sidebar label and placement for candidate review nav | UX | **Closed** — **Candidates**, sibling after Events (⌘5). See spec §4 |
| OQ-5 | Sequence: M1 candidate review vs platform UX P0? | PM | **Closed** — M1 primary; UX P0 parallel (see D-005) |

---

## Decision Log (project-wide)

Cross-feature decisions only. Feature-specific decisions go in the feature spec §6.

| Date | Decision | Rationale | Decided by |
|------|----------|-----------|------------|
| 2026-06-15 | M1 candidate review is draft-only; publish deferred to M2 | Reduces accidental publication; per Codex milestone plan | PM |
| 2026-06-15 | M1 is web-only | Spec is admin-page focused; iOS not requested | PM |
| 2026-06-15 | PM maintains all requirements and project documentation | Single owner; team informed via DECISIONS + Team Log | PM |
| 2026-06-15 | **Finish Event Triage before Ad Management** | User direction; FE-001 needs PRD review/adjustments anyway | No ad work until triage M1 ships | PM |
| 2026-06-15 | M1 candidate review primary; platform UX P0 parallel | Unblocks curation; UX fixes don't block M1 | PM |
| 2026-06-15 | Use repo markdown (`docs/TEAM_WORKSPACE.md` + `docs/features/`) as the shared agent workspace | Version-controlled, no external tools, fits existing docs workflow | PM |

---

## Quick Links

- [Agent onboarding](./AGENT_ONBOARDING.md)
- [Documentation index](./README.md)
- [Decision log](./DECISIONS.md)
- [Documentation maintenance (PM)](./DOCUMENTATION_MAINTENANCE.md)
- [Event Candidate Review spec](./features/event-candidate-review.md)
- [Future enhancements registry](./future-enhancements/README.md)
- [iPad parity (FE-003)](./future-enhancements/ipad-shared-logic-architecture.md)
- [Regional Advertising Manager (FE-001)](./future-enhancements/ad-management-system.md)
- [Style guide](./design/STYLE_GUIDE.md)
- [Event triage mockups (Pencil)](./design/event-triage-mockups.pen)
- [Feature specs & workflow](./features/README.md)
- [Feature spec template](./features/_TEMPLATE.md)
- [Product PRD](./SSA-Admin-PRD.md)
- [Development workflow](./DEVELOPMENT_WORKFLOW.md)
- [Shared logic contracts](./SHARED_LOGIC.md)
