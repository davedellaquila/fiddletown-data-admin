# SSA Admin Style Guide

| Field | Value |
|-------|-------|
| **Owner** | UX |
| **Status** | Review |
| **Last updated** | 2026-06-15 |
| **Platforms** | Web (primary), iOS (parity target) |
| **Visual reference** | [ssa-admin-style-guide.pen](./ssa-admin-style-guide.pen) · [ssa-admin-ux-mockups.pen](./ssa-admin-ux-mockups.pen) |

This guide defines the visual and interaction language for SSA Admin. It is the source of truth for design decisions; implementation should converge on these tokens and patterns (see [platform UX assessment](../backlog/platform-ux-assessment.md) for migration priorities).

---

## 1. Brand & tone

**Product name:** SSA Admin  
**Context:** Internal admin tool for Fiddletown area content (locations, events, routes).

**Voice (UI copy):**
- Plain, direct, professional — not marketing language.
- Prefer user outcomes over technical terms (e.g. “Delete event” not “Soft delete”).
- Confirm destructive actions with a clear consequence, not jargon.
- Error messages: what happened + what to do next.

**Visual tone:**
- Clean utility UI — dense data tables, efficient toolbars.
- Restrained color; status and primary actions carry most of the chroma.
- No decorative gradients in app chrome (login screen exception is allowed).

---

## 2. Design principles

1. **Predictable modules** — Locations, Events, and Routes share the same shell: sidebar → toolbar → table/cards → edit dialog.
2. **Progressive disclosure** — Primary actions visible; bulk and advanced filters behind Actions menu or a Filters panel.
3. **Feedback in-app** — Toasts and inline banners, not browser `alert()` / `confirm()`.
4. **Accessible by default** — Visible focus, labeled controls, 44px touch targets on mobile.
5. **Theme parity** — Light and dark modes are first-class; no white flash in dark mode dialogs.

---

## 3. Color system

### 3.1 Canonical tokens

Use CSS custom properties (web) and named constants (iOS). **Primary blue is `#3B82F6`** — this is the canonical brand action color.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | `#FFFFFF` | `#111827` | App main area |
| `--foreground` | `#1F2937` | `#F9FAFB` | Primary text |
| `--card` | `#FFFFFF` | `#1F2937` | Buttons, inputs, cards, dialogs |
| `--muted` | `#F8F9FA` | `#1F2937` | Toolbars, secondary surfaces |
| `--muted-foreground` | `#6B7280` | `#9CA3AF` | Hints, placeholders, secondary text |
| `--border` | `#E5E7EB` | `#374151` | Dividers, input borders |
| `--sidebar` | `#F9FAFB` | `#1F2937` | Sidebar background |
| `--sidebar-border` | `#E5E7EB` | `#374151` | Sidebar edge |
| `--primary` | `#3B82F6` | `#3B82F6` | Primary buttons, active nav, links |
| `--primary-hover` | `#2563EB` | `#2563EB` | Primary hover |
| `--primary-active` | `#1D4ED8` | `#1D4ED8` | Primary pressed |
| `--destructive` | `#DC2626` | `#DC2626` | Delete, irreversible actions |
| `--success` | `#059669` | `#10B981` | Success toast, publish (dark) |
| `--success-muted` | `#D1FAE5` | `#065F46` | Published badge background |
| `--warning` | `#D97706` | `#F59E0B` | Archive actions |
| `--warning-muted` | `#FEF3C7` | `#78350F` | Archived badge background |
| `--info` | `#1D4ED8` | `#60A5FA` | Selection bar, filter chips |
| `--info-muted` | `#EFF6FF` | `#1E3A8A` | Selection bar background |
| `--focus-ring` | `#3B82F6` | `#60A5FA` | Focus outline (2px, 2px offset) |

**Known drift (fix in platform UX sprint):** `index.css` `.btn.primary` uses `#1a73e8` in light mode; many components use `#3b82f6` inline. Converge on `--primary`.

### 3.2 Status colors

Status is communicated with badge color + label (emoji optional in legacy UI; prefer text + color for new work).

| Status | Badge background (light) | Text (light) | Badge background (dark) | Text (dark) |
|--------|---------------------------|--------------|---------------------------|-------------|
| **Draft** | `#F3F4F6` | `#374151` | `#374151` | `#F9FAFB` |
| **Published** | `#D1FAE5` | `#047857` | `#065F46` | `#10B981` |
| **Archived** | `#FEF3C7` | `#B45309` | `#78350F` | `#E5E7EB` |

**iOS mapping (current → target):** System `.green` / `.orange` / `.gray` → align with hex values above in a shared `DesignTokens` module.

