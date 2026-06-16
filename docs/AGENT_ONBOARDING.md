# Agent Onboarding

Brief intro for any agent joining **SSA Admin** (web React + iOS Swift, shared Supabase backend).

---

## What this project is

An admin app for managing locations, events, and routes for Sports Car Adventures / Fiddletown. TypeScript types are the source of truth; Swift models and utilities must stay in sync. **Active priority:** Event Triage M1 — build shipped; **QA verification pending** (approve-as-draft, draft-only guard).

---

## Read these first (every session)

1. **[TEAM_WORKSPACE.md](./TEAM_WORKSPACE.md)** — Active Work, Agent assignments, Team Log
2. **Active feature spec** — linked from Team Workspace (currently [event-candidate-review.md](./features/event-candidate-review.md))
3. **Your role section** below

Also useful: [`.cursorrules`](../.cursorrules), [`.cursor/patterns.md`](../.cursor/patterns.md), [DEVELOPMENT_WORKFLOW.md](./DEVELOPMENT_WORKFLOW.md)

---

## Roles & what you own

| Role | You own | You update |
|------|---------|------------|
| **PM** | Scope, priorities, acceptance criteria, all project docs | `TEAM_WORKSPACE`, `DECISIONS`, `docs/README`, feature specs §1–3 |
| **UX** | Flows, layout, interaction, accessibility, Pencil mockups | Feature spec **§4**; design assets in `docs/design/` |
| **Dev** | Implementation, types, API, migrations, cross-platform sync | Feature spec **§5**; code in `web/` and `ios/` |
| **QA** *(optional)* | Independent verification before ship | Feature spec **§8**; AC checkboxes in §3 |

**QA default:** Dev verifies functional ACs; UX verifies design ACs; **PM signs off** before `Done`. Use a dedicated QA session only for high-risk milestones (e.g. Event Triage approve-as-draft).

---

## Session start

1. Open `docs/TEAM_WORKSPACE.md` → read **Active Work** and **Agent assignments**
2. Scan **Team Log** (newest first) for messages to your role
3. Open the active feature spec; work only in **your section** unless assigned otherwise
4. Do not start new features or expand scope without PM alignment

---

## Session end (if you changed anything)

1. Add a **Team Log** row: `Date | Role | Topic | Message | Action needed`
2. Update your section of the feature spec
3. Tag `Decision:` in Team Log if you made a scope/architecture choice → PM records in `DECISIONS.md`
4. Set **Action needed** to whoever you unblocked (`PM`, `UX`, `Dev`, or `None`)

---

## Rules everyone follows

- **Simple solutions** — minimal diff, match existing patterns
- **No mock data in dev/prod** — tests only
- **Shared logic** — document in `SHARED_LOGIC.md` before implementing; TypeScript first, then Swift
- **Don't restructure docs** (except PM) — use Team Log to hand findings to PM
- **Parked work** — Ad Management, iPad parity, etc. live in `future-enhancements/`; don't implement until PM promotes them
- **Commits** — only when the user asks

---

## Handoff chain

```
PM (requirements) → UX (§4 design) → Dev (§5 build) → Dev/UX verify → PM sign-off → Done
```

---

## Paste this to start a new agent session

```
You are joining the SSA Admin project. Read docs/AGENT_ONBOARDING.md and docs/TEAM_WORKSPACE.md
(Active Work + Agent assignments) before doing anything. Work within your role's responsibilities.
Log updates in Team Log when you finish.
```

Replace the opening line with your role, e.g. *"You are the Dev agent…"* or *"You are the UX agent…"*.
