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