### 3.3 Semantic feedback

| Type | Background (light) | Border (light) | Text (light) | Background (dark) | Border (dark) | Text (dark) |
|------|------------------|----------------|--------------|-------------------|---------------|-------------|
| Success toast | `#ECFDF5` | `#A7F3D0` | `#065F46` | `#064E3B` | `#047857` | `#A7F3D0` |
| Error toast / banner | `#FEF2F2` | `#FECACA` | `#991B1B` | `#7F1D1D` | `#991B1B` | `#FECACA` |
| Info banner / selection bar | `#EFF6FF` | `#BFDBFE` | `#1E40AF` | `#1E3A8A` | `#1D4ED8` | `#BFDBFE` |

### 3.4 Dark mode

Dark mode is **required** for every surface, component, and dialog. It is not an optional theme.

#### Web implementation

- Toggle sets `document.documentElement.setAttribute('data-theme', 'dark' | 'light')`.
- Persist preference in `localStorage` key `darkMode`.
- All new styles must use CSS variables from §3.1 — never hardcode light-only hex in components.
- `color-scheme: dark` on `html[data-theme="dark"]` (already in `index.css`).

```css
/* Token pattern — every semantic color needs both blocks */
:root {
  --background: #ffffff;
  --foreground: #1f2937;
  --card: #ffffff;
  /* … */
}
html[data-theme="dark"] {
  --background: #111827;
  --foreground: #f9fafb;
  --card: #1f2937;
  /* … */
}
```

#### Surfaces in dark mode

| Surface | Token / value | Notes |
|---------|---------------|-------|
| App background | `--background` `#111827` | Main content area |
| Sidebar | `--sidebar` `#1F2937` | Same as card in dark |
| Toolbar | `--muted` `#1F2937` | Sticky toolbar background |
| Table body | `#1F2937` | Match `--card` |
| Table header | `#374151` | One step lighter than body |
| Row border | `#374151` | `--border` |
| Dialog | `--card` `#1F2937` | **No white dialogs** — `ModalDialog` must respect `darkMode` |
| Dialog overlay | `rgba(0, 0, 0, 0.5)` | Same in both themes |
| Input / select / textarea | bg `#374151`, border `#4B5563` | Already in `index.css` |

#### Interactive states (dark)

| Control | Default | Hover | Active / focus |
|---------|---------|-------|----------------|
| Secondary button | `#374151` bg, `#4B5563` border | `#4B5563` bg | `#1F2937` bg |
| Primary button | `#3B82F6` | `#2563EB` | `#1D4ED8` |
| Sidebar nav (inactive) | `#374151` | `#4B5563` | — |
| Sidebar nav (active) | `#3B82F6` | no hover override | — |
| Icon button | `#374151` | `#4B5563` | focus ring `#60A5FA` |
| Disabled button | `#1F2937` bg, `#6B7280` text | — | — |

#### Filter chips (dark)

- Chip background: `#1E3A8A`
- Chip text: `#93C5FD`
- Chip border (optional): `#1D4ED8`

#### Scrollbars (dark)

- Track: `#1F2937`
- Thumb: `#4B5563` (hover `#6B7280`)

#### iOS implementation

- `preferredColorScheme(darkMode ? .dark : .light)` on root view.
- Persist `darkMode` in `UserDefaults` / app state (match web `localStorage`).
- Replace system `.green` / `.orange` / `.gray` status colors with shared hex from §3.2.
- Use semantic `Color` extensions backed by the same token table when `DesignTokens` ships.

#### Dark mode checklist (every new UI)

- [ ] Background, text, and borders use theme tokens
- [ ] Dialogs and sheets match `--card`, not system white
- [ ] Status badges use dark row from §3.2
- [ ] Toasts/banners use dark row from §3.3
- [ ] Focus ring visible on dark backgrounds (`#60A5FA`)
- [ ] Placeholder text `#9CA3AF` minimum contrast
- [ ] Verified in Pencil dark gallery frame and in running app

---

## 4. Typography

