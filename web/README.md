# SSA Admin Web Application

React + Vite web application for managing SSA data.

## Quick Start

1) Create `.env.local` in the `web/` directory with:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

2) Install dependencies:
   ```bash
   cd web
   npm install
   ```

3) Run the development server:
   ```bash
   npm run dev
   ```

4) Open http://localhost:5173 and sign in via magic link.

## Production (Vercel)

The admin app is deployed on Vercel (not GitHub Pages).

| | |
|---|---|
| **URL** | https://ssa-admin-puce.vercel.app |
| **Project** | `ssa-admin` (linked via `web/.vercel/project.json`, gitignored) |
| **Root directory** | `web/` |
| **Build** | `npm run build` → `dist/` |

### Environment variables (Vercel dashboard)

Set for **Production** and **Preview**:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Do **not** set `VITE_DEV_AUTH_*` on Vercel — production requires magic link auth.

### Supabase Auth redirects

Add these to Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**:

- `https://ssa-admin-puce.vercel.app`
- `https://ssa-admin-*.vercel.app` (preview deployments)

### Deploy commands

Deploy from the **repository root** (project `rootDirectory` is `web`):

```bash
# From repo root — matches Git integration settings
VERCEL_ORG_ID=team_gVHLPggyEPW7IG46EqMBCeRl VERCEL_PROJECT_ID=prj_EXNK7wWJbgHeD8lVxm22QTSQqBuc npx vercel --prod --yes

# Or link once from web/, then use Git push to main for auto-deploy
```

```bash
cd web
npx vercel          # preview (only if rootDirectory is `.`; use repo-root command above when rootDirectory is `web`)
npx vercel --prod   # production
```

**Git integration:** Connected to `davedellaquila/fiddletown-data-admin`, production branch `main`, root directory `web`.

**Note:** Pushing `web/**` to `main` still runs GitHub Pages for the **public events widget** (`docs/EVENTS_PUBLISHING.md`). Vercel and GitHub Pages are separate deploy paths.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Notes

- RLS policies must be created in your Supabase project as provided earlier.
- This application includes management screens for Wineries, Events, Routes, and Locations.

## Public events widget (Squarespace)

The Sports Car Adventures events calendar is **not** pasted inline into Squarespace. Production loads `event-list.js` from GitHub Pages; Squarespace only provides a mount div and `SSWidgets.renderEvents(...)`.

- **Source:** `code-snippets/events/event-list.js` (sync to `public/code-snippets/events/event-list.js` before deploy)
- **Publishing:** [docs/EVENTS_PUBLISHING.md](../docs/EVENTS_PUBLISHING.md)
- **Local preview:** open `code-snippets/events/event-list-dev.html`

