import { describe, it, expect, vi } from 'vitest';
import { SETTINGS_KEYS } from '../config';

vi.mock('./ado-client', () => ({ fetchAdoData: vi.fn() }));
vi.mock('./github-client', () => ({ fetchGithubItems: vi.fn(), fetchMergedExternalIds: vi.fn() }));
vi.mock('./jira-client', () => ({ fetchJiraData: vi.fn(), MAX_ISSUES: 500 }));

import { fetchAdoData } from './ado-client';
import { fetchJiraData } from './jira-client';
import { jiraAdapter } from './jira';
import { normalizeJiraSite, SOURCE_ITEM, isSourceEnabled, activeSources, hiddenItemSources } from './configured';
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
    expect(jiraAdapter.itemSource).toBe('jira_issue');
  });

  it('agrees with SOURCE_ITEM, which items-repo reads instead of the adapters', () => {
    for (const adapter of SOURCE_ADAPTERS) expect(SOURCE_ITEM[adapter.key]).toBe(adapter.itemSource);
  });
});

describe('source switch', () => {
  const github = { [SETTINGS_KEYS.githubPat]: 'p' };
  const jira = { [SETTINGS_KEYS.jiraSite]: 'acme.atlassian.net', [SETTINGS_KEYS.jiraEmail]: 'me@acme.test', [SETTINGS_KEYS.jiraToken]: 't' };

  it('is on unless it was switched off', () => {
    expect(isSourceEnabled(getter({}), 'github')).toBe(true);
    expect(isSourceEnabled(getter({ [SETTINGS_KEYS.githubEnabled]: 'true' }), 'github')).toBe(true);
    expect(isSourceEnabled(getter({ [SETTINGS_KEYS.githubEnabled]: 'false' }), 'github')).toBe(false);
  });

  it('keeps a switched-off source out of the active ones, though it is still set up', () => {
    expect(activeSources(getter({ ...github, ...jira }))).toEqual(['github', 'jira']);
    expect(activeSources(getter({ ...github, ...jira, [SETTINGS_KEYS.jiraEnabled]: 'false' }))).toEqual(['github']);
  });

  it('hides the items of each switched-off source, set up or not', () => {
    expect(hiddenItemSources(getter({}))).toEqual([]);
    expect(
      hiddenItemSources(getter({ [SETTINGS_KEYS.adoEnabled]: 'false', [SETTINGS_KEYS.jiraEnabled]: 'false' }))
    ).toEqual(['ado_workitem', 'jira_issue']);
  });
});

describe('githubAdapter', () => {
  it('needs only the PAT', () => {
    expect(githubAdapter.isConfigured(getter({}))).toBe(false);
    expect(githubAdapter.isConfigured(getter({ [SETTINGS_KEYS.githubPat]: 'p' }))).toBe(true);
  });
});

describe('jiraAdapter', () => {
  const full = { [SETTINGS_KEYS.jiraSite]: 'acme.atlassian.net', [SETTINGS_KEYS.jiraEmail]: 'me@acme.test', [SETTINGS_KEYS.jiraToken]: 't' };

  it('needs site, email and token, but not a query', () => {
    expect(jiraAdapter.isConfigured(getter({ ...full, [SETTINGS_KEYS.jiraToken]: '' }))).toBe(false);
    expect(jiraAdapter.isConfigured(getter({ ...full, [SETTINGS_KEYS.jiraEmail]: '' }))).toBe(false);
    expect(jiraAdapter.isConfigured(getter(full))).toBe(true);
  });

  it('passes the settings through and returns the sprint', async () => {
    const sprint = { name: 'PLAT Sprint 7', startDate: 'a', endDate: 'b' };
    (fetchJiraData as any).mockResolvedValue({ items: [], sprint, truncated: false });
    const result = await jiraAdapter.sync(getter({ ...full, [SETTINGS_KEYS.jiraJql]: 'project = PLAT' }));
    expect(fetchJiraData).toHaveBeenCalledWith({ site: 'acme.atlassian.net', email: 'me@acme.test', token: 't', jql: 'project = PLAT' });
    expect(result.sprint).toEqual(sprint);
  });
});

describe('normalizeJiraSite', () => {
  it('keeps only the host, whatever gets pasted', () => {
    expect(normalizeJiraSite('acme.atlassian.net')).toBe('acme.atlassian.net');
    expect(normalizeJiraSite(' https://Acme.atlassian.net/ ')).toBe('acme.atlassian.net');
    expect(normalizeJiraSite('https://acme.atlassian.net/jira/software/projects/PLAT/boards/1')).toBe('acme.atlassian.net');
    expect(normalizeJiraSite('')).toBe('');
  });
});

describe('SOURCE_ADAPTERS', () => {
  it('has one adapter per source key, in key order', () => {
    expect(SOURCE_ADAPTERS.map((a) => a.key)).toEqual([...SOURCE_KEYS]);
  });
});
