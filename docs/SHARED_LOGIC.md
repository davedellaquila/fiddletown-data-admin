# Shared Business Logic Contracts

This document defines the business logic contracts that both the web (TypeScript) and iOS (Swift) applications must follow. These contracts ensure consistent behavior across platforms.

## Table of Contents

1. [Slug Generation](#slug-generation)
2. [Date Formatting](#date-formatting)
3. [Time Formatting](#time-formatting)
4. [URL Normalization](#url-normalization)
5. [Status Transitions](#status-transitions)
6. [Validation Rules](#validation-rules)
7. [Data Transformations](#data-transformations)

---

## Slug Generation

**Contract**: Convert a string to a URL-friendly slug.

**Rules**:
1. Convert to lowercase
2. Trim whitespace
3. Remove apostrophes and similar characters (`'`, `` ` ``, `'`)
4. Replace non-alphanumeric characters with hyphens (`-`)
5. Remove leading and trailing hyphens
6. Collapse multiple consecutive hyphens into a single hyphen

**Examples**:
- `"Hello World"` → `"hello-world"`
- `"St. Mary's Winery"` → `"st-marys-winery"`
- `"  Test   "` → `"test"`
- `"---test---"` → `"test"`
- `"test@#$%test"` → `"test-test"`

**Implementation Reference**:
- TypeScript: `web/shared/utils/slugify.ts`
- Swift: `ios/SSA-Admin/Shared/Utils/StringUtils.swift`

---

## Date Formatting

### ISO Date Format

**Contract**: Format a Date object to ISO date string (YYYY-MM-DD).

**Rules**:
1. Use ISO 8601 date format
2. Format: `YYYY-MM-DD`
3. Use UTC timezone for consistency

**Examples**:
- `new Date(2024, 0, 15)` → `"2024-01-15"`
- `new Date(2024, 11, 31)` → `"2024-12-31"`

**Implementation Reference**:
- TypeScript: `web/shared/utils/dateUtils.ts` → `formatISO()`
- Swift: `ios/SSA-Admin/Shared/Utils/DateUtils.swift` → `formatISO()`

---

## Time Formatting

### Format Time to 12-Hour AM/PM

**Contract**: Convert 24-hour time string to 12-hour AM/PM format.

**Input Format**: `HH:MM` or `HH:MM:SS` (24-hour)

**Rules**:
1. Handle both `HH:MM` and `HH:MM:SS` formats
2. Convert 00:XX to 12:XX AM
3. Convert 01-11:XX to 1-11:XX AM
4. Convert 12:XX to 12:XX PM
5. Convert 13-23:XX to 1-11:XX PM
6. Return `"—"` for null/empty input

**Examples**:
- `"00:30"` → `"12:30 AM"`
- `"09:15"` → `"9:15 AM"`
- `"12:00"` → `"12:00 PM"`
- `"14:30"` → `"2:30 PM"`
- `"23:59"` → `"11:59 PM"`
- `null` → `"—"`

**Implementation Reference**:
- TypeScript: `web/shared/utils/dateUtils.ts` → `formatTimeToAMPM()`
- Swift: `ios/SSA-Admin/Shared/Utils/DateUtils.swift` → `formatTimeToAMPM()`

### Convert to 24-Hour Format

**Contract**: Convert various time string formats to 24-hour format (HH:MM).

**Supported Input Formats**:
1. Abbreviated: `"2p"`, `"9a"`, `"2:30p"`, `"12a"`
2. 12-hour: `"2:30 PM"`, `"9:15 AM"`, `"12:00 PM"`
3. 24-hour: `"14:30"`, `"09:15"`
4. Single number with suffix: `"1P"`, `"9A"`, `"12P"`
5. Single number: `"7"`, `"9"`, `"10"`, `"11"`, `"12"`

**Rules**:
1. For end times (`isEndTime=true`), if hour is 1-11 and no AM/PM specified, assume PM
2. For single numbers without AM/PM:
   - Start times: 1-9 → AM, 10-12 → as-is
   - End times: Use `startTime` context to determine AM/PM
3. Return `null` for invalid/unparseable input

**Examples**:
- `"2:30 PM"` → `"14:30"`
- `"9:15 AM"` → `"09:15"`
- `"2p"` → `"14:00"`
- `"9a"` → `"09:00"`
- `"7"` (start time) → `"07:00"`
- `"7"` (end time) → `"19:00"`
- `"12"` → `"12:00"`

**Implementation Reference**:
- TypeScript: `web/shared/utils/dateUtils.ts` → `convertTo24Hour()`
- Swift: `ios/SSA-Admin/Shared/Utils/DateUtils.swift` → `convertTo24Hour()`

---

## URL Normalization

**Contract**: Normalize URL strings by adding protocol if missing.

**Rules**:
1. Return empty string for null/empty input
2. Trim whitespace
3. If URL already has `http://` or `https://`, return as-is
4. Otherwise, prepend `https://`

**Examples**:
- `"example.com"` → `"https://example.com"`
- `"https://example.com"` → `"https://example.com"`
- `"http://example.com"` → `"http://example.com"`
- `"  example.com  "` → `"https://example.com"`
- `null` → `""`
- `""` → `""`

**Implementation Reference**:
- TypeScript: `web/shared/utils/dateUtils.ts` → `normalizeUrl()` (to be moved to `urlUtils.ts`)
- Swift: `ios/SSA-Admin/Shared/Utils/URLUtils.swift` → `normalizeUrl()`

---

## Status Transitions

### Status Values

**Valid Status Values**:
- `"draft"` - Work in progress, not visible to public
- `"published"` - Live and visible to public
- `"archived"` - No longer active, historical record

### Status Transition Rules

**Locations, Events, Routes**:
1. Any status can transition to any other status
2. No restrictions on status changes
3. Status changes are logged via `updated_at` timestamp

**Business Rules**:
- Draft items are not visible in public-facing queries
- Published items appear in public queries
- Archived items are excluded from active listings but preserved

---

## Validation Rules

### Location Validation

**Required Fields**:
- `name` (string, non-empty)

**Optional Fields**:
- `slug` (auto-generated from name if not provided)
- `region` (string)
- `short_description` (string)
- `website_url` (string, should be normalized URL)
- `status` (default: `"draft"`)
- `sort_order` (number, used for ordering)

**Validation Rules**:
1. `name` must be non-empty after trimming
2. `slug` must be URL-friendly (use slugify if auto-generating)
3. `website_url` should be normalized (use normalizeUrl)
4. `status` must be one of: `"draft"`, `"published"`, `"archived"`

### Event Validation

**Required Fields**:
- `name` (string, non-empty)

**Optional Fields**:
- `slug` (auto-generated from name if not provided)
- `description` (string)
- `host_org` (string)
- `start_date` (ISO date string: YYYY-MM-DD)
- `end_date` (ISO date string: YYYY-MM-DD)
- `start_time` (time string: HH:MM)
- `end_time` (time string: HH:MM)
- `location` (string)
- `recurrence` (string)
- `website_url` (string, should be normalized URL)
- `image_url` (string, URL)
- `status` (default: `"draft"`)
- `sort_order` (number)
- `keywords` (array of strings)

**Validation Rules**:
1. `name` must be non-empty after trimming
2. `start_date` must be valid ISO date format if provided
3. `end_date` must be >= `start_date` if both provided
4. `start_time` and `end_time` must be valid time format if provided
5. `website_url` should be normalized
6. `status` must be one of: `"draft"`, `"published"`, `"archived"`

### Route Validation

**Required Fields**:
- `name` (string, non-empty)

**Optional Fields**:
- `slug` (auto-generated from name if not provided)
- `gpx_url` (string, URL)
- `duration_minutes` (number, positive integer)
- `start_point` (string)
- `end_point` (string)
- `difficulty` (enum: `"easy"`, `"moderate"`, `"challenging"`)
- `notes` (string)
- `status` (default: `"draft"`)
- `sort_order` (number)

**Validation Rules**:
1. `name` must be non-empty after trimming
2. `duration_minutes` must be positive if provided
3. `difficulty` must be one of: `"easy"`, `"moderate"`, `"challenging"`
4. `status` must be one of: `"draft"`, `"published"`, `"archived"`

---

## Data Transformations

### Auto-Generate Slug from Name

**Contract**: If slug is not provided, generate it from the name field.

**Process**:
1. Use the `slugify()` function on the `name` field
2. Set the `slug` field to the result

**When to Apply**:
- On create: If slug is empty/null, generate from name
- On update: Only if slug is being cleared (not if name changes)

### Soft Delete

**Contract**: Records are never physically deleted, only marked as deleted.

**Process**:
1. Set `deleted_at` to current timestamp (ISO 8601 format)
2. Do not remove the record from the database
3. Exclude from queries using `.is('deleted_at', null)` filter

**Implementation**:
- All fetch queries must filter out deleted records
- Delete operations update `deleted_at` instead of removing records

---

## Testing Requirements

Both platforms must pass the following test cases for each utility function:

### Slugify Tests
- [ ] Basic conversion: "Hello World" → "hello-world"
- [ ] Apostrophes removed: "St. Mary's" → "st-marys"
- [ ] Leading/trailing hyphens removed: "---test---" → "test"
- [ ] Special characters handled: "test@#$%test" → "test-test"
- [ ] Empty string: "" → ""
- [ ] Whitespace trimmed: "  test  " → "test"

### Time Formatting Tests
- [ ] 00:30 → "12:30 AM"
- [ ] 09:15 → "9:15 AM"
- [ ] 12:00 → "12:00 PM"
- [ ] 14:30 → "2:30 PM"
- [ ] 23:59 → "11:59 PM"
- [ ] null → "—"

### URL Normalization Tests
- [ ] "example.com" → "https://example.com"
- [ ] "https://example.com" → "https://example.com"
- [ ] "http://example.com" → "http://example.com"
- [ ] "  example.com  " → "https://example.com"
- [ ] null → ""
- [ ] "" → ""

---

## Maintenance Notes

- When updating business logic, update this document first
- Both platforms must implement changes to maintain consistency
- Test cases should be added for any new edge cases discovered
- Review this document during code reviews for shared logic changes