**Font stack (web):**
```css
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

**iOS:** System font (`.body`, `.headline`, etc.) — no custom typeface.

| Role | Size | Weight | Line height | Example |
|------|------|--------|-------------|---------|
| Page title | 24px | 600 | 1.25 | `📍 Locations` |
| Dialog title | 24px | 600 | 1.25 | Edit location |
| Body | 14px | 400 | 1.5 | Table cells, form labels |
| Label | 14px | 500 | 1.4 | Form field labels |
| Caption / badge | 12px | 500–600 | 1.33 | Status badges, hints |
| Micro | 11px | 400 | 1.4 | Shortcut hints in sidebar |

**Rules:**
- One page title per module (toolbar row 1).
- Required fields: label + `*` (red asterisk optional; asterisk alone is sufficient).
- Table headers: 12px, semibold, `--muted-foreground`.
- Avoid ALL CAPS except micro labels in mobile card fields (existing `.data-card-label` pattern).

---

## 5. Spacing & layout

**Base unit:** 4px. Use multiples: 4, 8, 12, 16, 20, 24, 32.

| Context | Value |
|---------|-------|
| Sidebar width (expanded) | 220px |
| Sidebar width (collapsed) | 60px |
| Main padding | 20px left/bottom (desktop); 12–16px (tablet/mobile) |
| Toolbar padding | 12px |
| Toolbar row gap | 8px (controls), 12px (sections) |
| Form field gap | 6px label-to-input; 16–24px between fields |
| Dialog padding | 32px |
| Table cell padding | 8–12px |
| Button padding | 8px 12px (default); 10px 16px (mobile min-height 44px) |

**Breakpoints** (from `index.css`):

| Name | Width | Behavior |
|------|-------|----------|
| Desktop | > 1024px | Full sidebar, table layout |
| Tablet | ≤ 1024px | Sidebar auto-collapse |
| Mobile | ≤ 768px | Card layout, larger touch targets |
| Narrow | ≤ 640px | Stacked toolbar and filters |

---

## 6. Shape & elevation

| Element | Border radius |
|---------|---------------|
| Buttons, inputs | 8px (6px for compact toolbar controls) |
| Cards, dialogs | 8–12px |
| Badges, chips | 4px (badges) / 999px (pills) |
| Icon buttons | 6px |

**Borders:** 1px solid `--border` on inputs, cards, toolbars. No drop shadows on toolbars; dialogs may use subtle shadow:

```css
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

**Motion:** 200ms ease for background, border, and color transitions. No animation on data tables.

---

## 7. Components

Visual specs live in [ssa-admin-style-guide.pen](./ssa-admin-style-guide.pen). Summary below.

**Pencil:** Frames prefixed `Light ·` use `theme: Light`; frames prefixed `Dark ·` use `theme: Dark`. Badge, toast, and form components bind to theme variables so they adapt when the parent frame theme changes. Scroll to **Dark · App shell preview** and **Dark · Component gallery** for the dark reference.

### 7.1 App shell

- **Sidebar:** Product title “SSA Admin” + subtitle “Fiddletown Data”; account email below; nav items; sign out; optional shortcut hint footer.
- **Active nav:** `--primary` fill, white text, no hover override.
- **Inactive nav:** `--card` fill, `--border` stroke; hover `--muted` tint.
- **Dev-only items** (OCR Test, Events List Dev): not in production nav — Settings/Developer only.

### 7.2 Module toolbar

Two-row pattern (Events may collapse row 2 into Filters panel):

**Row 1:** `[Module title] [New]` ··· `[Export] [Import] [Actions ▾]`  
**Row 2:** `[Search………………]` · `[Filters / dates / chips]` · `[Clear]`

- **New:** secondary button with optional sparkle prefix; not primary blue (creation opens dialog, not immediate commit).
- **Export / Import:** text labels at desktop; never icon-only without tooltip + `aria-label`.
- **Actions menu:** bulk ops, refresh, template — selection-required items show count.

### 7.3 Buttons

| Variant | Class / pattern | Use |
|---------|-----------------|-----|
| Primary | `.btn.primary` / `--primary` | Save, confirm publish, magic link send |
| Secondary | `.btn` / `--card` + border | New, Export, Import, Cancel |
| Success | `.btn.success` | Publish row / bulk publish |
| Warning | `.btn.warning` | Archive |
| Danger | `.btn.danger` | Delete |
| Icon | `.icon-action-btn` + SVG | Row actions (archive, delete) |
| Disabled | 60% opacity, `not-allowed` cursor | Loading / invalid state |

Minimum touch target: **44×44px** on viewports ≤ 768px.

### 7.4 Status badge

Inline pill: 4px 8px padding, 12px semibold text, colors from §3.2.  
Web: prefer text label (“Published”); emoji prefix is legacy.

### 7.5 Form fields (`FormField`)

- Label above input, 14px medium weight.
- Input: 12px padding, 8px radius, full width.
- Focus: 2px `--focus-ring` outline + border color match.
- Associate `<label htmlFor>` with input `id` (accessibility gap today).
- Textarea min-height: 80px, vertical resize only.

### 7.6 Data table

- Sticky header below toolbar (offset per module — see `layout.ts`).
- Sortable columns: click header toggles asc/desc.
- Row click opens edit dialog; checkbox stops propagation.
- Empty state: centered message + CTA — not a single table row “No records.”

