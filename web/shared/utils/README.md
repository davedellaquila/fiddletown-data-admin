# Shared Utility Functions

This directory contains utility functions that must behave identically in both the web (TypeScript) and iOS (Swift) applications. Each function has a documented contract that both platforms must follow.

## Table of Contents

1. [slugify](#slugify)
2. [Date Utilities](#date-utilities)
3. [URL Utilities](#url-utilities)

---

## slugify

**File**: `slugify.ts`

**Contract**: Convert a string to a URL-friendly slug.

**Function Signature**:
```typescript
function slugify(s: string): string
```

**Input**: A string to convert to a slug

**Output**: A URL-friendly slug string

**Rules**:
1. Convert to lowercase
2. Trim whitespace
3. Remove apostrophes and similar characters (`'`, `` ` ``, `'`)
4. Replace non-alphanumeric characters with hyphens (`-`)
5. Remove leading and trailing hyphens
6. Collapse multiple consecutive hyphens into a single hyphen

**Test Cases**:
- `"Hello World"` → `"hello-world"`
- `"St. Mary's Winery"` → `"st-marys-winery"`
- `"  Test   "` → `"test"`
- `"---test---"` → `"test"`
- `"test@#$%test"` → `"test-test"`
- `""` → `""`
- `"test--test"` → `"test-test"`

**Edge Cases**:
- Empty string returns empty string
- String with only special characters returns empty string
- Multiple spaces become single hyphen

**Swift Implementation**: `ios/SSA-Admin/Shared/Utils/StringUtils.swift`

**See Also**: `docs/SHARED_LOGIC.md#slug-generation`

---

## Date Utilities

**File**: `dateUtils.ts`

### formatISO

**Contract**: Format a Date object to ISO date string (YYYY-MM-DD).

**Function Signature**:
```typescript
function formatISO(date: Date): string
```

**Input**: JavaScript Date object

**Output**: ISO date string in format `YYYY-MM-DD`

**Rules**:
1. Use ISO 8601 date format
2. Format: `YYYY-MM-DD`
3. Use UTC timezone for consistency

**Test Cases**:
- `new Date(2024, 0, 15)` → `"2024-01-15"`
- `new Date(2024, 11, 31)` → `"2024-12-31"`
- `new Date(2024, 0, 1)` → `"2024-01-01"`

**Swift Implementation**: `ios/SSA-Admin/Shared/Utils/DateUtils.swift`

**See Also**: `docs/SHARED_LOGIC.md#date-formatting`

### formatTimeToAMPM

**Contract**: Convert 24-hour time string to 12-hour AM/PM format.

**Function Signature**:
```typescript
function formatTimeToAMPM(timeStr: string | null): string
```

**Input**: Time string in `HH:MM` or `HH:MM:SS` format, or `null`

**Output**: 12-hour format string (e.g., `"2:30 PM"`) or `"—"` for null input

**Rules**:
1. Handle both `HH:MM` and `HH:MM:SS` formats
2. Convert 00:XX to 12:XX AM
3. Convert 01-11:XX to 1-11:XX AM
4. Convert 12:XX to 12:XX PM
5. Convert 13-23:XX to 1-11:XX PM
6. Return `"—"` for null/empty input

**Test Cases**:
- `"00:30"` → `"12:30 AM"`
- `"09:15"` → `"9:15 AM"`
- `"12:00"` → `"12:00 PM"`
- `"14:30"` → `"2:30 PM"`
- `"23:59"` → `"11:59 PM"`
- `"09:15:30"` → `"9:15 AM"`
- `null` → `"—"`
- `""` → `"—"`

**Edge Cases**:
- Invalid format returns input as-is
- Seconds are ignored if present

**Swift Implementation**: `ios/SSA-Admin/Shared/Utils/DateUtils.swift`

**See Also**: `docs/SHARED_LOGIC.md#time-formatting`

### convertTo24Hour

**Contract**: Convert various time string formats to 24-hour format (HH:MM).

**Function Signature**:
```typescript
function convertTo24Hour(
  timeStr: string | null,
  isEndTime?: boolean,
  startTime?: string | null
): string | null
```

**Input**:
- `timeStr`: Time string in various formats
- `isEndTime`: Whether this is an end time (affects AM/PM inference)
- `startTime`: Start time for context when inferring AM/PM

**Output**: 24-hour format string (`HH:MM`) or `null` if invalid

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

**Test Cases**:
- `"2:30 PM"` → `"14:30"`
- `"9:15 AM"` → `"09:15"`
- `"2p"` → `"14:00"`
- `"9a"` → `"09:00"`
- `"7"` (start time) → `"07:00"`
- `"7"` (end time) → `"19:00"`
- `"12"` → `"12:00"`
- `"invalid"` → `null`
- `null` → `null`

**Edge Cases**:
- Single digit hours without AM/PM require context
- End times default to PM for ambiguous cases
- Invalid formats return null

**Swift Implementation**: `ios/SSA-Admin/Shared/Utils/DateUtils.swift`

**See Also**: `docs/SHARED_LOGIC.md#time-formatting`

---

## URL Utilities

**File**: `urlUtils.ts`

### normalizeUrl

**Contract**: Normalize URL strings by adding protocol if missing.

**Function Signature**:
```typescript
function normalizeUrl(u?: string | null): string
```

**Input**: URL string or `null`/`undefined`

**Output**: Normalized URL string with protocol, or empty string

**Rules**:
1. Return empty string for null/empty input
2. Trim whitespace
3. If URL already has `http://` or `https://`, return as-is
4. Otherwise, prepend `https://`

**Test Cases**:
- `"example.com"` → `"https://example.com"`
- `"https://example.com"` → `"https://example.com"`
- `"http://example.com"` → `"http://example.com"`
- `"  example.com  "` → `"https://example.com"`
- `null` → `""`
- `undefined` → `""`
- `""` → `""`

**Edge Cases**:
- Empty string after trimming returns empty string
- Protocol is case-insensitive (`HTTP://` is recognized)
- Trailing slashes are preserved

**Swift Implementation**: `ios/SSA-Admin/Shared/Utils/URLUtils.swift`

**See Also**: `docs/SHARED_LOGIC.md#url-normalization`

---

## Testing Requirements

Both platforms must pass all test cases listed above for each utility function. When implementing or updating utilities:

1. Review the test cases in this document
2. Implement the function to pass all test cases
3. Add any new edge cases discovered to this document
4. Update the Swift implementation to match

---

## Maintenance Notes

- When updating utility functions, update this README first
- Add test cases for any new edge cases discovered
- Both platforms must implement changes to maintain consistency
- Review this document during code reviews for utility changes

