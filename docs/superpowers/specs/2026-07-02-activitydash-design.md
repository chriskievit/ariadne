# ActivityDash — Design Spec

Date: 2026-07-02

## Problem

During the workday, work-relevant signals arrive across several disconnected
systems: GitHub (PRs, review requests, mentions), Azure DevOps (assigned work
items, comments, sprint iterations), and unstructured channels (face-to-face
conversations, email, Teams). There is no single place to see, at a glance,
what needs attention right now, how the current sprint is going, and to track
what's actively being worked on.

ActivityDash is a personal, local-only dashboard that aggregates these
sources, ranks items by urgency, tracks sprint progress, and lets the user
pick a "currently working on" item and log time against it.

## Scope (v1)

- Single user, runs locally only. No multi-user auth.
- Read-only access to GitHub and Azure DevOps — ActivityDash never writes
  back to either system.
- Data refresh is manual (a "Refresh" button), not a background job.
- Ad-hoc (face-to-face/email/Teams) requests are captured via a quick-add
  form inside the dashboard.

## Architecture & Tech Stack

Single full-stack **Next.js (App Router, TypeScript)** app, run locally via
`npm run dev` and used at `localhost`.

- **Frontend:** React (Next.js pages/components), Tailwind CSS. One primary
  dashboard route, plus a `/settings` route.
- **Backend:** Next.js API routes handle (a) the manual sync trigger that
  calls the GitHub and Azure DevOps REST APIs, and (b) CRUD for ad-hoc items,
  current-task selection, completion, and time logging.
- **Storage:** SQLite via `better-sqlite3`, a single `activitydash.db` file
  in the project directory. No separate database server.
- **Auth:** None at the app level (localhost-only, single user). GitHub and
  Azure DevOps PATs are configured via the in-app Settings page and stored in
  the local SQLite `settings` table (read-only API scopes only).

Rejected alternatives: Express + plain frontend (more manual wiring, no
material benefit since the backend surface is small); Python/FastAPI (a
fine alternative, but Next.js keeps UI, API, and types in one TypeScript
codebase, which matters more here since the bulk of the work is the
dashboard UI, not the backend).

## Data Model (SQLite)

**`items`** — unified table for everything shown on the dashboard, regardless
of source:

| column | notes |
|---|---|
| `id` | primary key |
| `source` | `github_pr` \| `ado_workitem` \| `adhoc` |
| `external_id` | nullable; GitHub/ADO id for upsert matching |
| `title` | |
| `url` | nullable |
| `reason` | `mention` \| `review_requested` \| `assigned` \| `authored` \| `manual` \| `stale_own_pr` \| `approved_unmerged` |
| `category` | nullable; user-editable (e.g. bug/feature/review/meeting/ad-hoc) |
| `due_date` | nullable |
| `sprint_iteration` | nullable |
| `raw_updated_at` | last-activity timestamp from the source system |
| `status` | `inbox` \| `in_progress` \| `done` |
| `created_at` | |
| `completed_at` | nullable |

**`time_logs`** — separate from `items` so an item can be worked on across
multiple sessions, and so time data is queryable independently for future
time-analysis dashboards (by category, by source, by day/week):

| column | notes |
|---|---|
| `id` | primary key |
| `item_id` | FK → `items.id` |
| `started_at` | |
| `ended_at` | nullable |
| `duration_minutes` | |
| `note` | nullable |

**`sync_log`** — `id, source, ran_at, item_count, error (nullable)`. Powers
the "last synced" indicator and error banners.

**`settings`** — key-value table: `key, value, updated_at`. Holds the GitHub
PAT, Azure DevOps PAT + org/project, and the stale-PR threshold (days).

Note: PATs sit in plaintext in the local SQLite file — the same trust model
as a `.env` file, acceptable for local single-user use. Input fields are
masked (password-style) in the UI. No OS-keychain integration in v1.

