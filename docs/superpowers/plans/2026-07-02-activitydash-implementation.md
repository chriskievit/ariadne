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
- Light and dark mode are both built in from the start using Tailwind semantic classes, not retrofitted (UX review).
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
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(['items', 'settings', 'sync_log', 'time_logs']);
    db.close();
  });
});
```

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
    createAdhocItem(db, { title: 'Reply to Sarah' });
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
      if (url.includes('author:chris')) {
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
      if (url.includes('review-requested:chris')) return jsonResponse({ items: [] });
      if (url.includes('mentions:chris')) return jsonResponse({ items: [] });
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
      if (url.includes('author:chris')) {
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
      if (url.includes('review-requested:chris')) return jsonResponse({ items: [] });
      if (url.includes('mentions:chris')) return jsonResponse({ items: [] });
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
      if (url.includes('author:chris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested:chris')) return jsonResponse({ items: [prPayload] });
      if (url.includes('mentions:chris')) return jsonResponse({ items: [prPayload] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('review_requested');
  });
});
```

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

## Task 13: API Route — `/api/items` (list + create)

**Files:**
- Create: `app/api/items/route.ts`
- Test: `app/api/items/route.test.ts`

**Interfaces:**
- Consumes: `listItems`, `createAdhocItem` from `lib/items-repo.ts`; `getSetting` from `lib/settings-repo.ts`; `sortByUrgency` from `lib/scoring.ts`; `SETTINGS_KEYS`, `NEEDS_ATTENTION_THRESHOLD` from `lib/config.ts`; `db` from `lib/db-instance.ts`.
- Produces: `GET(): Promise<Response>` returns `{ needsAttention, inProgress, everythingElse }` (each an array of `Item & { score: number }`); `POST(request: Request): Promise<Response>` creates an ad-hoc item, returns it with status 201.

