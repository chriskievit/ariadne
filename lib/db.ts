import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { adoStatusCategory } from './sources/ado-state';

// The one definition of the items table, used by SCHEMA_SQL for a fresh file
// and by migrateItemsToSourceShape for the rebuild of an old one, so the two
// can never disagree.
const ITEMS_TABLE_BODY = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('github_pr','ado_workitem','jira_issue','adhoc')),
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
  upstream_status TEXT,
  status_category TEXT CHECK (status_category IS NULL OR status_category IN ('todo','in_progress','done')),
  pr_status TEXT,
  repo TEXT,
  has_unresolved_conversations INTEGER,
  priority TEXT CHECK (priority IS NULL OR priority IN ('low','medium','high')),
  priority_set_at TEXT,
  parked INTEGER,
  today_date TEXT,
  starred INTEGER,
  snoozed_until TEXT,
  triage_state TEXT,
  woke_early INTEGER,
  UNIQUE(source, external_id)
)`;

// Columns copied verbatim by the rebuild. upstream_status (from ado_status),
// status_category (backfilled) and priority (sanitised) are handled apart.
const ITEMS_COPIED_COLUMNS = [
  'id', 'source', 'external_id', 'title', 'url', 'reason', 'category', 'due_date', 'sprint_iteration',
  'raw_updated_at', 'status', 'created_at', 'completed_at', 'pr_status', 'repo',
  'has_unresolved_conversations', 'priority_set_at', 'parked', 'today_date', 'starred',
  'snoozed_until', 'triage_state', 'woke_early',
].join(', ');

const ITEM_LINKS_TABLE_BODY = `(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_item_id INTEGER NOT NULL REFERENCES items(id),
  target_source TEXT NOT NULL CHECK (target_source IN ('ado_workitem','jira_issue')),
  target_external_id TEXT NOT NULL,
  UNIQUE(pr_item_id, target_source, target_external_id)
)`;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS items ${ITEMS_TABLE_BODY};

CREATE TABLE IF NOT EXISTS item_links ${ITEM_LINKS_TABLE_BODY};

CREATE TABLE IF NOT EXISTS time_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_hours REAL,
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

CREATE TABLE IF NOT EXISTS plans (
  date TEXT PRIMARY KEY,
  capacity_minutes INTEGER NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS plan_items (
  plan_date TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER NOT NULL,
  estimate_minutes INTEGER,
  PRIMARY KEY (plan_date, item_id)
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id),
  agent TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'launching',
  launch_token TEXT NOT NULL UNIQUE,
  agent_session_id TEXT,
  transcript_path TEXT,
  cwd TEXT,
  git_branch TEXT,
  model TEXT,
  tab_title TEXT NOT NULL,
  tab_color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  registered_at TEXT,
  last_event_at TEXT,
  ended_at TEXT,
  end_reason TEXT,
  last_message TEXT,
  needs_you_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_item ON agent_sessions(item_id);
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

function isMissingColumnError(err: unknown): boolean {
  return err instanceof Error && /no such column/i.test(err.message);
}

// Converts a pre-migration time_logs table (duration_minutes) to the current
// schema (duration_hours), backfilling existing rows. Guarded by checking
// for duration_minutes first so this is a no-op on both fresh databases
// (which never had that column) and already-migrated ones.
function migrateTimeLogsToHours(db: Database.Database): void {
  const hasMinutesColumn = (db.prepare('PRAGMA table_info(time_logs)').all() as { name: string }[]).some(
    (col) => col.name === 'duration_minutes'
  );
  if (!hasMinutesColumn) return;

  addColumnIfMissing(db, 'time_logs', 'duration_hours', 'REAL');
  db.exec(
    'UPDATE time_logs SET duration_hours = duration_minutes / 60.0 WHERE duration_hours IS NULL AND duration_minutes IS NOT NULL'
  );

  try {
    db.exec('ALTER TABLE time_logs DROP COLUMN duration_minutes');
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
  }
}

function itemsHasSourceShape(db: Database.Database): boolean {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'items'").get() as
    | { sql: string }
    | undefined;
  return row?.sql.includes('jira_issue') ?? false;
}

// Rebuilds a pre-#97 items table into the source-neutral shape: the source
// CHECK gains jira_issue, ado_status becomes upstream_status, and ADO rows get
// their status_category. SQLite cannot alter a CHECK in place, so this is the
// documented create-copy-drop-rename procedure.
//
// Foreign keys are off for the swap, because four tables reference items(id)
// and DROP TABLE would otherwise fail or cascade. Ids are copied verbatim, so
// every reference still points at the same row afterwards. There is no
// foreign_key_check at the end on purpose: an orphan row that predates the
// migration would fail it, and the app would then never open.
//
// BEGIN IMMEDIATE plus the second guard inside the transaction is what makes
// a concurrent openDb() on the same file harmless: the loser waits for the
// write lock, then sees the new shape and does nothing.
// The rebuild is a one-way table swap on a user's irreplaceable local database,
// so a file-backed one is copied first. VACUUM cannot run inside a transaction,
// hence this runs before it. An existing backup means an earlier attempt or a
// concurrent opener made it, and the older copy is the one worth keeping.
function backUpBeforeItemsRebuild(db: Database.Database): void {
  if (!db.name || db.name === ':memory:') return;
  const backupPath = `${db.name}.pre-source-shape.bak`;
  if (existsSync(backupPath)) return;
  try {
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } catch (err) {
    // Another process can create the file between the check and the VACUUM.
    if (!existsSync(backupPath)) throw err;
  }
}

function migrateItemsToSourceShape(db: Database.Database): void {
  if (itemsHasSourceShape(db)) return;

  backUpBeforeItemsRebuild(db);

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      if (itemsHasSourceShape(db)) return;

      // DROP TABLE removes the old sqlite_sequence row, and the copy only
      // advances the new one to MAX(id). Carrying the old value over keeps a
      // deleted item's id from being handed out again.
      const oldSeq =
        (db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'items'").get() as { seq: number } | undefined)?.seq ?? 0;

      db.exec(`CREATE TABLE items_new ${ITEMS_TABLE_BODY}`);
      // priority was added by ALTER without a CHECK, so an old row can hold a
      // value the new table rejects. It becomes NULL, never a failed open.
      db.exec(
        `INSERT INTO items_new (${ITEMS_COPIED_COLUMNS}, upstream_status, priority)
         SELECT ${ITEMS_COPIED_COLUMNS}, ado_status,
                CASE WHEN priority IN ('low','medium','high') THEN priority END
         FROM items`
      );

      const adoRows = db
        .prepare("SELECT id, upstream_status FROM items_new WHERE source = 'ado_workitem' AND upstream_status IS NOT NULL")
        .all() as { id: number; upstream_status: string }[];
      const setCategory = db.prepare('UPDATE items_new SET status_category = ? WHERE id = ?');
      for (const row of adoRows) setCategory.run(adoStatusCategory(row.upstream_status), row.id);

      db.exec('DROP TABLE items');
      db.exec('ALTER TABLE items_new RENAME TO items');
      // BigInt, because a JS number binds as REAL and seq would become 57602.0.
      db.prepare("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'items'").run(BigInt(oldSeq));
    }).immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function itemLinksHasTargetSource(db: Database.Database): boolean {
  return (db.prepare('PRAGMA table_info(item_links)').all() as { name: string }[]).some((c) => c.name === 'target_source');
}

// item_links used to point only at ADO work items. Every existing row is one,
// so it migrates as target_source 'ado_workitem'. Same guard-twice and
// BEGIN IMMEDIATE pattern as migrateItemsToSourceShape.
//
// Foreign keys are off for the copy because item_links itself references
// items(id): an orphan row from before foreign keys were enforced would make
// the INSERT throw, and the app would then never open. The rows are kept as
// they are. The sqlite_sequence of item_links is not carried over, which is
// harmless because nothing references item_links.id.
function migrateItemLinksToTargets(db: Database.Database): void {
  if (itemLinksHasTargetSource(db)) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      if (itemLinksHasTargetSource(db)) return;
      db.exec(`CREATE TABLE item_links_new ${ITEM_LINKS_TABLE_BODY}`);
      db.exec(
        `INSERT INTO item_links_new (id, pr_item_id, target_source, target_external_id)
         SELECT id, pr_item_id, 'ado_workitem', ado_external_id FROM item_links`
      );
      db.exec('DROP TABLE item_links');
      db.exec('ALTER TABLE item_links_new RENAME TO item_links');
    }).immediate();
  } finally {
    db.pragma('foreign_keys = ON');
  }
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

      // Only an old-shape table needs ado_status: the rebuild below reads it.
      // A fresh or migrated table has upstream_status instead.
      if (!itemsHasSourceShape(db)) addColumnIfMissing(db, 'items', 'ado_status', 'TEXT');
      addColumnIfMissing(db, 'items', 'pr_status', 'TEXT');
      addColumnIfMissing(db, 'items', 'repo', 'TEXT');
      addColumnIfMissing(db, 'items', 'has_unresolved_conversations', 'INTEGER');
      addColumnIfMissing(db, 'items', 'parked', 'INTEGER');
      addColumnIfMissing(db, 'items', 'today_date', 'TEXT');
      addColumnIfMissing(db, 'items', 'starred', 'INTEGER');
      addColumnIfMissing(db, 'items', 'snoozed_until', 'TEXT');
      addColumnIfMissing(db, 'items', 'triage_state', 'TEXT');
      addColumnIfMissing(db, 'items', 'woke_early', 'INTEGER');
      // No CHECK on the added column: SQLite cannot add a constraint to an
      // existing table without a full rebuild, and the value domain is
      // already enforced by setPriority/createAdhocItem.
      addColumnIfMissing(db, 'items', 'priority', 'TEXT');
      addColumnIfMissing(db, 'items', 'priority_set_at', 'TEXT');
      migrateTimeLogsToHours(db);
      migrateItemsToSourceShape(db);
      migrateItemLinksToTargets(db);

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
