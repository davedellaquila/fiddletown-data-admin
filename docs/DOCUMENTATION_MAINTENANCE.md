# Documentation Maintenance

**Owner: Product Manager (PM agent)**

The PM maintains all requirements documents and project documentation. Other agents contribute source material; the PM structures it, keeps indexes current, and broadcasts major decisions to the team.

---

## PM responsibilities

### Always maintain

| Artifact | Update trigger |
|----------|----------------|
| [TEAM_WORKSPACE.md](./TEAM_WORKSPACE.md) | Any active work change, handoff, or team message |
| [DECISIONS.md](./DECISIONS.md) | Any decision affecting scope, architecture, or cross-feature behavior |
| [README.md](./README.md) (this index) | New doc added, doc renamed, or doc retired |
| [features/*.md](./features/) | New feature intake, scope change, milestone shift |
| [backlog/*.md](./backlog/) | UX/Dev assessments, prioritized backlog changes |
| [future-enhancements/*.md](./future-enhancements/) | Future enhancement PRDs and registry |

### Keep aligned with implementation

When Dev ships or changes behavior, PM verifies:

- Feature spec status and acceptance criteria checkboxes
- [SHARED_LOGIC.md](./SHARED_LOGIC.md) reflects new business rules (Dev drafts; PM tracks)
- [SSA-Admin-PRD.md](./SSA-Admin-PRD.md) updated if baseline product scope changes
- Open questions closed or reassigned in TEAM_WORKSPACE

### Do not maintain directly (Dev/UX own content)

- Code and inline JSDoc
- `SHARED_LOGIC.md` / `API_*` technical prose (PM requests updates; Dev writes)
- Design assets in `docs/design/` (UX owns; PM links from specs)

---

## When to record a decision

Log to [DECISIONS.md](./DECISIONS.md) **and** announce in TEAM_WORKSPACE **Team Log** when:

- Feature scope is cut, expanded, or re-phased
- Platform priority changes (e.g. web-first, iOS deferred)
- A workflow default is set (e.g. draft-only approval)
- UX or technical approach is chosen over alternatives
- Something in the PRD is superseded by a feature spec

**Skip DECISIONS.md** for trivial implementation details — Team Log is enough.

---

## Intake workflow

### New feature (external spec, stakeholder request)

1. Copy [features/_TEMPLATE.md](./features/_TEMPLATE.md) → `features/<name>.md`
2. Structure problem, stories, acceptance criteria (don't leave raw dumps)
3. Set Active Work in TEAM_WORKSPACE
4. Log Team Log entry with action owners
5. Add row to docs/README.md feature table

### UX or Dev assessment

1. Create `backlog/<topic>.md` with prioritized findings
2. Link from TEAM_WORKSPACE backlog section
3. PM decides: new feature spec, fold into active feature, or defer

### Future enhancement (large PRD, not scheduled)

1. Copy [future-enhancements/_TEMPLATE.md](./future-enhancements/_TEMPLATE.md) or import external PRD into `future-enhancements/<name>.md`
2. Note **Original source** path if imported from outside repo (e.g. Cursor plans)
3. Assign **FE-###** ID in [future-enhancements/README.md](./future-enhancements/README.md)
4. Add row to docs/README.md future enhancements table
5. When approved for build: promote to `docs/features/` and set status **Promoted**

### Question resolution

1. Close row in TEAM_WORKSPACE Open Questions
2. If answer is a decision → DECISIONS.md
3. Update affected feature spec or technical doc reference

---

## Team notification protocol

Major decisions use this broadcast pattern in **Team Log**:

```
| Date | PM | Decision: <title> | <one sentence>. Details in DECISIONS.md §<date>. | <who acts next> |
```

All agents should read TEAM_WORKSPACE at session start (per `.cursor/rules/team-collaboration.mdc`).

---

## Review cadence

| When | PM action |
|------|-----------|
| Feature status change | Update spec header + Active Work |
| Milestone complete | Check off acceptance criteria; log completion |
| New agent session on active feature | Verify open questions still accurate |
| Conflicting docs detected | Resolve; note in DECISIONS if precedence changes |

---

## Precedence (conflict resolution)

1. **Active feature spec** (`docs/features/<active>.md`) — current feature truth
2. **DECISIONS.md** — project-wide choices
3. **SSA-Admin-PRD.md** — baseline product vision
4. **SHARED_LOGIC / API contracts** — implementation truth for business logic
5. **IMPLEMENTATION_SUMMARY.md** — historical snapshot only (may be stale)