### 7.7 Selection bar

When ≥1 row selected, show bar above table:

`4 selected · [Publish] [Archive] [Delete] · Clear selection`

Background `--info-muted`, border `--info` at 20% opacity.

### 7.8 Filter chips

Active filters as removable pills.

| Mode | Background | Text |
|------|------------|------|
| Light | `#DBEAFE` | `#1D4ED8` |
| Dark | `#1E3A8A` | `#93C5FD` |

“Clear all” uses `--primary` text in both themes.

### 7.9 Dialogs

| Type | Component | Notes |
|------|-----------|-------|
| Edit | `AutoSaveEditDialog` | Prev/next navigation, auto-save on navigate, ESC to close |
| Simple | `ModalDialog` | Import preview; must respect `darkMode` |
| Confirm | `ConfirmDialog` (planned) | Destructive actions; plain language |

Dialog max-width: 700px default; max-height 90vh, scroll inside.

### 7.10 Feedback

| Pattern | Duration | Placement |
|---------|----------|-----------|
| Toast (success/error) | 2.5s auto-dismiss | Bottom-right |
| Inline error (load failure) | Until dismissed/retry | Toolbar top |
| Loading | While fetch in flight | Toolbar banner or skeleton rows |

Do not use browser `alert()` or `confirm()`.

### 7.11 Empty states

- **No data yet:** “No events yet” + **Create event** primary CTA.
- **No filter results:** “No events match these filters” + **Clear filters** secondary.

---

## 8. Icons

**Target:** SVG icon set at 16px (row actions) and 20px (toolbar), stroke `#6B7280` / `#9CA3AF` dark.

**Current state:** Mixed emoji (nav, toolbar) and SVG (`archive.svg`, `trash.svg`, `duplicate.svg`).

**Rules for new work:**
- Prefer SVG with `aria-hidden="true"` on decorative icons; visible text or `aria-label` on the control.
- Do not rely on emoji alone for actionable controls.
- Lucide-style stroke icons are acceptable if added as a set (web + iOS SF Symbols equivalent).

---

## 9. Accessibility

- **Focus:** Visible 2px ring on all interactive elements (already in dark mode CSS; extend to light).
- **Labels:** Every input has a programmatic label; icon buttons have `title` + `aria-label`.
- **Live regions:** Toasts and errors use `role="status"` or `role="alert"`.
- **Color:** Status never conveyed by color alone — always include text label.
- **Keyboard:** ESC closes dialogs/menus; ⌘/Ctrl+1–3 module shortcuts (document in `?` help).
- **Contrast:** Body text on background ≥ 4.5:1; large text ≥ 3:1.

---

## 10. Cross-platform notes (iOS)

| Web pattern | iOS equivalent |
|-------------|----------------|
| Sidebar nav | `NavigationStack` + sidebar / tab pattern in `ContentView` |
| Module toolbar | `ToolbarView` / `EventsToolbarView` |
| Table | `List` |
| Edit dialog | `.sheet` + `Form` |
| Status badge | `StatusBadge` with shared hex colors |
| Dark mode | `preferredColorScheme` + semantic colors |

iOS should import the same status hex values and primary blue when `DesignTokens` is added.

---

## 11. Implementation checklist (Dev)

When building or refactoring UI:

- [ ] Use CSS variables from §3 — no new hardcoded hex in JSX
- [ ] Use shared components (`FormField`, `StickyToolbar`, `ActionMenu`, planned `Toast` / `ConfirmDialog`)
- [ ] Match spacing and radius from §5–6
- [ ] Support `data-theme="dark"` on all surfaces including modals
- [ ] Follow copy rules in §1 for errors and confirms
- [ ] Update Pencil mockups if the pattern changes materially

**Target CSS location:** consolidate tokens in `web/src/index.css` `:root` and `[data-theme="dark"]` (platform UX sprint).

---

## 12. Related documents

| Doc | Relationship |
|-----|--------------|
| [platform-ux-assessment.md](../backlog/platform-ux-assessment.md) | Prioritized gaps vs this guide |
| [ssa-admin-ux-mockups.pen](./ssa-admin-ux-mockups.pen) | Screen-level proposed UI |
| [ssa-admin-style-guide.pen](./ssa-admin-style-guide.pen) | Token swatches + light/dark component galleries |
| [TEAM_WORKSPACE.md](../TEAM_WORKSPACE.md) | Active design/engineering handoffs |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Dark mode §3.4 — tokens, surfaces, states, iOS, checklist; feedback/chips dual-theme tables |
| 2026-06-15 | Initial style guide (UX first pass) |