- [ ] **Step 1: Write the failing tests**

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
  it('groups items into needsAttention, inProgress, and everythingElse', async () => {
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
    const low = upsertSyncedItem(testDb, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Backlog item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    const active = upsertSyncedItem(testDb, {
      source: 'ado_workitem',
      externalId: '102',
      title: 'In flight',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    setStatus(testDb, active.id, 'in_progress');

    const res = await GET();
    const body = await res.json();
    expect(body.needsAttention.map((i: any) => i.id)).toEqual([urgent.id]);
    expect(body.inProgress.map((i: any) => i.id)).toEqual([active.id]);
    expect(body.everythingElse.map((i: any) => i.id)).toEqual([low.id]);
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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/items/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `app/api/items/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { listItems, createAdhocItem } from '@/lib/items-repo';
import { getSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS, NEEDS_ATTENTION_THRESHOLD } from '@/lib/config';
import { sortByUrgency } from '@/lib/scoring';

export async function GET() {
  const items = listItems(db);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), new Date());

  const needsAttention = scored.filter((i) => i.status === 'inbox' && i.score >= NEEDS_ATTENTION_THRESHOLD);
  const inProgress = scored.filter((i) => i.status === 'in_progress');
  const everythingElse = scored.filter((i) => i.status === 'inbox' && i.score < NEEDS_ATTENTION_THRESHOLD);

  return NextResponse.json({ needsAttention, inProgress, everythingElse });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title: string; category?: string; dueDate?: string };
  const item = createAdhocItem(db, body);
  return NextResponse.json(item, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/items/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/items/route.ts app/api/items/route.test.ts
git commit -m "Add /api/items route with scored grouping and ad-hoc creation"
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

## Task 16: App Shell & Dashboard Wiring

**Files:**
- Create: `lib/api-client.ts`
- Modify: `app/page.tsx` (replace Task 1 placeholder)
- Create: `components/Dashboard.tsx`

**Interfaces:**
- Consumes: `listItems` from `lib/items-repo.ts`; `getSprintProgress` from `lib/sprint.ts`; `sortByUrgency` from `lib/scoring.ts`; `SETTINGS_KEYS`, `NEEDS_ATTENTION_THRESHOLD` from `lib/config.ts`; `db` from `lib/db-instance.ts`.
- Produces: `fetchDashboardData()`, `triggerSync()`, `startItem(id)`, `completeItem(id, options)`, `undoItem(id)`, `createAdhocItemRequest(input)` from `lib/api-client.ts`; `<Dashboard initialData={...} />` component consumed by `app/page.tsx`. `DashboardData` shape: `{ needsAttention, inProgress, everythingElse: (Item & { score: number })[]; sprint: SprintProgress }`.

This task has no automated test — it is UI wiring, verified manually in Task 21 per the spec's testing approach (pure logic gets unit tests; UI is manually verified).

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
import { listItems } from '@/lib/items-repo';
import { getSprintProgress } from '@/lib/sprint';
import { NEEDS_ATTENTION_THRESHOLD } from '@/lib/config';
import { sortByUrgency } from '@/lib/scoring';

export default function Page() {
  const items = listItems(db);
  const sprint = getSprintProgress(db);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd: sprint.endDate })), new Date());

  const initialData = {
    needsAttention: scored.filter((i) => i.status === 'inbox' && i.score >= NEEDS_ATTENTION_THRESHOLD),
    inProgress: scored.filter((i) => i.status === 'in_progress'),
    everythingElse: scored.filter((i) => i.status === 'inbox' && i.score < NEEDS_ATTENTION_THRESHOLD),
    sprint,
  };

  return <Dashboard initialData={initialData} />;
}
```

- [ ] **Step 3: Create the Client Component shell**

`components/Dashboard.tsx`:
```tsx
'use client';

import { useState } from 'react';
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
  const [undoItemId, setUndoItemId] = useState<number | null>(null);

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
    setUndoItemId(id);
    setTimeout(() => setUndoItemId((current) => (current === id ? null : current)), 5000);
    await refresh();
  }

  async function handleUndo(id: number) {
    await undoItem(id);
    setUndoItemId(null);
    await refresh();
  }

  async function handleQuickAdd(input: { title: string; category?: string; dueDate?: string }) {
    await createAdhocItemRequest(input);
    await refresh();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <p className="text-sm text-slate-500">Dashboard shell — sections added in Tasks 17-19.</p>
    </main>
  );
}
```

This placeholder body is intentionally minimal — Task 17 adds `SprintProgressHeader`, Task 18 adds the item sections, and Task 19 adds quick-add and the undo toast, each wired to the handlers already defined here.

- [ ] **Step 4: Verify it compiles and renders**

Run: `npm run build`
Expected: build succeeds with no type errors.
Run: `npm run dev`, open `http://localhost:3000`
Expected: page renders "Dashboard shell — sections added in Tasks 17-19." with no console errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts app/page.tsx components/Dashboard.tsx
git commit -m "Wire dashboard page: server-fetched initial data + client shell"
```

---

## Task 17: Sprint Progress Header

**Files:**
- Create: `components/SprintProgressHeader.tsx`
- Modify: `components/Dashboard.tsx:` render `<SprintProgressHeader>` inside the returned JSX, replacing the placeholder paragraph.

**Interfaces:**
- Consumes: `SprintProgress` from `lib/sprint.ts`.
- Produces: `<SprintProgressHeader sprint={SprintProgress} onRefresh={() => void} syncing={boolean} errors={string[]} />`.

No automated test — visual component, verified manually in Task 21.

- [ ] **Step 1: Create `components/SprintProgressHeader.tsx`**

```tsx
'use client';

import { RefreshCw } from 'lucide-react';
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
    <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{sprint.name ?? 'No active sprint'}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {sprint.completedCount}/{sprint.totalCount} done
            {daysRemaining !== null ? ` · ${daysRemaining} days remaining` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={syncing}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
          {syncing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
      </div>
      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </header>
  );
}
```

The percentage bar is a supplementary visual — the "N/M done" text above it is always present regardless of whether `totalCount` is 0, satisfying the no-color-alone requirement from the spec's UI Layout section.

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
Expected: header renders with "0/0 done" (no data yet), Refresh button clickable, no console errors.

- [ ] **Step 4: Commit**

```bash
git add components/SprintProgressHeader.tsx components/Dashboard.tsx
git commit -m "Add sprint progress header with text-labeled completion and loading state"
```

---

## Task 18: Item Section & Item Row

**Files:**
- Create: `components/ItemRow.tsx`
- Create: `components/ItemSection.tsx`
- Modify: `components/Dashboard.tsx`: render three `<ItemSection>`s in place of the placeholder paragraph (alongside the header from Task 17).

**Interfaces:**
- Consumes: `Item` from `lib/types.ts`.
- Produces: `<ItemRow item={Item & { score: number }} onStart?={(id) => void} onComplete={(id, durationMinutes?) => void} />`; `<ItemSection title={string} items={(Item & { score: number })[]} emptyMessage={string} collapsedByDefault?={boolean} onStart?={...} onComplete={...} />`.

No automated test — visual components, verified manually in Task 21.

- [ ] **Step 1: Create `components/ItemRow.tsx`**

```tsx
'use client';

import { Github, ClipboardList, MessageSquare } from 'lucide-react';
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
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
              {item.title}
            </a>
          ) : (
            <span className="truncate font-medium">{item.title}</span>
          )}
          <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {REASON_LABEL[item.reason]}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {item.status !== 'in_progress' && onStart && (
          <button
            type="button"
            onClick={() => onStart(item.id)}
            className="cursor-pointer rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Start
          </button>
        )}
        <button
          type="button"
          onClick={() => onComplete(item.id)}
          className="cursor-pointer rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          Mark complete
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/ItemSection.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ItemRow from './ItemRow';
import type { Item } from '@/lib/types';

interface Props {
  title: string;
  items: (Item & { score: number })[];
  emptyMessage: string;
  collapsedByDefault?: boolean;
  onStart?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number) => void;
}

export default function ItemSection({ title, items, emptyMessage, collapsedByDefault, onStart, onComplete }: Props) {
  const [collapsed, setCollapsed] = useState(Boolean(collapsedByDefault));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between rounded-md text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <h2 className="font-semibold">
          {title} <span className="text-sm font-normal text-slate-400">({items.length})</span>
        </h2>
        {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {!collapsed &&
        (items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        ) : (
          <div className="mt-3">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onStart={onStart} onComplete={onComplete} />
            ))}
          </div>
        ))}
    </section>
  );
}
```

- [ ] **Step 3: Wire both into `components/Dashboard.tsx`**

Add the import:
```tsx
import ItemSection from './ItemSection';
```

Insert after `<SprintProgressHeader ... />`:
```tsx
      <ItemSection
        title="Needs attention"
        items={data.needsAttention}
        emptyMessage="You're all caught up."
        onStart={handleStart}
        onComplete={handleComplete}
      />
      <ItemSection
        title="In progress"
        items={data.inProgress}
        emptyMessage="Nothing in progress — start something above."
        onComplete={handleComplete}
      />
      <ItemSection
        title="Everything else"
        items={data.everythingElse}
        emptyMessage="Nothing else queued."
        collapsedByDefault
        onStart={handleStart}
        onComplete={handleComplete}
      />
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`
Expected: three sections render, each showing its empty-state message since the database is empty; "Everything else" starts collapsed.

- [ ] **Step 5: Commit**

```bash
git add components/ItemRow.tsx components/ItemSection.tsx components/Dashboard.tsx
git commit -m "Add item section/row components with reason badges and empty states"
```

---

## Task 19: Quick-Add Form & Undo Toast

**Files:**
- Create: `components/QuickAddForm.tsx`
- Modify: `components/Dashboard.tsx`: render `<QuickAddForm>` after the three sections, and render the undo toast when `undoItemId` is set.

**Interfaces:**
- Consumes: none beyond React.
- Produces: `<QuickAddForm onSubmit={(input: { title: string; category?: string; dueDate?: string }) => void} />`.

No automated test — visual components, verified manually in Task 21.

- [ ] **Step 1: Create `components/QuickAddForm.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  onSubmit: (input: { title: string; category?: string; dueDate?: string }) => void;
}

