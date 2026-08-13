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
    hasUnresolvedConversations: !!row.has_unresolved_conversations,
  };
}

function replaceItemLinks(db: Database.Database, prItemId: number, adoExternalIds: string[]): void {
  db.prepare('DELETE FROM item_links WHERE pr_item_id = ?').run(prItemId);
  const insert = db.prepare('INSERT INTO item_links (pr_item_id, ado_external_id) VALUES (?, ?)');
  for (const adoExternalId of adoExternalIds) insert.run(prItemId, adoExternalId);
}

export function upsertSyncedItem(db: Database.Database, input: NewSyncedItemInput): Item {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO items (source, external_id, title, url, reason, due_date, sprint_iteration, raw_updated_at, ado_status, pr_status, repo, has_unresolved_conversations, status, created_at)
     VALUES (@source, @externalId, @title, @url, @reason, @dueDate, @sprintIteration, @rawUpdatedAt, @adoStatus, @prStatus, @repo, @hasUnresolvedConversations, 'inbox', @now)
     ON CONFLICT(source, external_id) DO UPDATE SET
       title = excluded.title,
       url = excluded.url,
       reason = excluded.reason,
       due_date = excluded.due_date,
       sprint_iteration = excluded.sprint_iteration,
       raw_updated_at = excluded.raw_updated_at,
       ado_status = excluded.ado_status,
       pr_status = excluded.pr_status,
       repo = excluded.repo,
       has_unresolved_conversations = excluded.has_unresolved_conversations`
  ).run({
    ...input,
    adoStatus: input.adoStatus ?? null,
    prStatus: input.prStatus ?? null,
    repo: input.repo ?? null,
    hasUnresolvedConversations: input.hasUnresolvedConversations ? 1 : 0,
    now,
  });

  const row = db.prepare('SELECT * FROM items WHERE source = ? AND external_id = ?').get(input.source, input.externalId);
  const item = rowToItem(row);

  if (input.source === 'github_pr' && input.linkedAdoExternalIds) {
    replaceItemLinks(db, item.id, input.linkedAdoExternalIds);
  }

  return item;
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

export function getOpenGithubPrCandidates(db: Database.Database): { id: number; externalId: string }[] {
  return db
    .prepare(
      `SELECT id, external_id FROM items WHERE source = 'github_pr' AND status != 'done' AND (pr_status IS NULL OR pr_status != 'merged')`
    )
    .all()
    .map((row: any) => ({ id: row.id, externalId: row.external_id }));
}

export function setPrStatus(db: Database.Database, id: number, prStatus: Item['prStatus']): void {
  db.prepare('UPDATE items SET pr_status = ? WHERE id = ?').run(prStatus, id);
}

export function deleteItem(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
}
