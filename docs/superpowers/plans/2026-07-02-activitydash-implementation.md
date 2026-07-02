# ActivityDash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ActivityDash v1 — a local-only Next.js dashboard that aggregates GitHub PRs, Azure DevOps work items, and ad-hoc items into a single ranked "needs attention" view, tracks sprint progress, and lets the user start/complete items with time logging.

**Architecture:** Single full-stack Next.js (App Router, TypeScript) app. SQLite (via `better-sqlite3`) is the only datastore, accessed through small repository modules (`items-repo`, `time-logs-repo`, `settings-repo`). GitHub/Azure DevOps access is read-only, isolated behind `github-client.ts` / `ado-client.ts`, and only invoked by a manual-refresh sync orchestrator (`sync.ts`). Urgency scoring is a pure function computed at read time. The UI is one dashboard page (Server Component fetches initial data, a Client Component owns interactive state) plus a `/settings` page.

**Tech Stack:** Next.js 14 (App Router) + TypeScript (strict), Tailwind CSS, Lucide icons, `better-sqlite3`, Vitest for unit tests.

## Global Constraints

- Read-only access to GitHub and Azure DevOps only — never write back to either system (spec: Scope).
- Data refresh is manual (a Refresh button) — no background/scheduled sync (spec: Scope).
- Single user, localhost only — no auth layer (spec: Architecture & Tech Stack).
- PATs are stored in the SQLite `settings` table, masked in the UI, plaintext at rest — acceptable for local single-user use (spec: Data Model).
- Upserts on `(source, external_id)` preserve `status`, `category`, `completed_at` across re-sync; all other fields are overwritten (spec: Data Model).
- Each source's sync is independently try/caught — a GitHub failure must not block the Azure DevOps sync or vice versa (spec: Data Sync).
- Urgency score signals: `approved_unmerged` +45, `mention`/`review_requested` +40, `stale_own_pr` +30, due date/sprint end within 2 days +25, untouched >5 days +15, baseline (`assigned`/`authored`/`manual`) +10. `in_progress` items always sort above their bucket regardless of score (spec: Urgency Scoring).
- Default stale-PR threshold is 3 days, configurable in Settings (spec: Data Sync).
- "Needs attention" grouping threshold is a score of 25 (spec: UI Layout).
- No confirmation dialog on "Mark complete" — use an undo toast instead (spec: UI Layout, UX review).
- Empty sections show a specific message ("You're all caught up", "Nothing in progress — start something above") rather than blank space (spec: UI Layout, UX review).
- Refresh button shows a loading/disabled state while syncing (spec: UI Layout, UX review).
- One icon set (Lucide) throughout, no emoji as structural icons (UX review).
- UI is built on **shadcn/ui** (Radix primitives + Tailwind, generated via the shadcn CLI) rather than hand-rolled components — gets accessible focus/keyboard handling, consistent theming via CSS variables, and a real Toast (Sonner) for free (per user direction + ui-ux-pro-max shadcn stack guidance).
- Visual direction: Inter font, dark-mode-first ("premium developer tool" aesthetic — deep neutral surfaces, hairline borders, a single indigo accent color), with light mode still fully supported via a manual toggle — not the default, per ui-ux-pro-max's dark-mode-first guidance for developer tools (UX review, `--design-system` query).
- Sprint completion is always shown as text/number (e.g. "7/12 done"), never by fill color alone (UX review).

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `app/page.tsx`
- Test: `lib/sanity.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm test` commands; `@/*` path alias resolving to the project root; Tailwind with `darkMode: 'media'`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "activitydash",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "better-sqlite3": "^11.0.0",
    "lucide-react": "^0.400.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/better-sqlite3": "^7.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`**

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

`tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

`postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
.next
*.db
*.db-journal
*.db-wal
*.db-shm
.env*.local
```

- [ ] **Step 7: Create the app shell placeholder**

`app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ActivityDash',
  description: 'Personal attention-triage dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
```

`app/page.tsx` (placeholder, replaced in Task 16):
```tsx
export default function Page() {
  return <main className="p-6">ActivityDash — coming together.</main>;
}
```

- [ ] **Step 8: Write a sanity test to confirm Vitest is wired up**

`lib/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Run the test suite**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 10: Verify the app builds and runs**

Run: `npm run build`
Expected: build succeeds.
Run: `npm run dev`, open `http://localhost:3000`
Expected: page shows "ActivityDash — coming together."

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js + TypeScript + Tailwind + Vitest project"
```

---

## Task 2: Database Schema, Types & Connection

**Files:**
- Create: `lib/types.ts`
- Create: `lib/db.ts`
- Create: `lib/db-instance.ts`
- Test: `lib/db.test.ts`

**Interfaces:**
- Produces: `openDb(path: string): Database.Database`; types `Source`, `Reason`, `Status`, `Item`, `NewSyncedItemInput`, `NewAdhocItemInput`, `TimeLog`; singleton `db` from `lib/db-instance.ts`.

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export type Source = 'github_pr' | 'ado_workitem' | 'adhoc';
export type Reason =
  | 'mention'
  | 'review_requested'
  | 'assigned'
  | 'authored'
  | 'manual'
  | 'stale_own_pr'
  | 'approved_unmerged';
export type Status = 'inbox' | 'in_progress' | 'done';

export interface Item {
  id: number;
  source: Source;
  externalId: string | null;
  title: string;
  url: string | null;
  reason: Reason;
  category: string | null;
  dueDate: string | null;
  sprintIteration: string | null;
  rawUpdatedAt: string | null;
  status: Status;
  createdAt: string;
  completedAt: string | null;
}

export interface NewSyncedItemInput {
  source: 'github_pr' | 'ado_workitem';
  externalId: string;
  title: string;
  url: string | null;
  reason: Reason;
  dueDate: string | null;
  sprintIteration: string | null;
  rawUpdatedAt: string | null;
}

export interface NewAdhocItemInput {
  title: string;
  category?: string | null;
  dueDate?: string | null;
}

export interface TimeLog {
  id: number;
  itemId: number;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  note: string | null;
}
```

- [ ] **Step 2: Write the failing test for `openDb`**

`lib/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { openDb } from './db';

describe('openDb', () => {
  it('creates all required tables', () => {
    const db = openDb(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(['items', 'settings', 'sync_log', 'time_logs']);
    db.close();
  });
});
```

The `sqlite_%` filter excludes `sqlite_sequence`, which SQLite creates automatically alongside any `AUTOINCREMENT` column — without it this assertion would fail against the real schema below.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/db.test.ts`
Expected: FAIL — `./db` has no exported member `openDb` (module doesn't exist yet).

- [ ] **Step 4: Implement `lib/db.ts`**

```ts
import Database from 'better-sqlite3';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('github_pr','ado_workitem','adhoc')),
  external_id TEXT,
  title TEXT NOT NULL,
  url TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('mention','review_requested','assigned','authored','manual','stale_own_pr','approved_unmerged')),
  category TEXT,
  due_date TEXT,
  sprint_iteration TEXT,
  raw_updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox','in_progress','done')),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(source, external_id)
);

CREATE TABLE IF NOT EXISTS time_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  error TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);
`;

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA_SQL);
  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- lib/db.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the singleton connection module**

`lib/db-instance.ts`:
```ts
import path from 'node:path';
import { openDb } from './db';

const dbPath = process.env.ACTIVITYDASH_DB_PATH ?? path.join(process.cwd(), 'activitydash.db');

export const db = openDb(dbPath);
```

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/db.ts lib/db-instance.ts lib/db.test.ts
git commit -m "Add SQLite schema, shared types, and connection singleton"
```

---

## Task 3: Items Repository

**Files:**
- Create: `lib/items-repo.ts`
- Test: `lib/items-repo.test.ts`

**Interfaces:**
- Consumes: `openDb` from `lib/db.ts`; `Item`, `NewSyncedItemInput`, `NewAdhocItemInput`, `Status` from `lib/types.ts`.
- Produces: `upsertSyncedItem(db, input: NewSyncedItemInput): Item`; `createAdhocItem(db, input: NewAdhocItemInput): Item`; `listItems(db): Item[]`; `getItemById(db, id: number): Item | undefined`; `setStatus(db, id: number, status: Status, completedAt?: string | null): void`.

- [ ] **Step 1: Write the failing tests**

`lib/items-repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem, listItems, getItemById, setStatus } from './items-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('upsertSyncedItem', () => {
  it('inserts a new synced item', () => {
    const item = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug',
      url: 'https://github.com/x/y/pull/1',
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(item.title).toBe('Fix bug');
    expect(item.status).toBe('inbox');
  });

  it('preserves local status and category on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    setStatus(db, first.id, 'in_progress');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug (renamed)',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(updated.id).toBe(first.id);
    expect(updated.title).toBe('Fix bug (renamed)');
    expect(updated.reason).toBe('approved_unmerged');
    expect(updated.status).toBe('in_progress');
  });

  it('preserves completed_at on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-2',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    setStatus(db, first.id, 'done', '2026-07-01T12:00:00.000Z');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-2',
      title: 'Fix bug',
      url: null,
      reason: 'mention',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(updated.status).toBe('done');
    expect(updated.completedAt).toBe('2026-07-01T12:00:00.000Z');
  });
});

describe('createAdhocItem', () => {
  it('creates an ad-hoc item with manual reason', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });
    expect(item.source).toBe('adhoc');
    expect(item.reason).toBe('manual');
    expect(item.status).toBe('inbox');
  });
});

describe('listItems / getItemById / setStatus', () => {
  it('lists and updates items', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'done', '2026-07-02T12:00:00.000Z');
    const updated = getItemById(db, item.id);
    expect(updated?.status).toBe('done');
    expect(updated?.completedAt).toBe('2026-07-02T12:00:00.000Z');
    expect(listItems(db)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/items-repo.test.ts`
