# Ad Management System

| Field | Value |
|-------|-------|
| **ID** | FE-001 |
| **Status** | Under review (deferred) |
| **Priority** | After Event Triage M1 |
| **Effort** | ~13 weeks (7 phases per §10) |
| **Platforms** | Web admin + Squarespace widget + Supabase |
| **Product area** | Ads / Served Up monetization |
| **Created** | 2026-06-15 (imported) |
| **Original source** | `~/.cursor/plans/ad_management_system_prd_2c2e3fc8.plan.md` |

---

## Summary

Full-featured ad management for **Served Up** Squarespace integration: ad serving, campaign/vendor management, enterprise metrics (impressions, clicks, conversions, viewability), multiple revenue models (CPM, CPC, CPA, flat rate), real-time analytics dashboard, A/B testing, and reporting. Extends existing Supabase tables (`ad_vendors`, `ads`, `ad_impressions`, `ad_clicks`) and adds campaigns, conversions, sessions, and daily aggregation tables.

**Not in active development.** Parked until Event Triage (candidate review) M1 ships. PRD will be reviewed and adjusted before promotion to `docs/features/`. No admin UI or types exist in this repo yet; DB tables may partially exist in Supabase per PRD §7.0.

---

## Implementation checklist

From original Cursor plan — all pending until promoted to `docs/features/`.

- [ ] **db-schema-extend** — Extend `ad_vendors`, `ads` with new columns
- [ ] **db-schema-enhance-tracking** — Enhance `ad_impressions`, `ad_clicks`
- [ ] **db-schema-new-tables** — `campaigns`, `ad_conversions`, `ad_events`, `ad_sessions`, daily metrics tables
- [ ] **db-indexes-rls** — Indexes, RLS, aggregation functions/triggers, partitioning
- [ ] **admin-vendors** — Vendor/advertiser CRUD UI
- [ ] **admin-campaigns** — Campaign management UI
- [ ] **admin-ads** — Ad management UI (upload + external links)
- [ ] **admin-placements** — Placement/zone management UI
- [ ] **tracking-script** — Client-side Squarespace tracking
- [ ] **tracking-api** — Server-side tracking API (rate-limited)
- [ ] **metrics-aggregation** — Daily metrics aggregation
- [ ] **analytics-dashboard** — Real-time dashboard
- [ ] **revenue-calculations** — CPM, CPC, CPA, flat rate logic
- [ ] **conversion-tracking** — Conversion + revenue attribution
- [ ] **ab-testing** — A/B test framework
- [ ] **funnel-tracking** — Conversion funnel visualization
- [ ] **squarespace-widget** — Ad widget for Squarespace
- [ ] **reporting-export** — CSV/JSON/PDF reports
- [ ] **device-geo-tracking** — Device, browser, OS, geo
- [ ] **viewability-tracking** — Intersection Observer viewability
- [ ] **session-tracking** — Session journey analysis
- [ ] **admin-types** — TypeScript types in `models.ts`
- [ ] **admin-api-queries** — Supabase query helpers
- [ ] **testing-optimization** — High-volume performance testing

---

## Promotion criteria

- [ ] **Event Triage M1 shipped** (D-008)
- [ ] PRD reviewed with team; adjustments incorporated
- [ ] Confirm partial DB schema state in Supabase (§7.0.1)
- [ ] PM defines M1 scope (likely Phase 1–2: core admin + basic tracking)
- [ ] Priority relative to Event Candidate Review and platform UX
- [ ] UX sizing for admin + dashboard; Dev sizing for tracking volume

---

# Ad Management System - Product Requirements Document

## 1. Executive Summary

### 1.1 Product Overview

A full-featured ad management system for "Served Up" Squarespace integration that enables ad serving, comprehensive metrics tracking, monetization, and analytics. The system supports multiple ad formats (image uploads and external links), multiple revenue models, and enterprise-level analytics with real-time dashboards.

### 1.2 Business Objectives

- **Primary Goal**: Enable ad monetization for Served Up Squarespace website
- **Secondary Goals**:
- Provide comprehensive analytics and metrics tracking
- Support multiple revenue models (CPM, CPC, CPA, flat rate)
- Enable advertiser self-service capabilities
- Track performance at ad, campaign, and advertiser levels
- Provide real-time and historical reporting

### 1.3 Success Metrics

- Ad revenue generation
- Advertiser satisfaction and retention
- System uptime and performance
- Analytics accuracy and completeness
- User engagement with ads

---

