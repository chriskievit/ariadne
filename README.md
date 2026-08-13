# Ariadne

A personal, local-only dashboard that aggregates work signals from GitHub
(PRs, review requests, mentions) and Azure DevOps (assigned work items,
comments, sprint iterations) into a single view, ranks them by urgency,
tracks sprint progress, and lets you pick what you're currently working on
and log time against it.

Single-user, runs on your machine only. GitHub and Azure DevOps access is
read-only — Ariadne never writes back to either system.

## Stack

- Next.js (App Router, TypeScript) — one app for frontend and API routes
- React + Tailwind CSS + shadcn/ui components
- SQLite (`better-sqlite3`) for local storage, no separate database server
- Vitest for tests

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3000`. On first run, open **Settings** to
add your GitHub and Azure DevOps personal access tokens (read-only scopes) —
these are stored locally in the SQLite `settings` table, not in environment
variables.

Data refresh is manual: use the **Refresh** button on the dashboard to pull
the latest PRs, work items, and sprint status.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm test` | Run the test suite (Vitest) |

## Data

All data lives in a local SQLite file (`ariadne.db` by default,
configurable via `ARIADNE_DB_PATH`). Ad-hoc requests (face-to-face,
email, Teams) can be added directly from the dashboard alongside synced
GitHub/ADO items.
