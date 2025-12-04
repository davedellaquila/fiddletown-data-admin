# Development Workflow

This document outlines the development process for maintaining consistency between the web and iOS applications.

## Table of Contents

1. [Adding New Features](#adding-new-features)
2. [Updating Shared Logic](#updating-shared-logic)
3. [Testing Requirements](#testing-requirements)
4. [Code Review Checklist](#code-review-checklist)

---

## Adding New Features

### Step 1: Plan the Feature

1. **Define the Feature**: Clearly describe what the feature does
2. **Identify Shared Logic**: Determine what business logic will be shared
3. **Document Contracts**: Add business logic contracts to `docs/SHARED_LOGIC.md`
4. **Plan API Changes**: Document any new API endpoints or query patterns

### Step 2: Update TypeScript Types (Source of Truth)

1. **Add/Update Types**: Modify `web/shared/types/models.ts`
2. **Add JSDoc Comments**: Document fields, validation rules, and business rules
3. **Update Constants**: Add any new constants to `web/shared/constants/index.ts`
4. **Export from Index**: Ensure types are exported from `web/shared/types/index.ts`

### Step 3: Implement Web Feature

1. **Create Feature Component**: Add to `web/src/features/`
2. **Use Shared Utilities**: Leverage utilities from `web/shared/utils/`
3. **Follow API Patterns**: Use patterns from `web/shared/api/supabaseQueries.ts`
4. **Add Tests**: Write tests for business logic

### Step 4: Sync Swift Models

1. **Update DataModels.swift**: Follow `ios/SSA-Admin/Shared/Models/README.md`
2. **Update Constants**: Sync `ios/SSA-Admin/Shared/Constants/AppConstants.swift`
3. **Update Service Layer**: Add methods to `SupabaseService.swift`
4. **Verify Sync**: Use type validation script (see below)

### Step 5: Implement iOS Feature

1. **Create Feature View**: Add to `ios/SSA-Admin/Features/`
2. **Use Shared Utilities**: Leverage utilities from `ios/SSA-Admin/Shared/Utils/`
3. **Follow API Patterns**: Use patterns matching TypeScript implementation
4. **Match Behavior**: Ensure behavior matches web app

### Step 6: Test Both Platforms

1. **Test Web**: Verify feature works in web app
2. **Test iOS**: Verify feature works in iOS app
3. **Compare Behavior**: Ensure both platforms behave identically
4. **Test Edge Cases**: Verify edge cases are handled consistently

---

## Updating Shared Logic

### When Updating Business Logic

1. **Update Documentation First**: Modify `docs/SHARED_LOGIC.md`
2. **Update TypeScript Implementation**: Modify utility functions
3. **Update Documentation**: Update `web/shared/utils/README.md` with new test cases
4. **Update Swift Implementation**: Sync Swift utilities to match
5. **Test Both Platforms**: Verify both implementations pass all test cases

### When Updating API Patterns

1. **Update Documentation**: Modify `docs/API_CONTRACTS.md` and `docs/API_PATTERNS.md`
2. **Update TypeScript Helpers**: Modify `web/shared/api/supabaseQueries.ts`
3. **Update Swift Service**: Modify `SupabaseService.swift` to match patterns
4. **Update Both Apps**: Update feature code in both platforms
5. **Test Queries**: Verify queries work correctly on both platforms

### When Updating Types

1. **Update TypeScript Types**: Modify `web/shared/types/models.ts`
2. **Run Type Validation**: Use `scripts/validate-types.ts` to check sync status
3. **Update Swift Models**: Follow `ios/SSA-Admin/Shared/Models/README.md`
4. **Update Service Layer**: Update insert/update data structures
5. **Update Views**: Update form fields and display logic
6. **Test**: Verify create/update/fetch operations work

---

## Testing Requirements

### Unit Tests

**TypeScript**:
- Test utility functions with all documented test cases
- Test type guards and validation helpers
- Test API query helpers

**Swift**:
- Test utility functions match TypeScript behavior
- Test model encoding/decoding
- Test service layer methods

### Integration Tests

**Both Platforms**:
- Test create operations with all required fields
- Test update operations
- Test fetch operations with filters
- Test delete operations (soft delete)
- Test error handling

### Cross-Platform Tests

- Compare utility function outputs for same inputs
- Verify API queries return same data structure
- Ensure business logic behaves identically

---

## Code Review Checklist

### For TypeScript Changes

- [ ] Types have JSDoc comments documenting business rules
- [ ] Utility functions match contracts in `docs/SHARED_LOGIC.md`
- [ ] API queries follow patterns in `docs/API_CONTRACTS.md`
- [ ] Constants are exported from `web/shared/constants/index.ts`
- [ ] Tests cover all documented test cases

### For Swift Changes

- [ ] Models match TypeScript types (check `docs/TYPE_SYNC.md`)
- [ ] Utility functions match TypeScript behavior
- [ ] Service methods follow API patterns
- [ ] Constants match TypeScript constants
- [ ] CodingKeys map snake_case correctly

### For Documentation Changes

- [ ] Contracts are clear and testable
- [ ] Examples are provided for both platforms
- [ ] Test cases are documented
- [ ] Sync process is documented

### For Feature Changes

- [ ] Feature works on both platforms
- [ ] Behavior is consistent across platforms
- [ ] Shared logic is documented
- [ ] Tests are added for new functionality

---

## Type Validation

Run the type validation script before committing type changes:

```bash
npm run validate-types
```

Or directly:

```bash
npx tsx scripts/validate-types.ts
```

The script will:
- Check TypeScript types have corresponding Swift models
- Validate field mappings
- Check enum values match
- Generate a sync report

---

## Branch Strategy

1. **Feature Branches**: Create branch for each feature
2. **Type Changes First**: Update TypeScript types first
3. **Sync Swift**: Update Swift models in same PR
4. **Implement Both**: Implement feature on both platforms
5. **Test Both**: Test on both platforms before merging

---

## Commit Messages

Use clear commit messages:

```
feat(types): Add phone_number field to Location model

- Add phone_number to TypeScript Location interface
- Update Swift Location model with phoneNumber property
- Update LocationInsertData and LocationUpdateData
- Update LocationsView form fields
```

---

## Maintenance Notes

- Review this workflow when adding new features
- Update documentation when patterns change
- Keep both platforms in sync
- Run type validation regularly
- Test both platforms before releasing

---

## See Also

- `docs/SHARED_LOGIC.md` - Business logic contracts
- `docs/API_CONTRACTS.md` - API query patterns
- `docs/TYPE_SYNC.md` - Type synchronization guide
- `ios/SSA-Admin/Shared/Models/README.md` - Model sync process
- `ios/SSA-Admin/Shared/Utils/README.md` - Utility sync process

