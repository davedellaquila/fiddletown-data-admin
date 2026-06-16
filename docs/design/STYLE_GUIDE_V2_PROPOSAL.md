# SSA Admin — Style Guide v2 Proposal

| Field | Value |
|-------|-------|
| **Owner** | UX |
| **Status** | **For review** — not approved for implementation |
| **Date** | 2026-06-15 |
| **Audience** | Dave (product owner) |
| **Visual deck** | [ssa-admin-v2-style-guide.pen](./ssa-admin-v2-style-guide.pen) |
| **Reference module** | Candidates (built + [event-triage-mockups.pen](./event-triage-mockups.pen)) |
| **Supersedes** | [STYLE_GUIDE.md](./STYLE_GUIDE.md) *if approved* |

---

## Executive summary

SSA Admin works well functionally, but **looks like three different apps stitched together**. Locations, Events, and Routes use legacy table + modal patterns with inline styles, emoji toolbars, and browser dialogs. The **Candidates module** already points toward a cleaner, more modern direction: split-pane layout, pill tabs, left-accent row selection, in-app toasts, and consistent blue (`#3B82F6`).

**Proposal:** Adopt a unified **SSA Admin v2** design language anchored on the Candidates patterns, then roll it across all modules. Light and dark themes are first-class. No new features required — this is a visual and interaction refresh.

**Your decision:** Review this doc + the Pencil deck. If approved, we schedule a platform UX sprint (see [platform-ux-assessment.md](../backlog/platform-ux-assessment.md)) before or after Event Triage ship.

---

## 1. Current state assessment

### What works today

| Pattern | Where | Verdict |
|---------|-------|---------|
| Predictable module shell | All modules | Keep — sidebar → toolbar → content |
| Sticky toolbars | Events, Locations | Keep — refine visually |
| Dark mode toggle | App shell | Keep — extend token coverage |
| Auto-save edit dialog | Locations, Events | Keep for modal edits |
| Toast feedback | Routes, **Candidates** | **Expand app-wide** |
| Split master–detail | **Candidates** | **Adopt as optional layout** for dense workflows |
| Keyboard shortcuts | App shell | Keep — add discoverability (`?` help) |

### What feels dated

| Pattern | Where | Problem |
|---------|-------|---------|
| Browser `alert()` / `confirm()` | Events, Locations (~80 calls) | Jarring, inaccessible, breaks dark mode |
| Inline hex + `style={{}}` everywhere | All legacy modules | Primary color drift (`#1a73e8` vs `#3b82f6`), hard to theme |
| Emoji-only toolbar actions | Events especially | Unclear affordances; unprofessional at desktop width |
| Full-width blue sidebar nav buttons | App.tsx | Heavy; every item looks like a primary CTA |
| Plain HTML tables | Locations, Events, Routes | Functional but flat; no row hierarchy |
| Modal-only editing | Events/Locations | Fine for create/edit; poor for scan-and-triage flows |
| Weak empty / loading states | Legacy modules | "Loading…" text or blank tables |
| Dev tools in primary nav | OCR Test | Clutters production sidebar |

### Candidates vs legacy — side by side

| Dimension | Legacy (Events/Locations) | Candidates (target direction) |
|-----------|---------------------------|-------------------------------|
| **Layout** | Full-width table + modal | Master–detail split (35/65) |
| **Navigation within module** | Dropdowns + many filter rows | Pill **status tabs** + compact filter row |
| **Row selection** | Checkbox + highlight | **Left accent bar** + tinted background |
| **Feedback** | `alert()` | **Toast** (fixed top-right) |
| **Confirmations** | `confirm()` | Inline panel / modal overlay |
| **Badges** | Status emoji + inline styles | **Pill badges** (priority, status) |
| **Typography** | System default, inconsistent sizes | Clear hierarchy (22px title, 14px body, 12px meta) |
| **Spacing** | Ad hoc 8px / 16px mix | Consistent 12–16px padding, 8px gaps |
| **Dark mode** | Partial (tables OK; modals flash white) | Mostly consistent (some hardcoded toast colors remain) |

**Conclusion:** Candidates is not a different product — it is the **prototype of the platform look** we should standardize.

---

## 2. SSA Admin v2 — design direction

### Design principles (updated)

1. **One visual language** — Every module uses the same tokens, components, and feedback patterns.
2. **Content-first chrome** — Sidebar and toolbars recede; data and actions come forward.
3. **Triage-friendly density** — Lists show title + meta + tertiary line; details live beside or below, not always in modals.
4. **Feedback in-app** — Toasts, banners, confirm dialogs; never browser dialogs.
5. **Theme parity** — Every surface, dialog, and toast works in light and dark without flash.
6. **Accessible defaults** — Focus rings, labels, 44px touch targets, `aria-selected` on lists.

