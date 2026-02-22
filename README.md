# Ghost

Personal task and project management app built with React, TypeScript, and Supabase.

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend: Supabase (Postgres, Auth, Realtime)
- Routing: React Router
- Drag and Drop: `@hello-pangea/dnd`
- PWA: `vite-plugin-pwa`
- Deployment: Vercel

## Current App Areas

- `Today` - Focused daily task view with ordering and quick actions
- `Tasks` - List/Kanban task management with filters, grouping, and batch actions
- `Projects` - Grid/List project views, category grouping, pinning, progress tracking, archive support
- `Project Detail` - Project-specific task view and management
- `Analytics` - Productivity/task insights
- `Settings` - App preferences and data utilities
- `Keyboard Shortcuts` - Global shortcuts modal (`?`) with navigation and page actions

## Key Features

- Task statuses (`todo`, `doing`, `waiting`, `done`)
- Task recurrence support
- Quick Capture (`N` or `Cmd/Ctrl+K`)
- Search and filtering across tasks/projects
- Project categories and uncategorized grouping
- Theme support
- Toast notifications
- Installable PWA build

## Local Development

### Requirements

- Node.js 18+ (recommended: current LTS)
- npm
- Supabase project (URL + publishable key)

### Setup

```bash
npm install
cp .env.example .env
```

Populate `.env` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- Optional fallback for older setups: `VITE_SUPABASE_ANON_KEY`

### Run

```bash
npm run dev
```

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run lint` - Run ESLint
- `npm run typecheck` - TypeScript type-check (`tsc -b --noEmit`)
- `npm run build` - Production build (`tsc -b && vite build`)
- `npm run preview` - Preview production build locally
- `npm run ci` - Lint + typecheck + build

## Build/Deploy Notes

- SPA routing is handled by `vercel.json`
- Frontend env vars should only include public Supabase client values
- Do not expose service-role keys or database passwords in frontend env vars

## Status

Verified against the current codebase routes and scripts on February 22, 2026.
