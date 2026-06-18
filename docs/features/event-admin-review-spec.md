# Sports Car Adventures Event Admin Review Spec

## Purpose

Create an internal admin page for reviewing discovered event candidates before they appear on `sportscaradventures.com/events`.

The scheduled monitor writes discovered items to `public.event_candidates`. The public website reads only from `public.events`. The admin page is the approval layer between those two tables.

## Current Data Flow

1. Daily monitor checks active rows in `public.event_sources`.
2. Discovered items are inserted or refreshed in `public.event_candidates`.
3. Candidate digest email is sent to Dave.
4. Admin reviews candidates.
5. Approved candidates create rows in `public.events`.
6. Public Events page displays rows from `public.events` where `status = 'published'`.

## Primary User

Dave, managing Sports Car Adventures event curation.

The page should prioritize fast review, source verification, and avoiding accidental publication.

## Candidate Statuses

`event_candidates.status` currently supports:

- `new`: higher-confidence discovery, ready for first review.
- `needs_review`: lower-confidence discovery or incomplete extracted details.
- `approved`: reviewed and approved, but not necessarily published.
- `published`: converted into a published row in `events`.
- `rejected`: reviewed and intentionally not used.
- `duplicate`: matched to an existing event.

## Minimum Admin Views

### 1. Candidate Queue

Default view for all actionable candidates.

Filter tabs:

- `New`
- `Needs Review`
- `Approved`
- `Rejected`
- `Duplicates`
- `All`

Default filter:

- Show `new` and `needs_review`.
- Sort by `start_date asc nulls last`, then `priority asc`, then `discovered_at desc`.

Each row/card should show:

- Candidate title
- Source name
- Priority
- Status
- Start date
- Start time
- Location
- Website/source link
- Extraction confidence
- Short description
- Duplicate warning if `duplicate_event_id` is set

### 2. Candidate Detail / Edit Panel

Open when a candidate is selected.

Editable fields before approval:

- `title`
- `host_org`
- `start_date`
- `end_date`
- `start_time`
- `end_time`
- `location`
- `short_description`
- `description`
- `image_url`
- `website_url`
- `priority`
- `review_notes`

Read-only reference fields:

- `source_name`
- `source_url`
- `raw_text`
- `extraction_confidence`
- `discovered_at`
- `last_seen_at`

## Required Actions

### Save Candidate Edits

Updates only `public.event_candidates`.

Use when Dave improves extracted fields but is not ready to approve.

Database action:

```sql
update public.event_candidates
set
  title = :title,
  host_org = :host_org,
  start_date = :start_date,
  end_date = :end_date,
  start_time = :start_time,
  end_time = :end_time,
  location = :location,
  short_description = :short_description,
  description = :description,
  image_url = :image_url,
  website_url = :website_url,
  priority = :priority,
  review_notes = :review_notes,
  updated_at = now()
where id = :candidate_id;
```

### Approve as Draft

Creates a real event in `public.events` with `status = 'draft'`.

Use when the event is probably good, but Dave wants another pass before public display.

Database behavior:

1. Insert row into `public.events`.
2. Mark candidate `approved`.
3. Store review timestamp.

Event field mapping:

| `event_candidates` | `events` |
|---|---|
| `title` | `name` |
| generated slug | `slug` |
| `host_org` | `host_org` |
| `start_date` | `start_date` |
| `end_date` | `end_date` |
| `start_time` | `start_time` |
| `end_time` | `end_time` |
| `location` | `location` |
| `short_description` | `short_description` |
| `description` | `description` |
| `website_url` | `website_url` |
| `image_url` | `image_url` |
| `raw_text` | `ocr_text` |

### Approve and Publish

Same as Approve as Draft, but creates the event with `status = 'published'` and marks the candidate `published`.

This makes the event visible on the public Events page.

This action should require a confirmation step.

### Reject

Marks a candidate as rejected.

Required input:

- Optional `review_notes`

Database action:

```sql
update public.event_candidates
set
  status = 'rejected',
  reviewed_at = now(),
  review_notes = :review_notes,
  updated_at = now()
where id = :candidate_id;
```

### Mark Duplicate

Marks a candidate as a duplicate of an existing event.

Required input:

- Existing `events.id`

Database action:

```sql
update public.event_candidates
set
  status = 'duplicate',
  duplicate_event_id = :event_id,
  reviewed_at = now(),
  updated_at = now()
where id = :candidate_id;
```

## Slug Rules

Generate event slugs from:

```text
event title + start date
```

Example:

```text
lavender-blue-days-2026-06-20
```

If slug exists, append a short suffix:

```text
lavender-blue-days-2026-06-20-2
```

## Validation Before Publishing

Require these fields before `Approve and Publish`:

- `title`
- `start_date`
- `location`
- `website_url` or `source_url`
- `short_description`

Allow drafts with missing fields, but visually flag missing required publish fields.

## Priority Guidance

- `A`: strong Sports Car Adventures fit; automotive, route-worthy, destination-worthy, or signature Gold Country event.
- `B`: good fit; useful stop, winery/music/history/local flavor, or easy pairing with a drive.
- `C`: possible fit; likely needs stronger reason or better details.
- `Watch`: source or recurring series worth monitoring, not necessarily an individual publishable event.

## Suggested Layout

Use a dense operational layout, not a marketing page.

Desktop:

- Left/main: candidate table or compact cards.
- Right: selected candidate detail/edit panel.
- Top: filter tabs, source filter, priority filter, text search.

Mobile:

- Candidate list first.
- Candidate detail opens as full-screen panel or separate route.

## Useful Candidate Query

```sql
select
  id,
  title,
  source_name,
  priority,
  status,
  start_date,
  start_time,
  location,
  short_description,
  website_url,
  source_url,
  extraction_confidence,
  duplicate_event_id,
  discovered_at,
  last_seen_at
from public.event_candidates
where status in ('new', 'needs_review')
order by start_date asc nulls last, priority asc, discovered_at desc;
```

## First Implementation Milestone

Build a private admin page that can:

1. List candidates.
2. Open candidate details.
3. Edit candidate fields.
4. Reject a candidate.
5. Approve a candidate into `events` as `draft`.

Do not add `Approve and Publish` until the draft workflow has been tested.

## Second Implementation Milestone

Add:

1. Approve and publish.
2. Duplicate matching UI.
3. Source management page for `event_sources`.
4. Candidate digest links that open the candidate in admin.

## Notes for Implementing Agent

- Do not publish automatically from the scheduled worker.
- Keep `event_candidates` private.
- Public website should continue to read only from `events`.
- The first admin workflow should prefer `draft` approval over direct publishing.
- Any action that creates or publishes events should be verified with a follow-up database query.
