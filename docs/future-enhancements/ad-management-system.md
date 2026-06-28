# Regional Advertising Manager

| Field | Value |
|-------|-------|
| **ID** | FE-001 |
| **Status** | Specced |
| **Priority** | TBD, likely after regional events foundation |
| **Effort** | Large, phased |
| **Platforms** | SSA Admin + Sports Car Adventures public events widget + Supabase |
| **Product area** | Ads / monetization / regional events |
| **Created** | 2026-06-15, rewritten 2026-06-28 |
| **Original source** | Replaces imported generic ad-management PRD with Sports Car Adventures regional ad spec |
| **Related** | [Weather and Regional Events Plan](./weather-and-regional-events.md), [FE-005 New Event Email Notifications](./new-event-email-notifications.md) |

---

## Summary

Create an advertising manager that lets Sports Car Adventures sell and manage ad placements for local businesses by region. Ads should appear on the public events page in a way that feels useful and local rather than noisy: for example, a Gold Country winery, repair shop, restaurant, storage facility, lodging property, or event sponsor can buy visibility beside events in that region.

The first version should focus on practical local sponsorships:

- Define regional ad inventory.
- Add advertisers and campaigns in SSA Admin.
- Upload or link ad creative.
- Schedule ads by date and region.
- Display ads on the public events page.
- Track basic impressions and clicks.
- Produce simple advertiser reports.

This is a future-release spec only. No implementation has started.

---

## Product vision

Sports Car Adventures can become a regional discovery hub for car people: events, local drives, nearby food, lodging, wineries, shops, and services. The ad manager should monetize that attention while preserving trust. Ads should be clearly labeled, relevant to the selected region, and visually consistent with the calendar.

The system should support a simple sales workflow first, then grow into richer campaign management if the local ad program proves valuable.

---

## Goals

- Allow Dave/admins to sell ads to local businesses by region.
- Show ads only in relevant regional contexts.
- Keep the events page fast, readable, and not overrun by ads.
- Give advertisers basic proof of value through impressions, clicks, dates served, and placement summary.
- Support simple pricing models such as flat monthly sponsorships before advanced CPM/CPC billing.
- Make it easy to pause, schedule, rotate, and replace ad creatives.
- Preserve a clean path to future self-service advertiser portals and richer analytics.

---

## Non-goals for M1

- No real-time ad auction or programmatic ad exchange.
- No third-party behavioral targeting.
- No advertiser self-service checkout in the first pass.
- No automated credit-card billing in M1.
- No complex conversion tracking in M1.
- No ads mixed into email notifications until public-page ads are proven.
- No invasive tracking, fingerprinting, or personal profile building.

---

## Users and jobs

### Dave / site admin

- Create and manage advertisers.
- Sell a regional ad placement.
- Upload artwork or enter a hosted creative URL.
- Schedule the ad.
- Preview how the ad will look.
- Pause or remove an ad quickly.
- Share a simple performance summary with the advertiser.

### Local advertiser

- Buy visibility among local event visitors.
- Have confidence that the ad appears in the right region.
- Understand roughly how many people saw or clicked the ad.
- Know the campaign dates, placement, and creative used.

### Event page visitor

- See relevant local sponsors without the page feeling cluttered.
- Understand that a block is sponsored.
- Tap/click an ad if it is useful.
- Continue browsing events without interruption.

---

## Placement strategy

Ads should be regional and context-aware. Initial placements should be conservative.

### M1 placements

| Placement | Description | Recommended limit |
|---|---|---|
| `regional_featured_sponsor` | One featured sponsor near the top of the selected region/events page | 1 active ad per region |
| `between_day_sections` | Sponsored card between day groups in list view | 1 ad every 2-3 day sections |
| `sidebar_or_footer_sponsor` | Desktop sidebar/footer sponsor when layout supports it | 1-3 active ads |
| `mobile_inline_sponsor` | Mobile-friendly inline sponsored card between event cards | 1 ad every 8-12 event cards max |

### Later placements

| Placement | Description |
|---|---|
| `event_category_sponsor` | Sponsor tied to a keyword/category such as wineries, cars, food, lodging, or live music |
| `weather_sponsor` | Small sponsor associated with the weather panel, if tasteful |
| `email_digest_sponsor` | Sponsor block inside new-event notification digests |
| `region_home_sponsor` | Top sponsor for a future region landing page |
| `event_detail_sponsor` | Sponsor on an event detail page if event detail pages exist later |

### Placement rules

- Every ad must be labeled `Sponsored`.
- Ads should never visually masquerade as event cards.
- Ads should not interrupt the first event card on mobile.
- Ads should not appear more frequently than the configured density.
- If no relevant regional ad is active, the page should render normally.
- Ads should have an accessible name and image alt text.
- Ad creative must be responsive and safe for mobile.

---

## Region model