## 2. Product Description

### 2.1 Product Vision

A comprehensive ad management platform that seamlessly integrates with Squarespace, providing publishers with powerful tools to monetize their content while giving advertisers detailed insights into campaign performance.

### 2.2 Target Users

- **Primary Users**: Site administrators managing ads
- **Secondary Users**: Vendors/Advertisers viewing their campaign performance
- **End Users**: Website visitors viewing ads

### 2.3 Key Value Propositions

- **Flexible Ad Formats**: Support for uploaded images and external ad links
- **Multiple Revenue Models**: CPM, CPC, CPA, and flat rate pricing
- **Comprehensive Analytics**: Enterprise-level metrics tracking
- **Real-time Performance**: Live dashboards and reporting
- **Easy Integration**: Simple Squarespace code injection

---

## 3. Functional Requirements

### 3.1 Ad Management

#### 3.1.1 Ad Creation

- **Image Upload**: Upload ad artwork to Supabase storage
- **External Links**: Support for external ad URLs (e.g., ad networks, third-party ad servers)
- **Ad Metadata**:
- Ad name/title
- Advertiser information
- Campaign association
- Target URL (click destination)
- Display dates (start/end)
- Status (draft/published/archived/paused)
- Ad dimensions/size
- Alt text for accessibility

#### 3.1.2 Campaign Management

- **Campaign Creation**: Group multiple ads into campaigns
- **Campaign Settings**:
- Campaign name
- Advertiser association
- Budget (total or daily)
- Revenue model (CPM/CPC/CPA/flat rate)
- Pricing rates
- Start/end dates
- Targeting rules (optional)

#### 3.1.3 Vendor/Advertiser Management

- **Vendor Profiles** (ad_vendors table):
- Company name
- Contact information (email, phone)
- Notes
- Status (draft/published/archived)
- **New fields to add**:
  - Billing address
  - Account status (active/suspended/inactive)

#### 3.1.4 Ad Placement/Zones

- **Placement Management**:
- Define ad zones/positions on Squarespace pages
- Configure ad rotation rules
- Set priority/weighting for ads
- Schedule ads by time/date

### 3.2 Metrics & Analytics Tracking

#### 3.2.1 Impression Tracking

- **Basic Impression**:
- Track when ad is served/displayed
- Timestamp
- Ad ID, Campaign ID, Advertiser ID
- Placement/zone ID
- Page URL
- User session ID
- **Advanced Impression Metrics**:
- Viewability (time in viewport)
- Scroll depth when ad appeared
- Page load time
- Ad load time
- Device type (desktop/mobile/tablet)
- Browser type and version
- Operating system
- Screen resolution
- Geographic location (IP-based, country/state/city)
- Referrer URL
- User agent string

#### 3.2.2 Click Tracking

- **Click Events**:
- Click timestamp
- Ad ID, Campaign ID, Advertiser ID
- Placement/zone ID
- Click coordinates (X, Y position)
- Time from impression to click
- Device/browser/OS information
- Geographic location
- Session ID
- User journey (previous pages)

#### 3.2.3 Conversion Tracking

- **Conversion Events**:
- Conversion type (purchase, signup, download, etc.)
- Conversion value (revenue amount)
- Conversion timestamp
- Associated click ID
- Associated impression ID
- Conversion source (direct, referral, etc.)
- Conversion path (impression → click → conversion timeline)

#### 3.2.4 User Engagement Metrics

- **Interaction Tracking**:
- Hover time on ad
- Mouse movements over ad
- Video play events (if video ads)
- Video completion rate
- Expand/collapse events (for expandable ads)
- Time spent viewing ad
- Multiple impressions per session

#### 3.2.5 Performance Metrics

- **Calculated Metrics**:
- Click-through rate (CTR) = clicks / impressions
- Conversion rate = conversions / clicks
- Cost per click (CPC) = campaign cost / clicks
- Cost per mille (CPM) = campaign cost / (impressions / 1000)
- Cost per acquisition (CPA) = campaign cost / conversions
- Return on ad spend (ROAS) = revenue / cost
- Effective CPM (eCPM) = revenue / (impressions / 1000)
- Viewability rate = viewable impressions / total impressions
- Average position
- Revenue per impression (RPM)

#### 3.2.6 Revenue Tracking

- **Revenue Calculation**:
- CPM: (impressions / 1000) × CPM rate
- CPC: clicks × CPC rate
- CPA: conversions × CPA rate
- Flat rate: Fixed amount per time period
- Total revenue per ad, campaign, advertiser
- Daily/weekly/monthly revenue breakdowns

