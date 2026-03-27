# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Next.js 15 (App Router) application called "Kottakezelő" — a Hungarian sheet music manager for uploading, organizing, and managing sheet music files with setlist functionality. Uses TypeScript, Tailwind CSS, shadcn/ui components, SQLite (better-sqlite3), and a custom Node.js server.

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production start via custom server.js (also serves /public/sheets)
npm run lint     # ESLint
```

No test suite is configured.

## Architecture

### Custom Server (`server.js`)
Wraps the Next.js request handler to also serve uploaded files from `public/sheets/` with correct MIME types. This is required in production — `npm run start` must be used (not `next start`).

### Database (`lib/db.ts`)
SQLite file at `data/sheetmusic.db`. Three tables initialized on startup:
- `sheets` — metadata + file path (`/sheets/<uuid>.<ext>`)
- `setlists` — named lists
- `setlist_sheets` — ordered many-to-many junction (CASCADE deletes on both FKs)

### API Routes (`app/api/`)
- `sheets/route.ts` — GET all, POST upload (PDF/PNG/JPG/JPEG, max 10 MB, multipart/form-data)
- `sheets/[id]/route.ts` — DELETE removes DB row + physical file
- `setlists/route.ts` — GET all (with sheet counts), POST create
- `setlists/[id]/route.ts` — PUT rename, DELETE, POST to append a sheet
- `setlists/[id]/sheets/route.ts` — sheet ordering within a setlist

### Pages (`app/`)
- `/sheets` — browse and manage sheets
- `/upload` — file upload
- `/setlists` — create and manage setlists
- `/perform/[id]` — full-screen performance view for a setlist

### Components
- `components/ui/` — shadcn/ui primitives (do not modify generated components without a clear reason)
- `components/pdf-viewer.tsx` / `components/image-viewer.tsx` — sheet display
- `components/navbar.tsx` — top navigation

## Key Implementation Details

- **Webpack config** (`next.config.mjs`): `better-sqlite3` is externalized (not bundled by webpack); canvas is aliased to false for PDF.js compatibility. TypeScript and ESLint errors are ignored during build.
- **File uploads**: validated by content type (must be `multipart/form-data`) and MIME type; stored with UUID filenames under `public/sheets/`.
- **Deleting a sheet** removes both the DB row and the file on disk — always verify both sides when touching deletion logic.
- **Setlist ordering** uses a `position` column in `setlist_sheets`; maintain ordering integrity when inserting or removing rows.
- **UI language**: existing user-facing strings are partially Hungarian — match the surrounding language unless a task explicitly asks otherwise.
- **v0.dev origin**: some generated patterns may be present in components; keep changes minimal and consistent with existing style.
- When modifying API logic, verify cascade behavior, file cleanup, and ordering remain intact.
- Reuse existing `components/ui` primitives; avoid adding new dependencies unless clearly required.
- Keep TypeScript types aligned with the SQLite schema and API response shapes.
