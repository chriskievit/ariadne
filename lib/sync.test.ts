import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from './db';
import { setSetting, getSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { listItems, upsertSyncedItem, getItemById } from './items-repo';

vi.mock('./github-client', () => ({ fetchGithubItems: vi.fn(), fetchMergedExternalIds: vi.fn() }));
vi.mock('./ado-client', () => ({ fetchAdoData: vi.fn() }));

import { fetchGithubItems, fetchMergedExternalIds } from './github-client';
import { fetchAdoData } from './ado-client';
import { runSync } from './sync';

let db: ReturnType<typeof openDb>;

beforeEach(() => {
  db = openDb(':memory:');
  vi.clearAllMocks();
});

describe('runSync', () => {
  it('upserts items from both sources and logs success', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');

    (fetchGithubItems as any).mockResolvedValue([
      { source: 'github_pr', externalId: '1@a/b', title: 'PR', url: null, reason: 'mention', dueDate: null, sprintIteration: null, rawUpdatedAt: null, repo: 'b' },
    ]);
    (fetchAdoData as any).mockResolvedValue({
      items: [
        { source: 'ado_workitem', externalId: '101', title: 'WI', url: null, reason: 'assigned', dueDate: null, sprintIteration: null, rawUpdatedAt: null, repo: null },
      ],
      iteration: { name: 'Sprint 1', startDate: '2026-07-01', endDate: '2026-07-14' },
    });

    const outcomes = await runSync(db);
    expect(outcomes.every((o) => o.error === null)).toBe(true);
    expect(listItems(db)).toHaveLength(2);
  });

  it('continues the ADO sync when GitHub sync fails', async () => {
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: null });

    const outcomes = await runSync(db);
    const github = outcomes.find((o) => o.source === 'github')!;
    const ado = outcomes.find((o) => o.source === 'ado')!;
    expect(github.error).toBe('GitHub PAT not configured');
    expect(ado.error).toBeNull();
  });

  it('continues the GitHub sync when ADO sync throws', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchGithubItems as any).mockResolvedValue([]);
    (fetchAdoData as any).mockRejectedValue(new Error('Azure DevOps API error 401'));

    const outcomes = await runSync(db);
    const github = outcomes.find((o) => o.source === 'github')!;
    const ado = outcomes.find((o) => o.source === 'ado')!;
    expect(github.error).toBeNull();
    expect(ado.error).toBe('Azure DevOps API error 401');
  });

  it('persists the synced sprint iteration to settings', async () => {
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchGithubItems as any).mockResolvedValue([]);
    (fetchAdoData as any).mockResolvedValue({
      items: [],
      iteration: { name: 'Sprint 7', startDate: '2026-07-01', endDate: '2026-07-14' },
    });

    await runSync(db);

    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBe('Sprint 7');
    expect(getSetting(db, SETTINGS_KEYS.sprintStart)).toBe('2026-07-01');
    expect(getSetting(db, SETTINGS_KEYS.sprintEnd)).toBe('2026-07-14');
  });

  it('flags a previously-synced PR as merged once it drops out of the open-PR fetch', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: null });

    const existing = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '42@acme/widgets',
      title: 'Add feature',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'widgets',
      prStatus: 'approved',
    });

    (fetchGithubItems as any).mockResolvedValue([]);
    (fetchMergedExternalIds as any).mockResolvedValue(new Set(['42@acme/widgets']));

    await runSync(db);

    expect(fetchMergedExternalIds).toHaveBeenCalledWith(
      { pat: 'gh-pat', staleDays: expect.any(Number) },
      [{ id: existing.id, externalId: '42@acme/widgets' }]
    );
    expect(getItemById(db, existing.id)?.prStatus).toBe('merged');
  });

  it('does not re-check a PR that is still present in the current fetch', async () => {
    setSetting(db, SETTINGS_KEYS.githubPat, 'gh-pat');
    setSetting(db, SETTINGS_KEYS.adoPat, 'ado-pat');
    setSetting(db, SETTINGS_KEYS.adoOrg, 'org');
    setSetting(db, SETTINGS_KEYS.adoProject, 'project');
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: null });

    upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '42@acme/widgets',
      title: 'Add feature',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'widgets',
      prStatus: 'approved',
    });

    (fetchGithubItems as any).mockResolvedValue([
      {
        source: 'github_pr',
        externalId: '42@acme/widgets',
        title: 'Add feature',
        url: null,
        reason: 'authored',
        dueDate: null,
        sprintIteration: null,
        rawUpdatedAt: '2026-07-02T00:00:00.000Z',
        repo: 'widgets',
        prStatus: 'approved',
      },
    ]);

    await runSync(db);

    expect(fetchMergedExternalIds).not.toHaveBeenCalled();
  });

  it('writes a sync_log row per source on every run', async () => {
    (fetchGithubItems as any).mockResolvedValue([]);
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: null });

    await runSync(db);

    const { count } = db.prepare('SELECT COUNT(*) as count FROM sync_log').get() as { count: number };
    expect(count).toBe(2);
  });
});
