import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, listItems } from './items-repo';
import { setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { getLinksForItems } from './links-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getLinksForItems', () => {
  it("resolves a synced work item as the linked PR's counterpart, and vice versa", () => {
    const wi = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '41363',
      title: 'Prevent deletion',
      url: 'https://pro4all.visualstudio.com/x/_workitems/edit/41363',
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
      adoStatus: 'Active',
    });
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '5654@acme/widgets',
      title: 'feat: prevent deletion',
      url: 'https://github.com/acme/widgets/pull/5654',
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'widgets',
      linkedAdoExternalIds: ['41363'],
    });

    const links = getLinksForItems(db, listItems(db));

    expect(links.get(wi.id)).toEqual([
      {
        source: 'github_pr',
        shortLabel: '#5654',
        title: 'feat: prevent deletion',
        url: 'https://github.com/acme/widgets/pull/5654',
        status: 'inbox',
        itemId: pr.id,
      },
    ]);
    expect(links.get(pr.id)).toEqual([
      {
        source: 'ado_workitem',
        shortLabel: 'WI-41363',
        title: 'Prevent deletion',
        url: 'https://pro4all.visualstudio.com/x/_workitems/edit/41363',
        status: 'inbox',
        itemId: wi.id,
      },
    ]);
  });

  it('supports a work item with multiple linked PRs', () => {
    const wi = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '41363',
      title: 'WI',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const prA = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '5654@acme/widgets',
      title: 'PR A',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'widgets',
      linkedAdoExternalIds: ['41363'],
    });
    const prB = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '46@acme/backend',
      title: 'PR B',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'backend',
      linkedAdoExternalIds: ['41363'],
    });

    const links = getLinksForItems(db, listItems(db));
    const itemIds = links
      .get(wi.id)
      ?.map((l) => l.itemId)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(itemIds).toEqual([prA.id, prB.id].sort((a, b) => a - b));
  });

  it('falls back to a constructed ADO URL when the linked work item is not synced', () => {
    setSetting(db, SETTINGS_KEYS.adoOrg, 'pro4all');
    setSetting(db, SETTINGS_KEYS.adoProject, 'Prostream general');
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '5654@acme/widgets',
      title: 'PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'widgets',
      linkedAdoExternalIds: ['99999'],
    });

    const links = getLinksForItems(db, listItems(db));
    expect(links.get(pr.id)).toEqual([
      {
        source: 'ado_workitem',
        shortLabel: 'WI-99999',
        title: 'WI-99999',
        url: 'https://dev.azure.com/pro4all/Prostream%20general/_workitems/edit/99999',
        status: null,
        itemId: null,
      },
    ]);
  });

  it('returns an empty map when there are no PR items', () => {
    upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '1',
      title: 'WI',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    expect(getLinksForItems(db, listItems(db)).size).toBe(0);
  });

  it('returns an empty map when no PR has linkedAdoExternalIds', () => {
    upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@acme/widgets',
      title: 'PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'widgets',
    });
    expect(getLinksForItems(db, listItems(db)).size).toBe(0);
  });
});
