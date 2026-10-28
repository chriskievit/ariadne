import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from './db';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import type { SourceAdapter } from './sources/types';

// A fake adapter list, so the test can use a source that is not ADO. The real
// adapters would pull in the HTTP clients.
const sprint = { name: 'Other sprint', startDate: '2026-09-01', endDate: '2026-09-14' };
const ITEM_SOURCE = { github: 'github_pr', ado: 'ado_workitem', jira: 'jira_issue' } as const;
const stub = (key: 'github' | 'ado' | 'jira', name = sprint.name): SourceAdapter => ({
  key,
  itemSource: ITEM_SOURCE[key],
  isConfigured: () => true,
  sync: async () => ({ items: [], sprint: { ...sprint, name } }),
});

const adapters = vi.hoisted(() => ({ list: [] as SourceAdapter[] }));
vi.mock('./sources', () => ({ SOURCE_ADAPTERS: adapters.list }));

import { runSync } from './sync';

let db: ReturnType<typeof openDb>;

beforeEach(() => {
  db = openDb(':memory:');
  adapters.list.length = 0;
});

describe('runSync sprint keys', () => {
  it('lets a non-ADO adapter return a sprint without touching the sprint settings', async () => {
    adapters.list.push(stub('github'));
    await runSync(db);
    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBeNull();
    expect(getSetting(db, SETTINGS_KEYS.sprintStart)).toBeNull();
    expect(getSetting(db, SETTINGS_KEYS.sprintEnd)).toBeNull();
  });

  it('still stores the sprint the ADO adapter returns', async () => {
    adapters.list.push(stub('ado'));
    await runSync(db);
    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBe('Other sprint');
  });

  it('stores the Jira sprint when Jira is the only tracker set up', async () => {
    adapters.list.push(stub('github'), stub('jira', 'Jira sprint'));
    await runSync(db);
    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBe('Jira sprint');
    expect(getSetting(db, SETTINGS_KEYS.sprintEnd)).toBe('2026-09-14');
  });

  it('gives the sprint to Jira when Azure DevOps is switched off', async () => {
    setSetting(db, SETTINGS_KEYS.adoEnabled, 'false');
    adapters.list.push(stub('ado', 'ADO sprint'), stub('jira', 'Jira sprint'));
    await runSync(db);
    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBe('Jira sprint');
  });

  it('keeps the ADO sprint when both trackers are set up, so they never race', async () => {
    adapters.list.push(stub('ado', 'ADO sprint'), stub('jira', 'Jira sprint'));
    await runSync(db);
    expect(getSetting(db, SETTINGS_KEYS.sprintName)).toBe('ADO sprint');
  });
});
