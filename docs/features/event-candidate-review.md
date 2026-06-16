# Feature: Event Triage (Candidate Review)

| Field | Value |
|-------|-------|
| **Status** | `Build` — Dev M1 shipped; QA verification pending |
| **Also known as** | Event Admin Review, Event Candidate Review |
| **Author** | PM |
| **Created** | 2026-06-15 |
| **Source** | Codex — `event-admin-review-spec.md` (Sports Car Adventures) |
| **Platforms** | Web (M1); iOS deferred |

---

## 1. Problem & goals

### Problem statement

A daily monitor discovers potential events from configured sources and writes them to `public.event_candidates`. The public site (`sportscaradventures.com/events`) reads only from `public.events` where `status = 'published'`. **M1 admin UI is shipped** (`Candidates` nav); independent QA verification is pending before release.

Dave needs a fast, trustworthy approval layer so high-confidence discoveries become real events without accidental publication.

### Goals

- Provide an internal admin page to review discovered event candidates before they reach the public site.
- Support save-in-place edits on candidates without approving.
- Approve candidates into `public.events` as **draft** first (safe default).
- Reject bad candidates and mark duplicates against existing events.
- Prioritize speed, source verification, and guardrails against accidental publish.

### Non-goals (out of scope for M1)

- Approve and publish in one step (M2).
- Duplicate-matching UI beyond basic mark-duplicate (M2).
- `event_sources` management page (M2).
- Deep links from candidate digest email (M2).
- Automatic publishing from the scheduled worker.
- iOS admin for candidate review (deferred unless requested).

### Success metrics

- Dave can process the daily candidate queue without SQL or direct DB access.
- Zero accidental publishes from the candidate workflow in M1 (draft-only approval).
- Approved drafts appear in existing Events admin with correct field mapping.
- Rejected/duplicate candidates do not re-surface as actionable in the default queue.

---

## 2. User stories

| ID | As a… | I want to… | So that… |
|----|--------|------------|----------|
| US-1 | Dave (curator) | See a queue of `new` and `needs_review` candidates sorted by date and priority | I can triage the daily digest quickly |
| US-2 | Dave | Filter candidates by status, source, priority, and text search | I can focus on one class of work at a time |
| US-3 | Dave | Open a candidate and see extracted fields plus read-only source context (`raw_text`, confidence, URLs) | I can verify the discovery before approving |
| US-4 | Dave | Edit candidate fields and save without approving | I can fix extraction errors before committing |
| US-5 | Dave | Approve a candidate as a **draft** event | The event enters the normal Events workflow without going public |
| US-6 | Dave | Reject a candidate with optional notes | Bad discoveries are cleared from the actionable queue |
| US-7 | Dave | Mark a candidate as duplicate of an existing event | Repeat discoveries don't create duplicate events |
| US-8 | Dave | See a duplicate warning when `duplicate_event_id` is set | I know the monitor already flagged a likely duplicate |

---

## 3. Acceptance criteria

### Milestone 1 — Draft approval workflow (ship first)

*Checkboxes below = **Dev implementation verified** (2026-06-15). QA updates after independent §8 pass.*

- [x] **AC-1:** New nav entry opens a **Candidate Queue** view (private admin only). *(Dev: `Candidates` nav + `EventCandidates.tsx`)*
- [x] **AC-2:** Default filter shows `new` + `needs_review`; tabs also support Approved, Rejected, Duplicates, All.
- [x] **AC-3:** Queue sorts by `start_date asc nulls last`, then `priority asc`, then `discovered_at desc`. *(Dev: `sortCandidates()`)*
- [x] **AC-4:** Each row/card shows: title, source name, priority, status, start date/time, location, website/source link, extraction confidence, short description, duplicate warning if `duplicate_event_id` set.
- [x] **AC-5:** Selecting a candidate opens a detail/edit panel with editable fields: title, host_org, start/end date, start/end time, location, short_description, description, image_url, website_url, priority, review_notes.
- [x] **AC-6:** Read-only fields displayed: source_name, source_url, raw_text, extraction_confidence, discovered_at, last_seen_at.
- [x] **AC-7:** **Save** updates only `public.event_candidates` (no event created).
- [x] **AC-8:** **Reject** sets `status = 'rejected'`, `reviewed_at = now()`, optional `review_notes`.
- [x] **AC-9:** **Approve as Draft** inserts into `public.events` with `status = 'draft'`, maps fields per table below, generates slug, marks candidate `approved` + `reviewed_at`. *(RPC)*
- [x] **AC-10:** Slug = `slugify(title) + '-' + start_date`; on collision append `-2`, `-3`, etc. *(RPC + `generateEventSlug` preview)*
- [x] **AC-11:** Missing publish-required fields are visually flagged in the panel (draft may still be created).
- [x] **AC-12:** Post-approve/reject actions verified via follow-up query (event exists / candidate status updated). *(Dev: `verifyCandidateStatus` + `fetchEventById` in UI)*
- [x] **AC-13:** `event_candidates` remains admin-only; public site continues reading only `events`. *(RLS: no anon policies on candidates; events anon policy unchanged)*

