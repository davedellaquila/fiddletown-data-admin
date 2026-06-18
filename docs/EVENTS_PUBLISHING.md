# Events publishing (Squarespace + Supabase)

How the public Sports Car Adventures events calendar is built, hosted, and updated.

**Last verified:** 2026-06-15

---

## Architecture

```text
Supabase (public.events, keywords, event_keywords)
      |
      | browser fetches via Supabase REST (anon key)
      v
GitHub Pages hosted widget JS
  https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js
      |
      | loaded by Squarespace code block
      v
Squarespace page
  https://sportscaradventures.com/events
  <div id="events-list"></div>
  SSWidgets.renderEvents({ ... })
```

**Event content** lives in Supabase, not Squarespace. The widget reads published rows in the browser and renders list, grid, and calendar layouts with filters.

**Website UI** is controlled by the hosted JavaScript file. Squarespace is a thin loader — routine widget changes ship through Git and GitHub Pages, not by pasting a large inline bundle.

---

## Repositories

| Location | Remote | Role |
|----------|--------|------|
| `ssa-admin-ios` (this repo) | `https://github.com/davedellaquila/fiddletown-data-admin.git` | Widget source, admin app, migrations |
| `Sports Car Adventures` planning folder | `https://github.com/davedellaquila/sports-car-adventures.git` | Planning/review artifacts only — not live widget source |

---

## Source files

| File | Purpose |
|------|---------|
| `web/code-snippets/events/event-list.js` | **Edit here** — primary widget source |
| `web/public/code-snippets/events/event-list.js` | **Deploy copy** — must match `code-snippets` version byte-for-byte before push |
| `web/code-snippets/events/event-list-dev.html` | Local preview (loads JS + calls `SSWidgets.renderEvents`) |
| `web/code-snippets/events/event-list.html` | **Legacy** — full inline bundle for emergency rollback only |

Keep `web/code-snippets/` and `web/public/code-snippets/` in sync for `event-list.js`.

---

## Squarespace setup (production)

The live Events page uses a **code block** on the page (not site-wide footer injection):

```html
<div id="events-list"></div>
<script src="https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js"></script>
<script>
  SSWidgets.renderEvents({
    mount: '#events-list',
    url: 'https://ydftcebaftngcdjvxrgl.supabase.co',
    key: '[public Supabase anon key — stored in Squarespace]',
    limit: 200
  });
</script>
```

Do **not** replace this with the old full inline `event-list.html` unless rolling back an emergency.

The anon key is intentionally public (browser-side). Access is enforced by Supabase Row Level Security policies, not key secrecy.

---

## Publishing event content

1. Create or update rows in `public.events` (via SSA Admin or Supabase).
2. Link keywords through `public.event_keywords` → `public.keywords`.
3. Ensure the event is visible to the public role (typically `status = 'published'` — verify active RLS and query behavior before changing publication rules).
4. Confirm the row in Supabase.
5. Hard-refresh `https://sportscaradventures.com/events` (widget may cache in `sessionStorage`).

---

## Publishing widget UI changes

1. Edit `web/code-snippets/events/event-list.js`.
2. Copy the file to `web/public/code-snippets/events/event-list.js` (identical contents).
3. Test locally — open `web/code-snippets/events/event-list-dev.html` in a browser (or use the admin app dev link if configured).
4. Commit and push to `main` on `fiddletown-data-admin`.
5. GitHub Actions (`.github/workflows/deploy-pages.yml`) builds `web/` and publishes `web/dist` to the `gh-pages` branch when `web/**` changes.
6. Verify the hosted script updated:
   ```bash
   curl -L -I https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js
   ```
7. Hard-refresh the live Squarespace page (visitors may need cache bust; the URL is versioned by deploy time).

**Hosting:** GitHub Pages (`davedellaquila.github.io/fiddletown-data-admin`) for the **widget script only**. The SSA Admin SPA is on **Vercel** (`https://ssa-admin-puce.vercel.app`). These are separate deploy paths.

---

## Local development

```bash
# From repo root — open dev preview
open web/code-snippets/events/event-list-dev.html
```

Or run the Vite dev server and use any admin-app link to the dev preview if present.

Edit `event-list.js`, refresh the browser. The dev HTML mirrors production: mount div + script tag + `SSWidgets.renderEvents(...)`.

---

## Widget API

The hosted script exposes:

```js
window.SSWidgets.renderEvents({
  mount: '#events-list',  // CSS selector for mount element
  url: 'https://....supabase.co',
  key: '...',             // Supabase anon key
  limit: 200              // max events to fetch
});
```

Current features include list/grid/calendar layouts, date and keyword filters, dark mode, pull-to-refresh (mobile), sessionStorage caching, and calendar day agendas.

---

## Verification commands

```bash
curl -L -I https://sportscaradventures.com/events
curl -L -I https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js
git -C /path/to/ssa-admin-ios status --short
diff web/code-snippets/events/event-list.js web/public/code-snippets/events/event-list.js
```

Expected:

- `sportscaradventures.com/events` → HTTP 200 (Squarespace)
- GitHub Pages `event-list.js` → HTTP 200
- `diff` between the two JS copies → no output

---

## Editorial / curation context

Planning docs for Sports Car Adventures event fit and candidate review live in the separate planning repo. The intended long-term flow:

```text
public.event_sources → public.event_candidates → admin review → public.events → public website
```

Do not auto-publish from discovery workers without a review step. See [features/event-candidate-review.md](./features/event-candidate-review.md).

---

## Related docs

- [SUPABASE_CONFIG.md](./SUPABASE_CONFIG.md) — Supabase project setup
- [web/code-snippets/events/README.md](../web/code-snippets/events/README.md) — quick reference for widget developers
- [future-enhancements/event-selection-email.md](./future-enhancements/event-selection-email.md) — planned widget extension
