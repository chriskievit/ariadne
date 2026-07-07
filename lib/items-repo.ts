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
    adoStatus: row.ado_status,
    prStatus: row.pr_status,
    repo: row.repo,
  };
}

export function upsertSyncedItem(db: Database.Database, input: NewSyncedItemInput): Item {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO items (source, external_id, title, url, reason, due_date, sprint_iteration, raw_updated_at, ado_status, pr_status, repo, status, created_at)
     VALUES (@source, @externalId, @title, @url, @reason, @dueDate, @sprintIteration, @rawUpdatedAt, @adoStatus, @prStatus, @repo, 'inbox', @now)
     ON CONFLICT(source, external_id) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       reason = excluded.reason,
       due_date = excluded.due_date,
       sprint_iteration = excluded.sprint_iteration,
       raw_updated_at = excluded.raw_updated_at,
       ado_status = excluded.ado_status,
       pr_status = excluded.pr_status,
       repo = excluded.repo`
  ).run({ ...input, adoStatus: input.adoStatus ?? null, prStatus: input.prStatus ?? null, repo: input.repo ?? null, now });

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

export function deleteItem(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}