### 3.3 A/B Testing Framework

#### 3.3.1 Test Creation

- Create A/B tests for ads
- Define test variants (different creatives, copy, CTAs)
- Set traffic split percentages
- Define success metrics
- Set test duration

#### 3.3.2 Test Execution

- Random variant assignment
- Track performance by variant
- Statistical significance calculation
- Real-time test results

#### 3.3.3 Test Analysis

- Compare variant performance
- Statistical significance indicators
- Recommendations for winning variant

### 3.4 Conversion Funnel Tracking

#### 3.4.1 Funnel Definition

- Define funnel stages (impression → click → landing page → conversion)
- Track drop-off rates between stages
- Identify bottlenecks

#### 3.4.2 Funnel Analysis

- Visual funnel representation
- Stage-by-stage conversion rates
- Time spent in each stage
- User path analysis

### 3.5 Real-time Analytics Dashboard

#### 3.5.1 Dashboard Features

- **Real-time Metrics**:
- Live impression count
- Live click count
- Current revenue
- Active campaigns
- Top performing ads
- **Visualizations**:
- Time-series charts (impressions, clicks, revenue over time)
- Geographic heatmaps
- Device/browser breakdowns
- Campaign performance comparisons
- Revenue trends
- **Filters**:
- Date range (real-time, today, last 7 days, last 30 days, custom)
- Campaign filter
- Vendor/Advertiser filter
- Ad filter
- Placement/zone filter
- Device type filter
- Geographic filter

### 3.6 Reporting & Export

#### 3.6.1 Report Types

- **Performance Reports**:
- Ad performance report
- Campaign performance report
- Vendor/Advertiser performance report
- Placement/zone performance report
- Revenue reports
- **Analytics Reports**:
- Audience demographics
- Geographic distribution
- Device/browser breakdown
- Time-based analysis (hourly, daily, weekly, monthly)
- Conversion funnel reports

#### 3.6.2 Export Formats

- CSV export
- JSON export
- PDF reports (formatted)
- Scheduled email reports

### 3.7 Admin Interface

#### 3.7.1 Ad Management UI

- List view of all ads with filters
- Create/edit ad forms
- Bulk operations (activate, pause, archive)
- Ad preview
- Image upload interface

#### 3.7.2 Campaign Management UI

- Campaign list with performance summary
- Create/edit campaign forms
- Campaign performance dashboard
- Budget tracking and alerts

#### 3.7.3 Analytics Dashboard UI

- Real-time metrics widgets
- Interactive charts and graphs
- Drill-down capabilities
- Custom date ranges
- Export functionality

#### 3.7.4 Vendor Portal (Optional - Future Enhancement)

- Vendor login
- View their campaigns and ads
- Performance reports
- Billing information

---

## 4. Technical Requirements

### 4.1 Database Schema

#### 4.1.1 Existing Tables (To Be Extended)

- **ad_vendors** (EXISTS): Company info, contact - needs billing fields
- **ads** (EXISTS): Ad details with vendor_id - needs campaign_id, external_ad_url, alt_text, dimensions, A/B testing
- **ad_impressions** (EXISTS): Basic tracking - needs extensive enhancement for advanced metrics
- **ad_clicks** (EXISTS): Basic tracking - needs extensive enhancement for advanced metrics

#### 4.1.2 New Core Tables

- **campaigns**: Campaign details, budget, revenue model, dates (NEW)
- **ad_placements**: Defined ad zones/positions on Squarespace (NEW - optional, can use position field)
- **ad_schedules**: Ad scheduling rules (time, date, placement) (NEW - optional)

#### 4.1.3 New Metrics Tables

- **ad_conversions**: Conversion events with revenue (NEW)
- **ad_events**: Generic event tracking (hover, video play, etc.) (NEW)
- **ad_sessions**: User session tracking for journey analysis (NEW)

#### 4.1.4 Analytics Aggregation Tables (for performance)

- **ad_metrics_daily**: Daily aggregated metrics per ad (NEW)
- **campaign_metrics_daily**: Daily aggregated metrics per campaign (NEW)
- **vendor_metrics_daily**: Daily aggregated metrics per vendor/advertiser (NEW)
- **placement_metrics_daily**: Daily aggregated metrics per placement (NEW)

### 4.2 Tracking Implementation

#### 4.2.1 Client-Side Tracking (Squarespace)

