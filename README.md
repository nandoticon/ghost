# Ghost

A minimal, personal task management app with a premium dark UI.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Drag & Drop:** @hello-pangea/dnd
- **Icons:** Lucide React
- **Deployment:** Vercel

## Features

- **Today View** — Focus on what matters today with drag-and-drop ordering
- **Tasks** — Full task list with 6-dimension filtering (status, location, energy, focus, project, date)
- **Projects** — Organize tasks into color-coded projects with progress tracking
- **Task Detail** — Inline editing, subtasks, notes, comments, recurrence
- **Quick Capture** — Press `N` anywhere to quickly add a task
- **Search** — Real-time search with keyboard navigation
- **Themes** — Multiple dark themes
- **PWA** — Installable progressive web app with offline support
- **Export/Import** — Full JSON export and CSV task export

## Setup

```bash
npm install
cp .env.example .env   # Fill in your Supabase credentials
npm run dev
```

For this project, set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred) or `VITE_SUPABASE_ANON_KEY`

## Deploy to Vercel

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (recommended)
   - Optional fallback: `VITE_SUPABASE_ANON_KEY`
4. Do **not** add database password, service-role key, or account login password to frontend env vars.
4. Deploy — SPA routing handled by `vercel.json`
