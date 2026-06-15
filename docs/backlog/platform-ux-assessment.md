# Platform UX Assessment — First Pass

| Field | Value |
|-------|-------|
| **Author** | UX |
| **Date** | 2026-06-15 |
| **Status** | Review |
| **Scope** | Web admin — shell, Locations, Events, Routes |
| **Related** | [STYLE_GUIDE.md](../design/STYLE_GUIDE.md) · [ssa-admin-style-guide.pen](../design/ssa-admin-style-guide.pen) |

---

## Executive summary

**Strengths:** Module structure is predictable; CRUD + import/export flows exist on all three entities; Events has thoughtful power-user features (date filters, keywords, OCR, record navigation).

**Main risks:** Feedback and confirmation patterns feel dated (`alert()` / `confirm()`), visual language is inconsistent (emoji vs SVG, inline styles vs CSS tokens), and Events toolbar complexity will strain smaller screens. A focused first pass on **feedback system + design tokens + navigation hygiene** would noticeably improve perceived quality without blocking feature work.

**PM sequencing (D-005):** Platform UX sprint runs **parallel** to Event Candidate Review M1; P0 items should be fixed before calling the app production-ready.

---

## Priority recommendations

### P0 — Fix before production-ready

| Issue | What users experience | Recommendation |
|-------|----------------------|----------------|
| **Browser dialogs for errors/success** | 80+ `alert()` calls across modules; jarring, non-dismissible, inaccessible | Shared **Toast + inline banner** (extend Routes `pushToast` app-wide). Reserve modals for destructive confirms only. |
| **Events “Clear” filter bug** | “Clear” sets **From = today** instead of clearing dates | Reset `from` and `to` to empty; clear search, keywords, signature toggle. |
| **Dev tools in primary nav** | “OCR Test” and “Events List Dev” beside production modules | Hide behind dev flag or **Settings / Developer** section. |
| **Destructive actions via `confirm()`** | Native confirm dialogs; inconsistent copy (“soft delete” is jargon) | Shared **ConfirmDialog** with plain-language consequence. |
| **ModalDialog ignores dark mode** | Import preview and modals flash white in dark mode | Pass `darkMode` into `ModalDialog` (match `AutoSaveEditDialog`). |

### P1 — High impact polish

| Issue | Recommendation |
|-------|----------------|
| **Inconsistent loading UX** | Skeleton row or toolbar spinner + “Loading…” in all modules |
| **Weak empty states** | Contextual empty states + primary CTA (“Create event”) |
| **Emoji-only toolbar buttons** | Text labels at desktop; icon + label on tablet |
| **No bulk-selection affordance** | Selection bar when rows selected |
| **Primary color drift** | CSS variables (`--color-primary`, etc.); remove inline hex |
| **Form accessibility** | `htmlFor` / `id` pairing; `aria-invalid` + error text |
| **Events toolbar density** | Collapse advanced filters; active filter chips |

### P2 — Consistency & cross-platform parity

| Issue | Recommendation |
|-------|----------------|
| **Duplicate toolbar implementations** | Use `StickyToolbar` + shared `ModuleHeader` / `FilterBar` |
| **Mixed icon systems** | Standardize SVG icon set |
| **Sidebar identity** | “SSA Admin” title; email to account footer |
| **Magic link login UX** | Persistent “Check your email” panel |
| **Keyboard shortcuts undiscoverable** | `?` shortcut help modal |
| **iOS feature gap** | Track bulk/import/OCR parity separately |

### P3 — Later

- Pagination or virtual scroll
- Undo for bulk operations (toast + 5s undo)
- Filter persistence per module in `localStorage`
- Remove developer artifacts (`console.log`, odd tooltips)
- Split `Events.tsx` (~3,500 lines) for maintainability

---

## Proposed first-pass scope

One sprint focused on platform UX:

1. Shared feedback layer (Toast, ConfirmDialog, inline errors)
2. Design tokens (CSS variables)
3. Navigation cleanup (dev-only gating, product title)
4. Events filter UX (Clear bug, collapsed filters, chips)
5. Empty + loading states (shared components)
6. Bulk selection bar

**Out of scope:** pagination, full iOS parity, Events file refactor.

---

## Acceptance criteria (for promotion to feature spec)

- [ ] No user-facing `alert()` or `confirm()` in Locations, Events, or Routes
- [ ] Destructive actions use in-app confirm with plain-language copy
- [ ] Loading and empty states consistent across all three modules
- [ ] Events “Clear” resets all filters including dates
- [ ] OCR Test / Events List Dev hidden in production builds
- [ ] Dark mode correct in all dialogs
- [ ] WCAG baseline: form labels, icon button names, visible focus

---

## Open questions

| ID | Question | Owner |
|----|----------|-------|
| UX-1 | Should OCR Test remain in nav for content admins, or dev-only? | PM |
| UX-2 | Is “soft delete” acceptable admin language, or “Delete” / “Restore”? | PM |
| UX-3 | Effort for shared Toast + ConfirmDialog — can Routes toast be extracted in ~1 day? | Dev |
| UX-4 | Web-only polish first, or parallel iOS shell updates? | PM |

---

## Source

First-pass review of `App.tsx`, shared components, Locations, Events, Routes — cross-checked against PRD and iOS parity. Logged in TEAM_WORKSPACE 2026-06-15.