- JavaScript tracking pixel/script
- Impression tracking on ad render
- Click tracking with redirect
- Viewability tracking (Intersection Observer API)
- User interaction tracking
- Session management (localStorage/cookies)
- Device/browser detection

#### 4.2.2 Server-Side Tracking

- API endpoints for event tracking
- Batch event processing
- Real-time aggregation
- Data validation and deduplication

### 4.3 Storage

- **Supabase Storage**: Ad image uploads
- **Supabase Database**: All metrics and metadata
- **File Organization**: `ad-images/{advertiser_id}/{campaign_id}/{ad_id}/`

### 4.4 Performance Requirements

- **Tracking Latency**: < 100ms for impression/click tracking
- **Dashboard Load**: < 2 seconds for real-time dashboard
- **Report Generation**: < 5 seconds for standard reports
- **Concurrent Tracking**: Support 1000+ events/second
- **Data Retention**: Configurable (default 2 years)

### 4.5 Security Requirements

- **RLS Policies**: Secure access to advertiser data
- **Tracking Privacy**: IP anonymization option
- **GDPR Compliance**: Cookie consent, data deletion
- **Rate Limiting**: Prevent tracking abuse

---

## 5. Integration Requirements

### 5.1 Squarespace Integration

- **Code Injection**: JavaScript snippet for footer
- **Ad Widget**: Self-contained ad display component
- **API Integration**: Fetch ads from Supabase
- **Caching**: Client-side caching for performance

### 5.2 Supabase Integration

- **Database**: PostgreSQL for all data
- **Storage**: File uploads for ad images
- **Real-time**: Optional real-time updates for dashboard
- **Functions**: Edge functions for batch processing (optional)

---

## 6. Data Models

### 6.1 Advertiser/Vendor Model (Existing - ad_vendors table)

```typescript
interface AdVendor {
  id: string
  name: string
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  status: 'draft' | 'published' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // NEW FIELDS TO ADD:
  billing_address: string | null
  account_status: 'active' | 'suspended' | 'inactive' | null
}
```

### 6.2 Campaign Model

