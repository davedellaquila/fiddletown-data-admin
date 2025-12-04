# Utility Function Synchronization Guide

This guide provides instructions for keeping Swift utility functions synchronized with TypeScript utilities.

## Source of Truth

**TypeScript Utilities**: `web/shared/utils/`  
**Swift Utilities**: `ios/SSA-Admin/Shared/Utils/`

## Utility Functions

### slugify

**TypeScript**: `web/shared/utils/slugify.ts`  
**Swift**: `ios/SSA-Admin/Shared/Utils/StringUtils.swift`

**Contract**: See `web/shared/utils/README.md#slugify`

**Test Cases** (both platforms must pass):
- `"Hello World"` → `"hello-world"`
- `"St. Mary's Winery"` → `"st-marys-winery"`
- `"  Test   "` → `"test"`
- `"---test---"` → `"test"`
- `"test@#$%test"` → `"test-test"`
- `""` → `""`

### Date Utilities

**TypeScript**: `web/shared/utils/dateUtils.ts`  
**Swift**: `ios/SSA-Admin/Shared/Utils/DateUtils.swift`

#### formatISO

**Contract**: Format Date to ISO date string (YYYY-MM-DD)

**Test Cases**:
- `Date(2024, 0, 15)` → `"2024-01-15"`
- `Date(2024, 11, 31)` → `"2024-12-31"`

#### formatTimeToAMPM

**Contract**: Convert 24-hour time to 12-hour AM/PM format

**Test Cases**:
- `"00:30"` → `"12:30 AM"`
- `"09:15"` → `"9:15 AM"`
- `"12:00"` → `"12:00 PM"`
- `"14:30"` → `"2:30 PM"`
- `"23:59"` → `"11:59 PM"`
- `null` → `"—"`

#### convertTo24Hour

**Contract**: Convert various time formats to 24-hour format

**Test Cases**:
- `"2:30 PM"` → `"14:30"`
- `"9:15 AM"` → `"09:15"`
- `"2p"` → `"14:00"`
- `"9a"` → `"09:00"`
- `"7"` (start time) → `"07:00"`
- `"7"` (end time) → `"19:00"`
- `"invalid"` → `null`

### URL Utilities

**TypeScript**: `web/shared/utils/urlUtils.ts`  
**Swift**: `ios/SSA-Admin/Shared/Utils/URLUtils.swift`

#### normalizeUrl

**Contract**: Add https:// protocol if missing

**Test Cases**:
- `"example.com"` → `"https://example.com"`
- `"https://example.com"` → `"https://example.com"`
- `"http://example.com"` → `"http://example.com"`
- `"  example.com  "` → `"https://example.com"`
- `null` → `""`

## Sync Process

### Step 1: Review TypeScript Changes

1. Open the TypeScript utility file
2. Read the function documentation
3. Review test cases in `web/shared/utils/README.md`

### Step 2: Update Swift Implementation

1. Open the corresponding Swift utility file
2. Update function implementation to match TypeScript behavior
3. Ensure all test cases pass

### Step 3: Test

- [ ] Run all test cases from `web/shared/utils/README.md`
- [ ] Verify edge cases are handled correctly
- [ ] Check error handling matches TypeScript behavior

## Implementation Notes

### String Manipulation

Swift uses different string APIs than TypeScript:
- Use `lowercased()` instead of `toLowerCase()`
- Use `trimmingCharacters(in: .whitespaces)` instead of `trim()`
- Use `replacingOccurrences(of:with:)` instead of `replace()`

### Regular Expressions

Swift uses `NSRegularExpression` or `String.range(of:options:)`:
- Pattern syntax is similar but may need adjustments
- Use `NSRegularExpression` for complex patterns
- Use `String.range(of:options:)` for simple patterns

### Date/Time Handling

Swift uses `Date` and `DateFormatter`:
- Use `ISO8601DateFormatter` for ISO dates
- Use `DateFormatter` for custom formats
- Be careful with timezone handling

## See Also

- `web/shared/utils/README.md` - Complete utility documentation
- `docs/SHARED_LOGIC.md` - Business logic contracts

