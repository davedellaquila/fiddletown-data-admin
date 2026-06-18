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
| Ad Management System (FE-001) | [ad-management-system.md](./future-enhancements/ad-management-system.md) | PRD review + scope adjustments before promotion to `features/` |
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
- [Ad Management System (FE-001)](./future-enhancements/ad-management-system.md)
- [Style guide](./design/STYLE_GUIDE.md)
- [Event triage mockups (Pencil)](./design/event-triage-mockups.pen)
- [Feature specs & workflow](./features/README.md)
- [Feature spec template](./features/_TEMPLATE.md)
- [Product PRD](./SSA-Admin-PRD.md)
- [Development workflow](./DEVELOPMENT_WORKFLOW.md)
- [Shared logic contracts](./SHARED_LOGIC.md)