> **Dev verification (2026-06-15):** Build passes; migration 004 applied. **QA** must independently verify in §8 (authenticated session; dev auth bypass will not load candidates).

### Milestone 2 — Publish, duplicates, sources (after M1 tested)

- [ ] **AC-14:** **Approve and Publish** creates event with `status = 'published'`, marks candidate `published`; requires confirmation + publish validation.
- [ ] **AC-15:** Publish validation blocks unless: title, start_date, location, (website_url or source_url), short_description present.
- [ ] **AC-16:** **Mark Duplicate** UI: pick existing `events.id`, set candidate `duplicate` + `duplicate_event_id`.
- [ ] **AC-17:** Source management page for `event_sources`.
- [ ] **AC-18:** Digest email links open candidate in admin.

### Field mapping: candidate → event (approve actions)

| `event_candidates` | `events` |
|---|---|
| `title` | `name` |
| generated slug | `slug` |
| `host_org` | `host_org` |
| `start_date` | `start_date` |
| `end_date` | `end_date` |
| `start_time` | `start_time` |
| `end_time` | `end_time` |
| `location` | `location` |
| `short_description` | `short_description` |
| `description` | `description` |
| `website_url` | `website_url` |
| `image_url` | `image_url` |
| `raw_text` | `ocr_text` |

### Candidate statuses

| Status | Meaning |
|--------|---------|
| `new` | Higher-confidence; ready for first review |
| `needs_review` | Lower-confidence or incomplete extraction |
| `approved` | Reviewed; event created (typically draft) |
| `published` | Converted to published event (M2) |
| `rejected` | Intentionally discarded |
| `duplicate` | Matched to existing event |

### Priority guidance (display + filter)

| Value | Meaning |
|-------|---------|
| `A` | Strong SCA fit — automotive, route-worthy, signature Gold Country |
| `B` | Good fit — winery, music, history, easy drive pairing |
| `C` | Possible fit — needs stronger reason or details |
| `Watch` | Worth monitoring; not necessarily publishable |

### Edge cases & constraints

- Do not publish automatically from the scheduled worker.
- Prefer draft approval over direct publish until M2 is tested.
- `short_description` may not exist on current `EventRow` type — confirm DB column and sync types before mapping.
- Slug collision handling must be deterministic (suffix increment).
- Null `start_date` candidates sort last but remain visible in queue.

---

## 4. Design (UX)

**Status:** Complete — 2026-06-15 (UX). Design QA passed 2026-06-15.  
**Mockups:** [event-triage-mockups.pen](../design/event-triage-mockups.pen) (Pencil)  
**Style reference:** [STYLE_GUIDE.md](../design/STYLE_GUIDE.md)

### Deliverables

- [x] §4 filled below (flows, screens table, interaction notes)
- [x] OQ-4 answered: sidebar label + placement → **Candidates**, sibling after Events
- [x] Pencil mockups: triage queue, split panel, filters, approve/reject, missing-field flags, mobile list, dark mode, empty queue
- [x] Team Log entry (see TEAM_WORKSPACE)

---

### Navigation (OQ-4 — resolved)

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Sidebar label** | **Candidates** | Short, scannable, distinct from Events (published workflow). Avoids jargon ("Triage", "Review queue"). |
| **Placement** | Sibling nav item **immediately after Events** | Matches mental model: discover → triage → manage published events. |
| **Icon** | 📥 (inbox) | Signals incoming items to process; consistent with emoji nav pattern until SVG migration. |
| **Keyboard shortcut** | `⌘5` / `Ctrl+5` | Locations=1, Events=2, Routes=3, OCR Test=4 (dev), Candidates=5. |
| **Not chosen** | Nested under Events | Hides daily workflow; triage is a first-class daily task per US-1. |
| **Not chosen** | "Event Review" | Ambiguous with editing events in Events module. |

---

### Layout

**Desktop (≥1024px):** Master–detail split pane — fixed proportion ~35% queue / 65% detail.

```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar  │ Toolbar: title + count │ status tabs │ search + filters      │
│          ├──────────────────┬──────────────────────────────────────────┤
│          │ Candidate queue  │ Detail / edit panel                      │
│          │ (table or cards) │ Editable fields + read-only source block │
│          │                  │ Save │ Reject │ Approve as Draft          │
└──────────┴──────────────────┴──────────────────────────────────────────┘
```

**Tablet (768–1024px):** Same split; queue column narrows; filters wrap to second toolbar row (reuse `responsive-filters` pattern).

**Mobile (≤768px):** Queue full-width list → tap row opens **full-screen detail** (sheet-style panel with back affordance). No side-by-side split.

Reuse existing shell: sidebar, sticky toolbar, `FormField`, status/priority pills from style guide. **Do not** reuse `AutoSaveEditDialog` as a modal — triage uses an **inline right panel** (or mobile full-screen) so the queue stays visible on desktop.

