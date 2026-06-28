# Future Enhancements

Major capabilities and product ideas that are **documented but not scheduled** for active development.

**PM maintains this registry.** When an enhancement is approved for near-term build, promote it to [`docs/features/`](../features/) and update status to **Promoted**.

---

## How this differs from other docs

| Location | What belongs there | Time horizon |
|----------|-------------------|--------------|
| **future-enhancements/** (here) | Full PRDs, large systems, significant new product areas | Not scheduled — inventory of possibilities |
| **backlog/** | UX assessments, polish, bugs, incremental improvements | Next sprint(s), parallel to active work |
| **features/** | Approved work with acceptance criteria | Active or imminent implementation |
| **to-do** | Legacy informal notes | Migrate here or to backlog |

---

## Registry

| ID | Enhancement | Status | Priority | Effort | Doc |
|----|-------------|--------|----------|--------|-----|
| FE-001 | Regional Advertising Manager | Specced | TBD, likely after regional events foundation | Large, phased | [ad-management-system.md](./ad-management-system.md) |
| FE-005 | New event email notifications | Specced | TBD | Medium | [new-event-email-notifications.md](./new-event-email-notifications.md) |
| FE-004 | Event selection & email | Specced | After Event Triage M1 | Medium | [event-selection-email.md](./event-selection-email.md) |
| FE-003 | iPad shared logic & parity | Specced (foundation done) | After Event Triage M1 | Large | [ipad-shared-logic-architecture.md](./ipad-shared-logic-architecture.md) |
| FE-002 | Smarter repeat events | Specced | After Event Triage M1 | Medium | [smarter-repeat-events.md](./smarter-repeat-events.md) |

### Status definitions

| Status | Meaning |
|--------|---------|
| **Idea** | Concept or one-liner; needs a spec |
| **Specced** | PRD or detailed doc exists in this folder |
| **Under review** | Team evaluating priority and fit |
| **Approved** | Greenlit for planning; not yet promoted to `features/` |
| **Promoted** | Moved to active feature spec — see linked feature doc |
| **Deferred** | Explicitly parked with reason |
| **Cancelled** | Will not implement |

---

## Adding an enhancement

1. Copy [`_TEMPLATE.md`](./_TEMPLATE.md) → `<short-kebab-name>.md`
2. Assign next **FE-###** ID in this README
3. If importing an external doc (Cursor plan, stakeholder PRD), copy content into the repo and note **Original source** path
4. Add registry row
5. Log in [TEAM_WORKSPACE.md](../TEAM_WORKSPACE.md) Team Log if team should know
6. Update [_SCANNED_PLANS.md](./_SCANNED_PLANS.md) if scanning `~/.cursor/plans/`

## Promoting to active work

1. Create `docs/features/<name>.md` from feature template (trim PRD to M1 scope if needed)
2. Set enhancement status → **Promoted** with link to feature spec
3. Update TEAM_WORKSPACE Active Work
4. Update [docs/README.md](../README.md) feature table
