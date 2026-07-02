import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from './db';
import { setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { listItems } from './items-repo';

vi.mock('./github-client', () => ({ fetchGithubItems: vi.fn() }));
vi.mock('./ado-client', () => ({ fetchAdoData: vi.fn() }));

import { fetchGithubItems } from './github-client';
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
      { source: 'github_pr', externalId: '1@a/b', title: 'PR', url: null, reason: 'mention', dueDate: null, sprintIteration: null, rawUpdatedAt: null },
    ]);
    (fetchAdoData as any).mockResolvedValue({
      items: [
        { source: 'ado_workitem', externalId: '101', title: 'WI', url: null, reason: 'assigned', dueDate: null, sprintIteration: null, rawUpdatedAt: null },
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
});