The ad manager should depend on or align with the future regional events architecture.

Initial regions likely include:

| Region | Example advertisers |
|---|---|
| Gold Country | Wineries, restaurants, local repair shops, storage, lodging, event sponsors |
| Bay Area | Car clubs, detailers, garages, specialty shops, restaurants near drives |
| Santa Cruz | Lodging, restaurants, cafes, surf/coastal destinations, shops |
| Central Valley | Dealerships, event venues, food stops, parts/service businesses |

Requirements:

- Ads can target one or more regions.
- A region selector on the public widget should filter both events and ads.
- A region should have a fallback ad inventory when no specific placement is sold.
- Gold Country remains the default region until regional selection is implemented.

---

## Advertiser and campaign workflow

### Advertiser management

Admin can create advertiser profiles:

- Business name.
- Contact name.
- Contact email.
- Contact phone.
- Website URL.
- Business category.
- Regions served.
- Billing notes.
- Internal notes.
- Status: `lead`, `active`, `paused`, `archived`.

### Campaign management

Admin can create campaigns:

- Campaign name.
- Advertiser.
- Region targeting.
- Placement targeting.
- Start date and end date.
- Status: `draft`, `scheduled`, `active`, `paused`, `completed`, `archived`.
- Pricing model.
- Contract amount or rate.
- Impression/click goals if any.
- Notes and renewal reminder.

### Creative management

Admin can attach one or more creatives:

- Image upload or hosted image URL.
- Destination URL.
- Headline.
- Short body copy.
- Call-to-action label.
- Alt text.
- Creative status.
- Preview thumbnail.

Supported M1 creative formats:

- Static image card.
- Text plus logo/card.
- Image plus headline/CTA.

Later formats:

- Multiple image variants.
- Video or animated creative, only if performance remains good.
- HTML snippets, only if sandboxed and carefully reviewed.

---

## Pricing model

M1 should support simple, human-manageable pricing first.

| Pricing model | M1? | Notes |
|---|---|---|
| Flat monthly sponsorship | Yes | Best fit for local businesses and manual sales |
| Flat campaign fee | Yes | Fixed date range, fixed placement |
| Sponsored region package | Yes | Example: Gold Country sponsor for July |
| CPM | Later | Requires more mature impression tracking and reporting |
| CPC | Later | Requires click-quality review and fraud controls |
| CPA/conversion | Later | Too complex for early local sponsorships |

M1 billing can be tracked manually in notes. Automated invoicing/payment can be a later enhancement.

---

## Public widget requirements

### Ad fetching

The public events widget should fetch eligible ads based on:

- Region.
- Placement.
- Date range.
- Status.
- Optional keyword/category context.

The widget must fail gracefully. If ad fetch fails, event browsing still works.

### Ad selection

M1 can use deterministic rotation:

- Filter active ads by region and placement.
- Sort by priority, sponsorship tier, and rotation weight.
- Pick a stable ad for each placement during a page load.
- Avoid showing the same ad too many times in one session.

Later versions can support weighted rotation, pacing, and frequency caps.

### Ad display

Each ad should include:

- `Sponsored` label.
- Business name or campaign label.
- Creative image or text.
- CTA button or link.
- Accessible alt text.
- Destination link opened safely.

Mobile behavior:

- Ads are inline cards.
- Tap target should be large.
- Creative must not overflow.
- Frequency should be lower than desktop.

Desktop behavior:

- Ads can appear inline, top-of-list, or in a sidebar if the page layout supports it.
- Sponsored content should still align with the visual language of the calendar.

---

## Tracking and reporting

### M1 metrics

Track only privacy-safe aggregate behavior:

- Ad served/impression.
- Click.
- Region.
- Placement.
- Campaign.
- Creative.
- Date/time bucket.
- Page path.
- Device class: `mobile`, `tablet`, `desktop`.

M1 reports:

- Total impressions.
- Total clicks.
- Click-through rate.
- Active dates.
- Placement summary.
- Region summary.
- Creative summary.

### Later metrics

- Viewability with Intersection Observer.
- Unique sessions, approximate and privacy-safe.
- Frequency caps per anonymous session.
- Daily/weekly charts.
- CSV export.
- Advertiser-facing report links.
- Conversion tracking for advertisers that can support it.

### Privacy constraints

- Do not collect personal names, emails, phone numbers, or exact location for ad tracking.
- Do not fingerprint visitors.
- Do not send ad tracking data to advertisers directly from the browser.
- IP address should not be stored unless a deliberate legal/privacy review approves it.
- Respect browser privacy settings where possible.

---

## Data model

Names can change during implementation, but the model should support these concepts.