export default function QuickAddForm({ onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), category: category || undefined, dueDate: dueDate || undefined });
    setTitle('');
    setCategory('');
    setDueDate('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Add ad-hoc item
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <label htmlFor="quick-add-title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="quick-add-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="quick-add-category" className="block text-sm font-medium">
            Category
          </label>
          <input
            id="quick-add-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="quick-add-due" className="block text-sm font-medium">
            Due date (optional)
          </label>
          <input
            id="quick-add-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="cursor-pointer rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire the form and the undo toast into `components/Dashboard.tsx`**

Add the import:
```tsx
import QuickAddForm from './QuickAddForm';
```

Insert after the three `<ItemSection>` elements, replacing nothing else:
```tsx
      <QuickAddForm onSubmit={handleQuickAdd} />
      {undoItemId !== null && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          Marked complete.
          <button type="button" className="cursor-pointer font-semibold underline" onClick={() => handleUndo(undoItemId)}>
            Undo
          </button>
        </div>
      )}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `http://localhost:3000`
Expected: clicking "Add ad-hoc item" reveals the form; submitting a title adds it to "Needs attention" or "Everything else" depending on score, and clears the form. Clicking "Mark complete" on any item shows the undo toast for 5 seconds; clicking "Undo" within that window reverts the item to "In progress".

- [ ] **Step 4: Commit**

```bash
git add components/QuickAddForm.tsx components/Dashboard.tsx
git commit -m "Add quick-add form and undo-over-confirm toast for completions"
```

---

## Task 20: Settings Page

**Files:**
- Create: `app/settings/page.tsx`
- Create: `components/SettingsForm.tsx`

**Interfaces:**
- Consumes: `getAllSettings` from `lib/settings-repo.ts`; `db` from `lib/db-instance.ts`; `SETTINGS_KEYS`, `DEFAULT_STALE_DAYS` from `lib/config.ts`.
- Produces: `<SettingsForm initialSettings={Record<string, string>} />` consumed by `app/settings/page.tsx`.

No automated test — visual component, verified manually in Task 21.

- [ ] **Step 1: Create `app/settings/page.tsx`**

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

- [ ] **Step 2: Create `components/SettingsForm.tsx`**

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from '@/lib/config';

interface Props {
  initialSettings: Record<string, string>;
}

export default function SettingsForm({ initialSettings }: Props) {
  const [values, setValues] = useState<Record<string, string>>({
    [SETTINGS_KEYS.githubPat]: initialSettings[SETTINGS_KEYS.githubPat] ?? '',
    [SETTINGS_KEYS.adoPat]: initialSettings[SETTINGS_KEYS.adoPat] ?? '',
    [SETTINGS_KEYS.adoOrg]: initialSettings[SETTINGS_KEYS.adoOrg] ?? '',
    [SETTINGS_KEYS.adoProject]: initialSettings[SETTINGS_KEYS.adoProject] ?? '',
    [SETTINGS_KEYS.staleDays]: initialSettings[SETTINGS_KEYS.staleDays] ?? String(DEFAULT_STALE_DAYS),
  });
  const [saved, setSaved] = useState(false);

  function update(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await fetch('/api/settings', { method: 'POST', body: JSON.stringify(values) });
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="GitHub personal access token" value={values[SETTINGS_KEYS.githubPat]} onChange={(v) => update(SETTINGS_KEYS.githubPat, v)} masked />
      <Field label="Azure DevOps personal access token" value={values[SETTINGS_KEYS.adoPat]} onChange={(v) => update(SETTINGS_KEYS.adoPat, v)} masked />
      <Field label="Azure DevOps organization" value={values[SETTINGS_KEYS.adoOrg]} onChange={(v) => update(SETTINGS_KEYS.adoOrg, v)} />
      <Field label="Azure DevOps project" value={values[SETTINGS_KEYS.adoProject]} onChange={(v) => update(SETTINGS_KEYS.adoProject, v)} />
      <Field label="Stale PR threshold (days)" value={values[SETTINGS_KEYS.staleDays]} onChange={(v) => update(SETTINGS_KEYS.staleDays, v)} type="number" />
      <div className="flex items-center gap-3">
        <button type="submit" className="cursor-pointer rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Save
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved.</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  masked,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input
        type={masked ? 'password' : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
      />
    </div>
  );
}
```

- [ ] **Step 3: Add a Settings link to the dashboard header**

In `components/SprintProgressHeader.tsx`, add next to the Refresh button (inside the same flex container, after the `<button>`):
```tsx
        <a
          href="/settings"
          className="ml-2 text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          Settings
        </a>
```

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `http://localhost:3000/settings`
Expected: form renders with empty/default fields; entering values and clicking Save shows "Saved."; reloading the page shows the saved values persisted (PAT fields masked). Clicking "Settings" from the dashboard header navigates here.

- [ ] **Step 5: Commit**

```bash
git add app/settings/page.tsx components/SettingsForm.tsx components/SprintProgressHeader.tsx
git commit -m "Add settings page for GitHub/Azure DevOps configuration"
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
- Items from GitHub (mentions, review requests, your own approved/stale PRs) and Azure DevOps (assigned work items, mentions) appear, grouped and ordered by urgency.
- The sprint header shows the real iteration name, "N/M done", and days remaining.

- [ ] **Step 5: Exercise item actions**

Click **Start** on an item — confirm it moves to "In progress". Click **Mark complete** — confirm it disappears from view, the undo toast appears, and clicking **Undo** within 5 seconds restores it to "In progress". Add an ad-hoc item via the quick-add form and confirm it appears in the correct section based on its score.

- [ ] **Step 6: Exercise error handling**

Temporarily set an invalid value for the GitHub PAT in Settings, click **Refresh**, and confirm the GitHub error banner appears while Azure DevOps items still load successfully (independent per-source failure, per the spec's Error Handling section).

- [ ] **Step 7: Verify dark mode**

Toggle the OS/browser color scheme to dark and confirm the dashboard and settings page both render with adequate contrast (no unreadable text, borders still visible) — this is the built-in `media` dark mode strategy from Task 1, not a runtime toggle.

- [ ] **Step 8: Final commit**

If any fixes were needed during manual verification, commit them individually with descriptive messages before considering the plan complete.

