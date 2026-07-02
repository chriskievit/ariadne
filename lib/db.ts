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
