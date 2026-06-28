# New Event Email Notifications

| Field | Value |
|-------|-------|
| **ID** | FE-005 |
| **Status** | Specced |
| **Priority** | TBD |
| **Effort** | Medium |
| **Platforms** | Squarespace public widget + Supabase + email provider |
| **Product area** | Events / public site / audience retention |
| **Created** | 2026-06-28 |
| **Original source** | User request in Codex thread |
| **Related** | [FE-004 Event selection & email](./event-selection-email.md), [FE weather and regional events plan](./weather-and-regional-events.md) |

---

## Summary

Allow public Sports Car Adventures visitors to enter their email address and opt in to notifications when new calendar events are added. This is a future enhancement only; no implementation has been started.

The main value is retention: someone who checks the calendar once can be pulled back when new, relevant events appear, without needing to revisit the site manually.

---

## Problem

The events calendar is useful only when visitors remember to check it. People interested in local car, wine, community, and regional events may miss newly added events because there is no lightweight follow-up channel.

The current FE-004 email feature is session-based: a visitor selects events and emails those selections to themselves. It does not create a durable relationship or notify users about later events.

---

## Proposed solution

Add an opt-in email notification flow to the public events widget:

1. Visitor enters an email address.
2. Visitor explicitly consents to receive new-event notifications.
3. System stores a subscription record with status and preferences.
4. When new published events are added, the system sends a notification email.
5. Every email includes an unsubscribe link and preference-management path.

The first version should be intentionally simple: notify subscribers about newly published events for the selected/default region, likely as a digest rather than one email per event.

---

## Key capabilities

- Public email signup form embedded near the calendar.
- Double opt-in or confirmation email before activating a subscription.
- Subscriber preferences for region, and optionally keyword/category.
- Notification emails for newly published events.
- Unsubscribe link in every email.
- Admin visibility into subscriber counts and recent sends.
- Rate limiting and abuse protection.
- Privacy-safe storage with clear consent copy.

---

## User-facing requirements

### Signup entry point

- Show a compact signup tile on the public events page.
- Suggested copy: `Get notified when new events are added.`
- Require only email for M1.
- Include a clear consent statement before submit.
- Do not require an account.
- Show success, already subscribed, invalid email, and temporary failure states.

### Preferences

- M1 should support region preference if regional events are implemented first.
- If regions are not implemented yet, default all signups to `Gold Country`.
- Keyword/category preferences are optional for M1 and should not block launch.
- Preference controls should be simple enough for mobile use.

### Email notifications

- Send a concise digest of newly published events.
- Recommended M1 cadence: daily digest when new events exist.
- Avoid sending more than one notification email per subscriber per day unless Dave explicitly chooses immediate alerts.
- Include event title, date/time, location, image thumbnail when available, and source/detail links.
- Include a clear unsubscribe link.
- Include sender identity tied to Sports Car Adventures.

### Unsubscribe

- Every notification must include a one-click unsubscribe link.
- Unsubscribe should not require login.
- The unsubscribe endpoint should mark the subscription inactive rather than deleting the row immediately.
- Show a friendly confirmation page or message.

---

## Data requirements

### New table: `public.event_subscribers`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `email` | Normalized email address |
| `email_hash` | Optional lookup hash for dedupe/privacy |
| `status` | `pending`, `active`, `unsubscribed`, `bounced`, `complained` |
| `region_id` | Optional FK to `regions` once regional events exist |
| `frequency` | `daily_digest`, `weekly_digest`, or `immediate` |
| `keyword_preferences` | Optional array/json for future filtering |
| `confirmation_token_hash` | Token hash for double opt-in |
| `unsubscribe_token_hash` | Token hash for one-click unsubscribe |
| `confirmed_at` | When the user confirmed opt-in |
| `unsubscribed_at` | When the user unsubscribed |
| `last_notified_at` | Most recent successful notification |
| `created_at` / `updated_at` | Audit timestamps |

### New table: `public.event_notification_sends`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `subscriber_id` | FK to `event_subscribers` |
| `event_ids` | Array/json of events included |
| `notification_type` | `confirmation`, `daily_digest`, `weekly_digest`, `immediate`, `unsubscribe` |
| `provider_message_id` | Email provider delivery id |
| `status` | `queued`, `sent`, `failed`, `bounced`, `complained` |
| `error_message` | Failure details for admin troubleshooting |
| `sent_at` | Timestamp |
| `created_at` | Audit timestamp |

### Existing event data needed

- Published event status.
- Published timestamp or equivalent change tracking.
- Region id once regions ship.
- Event image URL where available.
- Event detail/source URL.

If `events.published_at` does not exist, add it before implementing notifications. Notification logic needs a durable way to identify "new since last digest" without relying only on `created_at`.

---

## Architecture options

### Option A: Supabase Edge Function + scheduled digest

Recommended likely M1.

- Public widget submits email signup to an Edge Function.
- Edge Function validates email, writes subscription, and sends confirmation.
- Scheduled job runs daily, finds newly published events, sends digests, and records sends.
- Email provider: Resend, Postmark, SendGrid, or another provider chosen later.

