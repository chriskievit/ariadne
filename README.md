<p align="center">
  <img src="public/brand/ariadne-banner.png" width="440" alt="Ariadne">
</p>

<p align="center"><em>The anti-autopilot: a transparent, read-only thread through your GitHub,<br>Azure DevOps, and ad-hoc work signals, not an algorithm that runs your day.</em></p>

A personal, local-only dashboard that pulls GitHub (PRs, review requests,
mentions), Azure DevOps (assigned work items, comments, sprint iterations),
and ad-hoc requests (face-to-face, email, Teams) into one ranked view,
tracks sprint progress, and lets you pick what you're working on and log
time against it. No other personal tool combines all three.

Single-user, runs on your machine only. GitHub and Azure DevOps access is
read-only, Ariadne never writes back to either system.

![Ariadne dashboard showing Today, In progress, and Signals grouped by GitHub, Azure DevOps, and ad-hoc](docs/screenshot-dashboard.png)

## Philosophy

Ariadne's job is to give you a clear, at-a-glance overview of your work and
the mental space to process it, not to manage your calendar or decide what
you should do next.

- **Personal, local-only, single-user.** No account, no cloud sync, no
  multi-tenant backend, just a SQLite file on your machine.
- **Read-only, always.** Ariadne never writes back to GitHub or Azure
  DevOps. Actions like Start/Complete, even when they cascade to linked
  items, only ever touch Ariadne's own local `items` table.
- **Transparent, not AI-driven.** Urgency is a deterministic, visible point
  formula (own PR approved, mentioned, stale, due soon, ...), not an opaque
  ML ranking. The whole scoring table lives in `lib/scoring.ts`, readable
  end to end, and every score chip on the dashboard opens to show exactly
  which rules fired and which didn't.
- **You control your time, not the algorithm.** There's no auto-scheduling
  of your day and no calendar it rearranges for you. Ariadne surfaces
  signals; you decide what to work on and when.
- **Deliberately small surface.** A dashboard route, a time report, and
  Settings. New features are scoped tightly, and real tradeoffs are
  accepted explicitly rather than hidden. For example, access tokens are
  stored in plaintext locally, the same trust model as a `.env` file.

## Stack

- Next.js (App Router, TypeScript), one app for frontend and API routes
- React + Tailwind CSS + shadcn/ui components
- SQLite (`better-sqlite3`) for local storage, no separate database server
- Vitest for tests

## Getting started

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3000`. On first run, open **Settings** to
add your GitHub and Azure DevOps personal access tokens (read-only scopes).
These are stored locally in the SQLite `settings` table, not in environment
variables.

![Ariadne's first-run empty state, prompting to add tokens in Settings or add an ad-hoc request instead](docs/screenshot-empty-state.png)

Ariadne syncs automatically every 5 minutes while the dashboard is open, and
you can also click the **Refresh** button to pull the latest PRs, work
items, and sprint status on demand.

## Self-hosting with Docker

```bash
docker compose up
```

This builds the image and starts Ariadne at `http://127.0.0.1:3000`. The
SQLite database lives at `./data/ariadne.db` on the host (via a bind mount),
so it persists across container restarts and rebuilds.

By default the port is only published on the host's loopback interface
(`127.0.0.1`), matching Ariadne's local-only philosophy. If you want to
reach it from other devices on your network, change the port mapping in
`docker-compose.yml` from `"127.0.0.1:3000:3000"` to `"3000:3000"`.

Ariadne has no login of its own — anyone who can reach the port has full
access, including to your GitHub/Azure DevOps tokens. **Before exposing it
beyond loopback**, set an `ARIADNE_AUTH_TOKEN` environment variable; every
request then needs it as a Basic Auth password (any username works):

```bash
docker run -d -p 3000:3000 -v $(pwd)/data:/data \
  -e ARIADNE_DB_PATH=/data/ariadne.db \
  -e ARIADNE_AUTH_TOKEN=<a long random value> ariadne
```

