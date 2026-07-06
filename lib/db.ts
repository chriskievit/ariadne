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
  ado_status TEXT,
  pr_status TEXT,
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

function sleepSync(ms: number): void {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function isSqliteBusy(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'SQLITE_BUSY';
}

function isDuplicateColumnError(err: unknown): boolean {
  return err instanceof Error && /duplicate column name/i.test(err.message);
}

// Attempts the ALTER unconditionally, tolerating the column already being
// present. This is what makes losing a concurrent migration race harmless
// instead of fatal -- see addColumnIfMissing for why that race happens.
export function addColumnTolerant(db: Database.Database, table: string, column: string, type: string): void {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (err) {
    if (!isDuplicateColumnError(err)) throw err;
  }
}

// Adds `column` to `table` unless it's already present. The existence check
// and the ALTER aren't atomic across separate connections, so this also
// tolerates losing a race to another connection that added the column in
// between: Next.js's build-time page-data collection imports every API
// route module -- and therefore this module -- independently, so multiple
// unrelated openDb() calls can run this same migration concurrently against
// the same on-disk file.
function addColumnIfMissing(db: Database.Database, table: string, column: string, type: string): void {
  const exists = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
    (col) => col.name === column
  );
  if (!exists) addColumnTolerant(db, table, column, type);
}

// Opening a brand-new database file and switching it to WAL mode is not fully
// covered by `busy_timeout` when multiple processes race to initialize the
// same file concurrently (e.g. Next.js's parallel build-time page-data
// collection, which imports every API route module, and therefore this
// module, at once). Retry the one-time setup on SQLITE_BUSY so cold starts
// are reliable regardless of how many processes open the file simultaneously.
export function openDb(path: string): Database.Database {
  const maxAttempts = 10;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const db = new Database(path);
      db.pragma('busy_timeout = 5000');
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(SCHEMA_SQL);

      addColumnIfMissing(db, 'items', 'ado_status', 'TEXT');
      addColumnIfMissing(db, 'items', 'pr_status', 'TEXT');

      return db;
    } catch (err) {
      lastError = err;
      if (!isSqliteBusy(err) || attempt === maxAttempts) {
        throw err;
      }
      sleepSync(25 * attempt);
    }
  }

  throw lastError;
}