Pros:

- Keeps email provider secrets off the client.
- Works with current Supabase-centered architecture.
- Easier to rate limit and audit.

Cons:

- Requires Edge Function deployment and scheduled trigger setup.
- Requires email-provider account and domain authentication.

### Option B: Third-party newsletter platform

- Embed a provider-hosted signup form.
- Manually or automatically push new events into a campaign.

Pros:

- Faster to launch if a provider is already configured.
- Built-in unsubscribe/compliance tooling.

Cons:

- Harder to personalize by region/event keyword.
- May duplicate event data outside Supabase.
- More manual unless integrated.

### Option C: Wait for region architecture, then build notifications

- Defer notification implementation until the region selector and region data model are done.

Pros:

- Cleaner preference model from day one.
- Avoids migrating early subscribers from `Gold Country only` to multi-region later.

Cons:

- Delays a useful retention feature.

Recommended direction: write the spec now, then decide whether M1 is Gold Country-only or should wait for regions.

---

## Privacy, consent, and compliance requirements

- Use explicit opt-in language. Do not pre-check consent boxes.
- Prefer double opt-in before sending event notifications.
- Store only what is needed for notifications.
- Do not expose subscriber emails in client-side code.
- Do not expose email provider keys in the widget.
- Include unsubscribe in every notification email.
- Track unsubscribed/bounced/complained statuses and suppress future sends.
- Add basic bot protection and rate limiting.
- Add a short privacy note near signup explaining use: new-event notifications only, unsubscribe anytime.

This is not legal advice; compliance details should be reviewed before launch.

---

## Admin requirements

- View subscriber count by status and region.
- View recent notification sends and failures.
- Manually suppress/unsubscribe an email if requested.
- Optional later: export subscribers or resend a confirmation email.
- Optional later: preview the next digest before it sends.

---

## Suggested M1 scope

M1 should be deliberately small:

- Gold Country-only if regions are not implemented yet.
- Email signup form on the public widget.
- Double opt-in confirmation email.
- Daily digest when new published events exist.
- Unsubscribe link.
- Minimal admin visibility through Supabase table/query first, full admin UI later.

M1 should not include:

- Full newsletter editor.
- Complex preference center.
- SMS or push notifications.
- Per-event immediate alerts by default.
- Cross-region personalization unless region model has already shipped.

---

## Open questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-001 | Should M1 launch Gold Country-only, or wait for the region selector/data model? | Dave / PM |
| OQ-002 | Preferred email provider: Resend, Postmark, SendGrid, Mailchimp, or another service? | Dave / Dev |
| OQ-003 | Should notifications be daily digest, weekly digest, immediate, or user-selectable? | Dave / PM |
| OQ-004 | Where should the signup tile appear in the public widget? | UX |
| OQ-005 | Should subscribers choose keywords/categories in M1 or later? | Dave / PM |
| OQ-006 | Does the current `events` table have a reliable `published_at` timestamp, or do we need to add one? | Dev |
| OQ-007 | What sender identity/domain should be used for deliverability and trust? | Dave / Dev |

---

## Promotion criteria

- [ ] Dave confirms whether M1 is Gold Country-only or region-aware.
- [ ] Email provider is chosen.
- [ ] Sender domain authentication path is confirmed.
- [ ] Data model reviewed for consent/unsubscribe/bounce handling.
- [ ] Notification cadence chosen.
- [ ] UX placement for signup tile approved.
- [ ] Dev confirms whether `published_at` exists or needs migration.

---

## Implementation outline

### Phase 0: Planning only

- [x] Capture future enhancement spec.
- [ ] Resolve open questions.
- [ ] Decide M1 scope.

### Phase 1: Data and provider foundation

- [ ] Add subscriber and notification-send tables.
- [ ] Add or verify `events.published_at`.
- [ ] Choose and configure email provider.
- [ ] Configure sender domain authentication.

### Phase 2: Signup and confirmation

- [ ] Add signup Edge Function.
- [ ] Add confirmation email.
- [ ] Add unsubscribe token flow.
- [ ] Add public widget signup tile.

### Phase 3: Digest sending

- [ ] Add scheduled digest job.
- [ ] Generate new-event email content.
- [ ] Record sent/failed status.
- [ ] Suppress unsubscribed/bounced/complained emails.

### Phase 4: Admin visibility

- [ ] Add subscriber status view or basic admin panel.
- [ ] Add recent sends/failures view.
- [ ] Add manual unsubscribe/suppress action.

---

## Acceptance criteria for future feature spec

These are draft acceptance criteria for when the enhancement is promoted:

- A visitor can subscribe with an email address from the public events page.
- A visitor receives a confirmation email and is not active until confirmed.
- A confirmed subscriber receives a digest when new published events are added that match their scope.
- A subscriber can unsubscribe without logging in.
- Unsubscribed subscribers do not receive future notifications.
- Email provider credentials are never exposed to the browser.
- The system records notification sends and failures.
- The events page still works if the signup endpoint or email provider is unavailable.

