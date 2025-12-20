# Common Code Patterns

## Date Handling

### Parsing Date Strings (Avoid Timezone Issues)
```typescript
// ❌ BAD: Can cause timezone shifts
const date = new Date("2024-12-05"); // Parses as UTC midnight

// ✅ GOOD: Parse manually in local time
const [year, month, day] = "2024-12-05".split("-").map(Number);
const date = new Date(year, month - 1, day); // Local time
```

### Date Filtering with PostgREST
```typescript
// ✅ GOOD: Inclusive date range filter
const fromDate = "2024-12-04";
const toDate = "2024-12-10";

// Use day before FROM and day after TO for inclusive range
const dayBeforeFrom = new Date(fromDate);
dayBeforeFrom.setDate(dayBeforeFrom.getDate() - 1);
const dayAfterTo = new Date(toDate);
dayAfterTo.setDate(dayAfterTo.getDate() + 1);

query
  .gt('start_date', formatISO(dayBeforeFrom))
  .lte('end_date', formatISO(dayAfterTo))
```

## API Query Patterns

### Fetching with Filters
```typescript
// ✅ GOOD: Flattened or filter
query
  .or(`start_date.gte.${fromDate},end_date.lte.${toDate}`)

// ❌ BAD: Deeply nested or filter (causes 400 error)
query.or(`or(start_date.gte.${fromDate},end_date.lte.${toDate})`)
```

### Soft Delete Filter
```typescript
// ✅ GOOD: Always filter out deleted records
query.is('deleted_at', null)
```

### Status Filtering
```typescript
// ✅ GOOD: Filter by status
query.eq('status', 'published')

// Combine with soft delete
query
  .is('deleted_at', null)
  .eq('status', 'published')
```

## Type Definitions

### TypeScript Model with JSDoc
```typescript
/**
 * Location model representing a winery or location
 * 
 * @property {string} name - Required. Display name of the location
 * @property {string} slug - URL-friendly identifier, auto-generated from name if not provided
 * @property {string} status - One of: "draft", "published", "archived". Default: "draft"
 * @property {string} website_url - Should be normalized using normalizeUrl()
 * 
 * @example
 * const location: Location = {
 *   name: "St. Mary's Winery",
 *   slug: "st-marys-winery",
 *   status: "published"
 * };
 */
export interface Location {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  website_url?: string;
  // ... other fields
}
```

### Swift Model with CodingKeys
```swift
struct Location: Codable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let status: Status
    let websiteUrl: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case name
        case slug
        case status
        case websiteUrl = "website_url"  // snake_case ↔ camelCase
    }
}
```

## Utility Functions

### Slug Generation
```typescript
// ✅ GOOD: Follow contract from SHARED_LOGIC.md
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/['`']/g, '')  // Remove apostrophes
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '')  // Remove leading/trailing hyphens
    .replace(/-+/g, '-');  // Collapse multiple hyphens
}
```

### URL Normalization
```typescript
// ✅ GOOD: Add protocol if missing
export function normalizeUrl(url: string | null | undefined): string {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
```

## Component Patterns

### React Feature Component
```typescript
// ✅ GOOD: Feature component structure
export default function Locations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchLocations();
  }, []);
  
  async function fetchLocations() {
    // Use shared API helpers
    const data = await fetchLocationsQuery();
    setLocations(data);
    setLoading(false);
  }
  
  // ... rest of component
}
```

### SwiftUI Feature View
```swift
// ✅ GOOD: Feature view structure
struct LocationsView: View {
    @StateObject private var viewModel = LocationsViewModel()
    
    var body: some View {
        List(viewModel.locations) { location in
            // Display location
        }
        .onAppear {
            viewModel.fetchLocations()
        }
    }
}
```

## Error Handling

### API Error Handling
```typescript
// ✅ GOOD: Handle errors gracefully
try {
  const data = await fetchLocationsQuery();
  setLocations(data);
} catch (error) {
  console.error('Failed to fetch locations:', error);
  // Show user-friendly error message
}
```

## File Organization

### When to Refactor
- File exceeds 200-300 lines
- Component has multiple responsibilities
- Utility function is reused in multiple places

### Refactoring Pattern
1. Extract shared logic to `web/shared/utils/` or `ios/SSA-Admin/Shared/Utils/`
2. Extract reusable components to `web/src/shared/components/`
3. Update documentation if business logic changes
4. Sync Swift implementation if TypeScript changes

