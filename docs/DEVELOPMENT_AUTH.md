# Development Authentication Bypass

This document explains how authentication is bypassed in development mode for easier testing.

## Overview

In development (`npm run dev`), the app shell loads without a login gate. **Candidates** (and other RLS-protected tables) still need a Supabase session — but you can skip magic links entirely using **dev auto sign-in** (recommended).

Authentication is required in production builds.

## Recommended: Dev auto sign-in (no magic link)

### 1. Create a dev user in Supabase

1. Open [Supabase Dashboard](https://app.supabase.com) → your project → **Authentication** → **Users**
2. **Add user** → **Create new user**
3. Set an email and password (e.g. `dev@yourdomain.com` / a strong dev-only password)
4. Enable **Auto Confirm User** so email verification is not required

### 2. Add credentials to `web/.env.local`

```env
VITE_DEV_AUTH_EMAIL=dev@yourdomain.com
VITE_DEV_AUTH_PASSWORD=your-dev-password
```

Keep your existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` lines.

### 3. Restart the dev server

```bash
cd web
npm run dev
```

On load, the app signs in automatically. Candidates load without magic links. Your email appears in the sidebar.

**Security:** Never commit `.env.local`. These variables are only read when `npm run dev` is running; production builds ignore dev auto sign-in.

### Troubleshooting dev auto sign-in

| Problem | Fix |
|---------|-----|
| "Invalid login credentials" | Check email/password in Supabase Users |
| "Email not confirmed" | Recreate user with **Auto Confirm User** |
| Still shows magic link prompt | Ensure both `VITE_DEV_*` vars are set and restart dev server |
| Approve/publish fails | Dev user must exist in `auth.users` (RPCs use `auth.uid()`) |

## Fallback: Magic link (optional)

If you omit `VITE_DEV_AUTH_*`, Candidates shows a sign-in prompt. Send a magic link or paste the full URL in the textarea (useful in Cursor Simple Browser where email opens another browser).

See previous magic-link notes in git history if needed.

## How it works

### Web

- `web/src/lib/devMode.ts` — detects Vite dev mode
- `web/src/lib/devAuth.ts` — auto `signInWithPassword` from env
- `web/src/hooks/useSupabaseSession.ts` — runs dev sign-in before reading session
- `web/src/App.tsx` — bypasses login gate in dev
- `web/src/features/EventCandidates.tsx` — loads data when session exists (auto or manual)

### iOS

The iOS app uses compile-time flags to detect development mode:

```swift
#if DEBUG
private let isDevelopmentMode = true
#else
private let isDevelopmentMode = false
#endif
```

**Files**:
- `ios/SSA-Admin/SSA-Admin/SSA_AdminApp.swift` — bypasses login screen in DEBUG builds
- `ios/SSA-Admin/Shared/Services/SupabaseService.swift` — returns nil session in development mode

**Behavior**:
- DEBUG builds: App shows ContentView directly without authentication
- RELEASE builds: App shows LoginView and requires magic link authentication

## Enabling authentication for production

### Web

1. Build for production: `npm run build`
2. Authentication is automatically enabled in production builds
3. Do **not** set `VITE_DEV_AUTH_*` in production env

### iOS

Build a Release configuration or set `isDevelopmentMode = false` in debug to test auth.

## Testing authentication (production flow)

### Web

1. `npm run build && npm run preview`
2. Magic link login is required

### iOS

1. Release build or `isDevelopmentMode = false` in debug

## Security

⚠️ **Important**:

- Never commit `web/.env.local` or production credentials
- Dev password is for local machines only
- RLS still applies; dev auto sign-in uses a real authenticated role, not a service-role bypass
- Verify production builds do not include dev auth env vars
