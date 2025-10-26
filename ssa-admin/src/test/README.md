# Testing Guide for SSA Admin

This directory contains the testing setup and utilities for the SSA Admin application.

## Testing Framework

- **Vitest** - Fast unit test runner
- **React Testing Library** - Component testing utilities
- **MSW (Mock Service Worker)** - API mocking
- **jsdom** - DOM environment for tests

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test configuration and mocks
│   └── README.md             # This file
├── utils/
│   └── __tests__/            # Unit tests for utilities
├── components/
│   └── __tests__/            # Component tests
└── __tests__/                # Integration tests
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Run Once
```bash
npm run test:run
```

### Coverage Report
```bash
npm run test:coverage
```

### Test UI
```bash
npm run test:ui
```

## Test Categories

### 1. Unit Tests
- **Location**: `src/utils/__tests__/`
- **Purpose**: Test individual utility functions
- **Examples**: Validation, slug generation, data formatting

### 2. Component Tests
- **Location**: `src/components/__tests__/`
- **Purpose**: Test React components in isolation
- **Examples**: LoadingScreen, StartupLogo, form components

### 3. Integration Tests
- **Location**: `src/__tests__/`
- **Purpose**: Test component interactions and user flows
- **Examples**: App authentication, form submission, navigation

## Writing Tests

### Test File Naming
- Unit tests: `*.test.ts`
- Component tests: `*.test.tsx`
- Integration tests: `*.test.tsx`

### Test Structure
```typescript
import { describe, it, expect } from 'vitest'

describe('ComponentName', () => {
  it('should do something', () => {
    // Test implementation
  })
})
```

### Component Testing
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('should handle user interaction', async () => {
  const user = userEvent.setup()
  render(<MyComponent />)
  
  await user.click(screen.getByRole('button'))
  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

### Mocking
```typescript
// Mock external dependencies
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn()
    }
  }
}))
```

## Coverage Goals

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

## Best Practices

### 1. Test User Behavior
- Focus on what users see and do
- Test accessibility features
- Verify error handling

### 2. Mock External Dependencies
- Mock Supabase calls
- Mock file uploads
- Mock network requests

### 3. Test Edge Cases
- Empty states
- Error conditions
- Loading states
- Invalid input

### 4. Keep Tests Simple
- One concept per test
- Clear test names
- Minimal setup

## Debugging Tests

### Run Specific Test
```bash
npm test -- --run ComponentName
```

### Debug Mode
```bash
npm test -- --reporter=verbose
```

### Test UI
```bash
npm run test:ui
```

## Continuous Integration

Tests should run automatically on:
- Pull requests
- Main branch pushes
- Release builds

## Troubleshooting

### Common Issues

1. **Mock not working**
   - Check import paths
   - Verify mock setup in setup.ts

2. **Async test failures**
   - Use `waitFor` for async operations
   - Check for proper cleanup

3. **Component not rendering**
   - Check for missing providers
   - Verify mock implementations

### Getting Help

- Check Vitest documentation
- Review React Testing Library guides
- Check test setup.ts for configuration