### Visual personality

- **Tone:** Professional internal tool — calm, efficient, trustworthy.
- **Shape:** Soft corners (8–12px), subtle elevation, not flat 2015 admin panels.
- **Color:** Blue primary for navigation and links; green for constructive actions (Approve, Publish); red for destructive; amber for warnings.
- **Type:** **Inter** (already in Pencil mockups) — slightly more polished than system-ui alone.
- **Motion:** 150–200ms transitions on hover, selection, sidebar collapse.

---

## 3. Token system (light + dark)

Canonical CSS custom properties. v2 tightens neutrals and adds elevation.

### 3.1 Surfaces

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#FAFBFC` | `#0F1419` | App canvas (slightly off-white) |
| `--foreground` | `#111827` | `#F3F4F6` | Primary text |
| `--card` | `#FFFFFF` | `#1A2332` | Cards, inputs, queue rows |
| `--muted` | `#F3F4F6` | `#151C28` | Toolbar, empty states, secondary panels |
| `--muted-foreground` | `#6B7280` | `#9CA3AF` | Meta lines, placeholders |
| `--border` | `#E5E7EB` | `#2D3748` | Dividers, input borders |
| `--sidebar` | `#FFFFFF` | `#151C28` | Sidebar background |
| `--sidebar-border` | `#E5E7EB` | `#2D3748` | Sidebar edge |
| `--sidebar-active` | `#EFF6FF` | `#1E3A5F` | Active nav item background |
| `--sidebar-active-accent` | `#3B82F6` | `#60A5FA` | Active nav left bar |

### 3.2 Brand & actions

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#3B82F6` | `#3B82F6` | Links, active tabs, focus |
| `--primary-hover` | `#2563EB` | `#2563EB` | Hover |
| `--primary-muted` | `#EFF6FF` | `#1E3A8A` | Selected row tint |
| `--success` | `#059669` | `#10B981` | Approve, Publish, success toast |
| `--success-muted` | `#D1FAE5` | `#065F46` | Published badge |
| `--destructive` | `#DC2626` | `#EF4444` | Reject, Delete |
| `--warning` | `#D97706` | `#F59E0B` | Flags, archive |
| `--warning-muted` | `#FFFBEB` | `#78350F` | Warning banner bg |

### 3.3 Elevation (new in v2)

| Token | Light | Dark |
|-------|-------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.05)` | `0 1px 2px rgba(0,0,0,.3)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.08)` | `0 4px 12px rgba(0,0,0,.4)` |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,.12)` | `0 12px 32px rgba(0,0,0,.5)` |

Use on toasts, confirm dialogs, and dropdown menus — not on every card.

### 3.4 Radius & spacing

| Token | Value |
|-------|-------|
| `--radius-sm` | `6px` — badges, chips |
| `--radius-md` | `8px` — buttons, inputs |
| `--radius-lg` | `12px` — cards, dialogs |
| `--space-1` … `--space-6` | `4, 8, 12, 16, 24, 32px` |

### 3.5 Typography

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Page title | 22px | 600 | Module header ("Events", "Candidates") |
| Section title | 18px | 600 | Panel headers ("Edit candidate") |
| Body | 14px | 400 | Forms, table cells |
| Meta | 12–13px | 400 | Secondary lines, timestamps |
| Label | 13px | 500 | Form labels |
| Badge | 11px | 500–700 | Priority, status pills |

**Font stack:** `'Inter', ui-sans-serif, system-ui, sans-serif`

---

## 4. Component patterns (v2)

### 4.1 Sidebar navigation (modernized)

**Current:** Each nav item is a bordered button; active = solid blue fill.

**v2:** Ghost nav items with **left accent bar** on active item.

```
┌─────────────────┐
│ SSA Admin       │
│ dave@…          │
├─────────────────┤
│ ▌ 📍 Locations  │  ← active: 3px blue bar + muted bg
│   📅 Events     │
│   📥 Candidates │
│   🗺️ Routes     │
├─────────────────┤
│ Sign out        │
└─────────────────┘
```

- Inactive: transparent bg, `--foreground` text
- Active: `--sidebar-active` bg, `--sidebar-active-accent` left border
- Collapsed: icon only, tooltip with label + shortcut

### 4.2 Module header + status tabs (from Candidates)

Two-row toolbar:

1. **Row 1:** Page title + optional count · status tab pills · primary actions (right)
2. **Row 2:** Search + filter controls (wrap on tablet)

Tab active state: filled primary chip (see mockups). Inactive: card bg + border.

### 4.3 List / queue rows (from Candidates)