```typescript
interface Campaign {
  id: string
  advertiser_id: string
  name: string
  revenue_model: 'cpm' | 'cpc' | 'cpa' | 'flat_rate'
  cpm_rate: number | null      // Cost per 1000 impressions
  cpc_rate: number | null       // Cost per click
  cpa_rate: number | null       // Cost per action
  flat_rate: number | null      // Fixed rate
  flat_rate_period: 'day' | 'week' | 'month' | null
  budget_total: number | null
  budget_daily: number | null
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

### 6.3 Ad Model (Existing - ads table, needs extensions)

```typescript
interface Ad {
  id: string
  vendor_id: string              // EXISTS - maps to ad_vendors
  name: string                   // EXISTS
  image_url: string              // EXISTS - required currently
  target_url: string             // EXISTS - required currently
  mobile_image_url: string | null // EXISTS
  position: 'header' | 'body'    // EXISTS
  priority: number               // EXISTS - default 100
  start_date: string | null      // EXISTS
  end_date: string | null        // EXISTS
  status: 'draft' | 'published' | 'archived' // EXISTS
  sort_order: number | null      // EXISTS
  created_by: string | null       // EXISTS
  created_at: string             // EXISTS
  updated_at: string             // EXISTS
  deleted_at: string | null      // EXISTS
  // NEW FIELDS TO ADD:
  campaign_id: string | null      // Link to campaigns table
  external_ad_url: string | null // Support external ad links
  alt_text: string | null        // Accessibility
  width: number | null           // Ad dimensions
  height: number | null          // Ad dimensions
  ab_test_variant: string | null // For A/B testing
}
```

### 6.4 Ad Placement Model

```typescript
interface AdPlacement {
  id: string
  name: string                    // e.g., "Header Banner", "Sidebar"
  description: string | null
  width: number | null
  height: number | null
  position: string | null         // e.g., "header", "sidebar", "footer"
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}
```

### 6.5 Impression Model (Existing - ad_impressions table, needs extensive enhancement)

```typescript
interface AdImpression {
  id: string                      // EXISTS
  ad_id: string                   // EXISTS
  impressed_at: string            // EXISTS (timestamp)
  user_agent: string | null       // EXISTS
  ip_address: string | null       // EXISTS
  device_type: string | null      // EXISTS (text, should be enum)
  // NEW FIELDS TO ADD:
  campaign_id: string | null      // Link to campaigns
  vendor_id: string | null        // Link to ad_vendors (via ad)
  placement_id: string | null    // Link to placements (or use position field)
  session_id: string | null       // User session tracking
  page_url: string | null         // Page where ad was shown
  referrer_url: string | null    // Referring page
  browser: string | null          // Parsed from user_agent
  browser_version: string | null  // Parsed from user_agent
  os: string | null               // Parsed from user_agent
  screen_width: number | null     // Screen resolution
  screen_height: number | null    // Screen resolution
  country: string | null          // Geographic location
  state: string | null            // Geographic location
  city: string | null             // Geographic location
  viewability_start: number | null // Milliseconds ad was in viewport
  viewability_duration: number | null // Total time in viewport
  scroll_depth: number | null     // Percentage of page scrolled
  ad_load_time: number | null     // Milliseconds to load ad
  page_load_time: number | null   // Milliseconds to load page
}
```

### 6.6 Click Model

```typescript
interface AdClick {
  id: string
  impression_id: string           // Link to impression
  ad_id: string
  campaign_id: string
  advertiser_id: string
  placement_id: string | null
  session_id: string
  click_x: number | null          // Click coordinates
  click_y: number | null
  time_to_click: number | null   // Milliseconds from impression
  device_type: 'desktop' | 'mobile' | 'tablet'
  browser: string | null
  country: string | null
  state: string | null
  city: string | null
  timestamp: string
}
```

### 6.7 Conversion Model

```typescript
interface AdConversion {
  id: string
  click_id: string | null         // Associated click
  impression_id: string | null    // Associated impression
  ad_id: string
  campaign_id: string
  advertiser_id: string
  conversion_type: 'purchase' | 'signup' | 'download' | 'lead' | 'other'
  conversion_value: number | null // Revenue amount
  conversion_source: string | null
  session_id: string
  timestamp: string
}
```

### 6.8 Daily Metrics Aggregation Model

```typescript
interface AdMetricsDaily {
  id: string
  ad_id: string
  campaign_id: string
  advertiser_id: string
  placement_id: string | null
  date: string                    // YYYY-MM-DD
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  ctr: number                     // Calculated: clicks / impressions
  conversion_rate: number         // Calculated: conversions / clicks
  cpm: number                     // Calculated revenue per 1000 impressions
  cpc: number                     // Calculated cost per click
  cpa: number                     // Calculated cost per acquisition
  viewable_impressions: number
  viewability_rate: number
  avg_viewability_duration: number
  created_at: string
  updated_at: string
}
```

---

## 7. Implementation Architecture

### 7.0 Existing Database Schema Analysis

#### 7.0.1 Current State

The following tables already exist in Supabase:**ad_vendors** (advertisers):

- ✅ Basic vendor information (name, contact_email, contact_phone, notes)
- ✅ Status management (draft/published/archived)
- ✅ Soft delete support (deleted_at)
- ❌ Missing: billing_address, account_status

**ads**:

- ✅ Vendor association (vendor_id)
- ✅ Image URLs (image_url, mobile_image_url)
- ✅ Target URL (target_url)
- ✅ Position/placement (position: header/body)
- ✅ Priority for rotation (priority)
- ✅ Date range (start_date, end_date)
- ✅ Status and soft delete
- ❌ Missing: campaign_id, external_ad_url, alt_text, width, height, ab_test_variant

**ad_impressions**:

- ✅ Basic tracking (ad_id, impressed_at, user_agent, ip_address, device_type)
- ❌ Missing: campaign_id, vendor_id, session_id, page_url, referrer_url, browser details, geographic data, viewability metrics, performance metrics

**ad_clicks**:

- ✅ Basic tracking (ad_id, clicked_at, user_agent, ip_address, device_type)
- ❌ Missing: impression_id, campaign_id, vendor_id, session_id, click coordinates, time_to_click, browser details, geographic data

#### 7.0.2 Migration Strategy

- **Preserve existing data**: All migrations will be additive (ALTER TABLE ADD COLUMN) where possible
- **Backward compatibility**: Existing functionality will continue to work
- **Gradual enhancement**: New fields will be nullable initially, then populated as tracking improves
- **No breaking changes**: Existing queries and code will continue to function

### 7.1 Database Migrations

#### 7.1.1 Extend Existing Tables

- **ad_vendors**: Add `billing_address` and `account_status` columns
- **ads**: Add `campaign_id`, `external_ad_url`, `alt_text`, `width`, `height`, `ab_test_variant` columns
- **ad_impressions**: Add comprehensive tracking fields (campaign_id, vendor_id, session_id, page_url, referrer_url, browser details, geographic data, viewability metrics, performance metrics)
- **ad_clicks**: Add comprehensive tracking fields (impression_id, campaign_id, vendor_id, session_id, click coordinates, time_to_click, browser details, geographic data)

#### 7.1.2 Create New Tables

- **campaigns**: Campaign management with revenue models and budgets
- **ad_conversions**: Conversion tracking with revenue
- **ad_events**: Generic event tracking for engagement metrics
- **ad_sessions**: User session tracking
- **ad_metrics_daily**: Daily aggregated metrics per ad
- **campaign_metrics_daily**: Daily aggregated metrics per campaign
- **vendor_metrics_daily**: Daily aggregated metrics per vendor
- **placement_metrics_daily**: Daily aggregated metrics per placement (optional)

#### 7.1.3 Database Setup

- Create proper indexes on all foreign keys and frequently queried fields
- Set up RLS policies for all tables
- Create aggregation functions/triggers for daily metrics
- Set up partitioning for metrics tables (by date) for performance
- Create views for common analytics queries

### 7.2 Admin Web Application

- New "Ads" feature in SSA Admin
- Ad management UI (CRUD)
- Campaign management UI
- Analytics dashboard
- Reporting interface

### 7.3 Squarespace Widget

- JavaScript widget for ad display
- Tracking pixel implementation
- Viewability tracking
- Click tracking with redirect
- Session management

### 7.4 API Endpoints

- REST API for ad fetching (public)
- Tracking endpoints (public, rate-limited)
- Admin API (authenticated)
- Analytics API (authenticated)

---

## 8. Success Criteria

### 8.1 Launch Criteria

- Ad creation and management functional
- Campaign management functional
- Basic tracking (impressions, clicks) working
- Squarespace integration working
- Admin dashboard displaying metrics
- Revenue calculations accurate

### 8.2 Post-Launch Success Metrics

- System handles 10,000+ impressions/day
- Tracking accuracy > 99%
- Dashboard load time < 2 seconds
- Revenue tracking accuracy > 99.9%
- Zero data loss in tracking events

---

## 9. Future Enhancements

### 9.1 Phase 2 Features

- Advertiser self-service portal
- Automated billing and invoicing
- Advanced targeting (demographics, interests)
- Retargeting capabilities
- Video ad support
- Native ad formats

### 9.2 Advanced Analytics

- Predictive analytics (forecast revenue, performance)
- Machine learning for ad optimization
- Anomaly detection
- Competitive analysis
- Custom attribution models

---

## 10. Implementation Plan

### Phase 1: Core Ad Management (Weeks 1-2)

1. **Database migrations**:

- Extend existing `ad_vendors` table (add billing_address, account_status)
- Extend existing `ads` table (add campaign_id, external_ad_url, alt_text, width, height, ab_test_variant)
- Create new `campaigns` table
- Enhance `ad_impressions` and `ad_clicks` tables with comprehensive tracking fields
- Create new metrics tables (conversions, events, sessions, daily aggregations)
- Set up indexes, RLS policies, and aggregation functions

1. **Vendor/Advertiser management**: Extend existing UI to support new fields
2. **Campaign management**: New UI for campaign CRUD
3. **Ad management**: Extend existing UI to support campaigns, external links, and new fields
4. **Image upload**: Enhance existing upload to support ad images in Supabase storage

### Phase 2: Tracking Infrastructure (Weeks 3-4)

1. Impression tracking implementation
2. Click tracking implementation
3. Client-side tracking script
4. Server-side API endpoints
5. Basic metrics aggregation

### Phase 3: Analytics Dashboard (Weeks 5-6)

1. Real-time dashboard UI
2. Charts and visualizations
3. Filters and date ranges
4. Export functionality

### Phase 4: Advanced Metrics (Weeks 7-8)

1. Conversion tracking
2. Viewability tracking
3. User engagement metrics
4. Geographic and device tracking
5. Enhanced aggregation

### Phase 5: Squarespace Integration (Week 9)

1. Ad widget development
2. Code injection snippet
3. Testing and optimization
4. Documentation

### Phase 6: Advanced Features (Weeks 10-12)

1. A/B testing framework
2. Conversion funnel tracking
3. Revenue calculations for all models
4. Advanced reporting
5. Performance optimization

### Phase 7: Polish & Launch (Week 13)

1. Testing and bug fixes
2. Documentation

