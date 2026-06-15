# Decision Log

Major project decisions. Searchable history — for day-to-day handoffs see [TEAM_WORKSPACE.md](./TEAM_WORKSPACE.md).

**Maintained by PM.** New entries at the top.

---

| Date | ID | Decision | Rationale | Impact | By |
|------|-----|----------|-----------|--------|-----|
| 2026-06-15 | D-008 | **Event Triage M1 before Ad Management** | User priority; ad PRD needs review/adjustments before build | FE-001 stays parked; active work = event-candidate-review M1 | PM |
| 2026-06-15 | D-007 | **Future enhancements** live in `docs/future-enhancements/` | Large PRDs (e.g. Ad Management) tracked separately from backlog and active features | Import external specs into repo; promote to `features/` when scheduled | PM |
| 2026-06-15 | D-006 | PM agent owns all requirements and project documentation maintenance | User assignment; single owner keeps docs consistent and team informed | PM updates indexes, specs, DECISIONS, TEAM_WORKSPACE; UX/Dev contribute via Team Log | PM |
| 2026-06-15 | D-005 | **M1 Event Candidate Review before platform UX P0 sprint** | Unblocks Sports Car Adventures curation workflow; UX fixes can land alongside without blocking | Active priority = candidate review M1; UX backlog stays parallel | PM |
| 2026-06-15 | D-004 | Event Candidate Review M1 is **draft-only**; publish in M2 | Prevents accidental publication; matches Codex milestone plan | No Approve & Publish in M1 | PM |
| 2026-06-15 | D-003 | Event Candidate Review M1 is **web-only** | Spec targets internal admin page; iOS not requested | iOS deferred | PM |
| 2026-06-15 | D-002 | Candidate review ships as **new nav item in SSA Admin** | Same Supabase project, auth, and Events follow-up workflow | No separate app | PM |
| 2026-06-15 | D-001 | Repo markdown (`TEAM_WORKSPACE` + `docs/features/`) is the **agent collaboration workspace** | Version-controlled, no external tools, fits existing workflow | All agents read/update TEAM_WORKSPACE | PM |

---

## Pending decisions (not yet resolved)

| Topic | Options | Owner | Notes |
|-------|---------|-------|-------|
| OCR Test nav visibility | Dev-only vs admin-accessible | PM | See [platform-ux-assessment](./backlog/platform-ux-assessment.md) |
| Approve-as-draft transaction | Client two-step vs Supabase RPC | Dev | See event-candidate-review OQ-3 |
| Ad Management scheduling | After Event Triage M1 + PRD review | PM | FE-001 under review; see D-008 |