**Upsert behavior:** on each sync, GitHub/ADO items are upserted by
`(source, external_id)`. Local-only fields (`status`, `category`,
`completed_at`) are preserved across re-syncs; all other fields are
overwritten from the API response.

## Data Sync (manual, read-only)

Triggered by the "Refresh" button, one API route runs both syncs
sequentially and records results in `sync_log`. Each source's sync is
independently try/caught — a GitHub failure does not block the ADO sync or
vice versa.

**GitHub** (using the configured PAT):
- Open PRs where the user is a requested reviewer → `reason = review_requested`
- Open PRs authored by the user → `reason = authored` (baseline; refined by
  the two rules below when they apply)
- PRs authored by the user with **zero reviews and no activity in >N days**
  (N = stale threshold from Settings, default 3) → `reason = stale_own_pr`
- PRs authored by the user that are **approved but not yet merged** →
  `reason = approved_unmerged`
- Recent issue/PR comments mentioning the user (GitHub search,
  `mentions:@me`) → `reason = mention`

**Azure DevOps** (using the configured PAT + org/project):
- Work items assigned to the user in the current iteration (via WIQL) →
  `reason = assigned`
- Work item comments mentioning the user → `reason = mention`
- Current iteration's name and start/end dates, used for sprint progress

## Urgency Scoring

Computed at read-time (not stored), so tuning the formula doesn't require
re-syncing:

| signal | points |
|---|---|
| Own PR approved, not yet merged | +45 |
| Directly mentioned, or review requested | +40 |
| Own PR stale with no reviews (>N days) | +30 |
| Due date / sprint end within 2 days (scales down further out) | +25 |
| Item untouched >5 days (`raw_updated_at` age) | +15 |
| Baseline (ADO item assigned to you, or your own PR with no other signal, or ad-hoc item with no due date) | +10 |

Items with `status = in_progress` always sort to the top of their bucket
regardless of score, since the user has already committed to them.

## UI Layout

Single dashboard page:

1. **Header bar** — sprint progress widget (iteration name, days remaining,
   completion blending ADO work items done + GitHub PRs merged + ad-hoc items
   completed within the iteration window), "Last synced: X min ago",
   **Refresh** button, **Settings** link.
2. **Needs attention** — items scoring above a threshold (e.g. 25). Each row:
   source icon, title (links out to GitHub/ADO), a badge explaining the
   reason ("Ready to merge," "Mentioned you," "Stale — no reviews," "Due
   tomorrow"), and actions **Start** / **Mark complete**.
3. **In progress** — items the user has clicked **Start** on. **Mark
   complete** prompts for optional time (defaults to elapsed time since
   Start, editable, or a manually typed duration) and writes a `time_logs`
   row, setting `status = done`.
4. **Everything else** — collapsed by default; same row format, for
   lower-scored items.
5. **Quick-add** — persistent control to log an ad-hoc item (title, category,
   optional due date).

**Settings page** (`/settings`): GitHub PAT, Azure DevOps PAT + org/project,
stale-PR threshold — masked inputs, stored in `settings`.

## Error Handling

- Sync failures per source are caught, logged to `sync_log`, and surfaced as
  a dismissible banner rather than blocking the rest of the dashboard.
- Missing PAT configuration shows an empty state pointing to Settings
  instead of erroring.

## Testing

- Urgency scoring is a pure function (`item, now → score`) — unit tested
  with Vitest across each signal and combinations.
- GitHub/ADO API calls are isolated behind small client modules, mocked in
  tests for sync logic (upsert behavior, stale/approved detection).
- UI is manually verified — a small personal tool, not worth heavy
  component-test investment in v1.

## Out of scope (v1)

- Multi-user support / authentication
- Background/scheduled sync
- Writing back to GitHub or Azure DevOps (closing PRs/work items)
- Browser extension or global hotkey for ad-hoc capture
- OS-keychain-backed credential storage
