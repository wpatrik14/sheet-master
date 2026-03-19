# AGENTS.md

Repository guidance for Kilo Code agents working in this project.

## Project overview
- This is a Next.js 15 application for managing sheet music and setlists.
- The UI is built with TypeScript, React, Tailwind CSS, and shadcn/ui-style components in [`components/ui`](components/ui/card.tsx).
- Persistent data is stored in a local SQLite database via [`lib/db.ts`](lib/db.ts:1) using `better-sqlite3`.
- Uploaded sheet files are stored under [`public/sheets`](server.js:21) and served through a custom [`server.js`](server.js:1) wrapper.

## Common scripts
- [`npm run dev`](package.json:5) starts the Next.js development server.
- [`npm run build`](package.json:6) builds the app for production.
- [`npm run start`](package.json:7) runs [`server.js`](server.js:1), which starts Next.js and serves files from `public/sheets`.
- [`npm run lint`](package.json:8) runs the project lint command.

## Codebase structure
- App router pages live in [`app`](app/page.tsx:1).
- API routes are under [`app/api`](app/api/sheets/route.ts:1) and [`app/api/setlists`](app/api/setlists/route.ts:1).
- Shared UI primitives live in [`components/ui`](components/ui/card.tsx:1).
- Project utilities and services live in [`lib`](lib/db.ts:1) and [`hooks`](hooks/use-toast.ts:1).

## Data model
- SQLite tables are initialized in [`lib/db.ts`](lib/db.ts:15): `sheets`, `setlists`, and `setlist_sheets`.
- Sheet uploads store metadata plus a file path such as `/sheets/<uuid>.<ext>` in the database.
- Setlists use a many-to-many relationship with ordered sheet positions in `setlist_sheets`.

## Important implementation details
- File uploads are accepted by [`app/api/sheets/route.ts`](app/api/sheets/route.ts:66) only as PDF, PNG, JPG, or JPEG files.
- Upload size is limited to 10 MB in [`app/api/sheets/route.ts`](app/api/sheets/route.ts:140).
- Deleting a sheet removes both the database row and the physical file in [`app/api/sheets/[id]/route.ts`](app/api/sheets/[id]/route.ts:53).
- Setlist operations support create, read, update, append sheet, and delete flows in [`app/api/setlists/[id]/route.ts`](app/api/setlists/[id]/route.ts:21).

## Agent working rules
- Prefer small, focused changes that match the existing architecture.
- Keep TypeScript types aligned with the SQLite schema and API responses.
- Preserve the local-file storage approach unless the task explicitly asks for a storage change.
- When editing API logic, verify related file cleanup, ordering, and cascade behavior.
- When editing UI, reuse existing components in [`components/ui`](components/ui/card.tsx:1) and keep styling consistent with Tailwind conventions.
- Avoid introducing new dependencies unless they are clearly required.
- Do not rename routes, table names, or file storage paths without updating all references.

## Areas to review carefully before changing
- [`server.js`](server.js:1) for custom static file serving.
- [`lib/db.ts`](lib/db.ts:1) for schema initialization and database access.
- [`app/api/sheets/route.ts`](app/api/sheets/route.ts:1) and [`app/api/sheets/[id]/route.ts`](app/api/sheets/[id]/route.ts:1) for upload and deletion behavior.
- [`app/api/setlists/route.ts`](app/api/setlists/route.ts:1) and [`app/api/setlists/[id]/route.ts`](app/api/setlists/[id]/route.ts:1) for setlist CRUD and ordering logic.

## Notes for future agents
- The repository is synced from v0.dev, so some generated patterns may be present.
- Existing user-facing strings are partly Hungarian; keep language consistent with the surrounding feature unless a task requests localization changes.
- If a change touches file uploads or deletions, test both the browser-facing path and the database state.