Expected: FAIL — `./items-repo` module doesn't exist.

- [ ] **Step 3: Implement `lib/items-repo.ts`**

```ts
import type Database from 'better-sqlite3';
import type { Item, NewSyncedItemInput, NewAdhocItemInput, Status } from './types';

function rowToItem(row: any): Item {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    title: row.title,
    url: row.url,
    reason: row.reason,
    category: row.category,
    dueDate: row.due_date,
    sprintIteration: row.sprint_iteration,
    rawUpdatedAt: row.raw_updated_at,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function upsertSyncedItem(db: Database.Database, input: NewSyncedItemInput): Item {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO items (source, external_id, title, url, reason, due_date, sprint_iteration, raw_updated_at, status, created_at)
     VALUES (@source, @externalId, @title, @url, @reason, @dueDate, @sprintIteration, @rawUpdatedAt, 'inbox', @now)
     ON CONFLICT(source, external_id) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       reason = excluded.reason,
       due_date = excluded.due_date,
       sprint_iteration = excluded.sprint_iteration,
       raw_updated_at = excluded.raw_updated_at`
  ).run({ ...input, now });

  const row = db.prepare('SELECT * FROM items WHERE source = ? AND external_id = ?').get(input.source, input.externalId);
  return rowToItem(row);
}

export function createAdhocItem(db: Database.Database, input: NewAdhocItemInput): Item {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO items (source, external_id, title, url, reason, category, due_date, status, created_at)
       VALUES ('adhoc', NULL, @title, NULL, 'manual', @category, @dueDate, 'inbox', @now)`
    )
    .run({ title: input.title, category: input.category ?? null, dueDate: input.dueDate ?? null, now });
  return rowToItem(db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid));
}

export function listItems(db: Database.Database): Item[] {
  return db.prepare('SELECT * FROM items ORDER BY created_at DESC').all().map(rowToItem);
}

export function getItemById(db: Database.Database, id: number): Item | undefined {
  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  return row ? rowToItem(row) : undefined;
}

export function setStatus(db: Database.Database, id: number, status: Status, completedAt: string | null = null): void {
  db.prepare('UPDATE items SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/items-repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/items-repo.ts lib/items-repo.test.ts
git commit -m "Add items repository with upsert-preserves-local-state behavior"
```

---

## Task 4: Time Logs Repository

**Files:**
- Create: `lib/time-logs-repo.ts`
- Test: `lib/time-logs-repo.test.ts`

**Interfaces:**
- Consumes: `openDb` from `lib/db.ts`; `TimeLog` from `lib/types.ts`.
- Produces: `startTimer(db, itemId: number): TimeLog`; `completeTimer(db, itemId: number, options?: { durationMinutes?: number; note?: string }): TimeLog`; `undoLastCompletion(db, itemId: number): void`; `listLogsByItem(db, itemId: number): TimeLog[]`.

- [ ] **Step 1: Write the failing tests**

`lib/time-logs-repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { startTimer, completeTimer, undoLastCompletion, listLogsByItem } from './time-logs-repo';

let db: Database.Database;
let itemId: number;

beforeEach(() => {
  db = openDb(':memory:');
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO items (source, external_id, title, reason, status, created_at) VALUES ('adhoc', NULL, 'Test item', 'manual', 'inbox', ?)`
    )
    .run(now);
  itemId = Number(result.lastInsertRowid);
});

describe('startTimer / completeTimer', () => {
  it('starts an open log and closes it with a manual duration', () => {
    const started = startTimer(db, itemId);
    expect(started.endedAt).toBeNull();

    const completed = completeTimer(db, itemId, { durationMinutes: 45, note: 'Paired with Alex' });
    expect(completed.id).toBe(started.id);
    expect(completed.durationMinutes).toBe(45);
    expect(completed.note).toBe('Paired with Alex');
    expect(completed.endedAt).not.toBeNull();
  });

  it('computes duration from elapsed time when none is given', () => {
    const started = startTimer(db, itemId);
    db.prepare('UPDATE time_logs SET started_at = ? WHERE id = ?').run(
      new Date(Date.now() - 10 * 60_000).toISOString(),
      started.id
    );
    const completed = completeTimer(db, itemId);
    expect(completed.durationMinutes).toBeGreaterThanOrEqual(9);
    expect(completed.durationMinutes).toBeLessThanOrEqual(11);
  });

  it('throws when there is no open log to complete', () => {
    expect(() => completeTimer(db, itemId)).toThrow('No open time log for item');
  });
});

