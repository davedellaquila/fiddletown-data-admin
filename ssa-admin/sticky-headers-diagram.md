# Sticky Headers Layout Diagram

## How Sticky Header Offsets Work

```
┌─────────────────────────────────────────────────────────────────┐
│                        PAGE HEADER                             │
│                    (Fixed at top)                              │
├─────────────────────────────────────────────────────────────────┤
│                        TOOLBAR                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Search │ Filters │ Buttons │ Import │ Export │ OCR     │   │
│  └─────────────────────────────────────────────────────────┘   │
│  Height varies by module:                                     │
│  • Locations: ~105px                                          │
│  • Events: ~160px (includes OCR section)                      │
│  • Routes: ~125px                                             │
├─────────────────────────────────────────────────────────────────┤
│                    TABLE HEADERS (STICKY)                     │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐     │
│  │Name │Reg. │Stat.│Web. │Act. │     │     │     │     │     │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  │Data │Data │Data │Data │Data │     │     │     │     │     │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## CSS Implementation

### Layout Constants
```typescript
// /src/shared/constants/layout.ts
export const STICKY_HEADER_TOP_OFFSETS = {
  LOCATIONS: '105px',  // Shorter toolbar
  EVENTS: '160px',     // Taller toolbar (includes OCR)
  ROUTES: '125px'      // Medium toolbar
} as const;
```

### Applied to Table Headers
```css
/* Each <th> element gets: */
position: sticky;
top: STICKY_HEADER_TOP_OFFSETS.[MODULE];
zIndex: 110;
```

## Module-Specific Layouts

### Locations Module
```
┌─────────────────────────────────────┐
│           Page Header               │
├─────────────────────────────────────┤
│           Toolbar                 │ ← ~105px height
│  Search │ Filters │ Buttons       │
├─────────────────────────────────────┤
│  Table Headers (sticky)             │ ← top: 105px
│  ┌─────┬─────┬─────┬─────┬─────┐    │
│  │Name │Reg. │Stat.│Web. │Act. │    │
│  └─────┴─────┴─────┴─────┴─────┘    │
└─────────────────────────────────────┘
```

### Events Module
```
┌─────────────────────────────────────┐
│           Page Header               │
├─────────────────────────────────────┤
│           Toolbar                   │ ← ~160px height
│  Search │ Filters │ Buttons         │
│  ┌─────────────────────────────┐    │
│  │     OCR Section             │    │ ← Extra height
│  │  Image Upload │ Paste       │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│  Table Headers (sticky)             │ ← top: 160px
│  ┌─────┬─────┬─────┬─────┬─────┐    │
│  │Name │Date │Time │Loc. │Act. │    │
│  └─────┴─────┴─────┴─────┴─────┘    │
└─────────────────────────────────────┘
```

### Routes Module
```
┌─────────────────────────────────────┐
│           Page Header               │
├─────────────────────────────────────┤
│           Toolbar                   │ ← ~125px height
│  Search │ Filters │ Buttons         │
│  Import │ Export │ GPX Upload      │
├─────────────────────────────────────┤
│  Table Headers (sticky)             │ ← top: 125px
│  ┌─────┬─────┬─────┬─────┬─────┐    │
│  │Name │Dur. │Diff.│GPX  │Act. │    │
│  └─────┴─────┴─────┴─────┴─────┘    │
└─────────────────────────────────────┘
```

## Scrolling Behavior

### Before Scroll
```
┌─────────────────────────────────────┐
│           Page Header               │
├─────────────────────────────────────┤
│           Toolbar                   │
├─────────────────────────────────────┤
│  Table Headers (normal position)    │
│  ┌─────┬─────┬─────┬─────┬─────┐    │
│  │Name │Reg. │Stat.│Web. │Act. │    │
│  ├─────┼─────┼─────┼─────┼─────┤    │
│  │Data │Data │Data │Data │Data │    │
│  │Data │Data │Data │Data │Data │    │
│  └─────┴─────┴─────┴─────┴─────┘    │
└─────────────────────────────────────┘
```

### After Scroll
```
┌─────────────────────────────────────┐
│           Page Header               │ ← Scrolled up
├─────────────────────────────────────┤
│           Toolbar                   │ ← Scrolled up
├─────────────────────────────────────┤
│  Table Headers (sticky position)    │ ← Stays visible
│  ┌─────┬─────┬─────┬─────┬─────┐    │
│  │Name │Reg. │Stat.│Web. │Act. │    │
│  ├─────┼─────┼─────┼─────┼─────┤    │
│  │Data │Data │Data │Data │Data │    │
│  │Data │Data │Data │Data │Data │    │
│  │Data │Data │Data │Data │Data │    │
│  │Data │Data │Data │Data │Data │    │
│  └─────┴─────┴─────┴─────┴─────┘    │
└─────────────────────────────────────┘
```

## Key Benefits

1. **Consistent Positioning**: Headers stick at the right position for each module
2. **Module-Specific**: Different offsets accommodate different toolbar heights
3. **User Experience**: Headers remain visible while scrolling through data
4. **Maintainable**: Single source of truth for offset values
5. **Responsive**: Works across different screen sizes

## Technical Implementation

```typescript
// Import the constants
import { STICKY_HEADER_TOP_OFFSETS } from '../shared/constants/layout'

// Apply to each table header
<th style={{
  position: 'sticky',
  top: STICKY_HEADER_TOP_OFFSETS.LOCATIONS, // 105px
  zIndex: 110
}}>Name</th>
```

This ensures that when users scroll down, the table headers stick to the correct position just below each module's toolbar, maintaining visibility and usability.
