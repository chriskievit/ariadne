import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { openDb, addColumnTolerant } from './db';

describe('openDb', () => {
  it('creates all required tables', () => {
    const db = openDb(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((row: any) => row.name);
    expect(tables).toEqual(['agent_sessions', 'item_links', 'items', 'plan_items', 'plans', 'settings', 'sync_log', 'time_logs']);
    db.close();
  });

  it('includes upstream_status and status_category on a fresh items table, and no ado_status', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('upstream_status');
    expect(columns).toContain('status_category');
    expect(columns).not.toContain('ado_status');
    db.close();
  });

  it('adds the ado_status column to a pre-existing items table that lacks it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const path = join(dir, 'legacy.db');

    // Simulate a pre-migration database: an items table without ado_status.
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        external_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        reason TEXT NOT NULL,
        category TEXT,
        due_date TEXT,
        sprint_iteration TEXT,
        raw_updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'inbox',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(source, external_id)
      );
    `);
    legacy.close();

    const db = openDb(path);
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('upstream_status');
    db.close();

    // Reopening an already-migrated database must not error or duplicate the column.
    const reopened = openDb(path);
    reopened.close();

    rmSync(dir, { recursive: true, force: true });
  });

  it('includes the pr_status column on a fresh items table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('pr_status');
    db.close();
  });

  it('adds the pr_status column to a pre-existing items table that lacks it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const path = join(dir, 'legacy.db');

    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        external_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        reason TEXT NOT NULL,
        category TEXT,
        due_date TEXT,
        sprint_iteration TEXT,
        raw_updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'inbox',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        ado_status TEXT,
        UNIQUE(source, external_id)
      );
    `);
    legacy.close();

    const db = openDb(path);
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('pr_status');
    db.close();

    const reopened = openDb(path);
    reopened.close();

    rmSync(dir, { recursive: true, force: true });
  });

  it('includes the parked column on a fresh items table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('parked');
    db.close();
  });

  it('includes the today_date column on a fresh items table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('today_date');
    db.close();
  });

  it('includes the item_links table with pr_item_id, target_source and target_external_id columns', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(item_links)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(['id', 'pr_item_id', 'target_source', 'target_external_id']);
    db.close();
  });
});

describe('items.starred / snoozed_until / triage_state / woke_early migration', () => {
  it('adds all four columns to a fresh database', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('starred');
    expect(columns).toContain('snoozed_until');
    expect(columns).toContain('triage_state');
    expect(columns).toContain('woke_early');
    db.close();
  });

  it('adds all four columns to a pre-existing database that lacks them, without erroring on reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const dbPath = join(dir, 'legacy.db');
    try {
      const legacy = new Database(dbPath);
      legacy.exec(`
        CREATE TABLE items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          external_id TEXT,
          title TEXT NOT NULL,
          url TEXT,
          reason TEXT NOT NULL,
          category TEXT,
          due_date TEXT,
          sprint_iteration TEXT,
          raw_updated_at TEXT,
          status TEXT NOT NULL DEFAULT 'inbox',
          created_at TEXT NOT NULL,
          completed_at TEXT,
          UNIQUE(source, external_id)
        );
      `);
      legacy.close();

      const reopened = openDb(dbPath);
      const columns = (reopened.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
      expect(columns).toContain('starred');
      expect(columns).toContain('snoozed_until');
      expect(columns).toContain('triage_state');
      expect(columns).toContain('woke_early');
      reopened.close();

      expect(() => openDb(dbPath).close()).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('plans / plan_items schema', () => {
  it('creates the plans table with date as primary key', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(plans)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['date', 'capacity_minutes', 'note']));
    db.close();
  });

  it('creates the plan_items table with no time-of-day column', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(plan_items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['plan_date', 'item_id', 'sort_order', 'estimate_minutes']));
    expect(columns).not.toContain('time_of_day');
    expect(columns).not.toContain('scheduled_at');
    expect(columns).not.toContain('start_time');
    db.close();
  });

  it('allows only one plan_items row per (plan_date, item_id)', () => {
    const db = openDb(':memory:');
    db.prepare(
      'INSERT INTO items (source, external_id, title, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('adhoc', null, 'Test', 'manual', 'inbox', new Date().toISOString());
    db.prepare('INSERT INTO plan_items (plan_date, item_id, sort_order) VALUES (?, ?, ?)').run('2026-08-14', 1, 0);
    expect(() =>
      db.prepare('INSERT INTO plan_items (plan_date, item_id, sort_order) VALUES (?, ?, ?)').run('2026-08-14', 1, 1)
    ).toThrow();
    db.close();
  });
});