describe('undoLastCompletion', () => {
  it('removes the most recent log entry', () => {
    startTimer(db, itemId);
    completeTimer(db, itemId, { durationMinutes: 20 });
    undoLastCompletion(db, itemId);
    expect(listLogsByItem(db, itemId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/time-logs-repo.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/time-logs-repo.ts`**

```ts
import type Database from 'better-sqlite3';
import type { TimeLog } from './types';

function rowToLog(row: any): TimeLog {
  return {
    id: row.id,
    itemId: row.item_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes,
    note: row.note,
  };
}

export function startTimer(db: Database.Database, itemId: number): TimeLog {
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO time_logs (item_id, started_at) VALUES (?, ?)').run(itemId, now);
  return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(result.lastInsertRowid));
}

export function completeTimer(
  db: Database.Database,
  itemId: number,
  options: { durationMinutes?: number; note?: string } = {}
): TimeLog {
  const openLog = db
    .prepare('SELECT * FROM time_logs WHERE item_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(itemId) as any;
  if (!openLog) {
    throw new Error(`No open time log for item ${itemId}`);
  }
  const now = new Date().toISOString();
  const duration =
    options.durationMinutes ??
    Math.round((new Date(now).getTime() - new Date(openLog.started_at).getTime()) / 60_000);

  db.prepare('UPDATE time_logs SET ended_at = ?, duration_minutes = ?, note = ? WHERE id = ?').run(
    now,
    duration,
    options.note ?? null,
    openLog.id
  );
  return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(openLog.id));
}

export function undoLastCompletion(db: Database.Database, itemId: number): void {
  const lastLog = db.prepare('SELECT * FROM time_logs WHERE item_id = ? ORDER BY id DESC LIMIT 1').get(itemId) as any;
  if (lastLog) {
    db.prepare('DELETE FROM time_logs WHERE id = ?').run(lastLog.id);
  }
}

export function listLogsByItem(db: Database.Database, itemId: number): TimeLog[] {
  return db.prepare('SELECT * FROM time_logs WHERE item_id = ? ORDER BY started_at').all(itemId).map(rowToLog);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/time-logs-repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/time-logs-repo.ts lib/time-logs-repo.test.ts
git commit -m "Add time logs repository for start/complete/undo tracking"
```

---

## Task 5: Settings Repository & Config Constants

**Files:**
- Create: `lib/settings-repo.ts`
- Create: `lib/config.ts`
- Test: `lib/settings-repo.test.ts`

**Interfaces:**
- Consumes: `openDb` from `lib/db.ts`.
- Produces: `getSetting(db, key: string): string | null`; `setSetting(db, key: string, value: string): void`; `getAllSettings(db): Record<string, string>`; `SETTINGS_KEYS` object; `DEFAULT_STALE_DAYS = 3`; `NEEDS_ATTENTION_THRESHOLD = 25`.

- [ ] **Step 1: Write the failing tests**

`lib/settings-repo.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { getSetting, setSetting, getAllSettings } from './settings-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('settings-repo', () => {
  it('returns null for an unset key', () => {
    expect(getSetting(db, 'github.pat')).toBeNull();
  });

  it('sets and reads a value back', () => {
    setSetting(db, 'github.pat', 'abc123');
    expect(getSetting(db, 'github.pat')).toBe('abc123');
  });

  it('overwrites an existing value', () => {
    setSetting(db, 'github.pat', 'first');
    setSetting(db, 'github.pat', 'second');
    expect(getSetting(db, 'github.pat')).toBe('second');
  });

  it('returns all settings as a record', () => {
    setSetting(db, 'github.pat', 'abc123');
    setSetting(db, 'ado.org', 'myorg');
    expect(getAllSettings(db)).toEqual({ 'github.pat': 'abc123', 'ado.org': 'myorg' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/settings-repo.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/settings-repo.ts`**

```ts
import type Database from 'better-sqlite3';

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, now);
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/settings-repo.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create `lib/config.ts`**

```ts
export const SETTINGS_KEYS = {
  githubPat: 'github.pat',
  adoPat: 'ado.pat',
  adoOrg: 'ado.org',
  adoProject: 'ado.project',
  adoTeam: 'ado.team',
  staleDays: 'github.staleDays',
  sprintName: 'sprint.name',
  sprintStart: 'sprint.start',
  sprintEnd: 'sprint.end',
} as const;

export const DEFAULT_STALE_DAYS = 3;
export const NEEDS_ATTENTION_THRESHOLD = 25;
```

- [ ] **Step 6: Commit**

```bash
git add lib/settings-repo.ts lib/settings-repo.test.ts lib/config.ts
git commit -m "Add settings repository and shared config constants"
```

---

## Task 6: Urgency Scoring

**Files:**
- Create: `lib/scoring.ts`
- Test: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `Reason`, `Status` from `lib/types.ts`.
- Produces: `ScorableItem` interface `{ reason: Reason; status: Status; dueDate: string | null; sprintEnd: string | null; rawUpdatedAt: string | null }`; `scoreItem(item: ScorableItem, now: Date): number`; `sortByUrgency<T extends ScorableItem>(items: T[], now: Date): (T & { score: number })[]`.

- [ ] **Step 1: Write the failing tests**

`lib/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scoreItem, sortByUrgency } from './scoring';

const NOW = new Date('2026-07-02T12:00:00.000Z');

function baseItem(overrides: Partial<Parameters<typeof scoreItem>[0]> = {}) {
  return {
    reason: 'manual' as const,
    status: 'inbox' as const,
    dueDate: null,
    sprintEnd: null,
    rawUpdatedAt: null,
    ...overrides,
  };
}

describe('scoreItem', () => {
  it('scores an approved-unmerged PR highest among reasons', () => {
    expect(scoreItem(baseItem({ reason: 'approved_unmerged' }), NOW)).toBe(45);
  });

  it('scores a mention or review request at 40', () => {
    expect(scoreItem(baseItem({ reason: 'mention' }), NOW)).toBe(40);
    expect(scoreItem(baseItem({ reason: 'review_requested' }), NOW)).toBe(40);
  });

  it('scores a stale own PR at 30', () => {
    expect(scoreItem(baseItem({ reason: 'stale_own_pr' }), NOW)).toBe(30);
  });

  it('scores baseline reasons at 10', () => {
    expect(scoreItem(baseItem({ reason: 'assigned' }), NOW)).toBe(10);
    expect(scoreItem(baseItem({ reason: 'authored' }), NOW)).toBe(10);
    expect(scoreItem(baseItem({ reason: 'manual' }), NOW)).toBe(10);
  });

  it('adds 25 when the due date is within 2 days', () => {
    const score = scoreItem(baseItem({ dueDate: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 25);
  });

  it('does not add the due-date bonus when the due date is more than 2 days out', () => {
    const score = scoreItem(baseItem({ dueDate: '2026-07-10T12:00:00.000Z' }), NOW);
    expect(score).toBe(10);
  });

  it('falls back to sprintEnd when there is no due date', () => {
    const score = scoreItem(baseItem({ sprintEnd: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 25);
  });

  it('adds 15 when the item has been untouched for more than 5 days', () => {
    const score = scoreItem(baseItem({ rawUpdatedAt: '2026-06-20T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 15);
  });

  it('stacks the due-date and staleness bonuses on top of the reason score', () => {
    const score = scoreItem(
      baseItem({ reason: 'review_requested', dueDate: '2026-07-03T12:00:00.000Z', rawUpdatedAt: '2026-06-20T12:00:00.000Z' }),
      NOW
    );
    expect(score).toBe(40 + 25 + 15);
  });
});

describe('sortByUrgency', () => {
  it('always ranks in_progress items above their score would otherwise place them', () => {
    const items = [
      baseItem({ reason: 'approved_unmerged' }),
      { ...baseItem({ reason: 'manual' }), status: 'in_progress' as const },
    ];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted[0].status).toBe('in_progress');
  });

  it('otherwise sorts by descending score', () => {
    const items = [baseItem({ reason: 'manual' }), baseItem({ reason: 'approved_unmerged' }), baseItem({ reason: 'mention' })];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted.map((i) => i.reason)).toEqual(['approved_unmerged', 'mention', 'manual']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/scoring.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/scoring.ts`**

```ts
import type { Reason, Status } from './types';

export interface ScorableItem {
  reason: Reason;
  status: Status;
  dueDate: string | null;
  sprintEnd: string | null;
  rawUpdatedAt: string | null;
}

const REASON_SCORE: Record<Reason, number> = {
  approved_unmerged: 45,
  mention: 40,
  review_requested: 40,
  stale_own_pr: 30,
  assigned: 10,
  authored: 10,
  manual: 10,
};

// Due-date urgency and staleness age are independent of *why* the item
// exists, so they stack on top of the reason score rather than replacing it.
export function scoreItem(item: ScorableItem, now: Date): number {
  let score = REASON_SCORE[item.reason];

  const deadline = item.dueDate ?? item.sprintEnd;
  if (deadline) {
    const daysUntil = (new Date(deadline).getTime() - now.getTime()) / 86_400_000;
    if (daysUntil <= 2) score += 25;
  }

  if (item.rawUpdatedAt) {
    const ageDays = (now.getTime() - new Date(item.rawUpdatedAt).getTime()) / 86_400_000;
    if (ageDays > 5) score += 15;
  }

  return score;
}

export function sortByUrgency<T extends ScorableItem>(items: T[], now: Date): (T & { score: number })[] {
  return items
    .map((item) => ({ ...item, score: scoreItem(item, now) }))
    .sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      return b.score - a.score;
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/scoring.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "Add pure urgency scoring function with in-progress pinning"
```

---

## Task 7: Sprint Progress Calculation

**Files:**
- Create: `lib/sprint.ts`
- Test: `lib/sprint.test.ts`

**Interfaces:**
- Consumes: `getSetting` from `lib/settings-repo.ts`; `listItems` from `lib/items-repo.ts`; `SETTINGS_KEYS` from `lib/config.ts`.
- Produces: `SprintProgress` interface `{ name: string | null; startDate: string | null; endDate: string | null; totalCount: number; completedCount: number }`; `getSprintProgress(db): SprintProgress`.

- [ ] **Step 1: Write the failing tests**

`lib/sprint.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { setSetting } from './settings-repo';
import { createAdhocItem, upsertSyncedItem, setStatus } from './items-repo';
import { SETTINGS_KEYS } from './config';
import { getSprintProgress } from './sprint';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
  setSetting(db, SETTINGS_KEYS.sprintName, 'Sprint 42');
  setSetting(db, SETTINGS_KEYS.sprintStart, '2026-06-29T00:00:00.000Z');
  setSetting(db, SETTINGS_KEYS.sprintEnd, '2026-07-12T00:00:00.000Z');
});

describe('getSprintProgress', () => {
  it('counts an ADO item tagged with the current iteration', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: 'Sprint 42',
      rawUpdatedAt: null,
    });
    setStatus(db, item.id, 'done', '2026-07-01T00:00:00.000Z');

    const progress = getSprintProgress(db);
    expect(progress.name).toBe('Sprint 42');
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(1);
  });

  it('counts an ad-hoc item created within the sprint window even without an iteration tag', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah' });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-07-05T00:00:00.000Z', item.id);

    const progress = getSprintProgress(db);
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(0);
  });

  it('excludes items outside the sprint window with no matching iteration', () => {
    const item = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Old PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-05-01T00:00:00.000Z', item.id);

    expect(getSprintProgress(db).totalCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/sprint.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/sprint.ts`**

```ts
import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { listItems } from './items-repo';
import { SETTINGS_KEYS } from './config';

export interface SprintProgress {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  totalCount: number;
  completedCount: number;
}

export function getSprintProgress(db: Database.Database): SprintProgress {
  const name = getSetting(db, SETTINGS_KEYS.sprintName);
  const startDate = getSetting(db, SETTINGS_KEYS.sprintStart);
  const endDate = getSetting(db, SETTINGS_KEYS.sprintEnd);

  const items = listItems(db);
  const inSprint = items.filter((item) => {
    if (name && item.sprintIteration === name) return true;
    if (startDate && endDate) return item.createdAt >= startDate && item.createdAt <= endDate;
    return false;
  });

  return {
    name,
    startDate,
    endDate,
    totalCount: inSprint.length,
    completedCount: inSprint.filter((i) => i.status === 'done').length,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/sprint.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sprint.ts lib/sprint.test.ts
git commit -m "Add sprint progress calculation combining ADO, GitHub, and ad-hoc items"
```

---

## Task 8: GitHub Client

**Files:**
- Create: `lib/github-client.ts`
- Test: `lib/github-client.test.ts`

**Interfaces:**
- Consumes: `NewSyncedItemInput` from `lib/types.ts`.
- Produces: `GithubConfig` interface `{ pat: string; staleDays: number }`; `fetchGithubItems(config: GithubConfig): Promise<NewSyncedItemInput[]>`.

- [ ] **Step 1: Write the failing tests**

`lib/github-client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGithubItems } from './github-client';

function jsonResponse(body: any) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

describe('fetchGithubItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('classifies an authored PR with an approval as approved_unmerged', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 42,
              title: 'Add feature',
              html_url: 'https://github.com/acme/widgets/pull/42',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/pulls/42/reviews')) return jsonResponse([{ state: 'APPROVED' }]);
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('approved_unmerged');
  });

  it('classifies an authored PR with no reviews past the stale threshold as stale_own_pr', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const staleDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 7,
              title: 'Stale PR',
              html_url: 'https://github.com/acme/widgets/pull/7',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: staleDate,
            },
          ],
        });
      }
      if (url.includes('/pulls/7/reviews')) return jsonResponse([]);
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].reason).toBe('stale_own_pr');
  });

  it('deduplicates a PR appearing in both review-requested and mentions, keeping review_requested', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const prPayload = {
      number: 9,
      title: 'Please review',
      html_url: 'https://github.com/acme/widgets/pull/9',
      repository_url: 'https://api.github.com/repos/acme/widgets',
      updated_at: '2026-07-01T00:00:00Z',
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [prPayload] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [prPayload] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('review_requested');
  });
});
```

The mock predicates match `%3A` rather than `:` because the client's `encodeURIComponent` call on the search query encodes colons — matching the literal `:` here would never fire and every test would fall through to the `throw new Error('Unexpected URL...')` branch.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/github-client.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/github-client.ts`**

```ts
import type { NewSyncedItemInput } from './types';

const GITHUB_API = 'https://api.github.com';

export interface GithubConfig {
  pat: string;
  staleDays: number;
}

async function githubFetch(pat: string, path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

interface GithubSearchItem {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  updated_at: string;
}

function repoFromUrl(repositoryUrl: string): { owner: string; repo: string } {
  const parts = repositoryUrl.split('/');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

function externalId(pr: GithubSearchItem, owner: string, repo: string): string {
  return `${pr.number}@${owner}/${repo}`;
}

async function fetchAuthoredPrItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(
    config.pat,
    `/search/issues?q=${encodeURIComponent(`type:pr author:${username} is:open`)}`
  );

  const results: NewSyncedItemInput[] = [];
  for (const pr of items as GithubSearchItem[]) {
    const { owner, repo } = repoFromUrl(pr.repository_url);
    const reviews = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`);
    const hasApproval = reviews.some((r: any) => r.state === 'APPROVED');
    const ageDays = (Date.now() - new Date(pr.updated_at).getTime()) / 86_400_000;

    let reason: NewSyncedItemInput['reason'] = 'authored';
    if (hasApproval) reason = 'approved_unmerged';
    else if (reviews.length === 0 && ageDays > config.staleDays) reason = 'stale_own_pr';

    results.push({
      source: 'github_pr',
      externalId: externalId(pr, owner, repo),
      title: pr.title,
      url: pr.html_url,
      reason,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: pr.updated_at,
    });
  }
  return results;
}

async function fetchReviewRequestedItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(
    config.pat,
    `/search/issues?q=${encodeURIComponent(`type:pr review-requested:${username} is:open`)}`
  );
  return (items as GithubSearchItem[]).map((pr) => {
    const { owner, repo } = repoFromUrl(pr.repository_url);
    return {
      source: 'github_pr',
      externalId: externalId(pr, owner, repo),
      title: pr.title,
      url: pr.html_url,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: pr.updated_at,
    };
  });
}

async function fetchMentionItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(config.pat, `/search/issues?q=${encodeURIComponent(`mentions:${username} is:open`)}`);
  return (items as GithubSearchItem[]).map((issue) => {
    const { owner, repo } = repoFromUrl(issue.repository_url);
    return {
      source: 'github_pr',
      externalId: externalId(issue, owner, repo),
      title: issue.title,
      url: issue.html_url,
      reason: 'mention',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: issue.updated_at,
    };
  });
}

export async function fetchGithubItems(config: GithubConfig): Promise<NewSyncedItemInput[]> {
  const user = await githubFetch(config.pat, '/user');
  const username = user.login;

  const [authored, reviewRequested, mentions] = await Promise.all([
    fetchAuthoredPrItems(config, username),
    fetchReviewRequestedItems(config, username),
    fetchMentionItems(config, username),
  ]);

  // Priority order: authored (with stale/approved classification) beats a
  // generic review request, which beats a generic mention on the same PR.
  const byExternalId = new Map<string, NewSyncedItemInput>();
  for (const item of [...authored, ...reviewRequested, ...mentions]) {
    if (!byExternalId.has(item.externalId)) byExternalId.set(item.externalId, item);
  }
  return Array.from(byExternalId.values());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/github-client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/github-client.ts lib/github-client.test.ts
git commit -m "Add read-only GitHub client with stale/approved PR classification"
```

---

## Task 9: Azure DevOps Client

**Files:**
- Create: `lib/ado-client.ts`
- Test: `lib/ado-client.test.ts`

**Interfaces:**
- Consumes: `NewSyncedItemInput` from `lib/types.ts`.
- Produces: `AdoConfig` interface `{ pat: string; org: string; project: string; team?: string }`; `AdoSyncResult` interface `{ items: NewSyncedItemInput[]; iteration: { name: string; startDate: string; endDate: string } | null }`; `fetchAdoData(config: AdoConfig): Promise<AdoSyncResult>`.

- [ ] **Step 1: Write the failing tests**

`lib/ado-client.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdoData } from './ado-client';

function jsonResponse(body: any) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

describe('fetchAdoData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches the current iteration and assigned work items', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) {
        return jsonResponse({ value: [{ name: 'Sprint 42', attributes: { startDate: '2026-06-29', finishDate: '2026-07-12' } }] });
      }
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 101 }] });
      if (url.includes('/workitems?ids=101')) {
        return jsonResponse({
          value: [
            {
              id: 101,
              fields: {
                'System.Title': 'Fix login bug',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/101' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.iteration).toEqual({ name: 'Sprint 42', startDate: '2026-06-29', endDate: '2026-07-12' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ externalId: '101', reason: 'assigned', title: 'Fix login bug' });
  });

  it('marks a work item as mention when a comment mentions the user', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) return jsonResponse({ value: [] });
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 202 }] });
      if (url.includes('/workitems?ids=202')) {
        return jsonResponse({
          value: [
            {
              id: 202,
              fields: {
                'System.Title': 'Review design doc',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/202' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [{ mentions: [{ id: 'chris' }] }] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.items[0].reason).toBe('mention');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/ado-client.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/ado-client.ts`**

```ts
import type { NewSyncedItemInput } from './types';

export interface AdoConfig {
  pat: string;
  org: string;
  project: string;
  team?: string;
}

export interface AdoSyncResult {
  items: NewSyncedItemInput[];
  iteration: { name: string; startDate: string; endDate: string } | null;
}

function authHeader(pat: string): string {
  return 'Basic ' + Buffer.from(':' + pat).toString('base64');
}

async function adoFetch(config: AdoConfig, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: authHeader(config.pat),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Azure DevOps API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchCurrentIteration(config: AdoConfig): Promise<AdoSyncResult['iteration']> {
  const team = config.team ?? config.project;
  const data = await adoFetch(
    config,
    `https://dev.azure.com/${config.org}/${config.project}/${team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`
  );
  const iteration = data.value?.[0];
  if (!iteration) return null;
  return { name: iteration.name, startDate: iteration.attributes.startDate, endDate: iteration.attributes.finishDate };
}

async function fetchAssignedWorkItemIds(config: AdoConfig): Promise<number[]> {
  const wiql = {
    query:
      "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.IterationPath] = @CurrentIteration AND [System.State] <> 'Closed'",
  };
  const result = await adoFetch(
    config,
    `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/wiql?api-version=7.1`,
    { method: 'POST', body: JSON.stringify(wiql) }
  );
  return (result.workItems ?? []).map((wi: any) => wi.id);
}

async function fetchWorkItemDetails(config: AdoConfig, ids: number[]): Promise<NewSyncedItemInput[]> {
  if (ids.length === 0) return [];
  const data = await adoFetch(config, `https://dev.azure.com/${config.org}/_apis/wit/workitems?ids=${ids.join(',')}&api-version=7.1`);
  return data.value.map((wi: any) => ({
    source: 'ado_workitem' as const,
    externalId: String(wi.id),
    title: wi.fields['System.Title'],
    url: wi._links.html.href,
    reason: 'assigned' as const,
    dueDate: wi.fields['Microsoft.VSTS.Scheduling.DueDate'] ?? null,
    sprintIteration: wi.fields['System.IterationPath'] ?? null,
    rawUpdatedAt: wi.fields['System.ChangedDate'],
  }));
}

// v1 scopes mention detection to your assigned set to keep the WIQL surface
// small; mentions on work items not assigned to you are out of scope.
async function fetchMentionWorkItems(config: AdoConfig, ids: number[]): Promise<NewSyncedItemInput[]> {
  const mentioned: NewSyncedItemInput[] = [];
  for (const id of ids) {
    const comments = await adoFetch(
      config,
      `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`
    );
    const hasMention = (comments.comments ?? []).some((c: any) => c.mentions?.length > 0);
    if (hasMention) {
      const [details] = await fetchWorkItemDetails(config, [id]);
      if (details) mentioned.push({ ...details, reason: 'mention' });
    }
  }
  return mentioned;
}

export async function fetchAdoData(config: AdoConfig): Promise<AdoSyncResult> {
  const [iteration, assignedIds] = await Promise.all([fetchCurrentIteration(config), fetchAssignedWorkItemIds(config)]);
  const [assignedItems, mentionItems] = await Promise.all([
    fetchWorkItemDetails(config, assignedIds),
    fetchMentionWorkItems(config, assignedIds),
  ]);

  const byExternalId = new Map<string, NewSyncedItemInput>();
  for (const item of [...mentionItems, ...assignedItems]) {
    if (!byExternalId.has(item.externalId)) byExternalId.set(item.externalId, item);
  }

  return { items: Array.from(byExternalId.values()), iteration };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/ado-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ado-client.ts lib/ado-client.test.ts
git commit -m "Add read-only Azure DevOps client with iteration and mention detection"
```

---

## Task 10: Sync Orchestrator

**Files:**
- Create: `lib/sync.ts`
- Test: `lib/sync.test.ts`

**Interfaces:**
- Consumes: `fetchGithubItems` from `lib/github-client.ts`; `fetchAdoData` from `lib/ado-client.ts`; `upsertSyncedItem` from `lib/items-repo.ts`; `getSetting`, `setSetting` from `lib/settings-repo.ts`; `SETTINGS_KEYS`, `DEFAULT_STALE_DAYS` from `lib/config.ts`.
- Produces: `SyncOutcome` interface `{ source: 'github' | 'ado'; itemCount: number; error: string | null }`; `runSync(db): Promise<SyncOutcome[]>`.

- [ ] **Step 1: Write the failing tests**

`lib/sync.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from './db';
import { setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { listItems } from './items-repo';

vi.mock('./github-client', () => ({ fetchGithubItems: vi.fn() }));
vi.mock('./ado-client', () => ({ fetchAdoData: vi.fn() }));

import { fetchGithubItems } from './github-client';
import { fetchAdoData } from './ado-client';
import { runSync } from './sync';

let db: ReturnType<typeof openDb>;

beforeEach(() => {
  db = openDb(':memory:');
  vi.clearAllMocks();
});

describe('runSync', () => {
  it('upserts items from both sources and logs success', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');

    (fetchGithubItems as any).mockResolvedValue([
      { source: 'github_pr', externalId: '1@a/b', title: 'PR', url: null, reason: 'mention', dueDate: null, sprintIteration: null, rawUpdatedAt: null },
    ]);
    (fetchAdoData as any).mockResolvedValue({
      items: [
        { source: 'ado_workitem', externalId: '101', title: 'WI', url: null, reason: 'assigned', dueDate: null, sprintIteration: null, rawUpdatedAt: null },
      ],
      iteration: { name: 'Sprint 1', startDate: '2026-07-01', endDate: '2026-07-14' },
    });

    const outcomes = await runSync(db);
    expect(outcomes.every((o) => o.error === null)).toBe(true);
    expect(listItems(db)).toHaveLength(2);
  });

  it('continues the ADO sync when GitHub sync fails', async () => {
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: null });

    const outcomes = await runSync(db);
    const github = outcomes.find((o) => o.source === 'github')!;
    const ado = outcomes.find((o) => o.source === 'ado')!;
    expect(github.error).toBe('GitHub PAT not configured');
    expect(ado.error).toBeNull();
  });

  it('continues the GitHub sync when ADO sync throws', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchGithubItems as any).mockResolvedValue([]);
    (fetchAdoData as any).mockRejectedValue(new Error('Azure DevOps API error 401'));

    const outcomes = await runSync(db);
    const github = outcomes.find((o) => o.source === 'github')!;
    const ado = outcomes.find((o) => o.source === 'ado')!;
    expect(github.error).toBeNull();
    expect(ado.error).toBe('Azure DevOps API error 401');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/sync.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/sync.ts`**

```ts
import type Database from 'better-sqlite3';
import { fetchGithubItems } from './github-client';
import { fetchAdoData } from './ado-client';
import { upsertSyncedItem } from './items-repo';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from './config';

export interface SyncOutcome {
  source: 'github' | 'ado';
  itemCount: number;
  error: string | null;
}

function logSyncResult(db: Database.Database, source: string, itemCount: number, error: string | null): void {
  db.prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)').run(
    source,
    new Date().toISOString(),
    itemCount,
    error
  );
}

async function syncGithub(db: Database.Database): Promise<SyncOutcome> {
  const pat = getSetting(db, SETTINGS_KEYS.githubPat);
  if (!pat) {
    const error = 'GitHub PAT not configured';
    logSyncResult(db, 'github', 0, error);
    return { source: 'github', itemCount: 0, error };
  }

  const staleDays = Number(getSetting(db, SETTINGS_KEYS.staleDays) ?? DEFAULT_STALE_DAYS);
  try {
    const items = await fetchGithubItems({ pat, staleDays });
    for (const item of items) upsertSyncedItem(db, item);
    logSyncResult(db, 'github', items.length, null);
    return { source: 'github', itemCount: items.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSyncResult(db, 'github', 0, message);
    return { source: 'github', itemCount: 0, error: message };
  }
}

async function syncAdo(db: Database.Database): Promise<SyncOutcome> {
  const pat = getSetting(db, SETTINGS_KEYS.adoPat);
  const org = getSetting(db, SETTINGS_KEYS.adoOrg);
  const project = getSetting(db, SETTINGS_KEYS.adoProject);
  if (!pat || !org || !project) {
    const error = 'Azure DevOps settings not configured';
    logSyncResult(db, 'ado', 0, error);
    return { source: 'ado', itemCount: 0, error };
  }

  try {
    const team = getSetting(db, SETTINGS_KEYS.adoTeam) ?? undefined;
    const { items, iteration } = await fetchAdoData({ pat, org, project, team });
    for (const item of items) upsertSyncedItem(db, item);
    if (iteration) {
      setSetting(db, SETTINGS_KEYS.sprintName, iteration.name);
      setSetting(db, SETTINGS_KEYS.sprintStart, iteration.startDate);
      setSetting(db, SETTINGS_KEYS.sprintEnd, iteration.endDate);
    }
    logSyncResult(db, 'ado', items.length, null);
    return { source: 'ado', itemCount: items.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSyncResult(db, 'ado', 0, message);
    return { source: 'ado', itemCount: 0, error: message };
  }
}

export async function runSync(db: Database.Database): Promise<SyncOutcome[]> {
  return Promise.all([syncGithub(db), syncAdo(db)]);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/sync.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/sync.ts lib/sync.test.ts
git commit -m "Add sync orchestrator with independent per-source error handling"
```

---

## Task 11: API Route — `/api/settings`

**Files:**
- Create: `app/api/settings/route.ts`
- Test: `app/api/settings/route.test.ts`

**Interfaces:**
- Consumes: `getAllSettings`, `setSetting` from `lib/settings-repo.ts`; `db` from `lib/db-instance.ts`.
- Produces: `GET(): Promise<Response>` returns all settings as JSON; `POST(request: Request): Promise<Response>` merges the request body into settings and returns the updated set.

- [ ] **Step 1: Write the failing test**

`app/api/settings/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

describe('/api/settings', () => {
  it('saves and returns settings', async () => {
    const postRes = await POST(
      new Request('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [SETTINGS_KEYS.githubPat]: 'abc123' }),
      })
    );
    expect(postRes.status).toBe(200);

    const getRes = await GET();
    const body = await getRes.json();
    expect(body[SETTINGS_KEYS.githubPat]).toBe('abc123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/settings/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `app/api/settings/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAllSettings, setSetting } from '@/lib/settings-repo';

export async function GET() {
  return NextResponse.json(getAllSettings(db));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    setSetting(db, key, value);
  }
  return NextResponse.json(getAllSettings(db));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/settings/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/route.ts app/api/settings/route.test.ts
git commit -m "Add /api/settings route"
```

---

## Task 12: API Route — `/api/sync`

**Files:**
- Create: `app/api/sync/route.ts`
- Test: `app/api/sync/route.test.ts`

**Interfaces:**
- Consumes: `runSync` from `lib/sync.ts`; `db` from `lib/db-instance.ts`.
- Produces: `POST(): Promise<Response>` returns `{ outcomes: SyncOutcome[] }`.

- [ ] **Step 1: Write the failing test**

`app/api/sync/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));
vi.mock('@/lib/sync', () => ({
  runSync: vi.fn().mockResolvedValue([
    { source: 'github', itemCount: 2, error: null },
    { source: 'ado', itemCount: 1, error: null },
  ]),
}));

const { POST } = await import('./route');

describe('/api/sync', () => {
  it('returns outcomes from runSync', async () => {
    const res = await POST();
    const body = await res.json();
    expect(body.outcomes).toHaveLength(2);
    expect(body.outcomes[0].source).toBe('github');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/sync/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `app/api/sync/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { runSync } from '@/lib/sync';

export async function POST() {
  const outcomes = await runSync(db);
  return NextResponse.json({ outcomes });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/sync/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/sync/route.ts app/api/sync/route.test.ts
git commit -m "Add /api/sync route"
```

---

## Task 13: Grouped Items & API Route — `/api/items` (list + create)

**Files:**
- Create: `lib/dashboard.ts`
- Test: `lib/dashboard.test.ts`
- Create: `app/api/items/route.ts`
- Test: `app/api/items/route.test.ts`

**Interfaces:**
- Consumes: `listItems`, `createAdhocItem` from `lib/items-repo.ts`; `getSetting` from `lib/settings-repo.ts`; `sortByUrgency` from `lib/scoring.ts`; `SETTINGS_KEYS`, `NEEDS_ATTENTION_THRESHOLD` from `lib/config.ts`; `db` from `lib/db-instance.ts`.
- Produces: `GroupedItems` interface `{ needsAttention, inProgress, everythingElse: (Item & { score: number })[] }`; `getGroupedItems(db, now: Date): GroupedItems` from `lib/dashboard.ts` — the single source of the needs-attention/in-progress/everything-else split, consumed by both this route and the Server Component in Task 17 so the grouping logic exists in exactly one place. `GET(): Promise<Response>` returns a `GroupedItems` JSON object; `POST(request: Request): Promise<Response>` creates an ad-hoc item, returns it with status 201.

- [ ] **Step 1: Write the failing test for the grouping logic**

`lib/dashboard.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, setStatus } from './items-repo';
import { getGroupedItems } from './dashboard';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getGroupedItems', () => {
  it('splits items into needsAttention, inProgress, and everythingElse', () => {
    const urgent = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Ready to merge',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    const low = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Backlog item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    const active = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '102',
      title: 'In flight',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    setStatus(db, active.id, 'in_progress');

    const grouped = getGroupedItems(db, new Date());
    expect(grouped.needsAttention.map((i) => i.id)).toEqual([urgent.id]);
    expect(grouped.inProgress.map((i) => i.id)).toEqual([active.id]);
    expect(grouped.everythingElse.map((i) => i.id)).toEqual([low.id]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/dashboard.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/dashboard.ts`**

```ts
import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency } from './scoring';
import { SETTINGS_KEYS, NEEDS_ATTENTION_THRESHOLD } from './config';
import type { Item } from './types';

export interface GroupedItems {
  needsAttention: (Item & { score: number })[];
  inProgress: (Item & { score: number })[];
  everythingElse: (Item & { score: number })[];
}

export function getGroupedItems(db: Database.Database, now: Date): GroupedItems {
  const items = listItems(db);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), now);

  return {
    needsAttention: scored.filter((i) => i.status === 'inbox' && i.score >= NEEDS_ATTENTION_THRESHOLD),
    inProgress: scored.filter((i) => i.status === 'in_progress'),
    everythingElse: scored.filter((i) => i.status === 'inbox' && i.score < NEEDS_ATTENTION_THRESHOLD),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing route tests**

`app/api/items/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, setStatus } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM time_logs; DELETE FROM settings;');
});

describe('GET /api/items', () => {
  it('returns the grouped items from getGroupedItems', async () => {
    const urgent = upsertSyncedItem(testDb, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Ready to merge',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.needsAttention.map((i: any) => i.id)).toEqual([urgent.id]);
    expect(body.inProgress).toEqual([]);
    expect(body.everythingElse).toEqual([]);
  });
});

describe('POST /api/items', () => {
  it('creates an ad-hoc item', async () => {
    const res = await POST(
      new Request('http://localhost/api/items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Reply to Sarah', category: 'meeting' }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Reply to Sarah');
    expect(body.source).toBe('adhoc');
  });
});
```

This route test intentionally does not re-verify the needsAttention/inProgress/everythingElse split in detail — that behavior is already fully covered by `lib/dashboard.test.ts`; here it only confirms the route wires `getGroupedItems` to a JSON response.

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- app/api/items/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement `app/api/items/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { createAdhocItem } from '@/lib/items-repo';
import { getGroupedItems } from '@/lib/dashboard';

export async function GET() {
  return NextResponse.json(getGroupedItems(db, new Date()));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title: string; category?: string; dueDate?: string };
  const item = createAdhocItem(db, body);
  return NextResponse.json(item, { status: 201 });
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- app/api/items/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add lib/dashboard.ts lib/dashboard.test.ts app/api/items/route.ts app/api/items/route.test.ts
git commit -m "Add getGroupedItems helper and /api/items route with ad-hoc creation"
```

---

## Task 14: API Routes — `/api/items/[id]/{start,complete,undo}`

**Files:**
- Create: `app/api/items/[id]/start/route.ts`
- Create: `app/api/items/[id]/complete/route.ts`
- Create: `app/api/items/[id]/undo/route.ts`
- Test: `app/api/items/[id]/actions.test.ts`

**Interfaces:**
- Consumes: `setStatus`, `getItemById` from `lib/items-repo.ts`; `startTimer`, `completeTimer`, `undoLastCompletion` from `lib/time-logs-repo.ts`; `db` from `lib/db-instance.ts`.
- Produces: each route's `POST(request, { params }): Promise<Response>`. `start` sets status to `in_progress` and opens a timer. `complete` sets status to `done`, closes the timer (accepting optional `durationMinutes`/`note` in the JSON body), returns `{ item, timeLog }`. `undo` reverts status to `in_progress` and deletes the last time log.

- [ ] **Step 1: Write the failing tests**

`app/api/items/[id]/actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST: start } = await import('./start/route');
const { POST: complete } = await import('./complete/route');
const { POST: undo } = await import('./undo/route');

let itemId: number;

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM time_logs;');
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

describe('start -> complete -> undo', () => {
  it('walks an item through the full lifecycle', async () => {
    const startRes = await start(new Request('http://localhost'), { params: { id: String(itemId) } });
    expect((await startRes.json()).status).toBe('in_progress');

    const completeRes = await complete(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ durationMinutes: 30 }) }),
      { params: { id: String(itemId) } }
    );
    const completeBody = await completeRes.json();
    expect(completeBody.item.status).toBe('done');
    expect(completeBody.timeLog.durationMinutes).toBe(30);

    const undoRes = await undo(new Request('http://localhost'), { params: { id: String(itemId) } });
    const undoBody = await undoRes.json();
    expect(undoBody.status).toBe('in_progress');
    expect(undoBody.completedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/api/items/[id]/actions.test.ts"`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Implement the three routes**

`app/api/items/[id]/start/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { startTimer } from '@/lib/time-logs-repo';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  setStatus(db, id, 'in_progress');
  startTimer(db, id);
  return NextResponse.json(getItemById(db, id));
}
```

`app/api/items/[id]/complete/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { completeTimer } from '@/lib/time-logs-repo';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as { durationMinutes?: number; note?: string };
  setStatus(db, id, 'done', new Date().toISOString());
  const log = completeTimer(db, id, body);
  return NextResponse.json({ item: getItemById(db, id), timeLog: log });
}
```

`app/api/items/[id]/undo/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { undoLastCompletion } from '@/lib/time-logs-repo';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  undoLastCompletion(db, id);
  setStatus(db, id, 'in_progress', null);
  return NextResponse.json(getItemById(db, id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/api/items/[id]/actions.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/items/[id]/start/route.ts" "app/api/items/[id]/complete/route.ts" "app/api/items/[id]/undo/route.ts" "app/api/items/[id]/actions.test.ts"
git commit -m "Add item lifecycle routes: start, complete, undo"
```

---

## Task 15: API Route — `/api/sprint`

**Files:**
- Create: `app/api/sprint/route.ts`
- Test: `app/api/sprint/route.test.ts`

**Interfaces:**
- Consumes: `getSprintProgress` from `lib/sprint.ts`; `db` from `lib/db-instance.ts`.
- Produces: `GET(): Promise<Response>` returns a `SprintProgress` JSON object.

- [ ] **Step 1: Write the failing test**

`app/api/sprint/route.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

describe('/api/sprint', () => {
  it('returns sprint progress from settings and items', async () => {
    setSetting(testDb, SETTINGS_KEYS.sprintName, 'Sprint 42');
    setSetting(testDb, SETTINGS_KEYS.sprintStart, '2026-06-29T00:00:00.000Z');
    setSetting(testDb, SETTINGS_KEYS.sprintEnd, '2026-07-12T00:00:00.000Z');

    const res = await GET();
    const body = await res.json();
    expect(body.name).toBe('Sprint 42');
    expect(body).toHaveProperty('totalCount');
    expect(body).toHaveProperty('completedCount');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/api/sprint/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `app/api/sprint/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getSprintProgress } from '@/lib/sprint';

export async function GET() {
  return NextResponse.json(getSprintProgress(db));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/api/sprint/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/sprint/route.ts app/api/sprint/route.test.ts
git commit -m "Add /api/sprint route"
```

---

## Task 16: shadcn/ui Setup & Theming

**Files:**
- Create/Modify (via CLI): `components.json`, `lib/utils.ts`, `app/globals.css`, `tailwind.config.ts`
- Create (via CLI): `components/ui/button.tsx`, `components/ui/card.tsx`, `components/ui/badge.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/progress.tsx`, `components/ui/accordion.tsx`, `components/ui/sonner.tsx`, `components/ui/form.tsx`
- Create: `components/theme-provider.tsx`, `components/theme-toggle.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `Button`, `buttonVariants` (variants: `default`, `outline`, `secondary`, `ghost`, `link`; sizes: `default`, `sm`, `lg`, `icon`) from `@/components/ui/button`; `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`; `Badge`, `badgeVariants` (variants: `default`, `secondary`, `destructive`, `outline`) from `@/components/ui/badge`; `Input`, `Label` from `@/components/ui/input` and `@/components/ui/label`; `Progress` from `@/components/ui/progress`; `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion`; `Toaster`, `toast` (re-exported from `sonner`) from `@/components/ui/sonner`; `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `@/components/ui/form`; `cn(...)` from `@/lib/utils`; `ThemeProvider` from `components/theme-provider.tsx`; `ThemeToggle` from `components/theme-toggle.tsx`.

This task has no automated test — it is tooling/setup, verified by a successful build and a visual check.

- [ ] **Step 1: Run the shadcn CLI init**

Prefer the non-interactive form so this step is scriptable: run `npx shadcn@latest init --help` first to confirm the installed version's flags, then run something equivalent to:

Run: `npx shadcn@latest init -y -b zinc --css-variables`

(`-y`/`--yes` skips prompts using defaults, `-b zinc` sets the base color to Zinc, `--css-variables` requests CSS-variable-based theming.) If the installed CLI version does not support these flags, fall back to running `npx shadcn@latest init` interactively and answer:
- TypeScript: yes
- Style: **New York**
- Base color: **Zinc**
- CSS variables for colors: **yes**

Either way, after it completes, confirm `app/globals.css` contains `.dark` and `:root` blocks and `components.json` has `"baseColor": "zinc"` — if the base color differs, it's safe to proceed since Step 3 below overrides the accent color explicitly regardless of base color.

This overwrites `tailwind.config.ts`'s `darkMode` (changes from `'media'` to `'class'`, since theme switching is now controlled by `next-themes` rather than the OS preference alone) and rewrites `app/globals.css` with `:root`/`.dark` CSS variable blocks (`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--radius`, etc.). It also creates `components.json` and `lib/utils.ts` (exporting `cn()`). This is expected — do not revert these files to their Task 1 state.

- [ ] **Step 2: Add the required shadcn components**

Run: `npx shadcn@latest add button card badge input label progress accordion sonner form`
Expected: creates the nine files listed under Files above, and installs their dependencies (`@radix-ui/react-progress`, `@radix-ui/react-accordion`, `@radix-ui/react-label`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `zod`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`) into `package.json`.

- [ ] **Step 3: Set the indigo accent color**

The default Zinc theme is monochrome. Open `app/globals.css` and change the `--primary` / `--primary-foreground` variables in both the `:root` and `.dark` blocks to an indigo accent (all other generated variables stay as the CLI produced them):

```css
:root {
  /* ...existing generated variables above... */
  --primary: 243 75% 59%;
  --primary-foreground: 0 0% 100%;
}

.dark {
  /* ...existing generated variables above... */
  --primary: 243 75% 65%;
  --primary-foreground: 0 0% 100%;
}
```

Because every generated component (`Button`, `Progress`, focus rings, etc.) reads `bg-primary` / `text-primary-foreground` / `ring-primary` rather than a hardcoded color, this one change gives the whole app a consistent indigo accent — matching the shadcn theming guideline to use CSS variables, not hardcoded hex values, in components.

- [ ] **Step 4: Install next-themes and add the Inter font**

Run: `npm install next-themes`

`components/theme-provider.tsx`:
```tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

`components/theme-toggle.tsx`:
```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 5: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ActivityDash',
  description: 'Personal attention-triage dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} bg-background font-sans text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`defaultTheme="dark"` with `enableSystem={false}` makes dark the fixed starting point (matching the "avoid light mode default" guidance for developer tools) while `ThemeToggle` (wired into the header in Task 18) still lets the user switch to light — both themes stay fully supported, just not equally weighted by default.

- [ ] **Step 6: Verify the build and visual baseline**

Run: `npm run build`
Expected: build succeeds with no type errors.
Run: `npm run dev`, open `http://localhost:3000`
Expected: page renders in dark mode with the Inter font applied and no console errors (the page content itself is still the Task 1/16 placeholder until Task 17 replaces it).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Set up shadcn/ui, next-themes dark-mode-first theming, and Inter font"
```

---

## Task 17: App Shell & Dashboard Wiring

**Files:**
- Create: `lib/api-client.ts`
- Modify: `app/page.tsx` (replace Task 1 placeholder)
- Create: `components/Dashboard.tsx`

**Interfaces:**
- Consumes: `getGroupedItems` from `lib/dashboard.ts`; `getSprintProgress` from `lib/sprint.ts`; `db` from `lib/db-instance.ts`.
- Produces: `fetchDashboardData()`, `triggerSync()`, `startItem(id)`, `completeItem(id, options)`, `undoItem(id)`, `createAdhocItemRequest(input)` from `lib/api-client.ts`; `<Dashboard initialData={...} />` component consumed by `app/page.tsx`. `DashboardData` shape: `{ needsAttention, inProgress, everythingElse: (Item & { score: number })[]; sprint: SprintProgress }`.

This task has no automated test — it is UI wiring, verified manually in Task 22.

- [ ] **Step 1: Create the client-side API helper**

`lib/api-client.ts`:
```ts
export async function fetchDashboardData() {
  const [itemsRes, sprintRes] = await Promise.all([fetch('/api/items'), fetch('/api/sprint')]);
  const items = await itemsRes.json();
  const sprint = await sprintRes.json();
  return { ...items, sprint };
}

export async function triggerSync() {
  const res = await fetch('/api/sync', { method: 'POST' });
  return res.json();
}

export async function startItem(id: number) {
  await fetch(`/api/items/${id}/start`, { method: 'POST' });
}

export async function completeItem(id: number, body: { durationMinutes?: number; note?: string } = {}) {
  const res = await fetch(`/api/items/${id}/complete`, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}

export async function undoItem(id: number) {
  await fetch(`/api/items/${id}/undo`, { method: 'POST' });
}

export async function createAdhocItemRequest(input: { title: string; category?: string; dueDate?: string }) {
  await fetch('/api/items', { method: 'POST', body: JSON.stringify(input) });
}
```

- [ ] **Step 2: Replace the placeholder `app/page.tsx` with the real Server Component**

```tsx
import Dashboard from '@/components/Dashboard';
import { db } from '@/lib/db-instance';
import { getGroupedItems } from '@/lib/dashboard';
import { getSprintProgress } from '@/lib/sprint';

// Without this, Next.js may statically prerender this page at build time
// (it has no dynamic APIs to force server rendering otherwise), baking in
// build-time data forever under `next build && next start`.
export const dynamic = 'force-dynamic';

export default function Page() {
  const grouped = getGroupedItems(db, new Date());
  const sprint = getSprintProgress(db);

  return <Dashboard initialData={{ ...grouped, sprint }} />;
}
```

This reuses the exact grouping logic from `/api/items` (Task 13) instead of recomputing it — `getGroupedItems` is the single source of truth for the needs-attention/in-progress/everything-else split.

- [ ] **Step 3: Create the Client Component shell**

`components/Dashboard.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/sonner';
import {
  fetchDashboardData,
  triggerSync,
  startItem,
  completeItem,
  undoItem,
  createAdhocItemRequest,
} from '@/lib/api-client';
import type { Item } from '@/lib/types';
import type { SprintProgress } from '@/lib/sprint';

type ScoredItem = Item & { score: number };

interface DashboardData {
  needsAttention: ScoredItem[];
  inProgress: ScoredItem[];
  everythingElse: ScoredItem[];
  sprint: SprintProgress;
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  async function refresh() {
    const fresh = await fetchDashboardData();
    setData(fresh);
  }

  async function handleRefresh() {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const { outcomes } = await triggerSync();
      setSyncErrors(outcomes.filter((o: any) => o.error).map((o: any) => `${o.source}: ${o.error}`));
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleStart(id: number) {
    await startItem(id);
    await refresh();
  }

  async function handleComplete(id: number, durationMinutes?: number) {
    await completeItem(id, { durationMinutes });
    await refresh();
    toast('Marked complete.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await undoItem(id);
          await refresh();
        },
      },
    });
  }

  async function handleQuickAdd(input: { title: string; category?: string; dueDate?: string }) {
    await createAdhocItemRequest(input);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <p className="text-sm text-muted-foreground">Dashboard shell — sections added in Tasks 18-20.</p>
    </main>
  );
}
```

Using Sonner's `toast(...)` with an `action` button replaces the hand-rolled undo state/timeout entirely — Sonner owns the 5-second auto-dismiss and the Undo click target, per the shadcn Toast guideline to prefer Sonner over a custom implementation.

This placeholder body is intentionally minimal — Task 18 adds `SprintProgressHeader`, Task 19 adds the item sections, and Task 20 adds quick-add, each wired to the handlers already defined here.

- [ ] **Step 4: Verify it compiles and renders**

Run: `npm run build`
Expected: build succeeds with no type errors.
Run: `npm run dev`, open `http://localhost:3000`
Expected: page renders "Dashboard shell — sections added in Tasks 18-20." in dark mode with no console errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts app/page.tsx components/Dashboard.tsx
git commit -m "Wire dashboard page: server-fetched initial data + client shell with Sonner toast"
```

---

## Task 18: Sprint Progress Header

**Files:**
- Create: `components/SprintProgressHeader.tsx`
- Modify: `components/Dashboard.tsx`: render `<SprintProgressHeader>` inside the returned JSX, replacing the placeholder paragraph.

**Interfaces:**
- Consumes: `SprintProgress` from `lib/sprint.ts`; `Card`, `CardContent` from `@/components/ui/card`; `Button` from `@/components/ui/button`; `Progress` from `@/components/ui/progress`; `ThemeToggle` from `@/components/theme-toggle`.
- Produces: `<SprintProgressHeader sprint={SprintProgress} onRefresh={() => void} syncing={boolean} errors={string[]} />`.

No automated test — visual component, verified manually in Task 22.

- [ ] **Step 1: Create `components/SprintProgressHeader.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/theme-toggle';
import type { SprintProgress } from '@/lib/sprint';

interface Props {
  sprint: SprintProgress;
  onRefresh: () => void;
  syncing: boolean;
  errors: string[];
}

export default function SprintProgressHeader({ sprint, onRefresh, syncing, errors }: Props) {
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : null;
  const percent = sprint.totalCount > 0 ? Math.round((sprint.completedCount / sprint.totalCount) * 100) : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{sprint.name ?? 'No active sprint'}</h1>
            <p className="text-sm text-muted-foreground">
              {sprint.completedCount}/{sprint.totalCount} done
              {daysRemaining !== null ? ` · ${daysRemaining} days remaining` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" onClick={onRefresh} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : 'Refresh'}
            </Button>
            <Button type="button" variant="ghost" size="icon" asChild aria-label="Settings">
              <Link href="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <Progress value={percent} />
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

The "N/M done" text sits directly above the `Progress` bar and is always rendered regardless of `totalCount`, so completion is never conveyed by the bar's fill color alone. `Button`'s built-in `disabled:opacity-50 disabled:pointer-events-none` styling (from the shadcn component) handles the loading/disabled state without any custom CSS.

- [ ] **Step 2: Wire it into `components/Dashboard.tsx`**

Replace the placeholder `<p>` with:
```tsx
      <SprintProgressHeader sprint={data.sprint} onRefresh={handleRefresh} syncing={syncing} errors={syncErrors} />
```

And add the import at the top of the file:
```tsx
import SprintProgressHeader from './SprintProgressHeader';
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`
Expected: header renders as a card with "0/0 done", an empty progress bar, a working Refresh button (spinner + "Syncing…" while disabled), a Settings icon button linking to `/settings`, and a theme toggle that switches the whole page to light mode and back.

- [ ] **Step 4: Commit**

```bash
git add components/SprintProgressHeader.tsx components/Dashboard.tsx
git commit -m "Add sprint progress header using shadcn Card/Progress/Button and theme toggle"
```

---

## Task 19: Item Section & Item Row

**Files:**
- Create: `components/ItemRow.tsx`
- Create: `components/ItemSection.tsx`
- Modify: `components/Dashboard.tsx`: render three `<ItemSection>`s after the header from Task 18.

**Interfaces:**
- Consumes: `Item` from `lib/types.ts`; `Badge` from `@/components/ui/badge`; `Button` from `@/components/ui/button`; `Card`, `CardContent` from `@/components/ui/card`; `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` from `@/components/ui/accordion`.
- Produces: `<ItemRow item={Item & { score: number }} onStart?={(id) => void} onComplete={(id, durationMinutes?) => void} />`; `<ItemSection value={string} title={string} items={(Item & { score: number })[]} emptyMessage={string} onStart?={...} onComplete={...} />` (an `AccordionItem` — must be rendered inside a parent `<Accordion>`).

No automated test — visual components, verified manually in Task 22.

- [ ] **Step 1: Create `components/ItemRow.tsx`**

```tsx
'use client';

import { Github, ClipboardList, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Item } from '@/lib/types';

const REASON_LABEL: Record<Item['reason'], string> = {
  approved_unmerged: 'Ready to merge',
  mention: 'Mentioned you',
  review_requested: 'Review requested',
  stale_own_pr: 'Stale — no reviews',
  assigned: 'Assigned to you',
  authored: 'Your PR',
  manual: 'Ad-hoc',
};

const REASON_VARIANT: Record<Item['reason'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved_unmerged: 'default',
  mention: 'secondary',
  review_requested: 'secondary',
  stale_own_pr: 'destructive',
  assigned: 'outline',
  authored: 'outline',
  manual: 'outline',
};

const SOURCE_ICON = {
  github_pr: Github,
  ado_workitem: ClipboardList,
  adhoc: MessageSquare,
} as const;

interface Props {
  item: Item & { score: number };
  onStart?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number) => void;
}

export default function ItemRow({ item, onStart, onComplete }: Props) {
  const Icon = SOURCE_ICON[item.source];

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
              {item.title}
            </a>
          ) : (
            <span className="truncate font-medium">{item.title}</span>
          )}
          <Badge variant={REASON_VARIANT[item.reason]} className="ml-2">
            {REASON_LABEL[item.reason]}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {item.status !== 'in_progress' && onStart && (
          <Button type="button" variant="outline" size="sm" onClick={() => onStart(item.id)}>
            Start
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => onComplete(item.id)}>
          Mark complete
        </Button>
      </div>
    </div>
  );
}
```

Mapping `approved_unmerged` to the `default` (primary/indigo) badge variant and `stale_own_pr` to `destructive` gives the highest- and needs-nudging items a visually distinct look that reinforces the urgency score — while the label text is always present, so meaning is never carried by color alone.

- [ ] **Step 2: Create `components/ItemSection.tsx`**

```tsx
'use client';

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ItemRow from './ItemRow';
import type { Item } from '@/lib/types';

interface Props {
  value: string;
  title: string;
  items: (Item & { score: number })[];
  emptyMessage: string;
  onStart?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number) => void;
}

export default function ItemSection({ value, title, items, emptyMessage, onStart, onComplete }: Props) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </AccordionTrigger>
      <AccordionContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onStart={onStart} onComplete={onComplete} />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
```

`AccordionTrigger` already renders and rotates its own chevron on open/close, so there's no manual `ChevronDown`/`ChevronRight` state to wire up — matching the shadcn guideline to prefer `Accordion` over a custom collapse implementation for grouped expandable sections.

- [ ] **Step 3: Wire both into `components/Dashboard.tsx`**

Add the imports:
```tsx
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import ItemSection from './ItemSection';
```

Insert after `<SprintProgressHeader ... />`:
```tsx
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={['needs-attention', 'in-progress']}>
            <ItemSection
              value="needs-attention"
              title="Needs attention"
              items={data.needsAttention}
              emptyMessage="You're all caught up."
              onStart={handleStart}
              onComplete={handleComplete}
            />
            <ItemSection
              value="in-progress"
              title="In progress"
              items={data.inProgress}
              emptyMessage="Nothing in progress — start something above."
              onComplete={handleComplete}
            />
            <ItemSection
              value="everything-else"
              title="Everything else"
              items={data.everythingElse}
              emptyMessage="Nothing else queued."
              onStart={handleStart}
              onComplete={handleComplete}
            />
          </Accordion>
        </CardContent>
      </Card>
```

`type="multiple"` lets "Needs attention" and "In progress" both start open (via `defaultValue`) while "Everything else" starts collapsed, and any combination can be open at once — unlike `type="single"`, which would force closing one section to open another.

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`
Expected: one card renders containing all three sections; "Needs attention" and "In progress" start expanded showing their empty-state messages, "Everything else" starts collapsed; clicking a trigger smoothly expands/collapses with the chevron rotating; focus rings are visible when tabbing through triggers and Start/Mark complete buttons.

- [ ] **Step 5: Commit**

```bash
git add components/ItemRow.tsx components/ItemSection.tsx components/Dashboard.tsx
git commit -m "Add item section/row components using shadcn Card/Badge/Accordion"
```

---

## Task 20: Quick-Add Form & Settings Page

**Files:**
- Create: `components/QuickAddForm.tsx`
- Create: `app/settings/page.tsx`
- Create: `components/SettingsForm.tsx`
- Modify: `components/Dashboard.tsx`: render `<QuickAddForm>` after the three sections.

**Interfaces:**
- Consumes: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` from `@/components/ui/form`; `Input` from `@/components/ui/input`; `Button` from `@/components/ui/button`; `Card`, `CardContent` from `@/components/ui/card`; `getAllSettings` from `lib/settings-repo.ts`; `SETTINGS_KEYS`, `DEFAULT_STALE_DAYS` from `lib/config.ts`; `db` from `lib/db-instance.ts`.
- Produces: `<QuickAddForm onSubmit={(input: { title: string; category?: string; dueDate?: string }) => void} />`; `<SettingsForm initialSettings={Record<string, string>} />` consumed by `app/settings/page.tsx`.

No automated test — visual components, verified manually in Task 22.

- [ ] **Step 1: Create `components/QuickAddForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const quickAddSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional(),
  dueDate: z.string().optional(),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

interface Props {
  onSubmit: (input: { title: string; category?: string; dueDate?: string }) => void;
}

export default function QuickAddForm({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const form = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '', category: '', dueDate: '' },
  });

  function handleSubmit(values: QuickAddValues) {
    onSubmit({ title: values.title, category: values.category || undefined, dueDate: values.dueDate || undefined });
    form.reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" className="border-dashed" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Add ad-hoc item
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Due date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Add</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire the form into `components/Dashboard.tsx`**

Add the import:
```tsx
import QuickAddForm from './QuickAddForm';
```

Insert after the three `<ItemSection>` elements:
```tsx
      <QuickAddForm onSubmit={handleQuickAdd} />
```

- [ ] **Step 3: Create `app/settings/page.tsx`**

```tsx
import SettingsForm from '@/components/SettingsForm';
import { db } from '@/lib/db-instance';
import { getAllSettings } from '@/lib/settings-repo';

export default function SettingsPage() {
  const settings = getAllSettings(db);
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsForm initialSettings={settings} />
    </main>
  );
}
```

- [ ] **Step 4: Create `components/SettingsForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from '@/lib/config';

const settingsSchema = z.object({
  [SETTINGS_KEYS.githubPat]: z.string().optional(),
  [SETTINGS_KEYS.adoPat]: z.string().optional(),
  [SETTINGS_KEYS.adoOrg]: z.string().optional(),
  [SETTINGS_KEYS.adoProject]: z.string().optional(),
  [SETTINGS_KEYS.staleDays]: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface Props {
  initialSettings: Record<string, string>;
}

export default function SettingsForm({ initialSettings }: Props) {
  const [saved, setSaved] = useState(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      [SETTINGS_KEYS.githubPat]: initialSettings[SETTINGS_KEYS.githubPat] ?? '',
      [SETTINGS_KEYS.adoPat]: initialSettings[SETTINGS_KEYS.adoPat] ?? '',
      [SETTINGS_KEYS.adoOrg]: initialSettings[SETTINGS_KEYS.adoOrg] ?? '',
      [SETTINGS_KEYS.adoProject]: initialSettings[SETTINGS_KEYS.adoProject] ?? '',
      [SETTINGS_KEYS.staleDays]: initialSettings[SETTINGS_KEYS.staleDays] ?? String(DEFAULT_STALE_DAYS),
    },
  });

  async function handleSubmit(values: SettingsValues) {
    await fetch('/api/settings', { method: 'POST', body: JSON.stringify(values) });
    setSaved(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.githubPat}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub personal access token</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.adoPat}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Azure DevOps personal access token</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.adoOrg}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Azure DevOps organization</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.adoProject}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Azure DevOps project</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.staleDays}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stale PR threshold (days)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`
Expected: clicking "Add ad-hoc item" reveals the form in a card; submitting an empty title shows the Zod validation message inline instead of submitting; a valid submission adds the item and closes the form. Open `http://localhost:3000/settings`: form renders with masked PAT fields and default stale-days value; saving shows "Saved." and persists across reload.

- [ ] **Step 6: Commit**

```bash
git add components/QuickAddForm.tsx components/Dashboard.tsx app/settings/page.tsx components/SettingsForm.tsx
git commit -m "Add quick-add and settings forms using shadcn Form + zod validation"
```

---

## Task 21: End-to-End Manual Verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (db, items-repo, time-logs-repo, settings-repo, scoring, sprint, github-client, ado-client, sync, and all API route tests).

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Configure real credentials**

Run: `npm run dev`, open `http://localhost:3000/settings`, enter a real GitHub PAT (read-only scopes: `repo`, `read:user`) and Azure DevOps PAT + org + project, click Save.

- [ ] **Step 4: Exercise the golden path**

On the dashboard, click **Refresh**. Confirm:
- The button shows a spinner and is disabled while syncing.
- Items from GitHub (mentions, review requests, your own approved/stale PRs) and Azure DevOps (assigned work items, mentions) appear, grouped and ordered by urgency, with badges reflecting the reason (indigo "Ready to merge" badge, red/destructive "Stale — no reviews" badge, etc.).
- The sprint header shows the real iteration name, "N/M done" text, and a matching progress bar.

- [ ] **Step 5: Exercise item actions**

Click **Start** on an item — confirm it moves to "In progress". Click **Mark complete** — confirm it disappears from view and a Sonner toast appears with an **Undo** action; clicking it within 5 seconds restores the item to "In progress". Add an ad-hoc item via the quick-add form and confirm it appears in the correct section based on its score.

- [ ] **Step 6: Exercise error handling**

Temporarily set an invalid value for the GitHub PAT in Settings, click **Refresh**, and confirm the GitHub error banner appears while Azure DevOps items still load successfully (independent per-source failure, per the spec's Error Handling section).

- [ ] **Step 7: Verify theming and accessibility**

Confirm the dashboard loads in dark mode by default (Inter font, indigo accent on primary buttons/badges/progress bar) and that the theme toggle in the header switches to a fully readable light mode and back. Tab through the page with the keyboard and confirm every interactive element (buttons, form fields, collapsible triggers) shows a visible focus ring — this comes from the Radix/shadcn primitives by default, so its absence would indicate a regression (e.g. a custom `outline-none` override).

- [ ] **Step 8: Final commit**

If any fixes were needed during manual verification, commit them individually with descriptive messages before considering the plan complete.
