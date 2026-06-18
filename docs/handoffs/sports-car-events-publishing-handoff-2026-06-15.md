# Cursor Handoff: Sports Car Adventures Events Publishing

Last verified: 2026-06-15

## Short version

The Sports Car Adventures Events page is a Squarespace page, but the event UI is no longer fully pasted inline as one giant script. Squarespace now contains a small loader block:

1. A mount element: `<div id="events-list"></div>`
2. A hosted script loaded from GitHub Pages:
   `https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js`
3. A call to `SSWidgets.renderEvents(...)` with the Supabase URL, public anon key, mount selector, and limit.

The events themselves are published in Supabase. The widget reads from Supabase in the browser and renders the public calendar.

## Current architecture

```text
Supabase
  public.events
  public.keywords
  public.event_keywords
      |
      | browser fetches via Supabase REST API
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

## What is live right now

- `https://sportscaradventures.com/events` is served by Squarespace.
- The live Squarespace page currently loads:
  `https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js`
- That GitHub Pages script returned HTTP 200 when checked on 2026-06-15.
- `https://sportscaradventures.com/code-snippets/events/event-list.js` returned HTTP 404, so the script is not hosted by Squarespace itself.
- There was no local `vercel.json` or `.vercel` config found in the SSA Admin repo. Based on current evidence, Vercel is not the active hosting path for the widget.

## Repositories and folders

There are two relevant local folders:

### 1. Planning / handoff workspace

```text
/Users/davedellaquila/Documents/Sports Car Adventures
```

Git remote:

```text
https://github.com/davedellaquila/sports-car-adventures.git
```

This folder contains planning and review artifacts, including:

- `event-manager-plan.md`
- `event-candidates-2026-06-13.md`
- `event-admin-review-spec.md`
- `cursor-events-publishing-handoff.md`

This is not where the live widget source lives.

### 2. SSA Admin / widget source repo

```text
/Users/davedellaquila/Documents/Projects/ssa-admin-ios
```

Git remote:

```text
https://github.com/davedellaquila/fiddletown-data-admin.git
```

Current branch observed locally:

```text
main
```

The widget source files are:

```text
web/code-snippets/events/event-list.js
web/public/code-snippets/events/event-list.js
```

Those two files matched byte-for-byte when checked on 2026-06-15.

The public/static copy under `web/public/code-snippets/events/event-list.js` is the important one for GitHub Pages hosting.

## How publishing works now

### Event content publishing

Events are rows in Supabase, not Squarespace events.

Known live Supabase project:

```text
https://ydftcebaftngcdjvxrgl.supabase.co
```

Public display reads from:

```text
public.events
```

The public widget uses rows where the event is effectively published. Prior work established `status = 'published'` as the public status, although the current widget fetch select does not visibly include `status` in the checked JS. Cursor should verify the active Supabase policies/query behavior before changing publication logic.

Tags/filters use:

```text
public.keywords
public.event_keywords
```

The widget fetches events first, then fetches event-keyword relationships and keyword names, then attaches keyword arrays client-side.

### Website UI publishing

The Events UI is controlled by the hosted JavaScript file:

```text
web/public/code-snippets/events/event-list.js
```

The widget exposes:

```js
window.SSWidgets.renderEvents = renderEventsWidget;
```

Squarespace calls it after loading the hosted script. That means routine UI changes should happen in Git, then be pushed/deployed through GitHub Pages, not by pasting the whole bundle into Squarespace.

## Current Squarespace block shape

The live page contains this shape:

```html
<div id="events-list"></div>
<script src="https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js"></script>
<script>
  SSWidgets.renderEvents({
    mount: '#events-list',
    url: 'https://ydftcebaftngcdjvxrgl.supabase.co',
    key: '[public Supabase anon key currently in Squarespace]',
    limit: 200
  });
</script>
```

Do not replace this with the old full inline bundle unless there is a rollback emergency. The goal is to keep Squarespace as a thin loader and make source changes through Git.