### `public.advertisers`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `business_name` | Public advertiser name |
| `contact_name` | Internal sales/admin contact |
| `contact_email` | Internal contact email |
| `contact_phone` | Internal contact phone |
| `website_url` | Advertiser website |
| `category` | Winery, repair, lodging, restaurant, sponsor, etc. |
| `status` | `lead`, `active`, `paused`, `archived` |
| `notes` | Internal notes |
| `created_at` / `updated_at` | Audit timestamps |

### `public.ad_campaigns`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `advertiser_id` | FK to advertiser |
| `name` | Campaign name |
| `status` | `draft`, `scheduled`, `active`, `paused`, `completed`, `archived` |
| `starts_on` / `ends_on` | Campaign date range |
| `pricing_model` | `flat_monthly`, `flat_campaign`, `cpm`, `cpc` |
| `contract_amount_cents` | Manual billing/reference amount |
| `priority` | Rotation priority |
| `notes` | Internal notes |
| `created_at` / `updated_at` | Audit timestamps |

### `public.ad_creatives`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `campaign_id` | FK to campaign |
| `headline` | Optional public headline |
| `body` | Optional short public copy |
| `cta_label` | Example: `Learn more`, `Visit sponsor`, `Book now` |
| `destination_url` | Click target |
| `image_url` | Uploaded or hosted creative |
| `alt_text` | Accessibility text |
| `status` | `draft`, `active`, `paused`, `archived` |
| `created_at` / `updated_at` | Audit timestamps |

### `public.ad_placements`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `slug` | Stable key, e.g. `regional_featured_sponsor` |
| `name` | Admin display name |
| `description` | Placement description |
| `surface` | `events_widget`, `email_digest`, etc. |
| `status` | `active`, `paused`, `archived` |
| `created_at` / `updated_at` | Audit timestamps |

### `public.ad_campaign_regions`

| Column | Purpose |
|---|---|
| `campaign_id` | FK to campaign |
| `region_id` | FK to region |

### `public.ad_campaign_placements`

| Column | Purpose |
|---|---|
| `campaign_id` | FK to campaign |
| `placement_id` | FK to placement |
| `weight` | Rotation weight |
| `max_impressions_per_day` | Optional pacing control |

### `public.ad_events`

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `event_type` | `impression`, `click`, `viewable_impression` |
| `campaign_id` | FK to campaign |
| `creative_id` | FK to creative |
| `placement_id` | FK to placement |
| `region_id` | FK to region |
| `page_path` | Where the ad appeared |
| `device_class` | `mobile`, `tablet`, `desktop`, `unknown` |
| `session_key` | Optional hashed anonymous session key |
| `occurred_at` | Timestamp |

### `public.ad_daily_metrics`

Aggregated reporting table:

| Column | Purpose |
|---|---|
| `date` | Metric date |
| `campaign_id` | Campaign |
| `creative_id` | Creative |
| `placement_id` | Placement |
| `region_id` | Region |
| `impressions` | Count |
| `clicks` | Count |
| `viewable_impressions` | Optional count |

---

## Admin requirements

### Navigation

Add an `Ads` area in SSA Admin with:

- Advertisers.
- Campaigns.
- Creatives.
- Placements.
- Reports.

### Advertiser list

- Search by business name/contact.
- Filter by status and region.
- Show active campaign count.
- Show renewal/expiration warnings.

### Campaign editor

- Select advertiser.
- Select regions.
- Select placements.
- Set campaign dates.
- Set status.
- Add pricing/reference notes.
- Attach creatives.
- Preview public rendering.
- Show validation before publishing.

### Creative editor

- Upload image or paste image URL.
- Set destination URL.
- Add headline/body/CTA.
- Add alt text.
- Preview mobile and desktop card.
- Validate dimensions and file size.

### Reports

M1 report can be simple:

- Campaign date range.
- Impressions.
- Clicks.
- CTR.
- Region and placement breakdown.
- Creative breakdown.
- Export CSV.

Later:

- Shareable advertiser report page.
- Scheduled advertiser emails.
- Revenue reports.
- Inventory availability report.

---

## Sales workflow

Suggested manual-first workflow:

1. Dave creates advertiser.
2. Dave creates campaign and region/placement package.
3. Dave uploads creative or uses advertiser-provided URL/artwork.
4. Dave previews the ad.
5. Dave schedules campaign.
6. Widget starts displaying ad when active.
7. Metrics accumulate.
8. Dave exports or shares report at campaign end.
9. Dave renews or archives campaign.

This keeps the initial build operationally useful without requiring self-service advertiser accounts.

---

## UX principles

- Ads should feel like local sponsorships, not generic banner spam.
- The page should still be primarily about events.
- A user should always know what is sponsored.
- Mobile density must be conservative.
- Sponsor cards should use the same typography and spacing discipline as event cards, but with enough visual difference to avoid confusion.
- Ad creative should be quality-controlled before it goes live.

---

## Security and abuse prevention

