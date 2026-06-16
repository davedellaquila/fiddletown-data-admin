# Events widget (Squarespace)

Public events calendar for Sports Car Adventures. Data from Supabase; UI from a GitHub Pages–hosted script loaded by Squarespace.

**Full publishing guide:** [docs/EVENTS_PUBLISHING.md](../../../docs/EVENTS_PUBLISHING.md)

---

## Files

| File | Role |
|------|------|
| **`event-list.js`** | Primary source — edit this file |
| **`../public/code-snippets/events/event-list.js`** | Deploy copy (must match before push) |
| **`event-list-dev.html`** | Local browser preview |
| **`event-list.html`** | Legacy full inline bundle — emergency rollback only |

Other files in this folder (`hover-tiles*.html`, `dark-mode-injection.html`, etc.) are experiments or alternates; production uses the hosted `event-list.js` pattern.

---

## Development workflow

### 1. Local preview

```bash
open web/code-snippets/events/event-list-dev.html
```

Or double-click `event-list-dev.html`. It loads `event-list.js` and calls `SSWidgets.renderEvents()` the same way Squarespace does.

### 2. Edit JavaScript

- Change `event-list.js` in this directory.
- Refresh the browser to test.
- Use DevTools for layout, filters, and Supabase fetch debugging.

### 3. Sync and deploy

```bash
cp web/code-snippets/events/event-list.js web/public/code-snippets/events/event-list.js
diff web/code-snippets/events/event-list.js web/public/code-snippets/events/event-list.js  # should be silent
```

Then commit, push to `main`, and confirm GitHub Pages serves the update. See [EVENTS_PUBLISHING.md](../../../docs/EVENTS_PUBLISHING.md) for the full checklist.

---

## Production Squarespace block

Squarespace only needs a mount element, the hosted script, and an init call:

```html
<div id="events-list"></div>
<script src="https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js"></script>
<script>
  SSWidgets.renderEvents({
    mount: '#events-list',
    url: 'https://ydftcebaftngcdjvxrgl.supabase.co',
    key: '…',  // anon key in Squarespace
    limit: 200
  });
</script>
```

Do not paste `event-list.html` into Code Injection for routine updates.

---

## Code structure (inside `event-list.js`)

- Widget initialization and `sessionStorage` caching
- Supabase fetch (events, then keywords / `event_keywords`)
- Client-side date and keyword filtering
- List, grid, and calendar renderers
- Event handlers (layout, filters, info popovers, pull-to-refresh)
- Injected CSS

---

## Live URLs

- Page: https://sportscaradventures.com/events
- Script: https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js
