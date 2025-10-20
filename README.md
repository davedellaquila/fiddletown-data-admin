# SSA Admin (Supabase + React + Vite)

Minimal local admin for managing `wineries` in your Supabase DB.

## Quick Start
1) Download and unzip this folder.
2) Create `.env.local` in the project root with:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
3) Install + run:
   ```bash
   npm install
   npm run dev
   ```
4) Open http://localhost:5173 and sign in via magic link.

## Notes
- RLS policies must be created in your Supabase project as provided earlier.
- This MVP only includes the Wineries screen; Events/Routes can be added similarly.