---

### User flows

#### Flow 1 — Daily triage (default)

1. Dave opens **Candidates** (default tab: **Actionable** = `new` + `needs_review`).
2. Queue sorted per AC-3; scans title, source, priority, date, duplicate warning.
3. Selects row → detail panel loads candidate; source context visible below fold.
4. Edits fields if needed → **Save** (updates `event_candidates` only).
5. **Approve as Draft** → light confirm dialog → draft event created → row leaves Actionable tab → toast success.
6. Or **Reject** → optional notes → confirm → row moves to Rejected tab.

#### Flow 2 — Save without approving

1. Select candidate → edit fields → **Save**.
2. Inline toast: "Candidate saved."
3. Selection stays on same row; status unchanged; remains in Actionable tab.

#### Flow 3 — Approve as Draft

1. From detail panel → **Approve as Draft**.
2. Confirm dialog (non-blocking copy): explains draft-only, shows generated slug preview.
3. Primary: **Create draft event**; secondary: Cancel.
4. On success: toast with link text "View in Events" (navigates to Events module, optional M1.1).
5. Candidate status → `approved`; panel clears or auto-selects next row in queue.

#### Flow 4 — Reject

1. **Reject** from detail panel → inline reject state (same panel, simplified) OR expand notes area with destructive confirm.
2. Optional `review_notes` textarea (pre-filled if edits were made).
3. **Reject candidate** confirms; no browser `confirm()`.
4. Toast: "Candidate rejected"; return focus to queue.

#### Flow 5 — Duplicate warning (read-only M1)

1. If `duplicate_event_id` set: amber banner on queue row + detail panel header.
2. Copy: "Possible duplicate of [event name]" (resolve name via join or stored label).
3. M1: informational only; **Mark Duplicate** picker is M2 (AC-16).

---

### Key screens / states

| Screen / state | Behavior | Mockup frame |
|----------------|----------|--------------|
| **Queue (no selection)** | Actionable tab; filters; empty detail placeholder | `01 · Queue (Actionable)` |
| **Split panel (selected)** | Row highlighted; editable + read-only sections; action bar | `02 · Split panel (selected)` |
| **Missing field flags** | Amber banner + per-field border; draft still allowed | `03 · Missing field flags` |
| **Approve confirm** | Modal overlay; slug preview; draft-only copy | `04 · Approve as Draft confirm` |
| **Reject** | Notes + destructive confirm in panel | `05 · Reject candidate` |
| **Mobile queue** | Full-width cards; tap → detail route | `06 · Mobile · Queue list` |
| **Mobile detail** | Full-screen edit; back affordance; sticky actions | `09 · Mobile · Detail full-screen` |
| **Empty queue** | "No candidates to review" + link to Approved tab | `08 · Empty queue` |
| **Dark mode** | Same split panel with dark tokens | `07 · Dark mode (selected)` |
| **Loading** | Skeleton rows in queue; panel disabled | Reuse platform UX loading pattern |
| **Error** | Inline banner in toolbar; retry | Reuse toast/banner from style guide |

---

### Status tabs

| Tab label | Filter (`status`) | Default? |
|-----------|-------------------|----------|
| **Actionable** | `new`, `needs_review` | Yes |
| **Approved** | `approved` | |
| **Rejected** | `rejected` | |
| **Duplicates** | `duplicate` | |
| **All** | (no status filter) | |

Tab shows count badge when > 0 (e.g. `Actionable (12)`). Switching tabs clears detail selection unless deep-linked (M2).

---

### Queue row content (AC-4)

Each row shows:

