# SSA Admin Documentation

Master index for all project documentation. **Maintained by PM** — see [DOCUMENTATION_MAINTENANCE.md](./DOCUMENTATION_MAINTENANCE.md).

---

## Start here

| Doc | Purpose | Audience |
|-----|---------|----------|
| [TEAM_WORKSPACE.md](./TEAM_WORKSPACE.md) | Live collaboration hub — active work, team log, open questions | PM, UX, Dev (every session) |
| [AGENT_ONBOARDING.md](./AGENT_ONBOARDING.md) | Brief intro — rules and responsibilities for new agents | All (first session) |
| [DECISIONS.md](./DECISIONS.md) | Major project decisions (searchable history) | All |
| [SSA-Admin-PRD.md](./SSA-Admin-PRD.md) | Product requirements document (baseline scope) | PM, UX |

---

## Feature requirements

| Doc | Status | Description |
|-----|--------|-------------|
| [features/event-candidate-review.md](./features/event-candidate-review.md) | Review | Event candidate queue, edit, reject, approve-as-draft (M1) |
| [features/event-admin-review-spec.md](./features/event-admin-review-spec.md) | Imported | Original Sports Car Adventures admin review spec imported from the curation workspace |
| [features/README.md](./features/README.md) | — | Feature spec workflow and naming |
| [features/_TEMPLATE.md](./features/_TEMPLATE.md) | — | Template for new feature specs |

---

## Backlog & assessments

| Doc | Status | Description |
|-----|--------|-------------|
| [backlog/platform-ux-assessment.md](./backlog/platform-ux-assessment.md) | Review | Web admin UX first-pass (P0–P3) |
| [backlog/README.md](./backlog/README.md) | — | Incremental improvements index |
| [to-do](./to-do) | Legacy | Informal notes — migrate to backlog or future-enhancements |

---

## Future enhancements

Large, documented capabilities **not yet scheduled**. Full PRDs live here until promoted to `features/`.

| ID | Enhancement | Status | Doc |
|----|-------------|--------|-----|
| FE-001 | Ad Management System | Under review (deferred) | [future-enhancements/ad-management-system.md](./future-enhancements/ad-management-system.md) |
| FE-004 | Event selection & email | Specced | [future-enhancements/event-selection-email.md](./future-enhancements/event-selection-email.md) |
| FE-003 | iPad shared logic & parity | Specced (foundation done) | [future-enhancements/ipad-shared-logic-architecture.md](./future-enhancements/ipad-shared-logic-architecture.md) |
| FE-002 | Smarter repeat events | Specced | [future-enhancements/smarter-repeat-events.md](./future-enhancements/smarter-repeat-events.md) |

See [future-enhancements/README.md](./future-enhancements/README.md) for registry and workflow.  
**Plans audit:** [_SCANNED_PLANS.md](./future-enhancements/_SCANNED_PLANS.md)

---

## Design

| Asset | Description |
|-------|-------------|
| [design/STYLE_GUIDE.md](./design/STYLE_GUIDE.md) | **Style guide** — tokens, typography, components, accessibility (UX-owned) |
| [design/STYLE_GUIDE_V2_PROPOSAL.md](./design/STYLE_GUIDE_V2_PROPOSAL.md) | **Style guide v2 proposal** — assessment + modern refresh (for review, not implemented) |
| [design/ssa-admin-v2-style-guide.pen](./design/ssa-admin-v2-style-guide.pen) | Pencil presentation deck — v2 tokens, components, before/after, light + dark |
| [design/ssa-admin-style-guide.pen](./design/ssa-admin-style-guide.pen) | Pencil component gallery (colors, type, buttons, badges, forms) |
| [design/event-triage-mockups.pen](./design/event-triage-mockups.pen) | Event Triage M1 mockups (queue, split panel, actions) |
| [design/ssa-admin-ux-mockups.pen](./design/ssa-admin-ux-mockups.pen) | Platform UX mockups (UX-owned) |

---

## Technical contracts

| Doc | Purpose |
|-----|---------|
| [SHARED_LOGIC.md](./SHARED_LOGIC.md) | Business logic contracts (update before shared logic changes) |
| [API_CONTRACTS.md](./API_CONTRACTS.md) | API query contracts |
| [API_PATTERNS.md](./API_PATTERNS.md) | Query pattern examples |
| [TYPE_SYNC.md](./TYPE_SYNC.md) | TypeScript ↔ Swift sync guide |
| [SHARED_CONSTANTS.md](./SHARED_CONSTANTS.md) | Constants reference |
| [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md) | Cross-platform development process |

---

## Environment & operations

| Doc | Purpose |
|-----|---------|
| [EVENTS_PUBLISHING.md](./EVENTS_PUBLISHING.md) | Public events widget — Squarespace loader, GitHub Pages, Supabase |
| [handoffs/sports-car-events-publishing-handoff-2026-06-15.md](./handoffs/sports-car-events-publishing-handoff-2026-06-15.md) | Imported publishing handoff from the Sports Car Adventures curation workspace |
| [SUPABASE_CONFIG.md](./SUPABASE_CONFIG.md) | Supabase setup |
| [DEVELOPMENT_AUTH.md](./DEVELOPMENT_AUTH.md) | Dev auth bypass |
| [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) | Database migrations |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Historical implementation snapshot |

---

## Agent context (Cursor)

| File | Purpose |
|------|---------|
| [../.cursor/context.md](../.cursor/context.md) | Project context for agents |
| [../.cursor/patterns.md](../.cursor/patterns.md) | Code patterns |
| [../.cursor/rules/team-collaboration.mdc](../.cursor/rules/team-collaboration.mdc) | Multi-agent collaboration rule |

---

## Document ownership

| Category | Owner | Others may edit |
|----------|-------|-----------------|
| Feature specs §1–3 (requirements) | PM | UX, Dev (comments via Team Log) |
| Feature specs §4 (design) | UX | PM (scope alignment) |
| Feature specs §5 (engineering) | Dev | PM (scope tracking) |
| Feature specs §8 (test plan) | QA | PM (ship sign-off) |
| SHARED_LOGIC, API_*, TYPE_SYNC | Dev | PM updates when business rules change |
| TEAM_WORKSPACE, DECISIONS, this index | PM | All (Team Log entries) |
| Backlog / assessments | PM (from UX/Dev input) | UX, Dev (source material) |
| Future enhancements | PM | All (propose via Team Log) |