## Recent widget behavior/features

The current widget source includes:

- List, grid, and calendar layouts.
- Date filters and weekend/week presets.
- Keyword filters backed by `public.keywords` and `public.event_keywords`.
- Client-side filtering after broad event fetches to avoid PostgREST date edge cases.
- Image display controls and image preview behavior.
- Dark mode toggle.
- Sticky control sections and compact mobile controls.
- Calendar day agenda panels.
- Pull-to-refresh support on mobile.
- Session storage caching keyed by Supabase URL/date range/limit.

## Event curation flow

The intended editorial flow is:

1. Find candidate events that are a good fit for Sports Car Adventures clients.
2. Review source quality, date, location, ticketing, and fit.
3. Insert approved events into `public.events`.
4. Add keyword links through `public.event_keywords`.
5. Verify the row exists in Supabase.
6. Verify the public page renders it.

The local planning docs define the fit:

- Automotive events.
- Gold Country destinations.
- Wine country events.
- Drive-worthy local culture.

Core geography includes Amador County, El Dorado County, Calaveras County, and nearby route-worthy towns.

## Candidate/admin direction

`event-admin-review-spec.md` describes the desired future admin workflow:

```text
public.event_sources
  -> public.event_candidates
  -> admin review
  -> public.events
  -> public website
```

Important rule: do not publish automatically from a scheduled discovery worker. Candidate discovery and public publication should be separated by a review/approval layer.

## Git and deployment notes

Git is definitely involved:

- Widget source is in the `fiddletown-data-admin` GitHub repo.
- The live widget is hosted from GitHub Pages under `davedellaquila.github.io/fiddletown-data-admin`.
- The local repo has recent commits touching `web/code-snippets/events/event-list.js` and `web/public/code-snippets/events/event-list.js`.

Vercel does not appear to be active:

- No local Vercel config was found in `/Users/davedellaquila/Documents/Projects/ssa-admin-ios`.
- Prior investigation had Vercel auth/deployment unfinished.
- Current live page points to GitHub Pages, not Vercel.

If Cursor needs to deploy widget UI changes, the likely path is:

1. Edit `web/code-snippets/events/event-list.js`.
2. Copy the same final file to `web/public/code-snippets/events/event-list.js`.
3. Test locally.
4. Commit and push to `https://github.com/davedellaquila/fiddletown-data-admin.git`.
5. Confirm GitHub Pages serves the updated file.
6. Confirm `https://sportscaradventures.com/events` renders the change.

## Stale documentation warning

The SSA Admin widget README still describes the old manual Squarespace paste workflow:

```text
web/code-snippets/events/README.md
```

That README is stale relative to the current hosted-script architecture. Cursor should update it before relying on it.

## Things Cursor should verify before making changes

- GitHub Pages configuration for `fiddletown-data-admin`.
- Whether GitHub Pages deploys from `main`, `/docs`, or another branch/folder.
- Whether the live Supabase policies restrict public access correctly for the exposed anon key.
- Whether the widget should explicitly filter `public.events.status = 'published'`.
- Whether there are uncommitted unrelated local changes in `/Users/davedellaquila/Documents/Projects/ssa-admin-ios` before editing.

## Useful verification commands

```bash
curl -L -I https://sportscaradventures.com/events
curl -L -I https://davedellaquila.github.io/fiddletown-data-admin/code-snippets/events/event-list.js
curl -L -I https://sportscaradventures.com/code-snippets/events/event-list.js
git -C /Users/davedellaquila/Documents/Projects/ssa-admin-ios status --short
git -C /Users/davedellaquila/Documents/Projects/ssa-admin-ios remote -v
```

Expected as of 2026-06-15:

- `sportscaradventures.com/events`: HTTP 200, Squarespace page.
- GitHub Pages `event-list.js`: HTTP 200.
- `sportscaradventures.com/code-snippets/events/event-list.js`: HTTP 404.