describe('addColumnTolerant', () => {
  it('adds the column when missing', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY)');
    addColumnTolerant(db, 'widgets', 'color', 'TEXT');
    const columns = (db.prepare('PRAGMA table_info(widgets)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('color');
    db.close();
  });

  it('does not throw when the column already exists, simulating losing a concurrent migration race', () => {
    // Next.js's build-time page-data collection imports every API route
    // module -- and therefore lib/db-instance.ts -- independently, so
    // multiple unrelated openDb() calls can run this same column migration
    // concurrently against the same on-disk file. This reproduces the
    // "duplicate column name" crash a losing connection would hit: the
    // column is already present, but addColumnTolerant attempts the ALTER
    // unconditionally (it has no guard of its own -- that's addColumnIfMissing's
    // job) and must tolerate SQLite rejecting the duplicate add rather than
    // throwing.
    const db = new Database(':memory:');
    db.exec('CREATE TABLE widgets (id INTEGER PRIMARY KEY, color TEXT)');
    expect(() => addColumnTolerant(db, 'widgets', 'color', 'TEXT')).not.toThrow();
    db.close();
  });
});

describe('time_logs duration migration', () => {
  it('creates duration_hours (not duration_minutes) on a fresh time_logs table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(time_logs)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('duration_hours');
    expect(columns).not.toContain('duration_minutes');
    db.close();
  });

  it('converts existing duration_minutes values to duration_hours and drops the old column', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const path = join(dir, 'legacy.db');

    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        external_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        reason TEXT NOT NULL,
        category TEXT,
        due_date TEXT,
        sprint_iteration TEXT,
        raw_updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'inbox',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(source, external_id)
      );
      CREATE TABLE time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_minutes INTEGER,
        note TEXT
      );
    `);
    legacy
      .prepare(
        `INSERT INTO items (source, external_id, title, reason, status, created_at) VALUES ('adhoc', NULL, 'Legacy item', 'manual', 'done', '2026-01-01T00:00:00.000Z')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO time_logs (item_id, started_at, ended_at, duration_minutes, note) VALUES (1, '2026-01-01T00:00:00.000Z', '2026-01-01T01:30:00.000Z', 90, 'legacy note')`
      )
      .run();
    legacy.close();

    const db = openDb(path);
    const columns = (db.prepare('PRAGMA table_info(time_logs)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('duration_hours');
    expect(columns).not.toContain('duration_minutes');

    const row = db.prepare('SELECT * FROM time_logs WHERE item_id = 1').get() as any;
    expect(row.duration_hours).toBe(1.5);
    expect(row.note).toBe('legacy note');
    db.close();

    // Reopening an already-migrated database must not error or re-run destructively.
    const reopened = openDb(path);
    const reopenedRow = reopened.prepare('SELECT * FROM time_logs WHERE item_id = 1').get() as any;
    expect(reopenedRow.duration_hours).toBe(1.5);
    reopened.close();

    rmSync(dir, { recursive: true, force: true });
  });
});

describe('items source-shape migration', () => {
  // An items table as every pre-#97 database has it after the existing
  // addColumnIfMissing migrations ran: ado_status, no upstream_status, the
  // old source CHECK, priority added by ALTER (so without a CHECK).
  function writeOldShapeDb(path: string, seed: (db: Database.Database) => void): void {
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL CHECK (source IN ('github_pr','ado_workitem','adhoc')),
        external_id TEXT,
        title TEXT NOT NULL,
        url TEXT,
        reason TEXT NOT NULL,
        category TEXT,
        due_date TEXT,
        sprint_iteration TEXT,
        raw_updated_at TEXT,
        status TEXT NOT NULL DEFAULT 'inbox',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        ado_status TEXT,
        pr_status TEXT,
        repo TEXT,
        has_unresolved_conversations INTEGER,
        parked INTEGER,
        today_date TEXT,
        starred INTEGER,
        snoozed_until TEXT,
        triage_state TEXT,
        woke_early INTEGER,
        priority TEXT,
        priority_set_at TEXT,
        UNIQUE(source, external_id)
      );
      CREATE TABLE time_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER NOT NULL REFERENCES items(id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        duration_hours REAL,
        note TEXT
      );
    `);
    seed(legacy);
    legacy.close();
  }

  function withTempDb(run: (path: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    try {
      run(join(dir, 'old.db'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const insertItem = `INSERT INTO items (id, source, external_id, title, reason, status, created_at, ado_status, priority)
                      VALUES (?, ?, ?, ?, 'assigned', 'inbox', '2026-09-01T00:00:00.000Z', ?, ?)`;

  it('keeps ids, renames ado_status and backfills status_category for ADO rows', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => {
        db.prepare(insertItem).run(7, 'ado_workitem', '101', 'WI active', 'Active', null);
        db.prepare(insertItem).run(9, 'ado_workitem', '102', 'WI done', 'Done', null);
        db.prepare(insertItem).run(12, 'github_pr', '1@a/b', 'PR', null, null);
        db.prepare("INSERT INTO time_logs (item_id, started_at, duration_hours) VALUES (7, '2026-09-01T09:00:00.000Z', 1.5)").run();
      });

      const db = openDb(path);
      const rows = db.prepare('SELECT id, source, upstream_status, status_category FROM items ORDER BY id').all();
      expect(rows).toEqual([
        { id: 7, source: 'ado_workitem', upstream_status: 'Active', status_category: 'in_progress' },
        { id: 9, source: 'ado_workitem', upstream_status: 'Done', status_category: 'done' },
        { id: 12, source: 'github_pr', upstream_status: null, status_category: null },
      ]);
      const joined = db.prepare('SELECT items.title FROM time_logs JOIN items ON items.id = time_logs.item_id').all();
      expect(joined).toEqual([{ title: 'WI active' }]);
      db.close();
    });
  });

  it('accepts jira_issue as a source after the rebuild', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, () => {});
      const db = openDb(path);
      expect(() =>
        db.prepare("INSERT INTO items (source, external_id, title, reason, status, created_at) VALUES ('jira_issue', 'PLAT-1', 'x', 'assigned', 'inbox', 'now')").run()
      ).not.toThrow();
      db.close();
    });
  });

  it('migrates an ADO row with no state to a null category', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => db.prepare(insertItem).run(1, 'ado_workitem', '101', 'WI', null, null));
      const db = openDb(path);
      expect(db.prepare('SELECT upstream_status, status_category FROM items').get()).toEqual({ upstream_status: null, status_category: null });
      db.close();
    });
  });

  it('nulls a priority the new CHECK would reject instead of refusing to open', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => {
        db.prepare(insertItem).run(1, 'adhoc', null, 'bad', null, 'urgent');
        db.prepare(insertItem).run(2, 'adhoc', null, 'good', null, 'high');
      });
      const db = openDb(path);
      expect(db.prepare('SELECT id, priority FROM items ORDER BY id').all()).toEqual([
        { id: 1, priority: null },
        { id: 2, priority: 'high' },
      ]);
      db.close();
    });
  });

  it('does not let orphan child rows block the migration', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => {
        // Orphans only exist in databases written before foreign keys were
        // enforced, so the seed connection has to switch enforcement off.
        db.pragma('foreign_keys = OFF');
        db.prepare(insertItem).run(1, 'adhoc', null, 'kept', null, null);
        db.prepare("INSERT INTO time_logs (item_id, started_at) VALUES (999, '2026-09-01T09:00:00.000Z')").run();
      });
      expect(() => openDb(path).close()).not.toThrow();
    });
  });

  it('never hands out the id of an item deleted before the migration', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => {
        db.prepare(insertItem).run(1, 'adhoc', null, 'kept', null, null);
        db.prepare(insertItem).run(5, 'adhoc', null, 'deleted later', null, null);
        db.prepare('DELETE FROM items WHERE id = 5').run();
      });
      const db = openDb(path);
      const { lastInsertRowid } = db
        .prepare("INSERT INTO items (source, title, reason, status, created_at) VALUES ('adhoc', 'new', 'manual', 'inbox', 'now')")
        .run();
      expect(Number(lastInsertRowid)).toBe(6);
      db.close();
    });
  });

  it('is a no-op on a second open, and keeps the data', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => db.prepare(insertItem).run(3, 'ado_workitem', '101', 'WI', 'Active', null));
      openDb(path).close();
      const db = openDb(path);
      expect(db.prepare('SELECT id, upstream_status FROM items').all()).toEqual([{ id: 3, upstream_status: 'Active' }]);
      db.close();
    });
  });

  it('migrates while another idle connection holds the file open', () => {
    withTempDb((path) => {
      writeOldShapeDb(path, (db) => db.prepare(insertItem).run(1, 'adhoc', null, 'x', null, null));
      const idle = new Database(path);
      try {
        const db = openDb(path);
        expect(db.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 1 });
        db.close();
      } finally {
        idle.close();
      }
    });
  });
});

