import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
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

  it('includes the ado_status column on a fresh items table', () => {
    const db = openDb(':memory:');
    const columns = (db.prepare('PRAGMA table_info(items)').all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain('ado_status');
    db.close();
  });

  it('adds the ado_status column to a pre-existing items table that lacks it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'activitydash-db-test-'));
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
    const dir = mkdtempSync(join(tmpdir(), 'activitydash-db-test-'));
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
});
