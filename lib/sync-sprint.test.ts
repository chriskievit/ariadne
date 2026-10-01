import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from './db';
import { getSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import type { SourceAdapter } from './sources/types';

// A fake adapter list, so the test can use a source that is not ADO. The real
// adapters would pull in the HTTP clients.
const sprint = { name: 'Other sprint', startDate: '2026-09-01', endDate: '2026-09-14' };
const stub = (key: 'github' | 'ado'): SourceAdapter => ({
  key,
  itemSource: key === 'ado' ? 'ado_workitem' : 'github_pr',
  notConfiguredError: 'not configured',
  isConfigured: () => true,
  sync: async () => ({ items: [], sprint }),
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
});