- **Title** (primary, semibold)
- **Priority** pill (`A` / `B` / `C` / `Watch`) — color-coded; A = blue emphasis
- **Status** pill (`new` vs `needs_review`)
- **Secondary line:** `{source_name} · {start_date formatted} · {start_time if set}`
- **Tertiary (truncated):** `short_description` one line
- **Links:** external icon for `website_url` or `source_url` (don't navigate away — `target=_blank`)
- **Duplicate banner** when `duplicate_event_id` present
- **Confidence** as subtle text or dot scale (0–1 → "87%")

Sort indicator in column header optional; default sort is fixed per AC-3.

---

### Detail panel sections

**Header:** "Edit candidate" + extraction confidence.

**Editable (AC-5):** title, host_org, start/end date, start/end time, location, short_description, description (textarea), image_url, website_url, priority (select), review_notes.

**Read-only (AC-6):** source_name, source_url (link), raw_text (scrollable monospace block), extraction_confidence, discovered_at, last_seen_at.

**Actions (sticky footer on mobile):**

| Button | Variant | Behavior |
|--------|---------|----------|
| Save | Secondary | AC-7 |
| Reject | Danger outline | Flow 4 |
| Approve as Draft | Success / primary green | Flow 3; disabled while saving |

---

### Missing publish fields (AC-11)

**M1 flags (informational — draft still created):**

Fields to flag when empty: `location`, `short_description`, `website_url` (and `source_url` as fallback per M2 AC-15).

| Pattern | Implementation |
|---------|----------------|
| **Summary banner** | Top of detail panel: "N fields missing for publish" + "Draft can still be created." |
| **Field-level** | Amber border + ⚠ on label + hint "Needed before publish" |
| **Not blocking** | Approve as Draft remains enabled |

Do not use browser alerts. Flags recompute on field blur/save.

---

### Interaction & accessibility

- **Selection:** Click row to select; `aria-selected` on active row; left border accent `#3B82F6`.
- **Keyboard:** Up/Down moves selection in queue; Enter focuses first editable field; Esc clears selection on desktop.
- **Focus trap:** Only in approve confirm dialog, not in split panel.
- **Live regions:** Toasts for save / approve / reject; `role="alert"` on error banner.
- **Labels:** All filters and form fields labeled; priority/status pills have `aria-label`.
- **Contrast:** Warning flags use style guide `--warning-*` tokens; verified in light and dark.
- **Touch:** 44px min row tap target on mobile cards.

---

### Dark mode

All triage screens support `data-theme="dark"` using tokens from STYLE_GUIDE §3.4. Dialog overlay and warning banners use dark-theme rows from §3.3. Dev should not hardcode light-only surfaces on the detail panel.

---

### Component reuse map

| UI element | Reuse from codebase / style guide |
|------------|-----------------------------------|
| App shell + sidebar | `App.tsx` pattern + new Candidates nav item |
| Toolbar | Sticky two-row pattern from Events/Locations |
| Status tabs | New `StatusTabs` or segmented control; match style guide chips |
| Queue table | `responsive-table` + `data-card` on mobile |
| Form fields | `FormField` component |
| Confirm approve | New `ConfirmDialog` (platform UX P0) |
| Toasts | `pushToast` pattern from Routes |
| Priority/status pills | New small badges per style guide |

---

### Open design questions (resolved)

| Question | Resolution |
|----------|------------|
| Sidebar label | **Candidates** after Events (OQ-4) |
| Modal vs split panel | **Split panel** desktop; full-screen mobile |
| Missing field UX | **Banner + field flags**; non-blocking for M1 |
| Duplicate picker | **M2** — M1 shows read-only warning only |
| AutoSaveEditDialog | **Not used** — inline panel with explicit Save |

---

### Design decisions (for §6)

| Date | Decision | Rationale | By |
|------|----------|-----------|-----|
| 2026-06-15 | Nav label **Candidates** after Events | OQ-4; clear daily workflow | UX |
| 2026-06-15 | Master–detail split on desktop | Speed triage without losing queue context | UX |
| 2026-06-15 | Light confirm for Approve as Draft | Guardrail without heavy friction | UX |
| 2026-06-15 | Missing-field flags non-blocking in M1 | AC-11 allows draft with gaps | UX |

---

### Design QA (UX verification)

**Reviewed:** 2026-06-15 (UX)  
**Artifacts:** §4 above + [event-triage-mockups.pen](../design/event-triage-mockups.pen) (9 frames)  
**Verdict:** **Approved for Dev handoff** — M1 flows, layout, and interaction patterns match §3 AC-1–11 intent. Remaining gaps are documented below (non-blocking).

#### Checklist vs §4 / AC

| Area | Result | Notes |
|------|--------|-------|
| Nav: **Candidates** after Events, ⌘5 | **Pass** | Mockups show placement; sidebar label now **📥 Candidates** per OQ-4 |
| Actionable default tab (`new` + `needs_review`) | **Pass** | Tab + count badge in frames 01–05 |
| Status tabs (5) + filters | **Pass** | Search, source, priority in toolbar |
| Split panel ~35/65 desktop | **Pass** | Frames 01–03, 07 |
| Queue row (AC-4) | **Partial** | Title, priority, status, meta line, tertiary `short_description` added; **Dev:** add `start_time`, external-link icon, confidence on row |
| Detail panel fields (AC-5–6) | **Partial** | Mockups show representative subset; **Dev:** implement full field list in §4 (scrollable panel) |
| Save / Reject / Approve actions | **Pass** | Sticky footer; reject uses in-panel confirm (not `confirm()`) |
| Approve light confirm + slug preview | **Pass** | Frame 04 |
| Missing-field flags (AC-11) | **Pass** | Frame 03 — banner + field borders; approve stays enabled |
| Duplicate warning (US-8) | **Pass** | Queue row + detail header banner |
| Mobile queue → full-screen detail | **Pass** | Frames 06 + 09 |
| Empty queue | **Pass** | Frame 08 |
| Dark mode | **Pass** | Frame 07 (`theme: Dark`); Dev uses STYLE_GUIDE §3.4 tokens |
| Loading / error | **Defer** | Reuse [platform UX mockups](../design/ssa-admin-ux-mockups.pen) patterns — no triage-specific frame |
| A11y (§4 interaction) | **Pass** (spec) | Dev implements `aria-selected`, focus trap in confirm only, live toasts |
| Style tokens | **Pass** | Primary `#3B82F6`, warning/success/destructive from STYLE_GUIDE |

#### Mockup remediation (2026-06-15)

- Added frames **07** (dark), **08** (empty queue), **09** (mobile detail)
- Sidebar nav label → **📥 Candidates**
- Queue rows: tertiary `short_description` line
- Detail panel: duplicate warning banner on split-panel states

#### Dev implementation notes (from QA)

1. **Detail panel is scrollable** — mockups crop fields; include all §4 editable + read-only blocks.
2. **Priority pills** — show B/C/Watch variants per style guide (mockups only illustrate A).
3. **Approve as Draft** — use green success primary per §4 table (not blue primary).
4. **Confirm dialog** — implement `ConfirmDialog` (platform UX P0); mockup frame 04 is reference only.
5. QA should re-check layout against frames 01–09 after build (§8 TP-8, TP-9).

---

## 5. Engineering (Dev)

**Status:** M1 build complete — 2026-06-15 (Dev). Migration 004 applied to Supabase `ydftcebaftngcdjvxrgl`.

### Deliverables

- [x] OQ-1: `event_candidates` + `event_sources` exist? RLS documented?
- [x] OQ-2: `events.short_description` column exists?
- [x] OQ-3: Approve-as-draft — RPC vs client; recommendation with rationale
- [x] §5 filled below (approach, schema impact, risks, sizing)
- [x] Team Log entry: `Dev | Event Triage §5 | complete`

---

### OQ-1 — Schema and RLS (closed)

**Tables exist in production** (RLS enabled on both):

| Table | Rows (2026-06-15) | Notes |
|-------|-------------------|-------|
| `public.event_candidates` | 55 (46 `needs_review`, 9 `new`) | FK to `event_sources`, optional FK `duplicate_event_id` → `events.id` |
| `public.event_sources` | 14 | Monitor reads active sources |
| `public.event_monitor_runs` | 1 | Monitor telemetry (M2 admin optional) |

**`event_candidates` columns** match the spec: `title`, `host_org`, dates/times, `location`, `short_description`, `description`, `image_url`, `website_url`, `raw_text`, `extraction_confidence`, `priority` (`A`/`B`/`C`/`Watch`), `status` (`new`/`needs_review`/`approved`/`rejected`/`published`/`duplicate`), `source_id`, `source_name`, `source_url`, `candidate_key` (unique), `duplicate_event_id`, `reviewed_at`, `review_notes`, `discovered_at`, `last_seen_at`, timestamps.

**`event_sources` columns:** `name`, `url` (unique), `source_type`, `category`, `priority`, `active`, `check_frequency`, `last_checked_at`, `notes`, timestamps.

**RLS gap (resolved 2026-06-15):** Migration `004_event_candidates_admin_rls.sql` adds `authenticated` SELECT/UPDATE on `event_candidates` and SELECT on `event_sources`, plus `approve_event_candidate_as_draft` RPC. *Historical note: before migration 004, both tables had RLS enabled with zero policies — PostgREST denied all admin access.*

**Required before M1 UI:** Add repo migration (e.g. `migrations/004_event_candidates_admin_rls.sql`) with policies such as:

- `event_candidates`: `authenticated` — `SELECT`, `UPDATE` (and optionally `INSERT` for manual candidates later); **no `anon` policies**
- `event_sources`: `authenticated` — `SELECT` only for M1 filters (M2 CRUD separate)
- Document in `docs/API_CONTRACTS.md`

No approve/reject RPC exists yet in `public` schema.

---

### OQ-2 — `events.short_description` (closed)

**Column exists** on `public.events` (`text`, nullable). Also on `event_candidates`.

**Type gap:** `EventRow` in `web/shared/types/models.ts` does **not** include `short_description`. `Events.tsx` select list also omits it. Before approve-as-draft mapping (AC-9), add:

1. `short_description?: string | null` to `EventRow` (+ JSDoc)
2. Include in Events admin select/save if we want parity in the existing Events editor (optional for M1; **required** for approve mapping)
3. Swift `Event` model sync per `docs/TYPE_SYNC.md` (iOS deferred for M1)

Public widget already displays `description`; `short_description` is the publish-validation field per M2 AC-15.

---

### OQ-3 — Approve-as-draft: RPC vs client (closed)

**Recommendation: Supabase RPC** — `approve_event_candidate_as_draft(p_candidate_id uuid)` returning the new `events.id`.

| Approach | Pros | Cons |
|----------|------|------|
| **RPC (recommended)** | Single transaction; no orphan event or stuck candidate; slug collision loop atomic; `created_by = auth.uid()` in one place; can be `SECURITY DEFINER` with explicit checks | Requires migration + `docs/SHARED_LOGIC.md` contract; slightly more setup |
| **Client two-step** | No DB function to maintain | Insert then update can partially fail; race on slug uniqueness; two round trips; harder to satisfy AC-12 verification |

**RPC behavior (proposed):**

1. `SELECT` candidate `FOR UPDATE` where `status IN ('new','needs_review')` (or allow re-approve guard)
2. Build base slug: `slugify(title) + '-' + start_date` (or `'undated'` if null — flag in UI)
3. Loop suffix `-2`, `-3`, … until `events.slug` unique (same semantics as spec; reuse pattern from `Events.tsx` `ensureUniqueSlug` but with date suffix base)
4. `INSERT INTO events` with field mapping below, `status = 'draft'`, `created_by = auth.uid()`
5. `UPDATE event_candidates SET status = 'approved', reviewed_at = now(), updated_at = now()`
6. `RETURN` new event id

**Save** and **Reject** can remain direct client `UPDATE` on `event_candidates` once RLS policies exist.

**No RPC needed for reject** (single-row update).

---

### Technical approach

**New module:** `web/src/features/EventCandidates.tsx` — split layout (queue + detail panel), patterned after Events list + edit panel density.

**Routing:** Extend `App.tsx` `View` union with `'candidates'`; sidebar entry (label: UX OQ-4 — recommend **"Candidates"** sibling to Events).

**Types** (`web/shared/types/models.ts`):

```typescript
EventCandidateStatus = 'new' | 'needs_review' | 'approved' | 'published' | 'rejected' | 'duplicate'
CandidatePriority = 'A' | 'B' | 'C' | 'Watch'
EventCandidate { id, source_id?, source_name?, source_url, title, ... } // mirror DB
```

**API** (`web/shared/api/supabaseQueries.ts` or feature-local helpers):

| Operation | Method |
|-----------|--------|
| List queue | `.from('event_candidates').select(...)` + status filter + client sort (or DB `order` matching AC-3) |
| Get one | `.select().eq('id', id).single()` |
| Save edits | `.update({...}).eq('id', id)` |
| Reject | `.update({ status: 'rejected', reviewed_at, review_notes })` |
| Approve as draft | `.rpc('approve_event_candidate_as_draft', { p_candidate_id })` |

**Shared logic** (`web/shared/utils/eventSlug.ts`):

- `generateEventSlug(title: string, startDate: string | null): string` — `slugify(title)` + `-` + ISO date or `undated`
- Document slug + collision rules in `docs/SHARED_LOGIC.md` (distinct from name-only slug used elsewhere in Events admin)

**Publish-field flags (AC-11):** Client-side helper `getMissingPublishFields(candidate)` — title, start_date, location, website_url|source_url, short_description — show inline warnings; do not block draft create.

**Dev auth note:** `DEVELOPMENT_AUTH.md` bypass uses a mock session without a real JWT. Candidate queries will fail in dev until either real login is used for this feature or dev policies are tested with a signed-in user. Plan QA with production auth or temporary dev RLS.

---

### Data model / API impact

| Area | Action |
|------|--------|
| Migration `004` | RLS policies for `event_candidates`, `event_sources` SELECT |
| Migration `005` (or same file) | RPC `approve_event_candidate_as_draft` |
| `models.ts` | `EventCandidate`, enums; add `short_description` to `EventRow` |
| `SHARED_LOGIC.md` | Approve mapping, slug-with-date, publish-field validation |
| `API_CONTRACTS.md` | Candidate list/update + RPC contract |
| `App.tsx` | Nav + view switch |
| No change | Public widget; `events` anon SELECT remains published-only |

**Field mapping (approve RPC):** per spec §3 table — `title` → `name`, `raw_text` → `ocr_text`, all other shared names 1:1.

**`event_candidates` has no `deleted_at`:** Do not use `baseQuery()` helper; query table directly.

---

### Cross-platform notes

- **Web:** M1 full implementation target (~7–8 dev days after migrations land; see sizing).
- **iOS:** Out of scope M1.

---

### Risks and dependencies

| Risk | Mitigation |
|------|------------|
| **RLS blocker** | Resolved — migration 004 applied |
| Partial approve failure | RPC transaction |
| `EventRow.id` typed as `number` but DB is `uuid` | Fix types when touching Events; use `string` uuid for candidate/event ids in new code |
| Dev mode no JWT | Test candidates feature with real auth session |
| Slug base differs from Events admin | Document two slug strategies; candidate approve uses title+date only |

---

### Effort estimate (M1, AC-1–13)

| Workstream | Estimate | AC coverage |
|------------|----------|-------------|
| DB migration: RLS + approve RPC | 1 day | AC-7–9, AC-12, AC-13 |
| Types, constants, slug helper, SHARED_LOGIC | 0.5 day | AC-9–10 |
| API helpers + RPC wiring | 1 day | AC-7–9, AC-12 |
| Candidate queue UI (tabs, filters, sort, row cards) | 2 days | AC-1–4 |
| Detail/edit panel + save/reject/approve | 2 days | AC-5–8, AC-11 |
| Nav, routing, loading/error states | 0.5 day | AC-1 |
| Manual QA (auth + live data) | 1 day | AC-1–13 |
| **Total** | **~8 days** | |

M2 items (publish, duplicate picker, sources admin) not included.

---

### Implementation checklist

- [x] **Blocker:** Apply `migrations/004_event_candidates_admin_rls.sql` (RLS + RPC) to Supabase
- [x] Update `docs/SHARED_LOGIC.md` (slug-with-date, approve mapping, validation rules)
- [x] Update `docs/API_CONTRACTS.md`
- [x] Add TypeScript types + `generateEventSlug`; add `short_description` to `EventRow`
- [x] Add `eventCandidateQueries` helpers / RPC wrapper
- [x] Build `EventCandidates.tsx` + `CandidateDetailPanel.tsx`
- [x] Wire sidebar nav in `App.tsx` (Candidates after Events, ⌘5)
- [x] Dev verification — build + migration + code paths for AC-1–13
- [ ] QA sign-off (authenticated manual test per §8)
- [ ] M2 after M1 sign-off

### Shipped files

| Area | Path |
|------|------|
| Migration | `migrations/004_event_candidates_admin_rls.sql`, `005_clean_candidate_description_text.sql` (BUG-001 — pending apply) |
| Feature UI | `web/src/features/EventCandidates.tsx`, `CandidateDetailPanel.tsx` |
| API | `web/shared/api/eventCandidateQueries.ts` |
| Utils | `web/shared/utils/eventSlug.ts`, `candidateSort.ts`, `candidatePublishFields.ts`, `normalizeCandidateText.ts` |
| Types | `web/shared/types/models.ts` (`EventCandidate`, `short_description` on `EventRow`) |
| Nav | `web/src/App.tsx` |

**Test note:** Dev auth bypass has no JWT — use production login or disable dev bypass to exercise Candidates in local dev.

---

## 6. Decision log

| Date | Decision | Rationale | By |
|------|----------|-----------|-----|
| 2026-06-15 | RLS required before candidate UI | `event_candidates`/`event_sources` have RLS on but zero policies — admin app cannot query until migration 004 | Dev |
| 2026-06-15 | Approve-as-draft via RPC | Atomic insert + status update; slug collision server-side | Dev |
| 2026-06-15 | Active priority over Ad Management (D-008) | User: finish triage first; ad PRD review later | PM |
| 2026-06-15 | M1 primary; platform UX parallel (D-005) | UX P0 does not block candidate review kickoff | PM |
| 2026-06-15 | M1 is draft-only; no Approve & Publish until tested | Source spec + reduces accidental publication risk | PM |
| 2026-06-15 | Web-only for M1; iOS deferred | Spec targets internal admin page; no mobile requirement stated | PM |
| 2026-06-15 | Nav label **Candidates** after Events; split-panel triage UX | OQ-4 + §4 complete; Pencil mockups in `event-triage-mockups.pen` | UX |

---

## 7. Source material

Imported from Codex document: **Sports Car Adventures Event Admin Review Spec**.

**Data flow summary:**

1. Monitor checks `event_sources` → writes `event_candidates`
2. Digest email to Dave
3. Admin reviews in this feature
4. Approved → `events` (draft or published)
5. Public site reads `events` where `published` only

**Reference query (default queue):**

```sql
select id, title, source_name, priority, status, start_date, start_time,
       location, short_description, website_url, source_url,
       extraction_confidence, duplicate_event_id, discovered_at, last_seen_at
from public.event_candidates
where status in ('new', 'needs_review')
order by start_date asc nulls last, priority asc, discovered_at desc;
```

---

## 8. Test plan (QA)

**Status:** **Ready for QA** — Dev M1 handoff 2026-06-15. Fill **Pass?** and sign-off when complete.

### Test environment

| Requirement | Detail |
|-------------|--------|
| App | Web admin at `localhost:5173` or deployed preview |
| Auth | **Real Supabase login** — dev auth bypass has no JWT; Candidates will not load without a session |
| Database | Supabase **Fiddletown-data** (`ydftcebaftngcdjvxrgl`) |
| Migration | `migrations/004_event_candidates_admin_rls.sql` applied (RLS + `approve_event_candidate_as_draft` RPC) |
| Data | Live `event_candidates` from monitor (default queue: `new` + `needs_review`) |
| Design ref | `docs/design/event-triage-mockups.pen`, spec §4 |

**Entry:** Sign in → **Candidates** (⌘5).

### Critical paths

| ID | Scenario | Steps | Expected | Pass? |
|----|----------|-------|----------|-------|
| TP-1 | Default queue | Open **Candidates** nav | Shows `new` + `needs_review`; sort matches AC-3 | |
| TP-2 | Filter tabs | Click each status tab | Correct subset per tab (AC-2) | |
| TP-3 | Save edits | Edit fields → Save | Only `event_candidates` updated; no `events` row (AC-7) | |
| TP-4 | Reject | Reject with notes | `status=rejected`, `reviewed_at` set (AC-8) | |
| TP-5 | Approve as draft | Approve as Draft → confirm | `events` row `status=draft`; candidate `approved`; field mapping correct (AC-9) | |
| TP-6 | No accidental publish | After TP-5, check DB + public widget | Event **not** `published`; not visible on public site (AC-13, D-004) | |
| TP-7 | Slug collision | Approve two same-title+date candidates | Second slug gets `-2` suffix (AC-10) | |
| TP-8 | Missing field flags | Open candidate missing publish fields | Flags visible; draft still allowed (AC-11) | |
| TP-9 | Duplicate warning | Row with `duplicate_event_id` | Warning shown in queue (AC-4, US-8) | |
| TP-10 | DB follow-up | After approve/reject | Re-query confirms state (AC-12) | |

### DB verification (TP-5, TP-6, TP-10)

After **Approve as Draft** (note `event_id` from UI or query):

```sql
-- TP-5 / TP-6: event is draft only
SELECT id, name, slug, status FROM public.events WHERE id = '<event_id>';
-- expect status = 'draft'

SELECT status, reviewed_at FROM public.event_candidates WHERE id = '<candidate_id>';
-- expect status = 'approved', reviewed_at not null
```

```sql
-- TP-6: candidate workflow never sets published on events
SELECT count(*) FROM public.events e
JOIN public.event_candidates c ON c.id = '<candidate_id>'
WHERE e.id = '<event_id>' AND e.status = 'published';
-- expect 0
```

After **Reject**:

```sql
SELECT status, reviewed_at, review_notes FROM public.event_candidates WHERE id = '<candidate_id>';
-- expect status = 'rejected'
```

### Regression

| Check | Pass? |
|-------|-------|
| Locations module loads and saves | |
| Events module loads and saves | |
| Routes module loads and saves | |
| Sidebar: **Candidates** after Events (⌘5); OCR Test unchanged (OQ-4) | |
| UX alignment with `event-triage-mockups.pen` (layout, labels, confirm flows) | |

### Findings (manual testing)

| ID | Severity | Area | Steps | Expected | Actual | Owner |
|----|----------|------|-------|----------|--------|-------|
| BUG-001 | P2 | Detail panel — `short_description`, `description` | Open candidate with scraped HTML body text | Readable plain text for editing | Literal entities/escapes, e.g. `&lt;p&gt;…you\'ll…&lt;/p&gt;\n` | Dev — **in progress** |

**BUG-001 remediation:**

| Step | Status | Detail |
|------|--------|--------|
| Shared contract | Done | `docs/SHARED_LOGIC.md` — Scraped text normalization |
| TS utility | Done | `web/shared/utils/normalizeCandidateText.ts` |
| Normalize on load | Done | `eventCandidateQueries.ts` `mapCandidate` — clean text in UI immediately |
| One-time DB cleanup | **Pending Dev** | `migrations/005_clean_candidate_description_text.sql` — updates `new` + `needs_review` rows only; idempotent |
| Monitor upstream | Optional | Stop writing encoded HTML at source |

**Apply migration 005** (Dev — not run automatically):

1. Review `migrations/005_clean_candidate_description_text.sql`
2. Run in Supabase SQL editor for **Fiddletown-data**, or: `supabase db push` / MCP `apply_migration` after review
3. Verify: `SELECT id, left(short_description, 80) FROM event_candidates WHERE status IN ('new','needs_review') LIMIT 5;`
4. Log row count affected in Team Log

Until migration runs, UI still shows clean text via normalize-on-load; **Save** persists cleaned values if user saves.
| BUG-002 | P2 | Detail panel — missing publish fields (AC-11, TP-8) | Open candidate missing `location`, `short_description`, and/or URL | Banner **plus** missing fields highlighted (amber border and/or background per §4) | Banner only; labels get ⚠ but inputs have default styling — hard to spot which fields need attention | Dev |

**BUG-002 notes:** §4 specifies "amber border + ⚠ on label" (frame `03 · Missing field flags`). `CandidateDetailPanel` has banner + `warnLabel()` but `FormField` has no warning variant. Suggest `warning` prop on `FormField` (border + subtle background using `--warning-*` / existing `warnBorder`/`warnBg` tokens). Affects: `title`, `start_date`, `location`, `short_description`, `website_url` when in `getMissingPublishFields()`.

### QA sign-off

| Field | Value |
|-------|-------|
| **Tester** | QA |
| **Date** | |
| **Result** | Pass / Fail / Blocked |
| **Notes** | |

### PM sign-off

| Field | Value |
|-------|-------|
| **Reviewer** | PM |
| **Date** | |
| **Decision** | Ship M1 / Do not ship |
| **Notes** | Requires QA pass on TP-5 + TP-6 (draft-only, D-004) before `Done`. |

### History

| Date | Result | Notes |
|------|--------|-------|
| 2026-06-15 | **Blocked** (pre-build) | QA ran before Dev handoff — no UI/migration in repo. **Superseded**; do not use those results. |