- Full-width clickable row
- **Selected:** `border-left: 3px solid var(--primary)` + `--primary-muted` background
- **Content stack:** Title (semibold) + pills · meta line · tertiary line (truncated)
- **Hover:** subtle `--muted` background
- Mobile: same rows as cards with 44px min height

### 4.4 Data tables (Events, Locations, Routes)

Keep tables for bulk-select workflows, but apply v2 styling:

- Remove heavy thead gray blocks → use `--muted` header with 12px uppercase labels (optional)
- Row hover state
- Status as **pill badges** (not emoji alone)
- Sticky header below module toolbar
- `responsive-table` → card layout on mobile (existing pattern, restyled)

### 4.5 Buttons

| Variant | Light appearance | Use |
|---------|------------------|-----|
| **Primary** | Blue fill | Save filters, primary nav actions |
| **Success** | Green fill | Approve as Draft, Publish |
| **Secondary** | White/card + border | Save, Cancel |
| **Ghost** | Transparent | Toolbar secondary actions |
| **Danger** | Red fill or outline | Reject, Delete |

Fix: converge `.btn.primary` to `#3B82F6` (remove `#1a73e8` drift).

### 4.6 Feedback

| Type | Pattern |
|------|---------|
| Success | Toast top-right, green, 4s auto-dismiss |
| Error | Toast or inline banner with Retry |
| Warning | Amber banner in panel (missing fields, duplicates) |
| Confirm | Centered dialog with `--shadow-lg`, plain-language consequence |

### 4.7 Dialogs

- `--card` background in both themes
- `border-radius: var(--radius-lg)`
- Overlay: `rgba(0,0,0,.4)` light / `.6` dark
- No white flash in dark mode

---

## 5. Before → after (what changes for you)

### App shell

| Before | After |
|--------|-------|
| Email as sidebar title | **SSA Admin** wordmark + email in footer |
| Blue filled nav buttons | Ghost nav + accent bar |
| Emoji theme toggle | Icon button (optional text label) |

### Events module (example)

| Before | After |
|--------|-------|
| Dense toolbar, emoji actions | Labeled actions + Actions menu for bulk |
| `alert()` on save/error | Toast |
| Modal for everything | Modal for create/edit; optional split for review flows |
| Inline hex colors | CSS variables |

### Candidates (already close)

| Gap | v2 fix |
|-----|--------|
| Hardcoded toast colors | Theme-aware toast component |
| Inline styles | Shared CSS module / components |
| Sidebar still legacy | Shell v2 sidebar when platform migrates |

---

## 6. Implementation scope (if approved)

### Phase A — Foundation (~3–5 days)

- CSS token file (`tokens.css`) with light/dark
- Shared components: `Toast`, `ConfirmDialog`, `StatusTabs`, `Badge`, `ModuleHeader`
- Fix `.btn.primary` drift; remove inline hex in App shell

### Phase B — Shell + one module pilot (~3–5 days)

- Sidebar v2
- Migrate **Routes** or **Locations** as pilot (smaller than Events)
- Empty + loading state components

### Phase C — Remaining modules (~5–8 days)

- Events (largest; toolbar refactor)
- Candidates polish (token migration only)
- ModalDialog dark mode fix

### Out of scope for v2 visual refresh

- iOS SwiftUI reskin (track separately in FE-003)
- Pagination / virtual scroll
- SVG icon system (recommended but can follow v2)

---

## 7. Review checklist (for Dave)

Use this when reviewing the Pencil deck:

- [ ] **Overall direction** — Does v2 feel modern enough without being flashy?
- [ ] **Sidebar** — Prefer ghost nav + accent bar vs current blue buttons?
- [ ] **Candidates as north star** — OK to align Events/Locations to this density?
- [ ] **Light theme** — Off-white canvas (`#FAFBFC`) vs pure white?
- [ ] **Dark theme** — Deeper canvas (`#0F1419`) vs current `#111827`?
- [ ] **Green Approve / Publish** — Distinct from blue primary?
- [ ] **Timing** — Implement before Event Triage ship, after, or parallel Phase A only?

---

## 8. Appendix — file map

| Asset | Purpose |
|-------|---------|
| [ssa-admin-v2-style-guide.pen](./ssa-admin-v2-style-guide.pen) | **Presentation deck** — tokens, components, before/after, light + dark |
| [event-triage-mockups.pen](./event-triage-mockups.pen) | Candidates module screens (reference) |
| [STYLE_GUIDE.md](./STYLE_GUIDE.md) | Current v1 guide (unchanged until approval) |
| [platform-ux-assessment.md](../backlog/platform-ux-assessment.md) | P0–P3 engineering backlog |

---

## Decision (fill after review)

| Field | Value |
|-------|-------|
| **Reviewer** | |
| **Date** | |
| **Decision** | Approve / Revise / Defer |
| **Notes** | |