Without compose:

```bash
docker build -t ariadne .
docker run -d -p 127.0.0.1:3000:3000 -v $(pwd)/data:/data \
  -e ARIADNE_DB_PATH=/data/ariadne.db ariadne
```

## Controlling Ariadne from an assistant

Ariadne ships an [MCP](https://modelcontextprotocol.io) server, so an
assistant that speaks MCP can read your dashboard and move items through it.
Useful when the work happens somewhere other than the dashboard: you finish
something in a terminal and say so, instead of switching windows to click
Complete.

It talks to your running Ariadne over `http://127.0.0.1:3000`, so start the
app first. Transport is stdio, which means no extra port and no extra
listener: your client spawns the server and it exits with the session.

### Setup

Build it once, then register it. The build is part of `npm run build`, so if
you have already built the app you can skip the first line.

```bash
npm run mcp:build
claude mcp add --scope user ariadne -- node "$(pwd)/mcp/dist/index.js"
```

For Claude Desktop, add the same command to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ariadne": {
      "command": "node",
      "args": ["/absolute/path/to/ariadne/mcp/dist/index.js"]
    }
  }
}
```

Two optional environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `ARIADNE_URL` | `http://127.0.0.1:3000` | Where Ariadne is listening |
| `ARIADNE_AUTH_TOKEN` | unset | Same value as the app's, if you have exposed Ariadne beyond loopback |

### What it can do

35 tools, each mapping to exactly one thing Ariadne already does:

- **Look around.** List items, today's summary, a day's plan, the running
  timer, sprint progress, sync status, the time report, estimate calibration.
- **Move work.** Start, complete, stop the timer, requeue, undo a completion,
  park, unpark, snooze, unsnooze, star, mark triaged, add to or remove from a
  day.
- **Plan.** Set a day's capacity, add and remove plan items, reorder them, set
  estimates.
- **Housekeeping.** Create an ad-hoc item, delete an item, sync, manage saved
  views.

Completing an item needs the hours it took, and the server will not invent
them, so expect to be asked.

### What it deliberately cannot do

- **Write to GitHub or Azure DevOps.** Same as the rest of Ariadne. Completing
  an item here does not close the pull request or work item it came from.
- **Change your settings.** Settings writes accept arbitrary values including
  your access tokens, so that route is not exposed. Reading settings works and
  returns them redacted.
- **Decide anything.** Every tool is one narrow verb. There is no "plan my
  day" or "close everything stale": the ranking stays yours to read and act
  on, which is the whole point of the project.

The full list with descriptions lives in `mcp/tools.ts`.

## Troubleshooting

### Sync suddenly stopped working

The dashboard shows a banner naming the source (GitHub or Azure DevOps),
what went wrong, and what to do about it. The underlying causes are usually
one of:

- **Expired or revoked token.** The token was deleted, expired, or the
  account it belongs to lost access. Generate a new one and paste it into
  **Settings**.
- **Missing scope.** The token is valid but lacks a permission Ariadne
  needs. For GitHub, a classic PAT needs the `repo` scope (or, for a
  fine-grained PAT, read access to **Pull requests** and **Metadata**); for
  Azure DevOps, the PAT needs **Work Items (Read)**. Re-generate the token
  with the right scope and update it in Settings — refreshing the page
  won't help here.
- **Rate limit.** GitHub and Azure DevOps both throttle API calls. This
  resolves on its own; wait a few minutes and click **Refresh**.

Until it's fixed, Ariadne keeps showing the last data it read from that
source, marked stale, rather than hiding it.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build, including the MCP server |
| `npm run mcp:build` | Build just the MCP server |
| `npm run start` | Run the production build |
| `npm test` | Run the test suite (Vitest) |

## Data

All data lives in a local SQLite file (`ariadne.db` by default,
configurable via `ARIADNE_DB_PATH`). Ad-hoc requests (face-to-face,
email, Teams) can be added directly from the dashboard alongside synced
GitHub/ADO items.
