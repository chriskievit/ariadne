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
    expect(tables).toEqual(['item_links', 'items', 'settings', 'sync_log', 'time_logs']);
    db.close();
  });

  it('includes the ado_status column on a fresh items table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('ado_status');
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
    expect(columns).toContain('ado_status');
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

  it('includes the item_links table with pr_item_id and ado_external_id columns', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(item_links)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toEqual(expect.arrayContaining(['id', 'pr_item_id', 'ado_external_id']));
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
