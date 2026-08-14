# Ariadne

A personal, local-only dashboard that aggregates work signals from GitHub
(PRs, review requests, mentions) and Azure DevOps (assigned work items,
comments, sprint iterations) into a single view, ranks them by urgency,
tracks sprint progress, and lets you pick what you're currently working on
and log time against it.

Single-user, runs on your machine only. GitHub and Azure DevOps access is
read-only — Ariadne never writes back to either system.

## Philosophy

Ariadne's job is to give you a clear, at-a-glance overview of your work and
the mental space to process it — not to manage your calendar or decide what
you should do next.

- **Personal, local-only, single-user.** No account, no cloud sync, no
  multi-tenant backend — just a SQLite file on your machine.
- **Read-only, always.** Ariadne never writes back to GitHub or Azure
  DevOps. Actions like Start/Complete, even when they cascade to linked
  items, only ever touch Ariadne's own local `items` table.
- **Transparent, not AI-driven.** Urgency is a deterministic, visible point
  formula (own PR approved, mentioned, stale, due soon, ...), not an opaque
  ML ranking — the whole scoring table lives in `lib/scoring.ts`, readable
  end to end.
- **You control your time, not the algorithm.** There's no auto-scheduling
  of your day and no calendar it rearranges for you. Ariadne surfaces
  signals; you decide what to work on and when.
- **Deliberately small surface.** One dashboard route plus Settings. New
  features are scoped tightly, and real tradeoffs are accepted explicitly
  rather than hidden — e.g. access tokens are stored in plaintext locally,
  the same trust model as a `.env` file.

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
