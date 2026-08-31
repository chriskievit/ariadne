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
    parked: !!row.parked,
    todayDate: row.today_date,
    starred: !!row.starred,
    snoozedUntil: row.snoozed_until,
    triageState: (row.triage_state ?? 'none') as Item['triageState'],
    wokeEarly: !!row.woke_early,
  };
}

function replaceItemLinks(db: Database.Database, prItemId: number, adoExternalIds: string[]): void {
  db.prepare('DELETE FROM item_links WHERE pr_item_id = ?').run(prItemId);
  const insert = db.prepare('INSERT INTO item_links (pr_item_id, ado_external_id) VALUES (?, ?)');
  for (const adoExternalId of adoExternalIds) insert.run(prItemId, adoExternalId);
}

export function upsertSyncedItem(db: Database.Database, input: NewSyncedItemInput): Item {
  const now = new Date().toISOString();
  const before = db
    .prepare('SELECT raw_updated_at, snoozed_until FROM items WHERE source = ? AND external_id = ?')
    .get(input.source, input.externalId) as { raw_updated_at: string | null; snoozed_until: string | null } | undefined;

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

  // A snooze is a promise the item will stay quiet -- new upstream activity
  // breaks that promise, so it wakes the item early rather than silently
  // keeping it hidden. The row is marked woke_early instead of just clearing
  // the snooze, so the surprise is labelled instead of silent.
  const wasSnoozed = before?.snoozed_until != null;
  const activityChanged = before !== undefined && before.raw_updated_at !== input.rawUpdatedAt;
  if (wasSnoozed && activityChanged) {
    db.prepare('UPDATE items SET snoozed_until = NULL, woke_early = 1 WHERE id = ?').run(item.id);
  }

  if (input.source === 'github_pr' && input.linkedAdoExternalIds) {
    replaceItemLinks(db, item.id, input.linkedAdoExternalIds);
  }

  return wasSnoozed && activityChanged ? { ...item, snoozedUntil: null, wokeEarly: true } : item;
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
  // today_date is deliberately untouched here -- Today now tracks plan_items
  // membership across a status change instead of dropping it, so a planned
  // item stays visible in Today through Start/Pause/Complete (see
  // getGroupedItems in lib/dashboard.ts).
  db.prepare('UPDATE items SET status = ?, completed_at = ?, parked = 0 WHERE id = ?').run(status, completedAt, id);
}

export function setParked(db: Database.Database, id: number, parked: boolean): void {
  db.prepare('UPDATE items SET parked = ? WHERE id = ?').run(parked ? 1 : 0, id);
}

export function setTodayDate(db: Database.Database, id: number, date: string | null): void {
  db.prepare('UPDATE items SET today_date = ? WHERE id = ?').run(date, id);
}

export function setStarred(db: Database.Database, id: number, starred: boolean): void {
  db.prepare('UPDATE items SET starred = ? WHERE id = ?').run(starred ? 1 : 0, id);
}

// Setting a new snooze always clears any previous "woke early" marker -- a
// fresh snooze is the user re-acknowledging the item, so the old surprise
// no longer needs flagging.
export function setSnoozedUntil(db: Database.Database, id: number, until: string | null): void {
  db.prepare('UPDATE items SET snoozed_until = ?, woke_early = 0 WHERE id = ?').run(until, id);
}

export function setTriageState(db: Database.Database, id: number, state: Item['triageState']): void {
  db.prepare('UPDATE items SET triage_state = ? WHERE id = ?').run(state, id);
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

/**
 * Thrown instead of letting the delete hit a FOREIGN KEY constraint, so the
 * caller gets something it can act on and show.
 */
export class ItemHasLoggedTimeError extends Error {
  readonly itemId: number;
  readonly logCount: number;

  constructor(itemId: number, logCount: number) {
    super('This item has logged time and cannot be deleted. Park it instead.');
    this.name = 'ItemHasLoggedTimeError';
    this.itemId = itemId;
    this.logCount = logCount;
  }
}

/**
 * Three tables reference items(id) and foreign_keys is ON, so a bare delete
 * fails for any item that has ever been timed or planned.
 *
 * plan_items and item_links carry no history worth keeping, so they go with
 * the item. time_logs does: the time report is built on it, and deleting an
 * item should not quietly rewrite what you have already reported. An item with
 * logged time is refused, and parking covers that case instead.
 */
export function deleteItem(db: Database.Database, id: number): void {
  const { count } = db
    .prepare('SELECT COUNT(*) AS count FROM time_logs WHERE item_id = ?')
    .get(id) as { count: number };
  if (count > 0) throw new ItemHasLoggedTimeError(id, count);

  db.transaction(() => {
    db.prepare('DELETE FROM plan_items WHERE item_id = ?').run(id);
    db.prepare('DELETE FROM item_links WHERE pr_item_id = ?').run(id);
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
  })();
}