describe('item_links target-source migration', () => {
  it('moves existing links to target_source ado_workitem and keeps them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const path = join(dir, 'old-links.db');
    try {
      const fresh = openDb(path);
      fresh.prepare("INSERT INTO items (id, source, external_id, title, reason, status, created_at) VALUES (1, 'github_pr', '1@a/b', 'PR', 'authored', 'inbox', 'now')").run();
      // Recreate the pre-#97 link table by hand on top of a current database.
      fresh.exec(`
        DROP TABLE item_links;
        CREATE TABLE item_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pr_item_id INTEGER NOT NULL REFERENCES items(id),
          ado_external_id TEXT NOT NULL,
          UNIQUE(pr_item_id, ado_external_id)
        );
        INSERT INTO item_links (pr_item_id, ado_external_id) VALUES (1, '101'), (1, '102');
      `);
      fresh.close();

      const db = openDb(path);
      expect(db.prepare('SELECT pr_item_id, target_source, target_external_id FROM item_links ORDER BY target_external_id').all()).toEqual([
        { pr_item_id: 1, target_source: 'ado_workitem', target_external_id: '101' },
        { pr_item_id: 1, target_source: 'ado_workitem', target_external_id: '102' },
      ]);
      db.close();
      openDb(path).close(); // second open is a no-op
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps a link whose PR item no longer exists instead of failing to open', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ariadne-db-test-'));
    const path = join(dir, 'orphan-links.db');
    try {
      const fresh = openDb(path);
      fresh.pragma('foreign_keys = OFF');
      fresh.exec(`
        DROP TABLE item_links;
        CREATE TABLE item_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pr_item_id INTEGER NOT NULL REFERENCES items(id),
          ado_external_id TEXT NOT NULL,
          UNIQUE(pr_item_id, ado_external_id)
        );
        INSERT INTO item_links (pr_item_id, ado_external_id) VALUES (999, '101');
      `);
      fresh.close();

      const db = openDb(path);
      expect(db.prepare('SELECT pr_item_id, target_source, target_external_id FROM item_links').all()).toEqual([
        { pr_item_id: 999, target_source: 'ado_workitem', target_external_id: '101' },
      ]);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
