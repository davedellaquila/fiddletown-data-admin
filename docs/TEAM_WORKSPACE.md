# Team Workspace

**Single source of truth for cross-role collaboration on SSA Admin.**

All agents (Product, UX, Engineering) read this file at the start of a session and update it before ending work. Keep entries concise and timestamped.

---

## Roles & Responsibilities

| Role | Agent | Owns | Updates in workspace |
|------|-------|------|----------------------|
| **Product Manager** | PM | Requirements, documentation, scope, priorities, acceptance criteria, decision broadcast | All docs index, Active work, DECISIONS, open questions |
| **Lead UX Designer** | UX | User flows, wireframes, interaction patterns, accessibility | Design status, UX notes, review requests |
| **Lead Developer** | Dev | Architecture, implementation, API/types, cross-platform sync | Technical notes, implementation status, blockers |

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

- **Role**: `PM` | `UX` | `Dev`
- **Topic**: Short label (e.g. `Events filter`, `Scope cut`)
- **Message**: What changed, decided, or is blocked
- **Action needed**: Who should act next (`PM`, `UX`, `Dev`, `None`)

### 3. Handoffs

| From → To | Handoff artifact | Where it lives |
|-----------|------------------|----------------|
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
| **Status** | `Review` → ready for UX §4 + Dev schema check, then `Build` |
| **PM** | Priority locked: finish M1 before Ad Management; resolve open questions |
| **UX** | §4 triage queue + split-panel design |
| **Dev** | Schema/RLS check, effort sizing for M1 (AC-1–13) |
| **Target** | M1: list, edit, reject, approve-as-draft |

### Current focus

> **PM (2026-06-15):** **Finish Event Triage first.** Ad Management (FE-001) stays in future-enhancements for PRD review and adjustments — no implementation until triage M1 ships. Next: UX §4, Dev schema confirmation (OQ-1–3).

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
| 2026-06-15 | PM | Cursor plans scan | Reviewed 25 plans in `~/.cursor/plans/`. Imported 2 new (FE-004 event email, FE-002 repeat events full spec). 21 excluded (other projects). Audit: `_SCANNED_PLANS.md`. | None |
| 2026-06-15 | PM | Future enhancements | Added FE-003 iPad shared logic & parity plan. Foundation largely complete per IMPLEMENTATION_SUMMARY; remaining work = iOS feature gaps + sync for new web features. | None |
| 2026-06-15 | PM | Decision: priority | **Event Triage M1 first.** Ad Management (FE-001) deferred — PRD review/adjustments before any implementation. See D-008. | UX — triage §4; Dev — schema check |
| 2026-06-15 | PM | Future enhancements | Created `docs/future-enhancements/` registry. Imported Ad Management PRD as FE-001; migrated repeat-events idea as FE-002. | None |
| 2026-06-15 | PM | Decision: doc ownership | PM now maintains all requirements docs. Added `docs/README.md` index, `DOCUMENTATION_MAINTENANCE.md`, `DECISIONS.md`, formalized UX assessment in `backlog/`. Details in DECISIONS.md D-005, D-006. | All — read DECISIONS; route doc changes via Team Log |
| 2026-06-15 | PM | Decision: sequencing | M1 Event Candidate Review is primary; platform UX P0 runs parallel. | UX — §4 candidate review; Dev — schema + sizing |
| 2026-06-15 | PM | Event Candidate Review | Intook Codex spec → `docs/features/event-candidate-review.md`. 8 user stories, 13 M1 acceptance criteria, 5 M2 criteria. Decisions: draft-only M1, web-only, new nav in SSA Admin. | UX — §4 design; Dev — schema check + sizing |
| 2026-06-15 | UX | Style guide | Added `docs/design/STYLE_GUIDE.md` + `ssa-admin-style-guide.pen` (tokens, typography, components, a11y). Canon primary: `#3B82F6`. | PM/Dev — review; Dev — implement CSS variables sprint |
| 2026-06-15 | UX | Pencil mock-ups | Created `docs/design/ssa-admin-ux-mockups.pen` with 6 screens + reusable components (shell, events, empty state, confirm, feedback, login). Open in Pencil extension. | PM/Dev — review mock-ups in Pencil canvas |
| 2026-06-15 | UX | First-pass assessment | Reviewed web shell + Locations/Events/Routes. Top issues: browser `alert()`/`confirm()` feedback, inconsistent loading/empty states, Events “Clear” sets From=today (bug), dev nav items in prod sidebar, emoji-only icon buttons, ModalDialog ignores dark mode. Full P0–P3 list in chat. | PM — prioritize backlog; Dev — size P0/P1 |
| 2026-06-15 | PM | Workspace | Created `docs/TEAM_WORKSPACE.md`, feature template, and agent collaboration rule. | None |

---

## Open Questions

| ID | Question | Owner | Status |
|----|----------|-------|--------|
| OQ-1 | Do `event_candidates` and `event_sources` tables already exist in Supabase with documented RLS? | Dev | Open |
| OQ-2 | Does `events.short_description` exist in DB? Not on current `EventRow` type. | Dev | Open |
| OQ-3 | Approve-as-draft: client-side two-step or Supabase RPC/transaction? | Dev | Open |
| OQ-4 | Sidebar label and placement for candidate review nav | UX | Open |
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

- [Documentation index](./README.md)
- [Decision log](./DECISIONS.md)
- [Documentation maintenance (PM)](./DOCUMENTATION_MAINTENANCE.md)
- [Event Candidate Review spec](./features/event-candidate-review.md)
- [Future enhancements registry](./future-enhancements/README.md)
- [iPad parity (FE-003)](./future-enhancements/ipad-shared-logic-architecture.md)
- [Ad Management System (FE-001)](./future-enhancements/ad-management-system.md)
- [Style guide](./design/STYLE_GUIDE.md)
- [Pencil style gallery](./design/ssa-admin-style-guide.pen)
- [Feature specs & workflow](./features/README.md)
- [Feature spec template](./features/_TEMPLATE.md)
- [Product PRD](./SSA-Admin-PRD.md)
- [Development workflow](./DEVELOPMENT_WORKFLOW.md)
- [Shared logic contracts](./SHARED_LOGIC.md)
