import { describe, it, expect, vi } from 'vitest';
import { SETTINGS_KEYS } from '../config';

vi.mock('./ado-client', () => ({ fetchAdoData: vi.fn() }));
vi.mock('./github-client', () => ({ fetchGithubItems: vi.fn(), fetchMergedExternalIds: vi.fn() }));

import { fetchAdoData } from './ado-client';
import { adoAdapter } from './ado';
import { githubAdapter } from './github';
import { SOURCE_ADAPTERS } from './index';
import { SOURCE_KEYS } from './types';

function getter(values: Record<string, string>) {
  return (key: string) => values[key] ?? null;
}

describe('adoAdapter', () => {
  it('needs pat, org and project, but not team', () => {
    expect(adoAdapter.isConfigured(getter({ [SETTINGS_KEYS.adoPat]: 'p', [SETTINGS_KEYS.adoOrg]: 'o' }))).toBe(false);
    expect(
      adoAdapter.isConfigured(getter({ [SETTINGS_KEYS.adoPat]: 'p', [SETTINGS_KEYS.adoOrg]: 'o', [SETTINGS_KEYS.adoProject]: 'x' }))
    ).toBe(true);
  });

  it('passes the team through and returns the iteration as the sprint', async () => {
    (fetchAdoData as any).mockResolvedValue({ items: [], iteration: { name: 'Sprint 7', startDate: 'a', endDate: 'b' } });
    const result = await adoAdapter.sync(
      getter({ [SETTINGS_KEYS.adoPat]: 'p', [SETTINGS_KEYS.adoOrg]: 'o', [SETTINGS_KEYS.adoProject]: 'x', [SETTINGS_KEYS.adoTeam]: 't' })
    );
    expect(fetchAdoData).toHaveBeenCalledWith({ pat: 'p', org: 'o', project: 'x', team: 't' });
    expect(result.sprint).toEqual({ name: 'Sprint 7', startDate: 'a', endDate: 'b' });
  });
});

describe('itemSource', () => {
  it('maps each sync key to its item source', () => {
    expect(githubAdapter.itemSource).toBe('github_pr');
    expect(adoAdapter.itemSource).toBe('ado_workitem');
  });
});

describe('githubAdapter', () => {
  it('needs only the PAT', () => {
    expect(githubAdapter.isConfigured(getter({}))).toBe(false);
    expect(githubAdapter.isConfigured(getter({ [SETTINGS_KEYS.githubPat]: 'p' }))).toBe(true);
  });
});

describe('SOURCE_ADAPTERS', () => {
  it('has one adapter per source key, in key order', () => {
    expect(SOURCE_ADAPTERS.map((a) => a.key)).toEqual([...SOURCE_KEYS]);
  });
});
