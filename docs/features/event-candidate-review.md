# Feature: Event Triage (Candidate Review)

| Field | Value |
|-------|-------|
| **Status** | Review — **active priority** (see D-008) |
| **Also known as** | Event Admin Review, Event Candidate Review |
| **Author** | PM |
| **Created** | 2026-06-15 |
| **Source** | Codex — `event-admin-review-spec.md` (Sports Car Adventures) |
| **Platforms** | Web (M1); iOS deferred |

---

## 1. Problem & goals

### Problem statement

A daily monitor discovers potential events from configured sources and writes them to `public.event_candidates`. The public site (`sportscaradventures.com/events`) reads only from `public.events` where `status = 'published'`. Today there is no admin UI to review, edit, approve, or reject discovered candidates — creating a gap between automated discovery and curated publication.

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

- [ ] **AC-1:** New nav entry opens a **Candidate Queue** view (private admin only).
- [ ] **AC-2:** Default filter shows `new` + `needs_review`; tabs also support Approved, Rejected, Duplicates, All.
- [ ] **AC-3:** Queue sorts by `start_date asc nulls last`, then `priority asc`, then `discovered_at desc`.
- [ ] **AC-4:** Each row/card shows: title, source name, priority, status, start date/time, location, website/source link, extraction confidence, short description, duplicate warning if `duplicate_event_id` set.
- [ ] **AC-5:** Selecting a candidate opens a detail/edit panel with editable fields: title, host_org, start/end date, start/end time, location, short_description, description, image_url, website_url, priority, review_notes.
- [ ] **AC-6:** Read-only fields displayed: source_name, source_url, raw_text, extraction_confidence, discovered_at, last_seen_at.
- [ ] **AC-7:** **Save** updates only `public.event_candidates` (no event created).
- [ ] **AC-8:** **Reject** sets `status = 'rejected'`, `reviewed_at = now()`, optional `review_notes`.
- [ ] **AC-9:** **Approve as Draft** inserts into `public.events` with `status = 'draft'`, maps fields per table below, generates slug, marks candidate `approved` + `reviewed_at`.
- [ ] **AC-10:** Slug = `slugify(title) + '-' + start_date`; on collision append `-2`, `-3`, etc.
- [ ] **AC-11:** Missing publish-required fields are visually flagged in the panel (draft may still be created).
- [ ] **AC-12:** Post-approve/reject actions verified via follow-up query (event exists / candidate status updated).
- [ ] **AC-13:** `event_candidates` remains admin-only; public site continues reading only `events`.

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

*Lead UX Designer — to be completed.*

### Suggested layout (from source spec)

**Desktop:** dense operational layout — filter tabs + source/priority/search on top; candidate table/cards left; detail/edit panel right.

**Mobile:** list first; detail as full-screen panel or separate route.

### User flows (draft)

1. **Triage queue** → filter tabs → select candidate → review source context.
2. **Save edits** → return to queue (candidate stays in default filter until approved/rejected).
3. **Approve as draft** → confirmation (light) → candidate moves to Approved tab → event visible in Events admin as draft.
4. **Reject** → optional notes → candidate moves to Rejected tab.

### Open design questions

- New sidebar label: "Candidates" vs "Event Review" vs nested under Events?
- Reuse existing `AutoSaveEditDialog` / split-pane patterns from Events.tsx?
- How to surface "missing publish fields" flags — inline on fields vs summary banner?
- Duplicate picker UX for M2 — search existing events modal?

---

## 5. Engineering (Dev)

*Lead Developer — to be completed.*

### Technical approach (PM notes for sizing)

- New feature module: `web/src/features/EventCandidates.tsx` (or similar).
- New types: `EventCandidate`, `EventCandidateStatus`, `CandidatePriority` in `models.ts`.
- New API helpers in `supabaseQueries.ts`: list, get, save, reject, approve-as-draft.
- Approve-as-draft likely needs a Supabase RPC or multi-step transaction (insert event + update candidate atomically).
- Reuse `slugify()`; extend or add `generateEventSlug(title, startDate)` per spec (title + date, collision suffix).
- Register route/view in `App.tsx` sidebar.

### Data model / API impact

- **Types:** `EventCandidate` (new), possible `EventSource` (M2)
- **Queries:** candidate list with filters/sort; CRUD on `event_candidates`; insert into `events` on approve
- **Migrations:** Confirm `event_candidates` + `event_sources` tables exist in Supabase; RLS for admin-only access
- **Gap check:** `events.short_description` column vs current `EventRow` type

### Cross-platform notes

- **Web:** M1 target — full implementation
- **iOS:** Out of scope for M1; revisit if Dave needs mobile review

### Risks & dependencies

- Schema/RLS for `event_candidates` must exist before UI work
- Atomic approve (insert + status update) — avoid orphan events or stuck candidates
- Field name mismatch: candidate `title` → event `name`

### Implementation checklist

- [ ] Confirm Supabase schema + RLS for `event_candidates`
- [ ] Update `docs/SHARED_LOGIC.md` (slug-with-date, approve mapping, validation rules)
- [ ] Add TypeScript types + constants
- [ ] Add `supabaseQueries` helpers / RPC
- [ ] Build Candidate Queue + detail panel (M1)
- [ ] Wire sidebar nav
- [ ] Manual QA against AC-1–AC-13
- [ ] M2 items after M1 sign-off

---

## 6. Decision log

| Date | Decision | Rationale | By |
|------|----------|-----------|-----|
| 2026-06-15 | Active priority over Ad Management (D-008) | User: finish triage first; ad PRD review later | PM |
| 2026-06-15 | M1 primary; platform UX parallel (D-005) | UX P0 does not block candidate review kickoff | PM |
| 2026-06-15 | M1 is draft-only; no Approve & Publish until tested | Source spec + reduces accidental publication risk | PM |
| 2026-06-15 | Web-only for M1; iOS deferred | Spec targets internal admin page; no mobile requirement stated | PM |
| 2026-06-15 | Reuse existing SSA Admin app (new nav item) | Same Supabase project, same auth, same Events follow-up workflow | PM |

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