- Only authenticated admins can create/edit advertisers, campaigns, placements, and creatives.
- Public widget can read only published/active ad data needed for rendering.
- Tracking endpoint should accept only limited fields and validate IDs against active campaigns.
- Rate-limit click/impression endpoints.
- Sanitize all advertiser-provided text and URLs.
- Validate destination URLs against safe protocols.
- Store email/contact/billing notes only in admin-protected tables.
- Do not allow arbitrary advertiser HTML in M1.

---

## Performance requirements

- Ad loading must not block event rendering.
- Widget should render events first or render ads opportunistically.
- Ad query should be small and region/date constrained.
- Creative images should be optimized for mobile.
- Tracking should use `sendBeacon` or non-blocking fetch where possible.
- If tracking fails, user navigation should not be delayed.

---

## Accessibility requirements

- All images require meaningful alt text or empty decorative alt where appropriate.
- Sponsored label must be visible text.
- CTA links must be keyboard accessible.
- Color contrast must pass WCAG AA for text.
- Ads must not rely on animation or color alone to communicate status.

---

## Suggested implementation phases

### Phase 0: Product decisions

- [x] Rewrite future spec around regional local-business advertising.
- [ ] Decide if this waits for regional events foundation.
- [ ] Confirm M1 placements and maximum ad density.
- [ ] Confirm pricing model for first sponsors.

### Phase 1: Data foundation

- [ ] Add advertiser/campaign/creative/placement tables.
- [ ] Add region join tables.
- [ ] Add public read policies for active renderable ad data.
- [ ] Add admin-only write policies.

### Phase 2: Admin MVP

- [ ] Advertiser CRUD.
- [ ] Campaign CRUD.
- [ ] Creative upload/linking.
- [ ] Region and placement targeting.
- [ ] Preview before publish.

### Phase 3: Public widget display

- [ ] Fetch active regional ads.
- [ ] Render sponsored placement cards.
- [ ] Add mobile and desktop styles.
- [ ] Add graceful no-ad/fetch-failure behavior.

### Phase 4: Basic tracking

- [ ] Track impressions.
- [ ] Track clicks.
- [ ] Aggregate daily metrics.
- [ ] Add simple admin report.

### Phase 5: Sales/reporting improvements

- [ ] CSV export.
- [ ] Renewal reminders.
- [ ] Advertiser-facing report link.
- [ ] Inventory availability view.

### Phase 6: Advanced capabilities

- [ ] Weighted rotation and pacing.
- [ ] Viewability tracking.
- [ ] Keyword/category targeting.
- [ ] Email digest sponsorships.
- [ ] Self-service advertiser portal.
- [ ] Automated billing/invoicing.

---

## M1 recommendation

Build the first release as a local sponsorship manager, not an ad-tech platform.

Recommended M1:

- Gold Country-only if region architecture is not ready.
- Advertiser profiles.
- Campaigns with flat fee/manual billing notes.
- Static creative cards.
- Featured regional sponsor plus limited inline sponsor cards.
- Basic impression and click tracking.
- CSV report.

Defer:

- CPM/CPC billing.
- Advertiser self-service.
- Conversion tracking.
- Complex targeting.
- A/B tests.
- Programmatic ads.

---

## Open questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-001 | Should ads launch Gold Country-only first, or wait for multi-region event selection? | Dave / PM |
| OQ-002 | Which placements are acceptable on the public page without hurting readability? | Dave / UX |
| OQ-003 | What should the first local sponsorship packages cost and include? | Dave |
| OQ-004 | Should ad reports be internal-only in M1 or shareable with advertisers? | Dave / PM |
| OQ-005 | Should advertisers be allowed to sponsor categories/keywords, or only regions at first? | Dave / PM |
| OQ-006 | Should email digest sponsorship be included once FE-005 exists, or kept separate? | Dave / PM |
| OQ-007 | What creative dimensions should be required for mobile and desktop? | UX / Dev |
| OQ-008 | What legal/privacy copy is needed for sponsor tracking and external links? | Dave / PM |

---

## Promotion criteria

- [ ] Regional events model decision made.
- [ ] M1 placement list approved.
- [ ] Maximum ad density approved.
- [ ] First pricing model selected.
- [ ] Data model reviewed.
- [ ] UX mockups approved for mobile and desktop placements.
- [ ] Tracking/privacy approach approved.
- [ ] Dev sizing complete.

---

## Draft acceptance criteria for future feature

- Admin can create an advertiser.
- Admin can create a campaign for a selected region and placement.
- Admin can upload or link an ad creative.
- Admin can preview the ad before publishing.
- Public events page shows active ads only for the selected/default region.
- Public events page labels every ad as sponsored.
- Public events page still works if ads fail to load.
- Mobile ad placements are readable and do not appear before the first event.
- Impressions and clicks are recorded without blocking page interaction.
- Admin can view basic campaign metrics.
- Admin can export a simple campaign report.

