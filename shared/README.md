# Shared Code

This directory contains shared business logic and type definitions that are used by both the web app and the iPad app.

## Structure

- **`types/`**: TypeScript type definitions for data models (Location, Event, Route)
- **`utils/`**: Pure utility functions (slugify, date parsing, OCR parsing logic)
- **`api/`**: Supabase API client configuration and query builders
- **`constants/`**: Shared constants (status enums, field definitions)

## Usage

### Web App
Import shared code using relative paths:
```typescript
import { slugify } from '../../shared/utils/slugify'
import type { Location } from '../../shared/types/models'
```

### iPad App
The Swift implementations in `ios-app/SSAAdminiPad/Shared/` mirror these TypeScript definitions. When updating shared logic, ensure both implementations stay in sync.

## Notes

- TypeScript types serve as the source of truth for data models
- Swift models in `ios-app/SSAAdminiPad/Shared/Models/` should match TypeScript types
- Utility functions are ported to Swift but follow the same logic patterns




