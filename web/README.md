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

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Notes

- RLS policies must be created in your Supabase project as provided earlier.
- This application includes management screens for Wineries, Events, Routes, and Locations.

