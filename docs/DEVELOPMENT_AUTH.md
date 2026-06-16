# Development Authentication Bypass

This document explains how authentication is bypassed in development mode for easier testing.

## Overview

Magic link authentication has been disabled in development mode to make testing easier in simulators and during development. Authentication will be automatically enabled in production builds.

## How It Works

### iOS App

The iOS app uses compile-time flags to detect development mode:

```swift
#if DEBUG
private let isDevelopmentMode = true
#else
private let isDevelopmentMode = false
#endif
```

**Files Modified**:
- `ios/SSA-Admin/SSA-Admin/SSA_AdminApp.swift` - Bypasses login screen in DEBUG builds
- `ios/SSA-Admin/Shared/Services/SupabaseService.swift` - Returns nil session in development mode

**Behavior**:
- In DEBUG builds: App shows ContentView directly without authentication
- In RELEASE builds: App shows LoginView and requires magic link authentication

### Web App

The web app uses Vite's environment detection:

```typescript
const IS_DEVELOPMENT_MODE = import.meta.env.DEV || import.meta.env.MODE === 'development'
```

**Files Modified**:
- `web/src/App.tsx` - Bypasses login screen in development mode

**Behavior**:
- In development (`npm run dev`): App loads without a login gate; Candidates (and other authenticated-only tables) show a sign-in prompt until you complete a magic link
- In production (`npm run build`): App shows login screen and requires magic link authentication

## Enabling Authentication for Production

### iOS

To enable authentication for production:

1. Open `ios/SSA-Admin/SSA-Admin/SSA_AdminApp.swift`
2. Change `isDevelopmentMode` to `false` in the `#if DEBUG` block:

```swift
#if DEBUG
private let isDevelopmentMode = false  // Change to false to test auth in debug
#else
private let isDevelopmentMode = false  // Always false in production
#endif
```

Or build a Release configuration:
- Product → Scheme → Edit Scheme
- Set Build Configuration to "Release"
- Authentication will be enabled automatically

### Web

To enable authentication for production:

1. Build for production: `npm run build`
2. Authentication is automatically enabled in production builds
3. Or manually set `IS_DEVELOPMENT_MODE` to `false` in `web/src/App.tsx`

## Testing Authentication

To test the authentication flow:

### iOS
1. Change `isDevelopmentMode` to `false` in `SSA_AdminApp.swift`
2. Or build with Release configuration
3. Run the app - you'll see the login screen

### Web
1. Build for production: `npm run build`
2. Run preview: `npm run preview`
3. Or manually set `IS_DEVELOPMENT_MODE = false` in `App.tsx`

## Notes

- Development mode skips the login gate but still connects to Supabase
- Sign in via magic link when working on Candidates (or other authenticated-only data)
- **Cursor Simple Browser:** email links open your default browser by default — copy the magic link and paste it into the Simple Browser address bar or the Candidates “Open link here” field
- The app shows your work email in the sidebar once signed in
- Sign out clears the Supabase session; other modules that allow anonymous read still work unsigned

## Security

⚠️ **Important**: Never commit code with `isDevelopmentMode = true` in production builds. The current implementation uses `#if DEBUG` which automatically disables it in Release builds, but always verify before deploying.

