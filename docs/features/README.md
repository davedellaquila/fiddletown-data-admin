# Feature Specs

Feature work is tracked as one markdown file per feature. The **Product Manager** creates or imports the spec; **UX** and **Dev** append to their sections as work progresses.

## Workflow

```
Intake → Spec review → UX design → Dev implementation → QA / ship
```

| Status | Meaning |
|--------|---------|
| `Intake` | Spec being written or imported (e.g. from Codex) |
| `Review` | PM + team aligning on scope and acceptance criteria |
| `Design` | UX defining flows and interaction |
| `Build` | Engineering implementing (web + iOS per project rules) |
| `QA` | Verification against acceptance criteria |
| `Done` | Shipped; spec archived as reference |

## File naming

```
docs/features/<short-kebab-name>.md
```

Examples: `event-calendar-view.md`, `bulk-location-import.md`

## Creating a new feature

1. Copy [`_TEMPLATE.md`](./_TEMPLATE.md) to a new file.
2. PM fills §1–3 (problem, users, acceptance criteria).
3. Update **Active Work** in [`../TEAM_WORKSPACE.md`](../TEAM_WORKSPACE.md) with the feature name and spec link.
4. Add a Team Log entry announcing the new feature.

## Importing an external doc (e.g. Codex)

1. Paste or attach the source document to the PM agent.
2. PM maps content into the template sections (do not leave a dangling raw paste — structure it).
3. PM flags gaps as **Open questions** in the spec and workspace.
4. UX and Dev only need the structured spec, not the original export.

## Who edits what

| Section | Owner |
|---------|-------|
| §1 Problem & goals | PM |
| §2 User stories | PM |
| §3 Acceptance criteria | PM |
| §4 Design (UX) | UX |
| §5 Engineering | Dev |
| §6 Decision log | Any role |
| §7 Implementation checklist | Dev (PM signs off) |
| §8 Test plan | QA (PM signs off) |

## Relationship to other docs

- **Business logic** introduced by a feature → update `docs/SHARED_LOGIC.md` before implementation (per `DEVELOPMENT_WORKFLOW.md`).
- **Types** → `web/shared/types/models.ts` remains source of truth.
- **API patterns** → `docs/API_CONTRACTS.md` / `docs/API_PATTERNS.md` when queries change.
