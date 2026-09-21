import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem, getItemById } from '@/lib/items-repo';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';
import { listAgentSessions } from '@/lib/agent-sessions-repo';
import { addPlanItem, getPlanItems } from '@/lib/plans-repo';
import { getRunningTimer } from '@/lib/time-logs-repo';
import { localDateString } from '@/lib/date';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

let tabDir: string;
let settingsDir: string;
let reposDir: string;

vi.mock('@/lib/agent-paths', () => ({
  agentTabConfigDir: () => tabDir,
  agentSettingsDir: () => settingsDir,
}));

const { POST } = await import('./route');

let itemId: number;

function post(id: number, body: unknown = {}) {
  return POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: String(id) }),
  });
}

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM plan_items; DELETE FROM time_logs; DELETE FROM items; DELETE FROM settings;');
  tabDir = mkdtempSync(join(tmpdir(), 'ariadne-tabs-'));
  settingsDir = mkdtempSync(join(tmpdir(), 'ariadne-settings-'));
  reposDir = mkdtempSync(join(tmpdir(), 'ariadne-repos-'));
  mkdirSync(join(reposDir, 'pipelines'));
  setSetting(testDb, SETTINGS_KEYS.localReposBaseDir, reposDir);
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
  testDb.prepare('UPDATE items SET repo = ? WHERE id = ?').run('pipelines', itemId);
});

afterEach(() => {
  for (const dir of [tabDir, settingsDir, reposDir]) rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/items/[id]/agent-session', () => {
  it('creates a launching session and returns the warp url for its own tab', async () => {
    const res = await post(itemId);
    const body = await res.json();

    const sessions = listAgentSessions(testDb);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].state).toBe('launching');
    expect(sessions[0].agent).toBe('claude');
    expect(sessions[0].launchToken).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(body.warpUrl).toBe(`warp://tab_config/ariadne-session-${sessions[0].id}`);
  });

  it('writes a tab config whose command points at this session\'s hook settings', async () => {
    await post(itemId);
    const session = listAgentSessions(testDb)[0];

    const toml = readFileSync(join(tabDir, `ariadne-session-${session.id}.toml`), 'utf8');
    // Ad-hoc item, so there is no #number: the title is just the repo.
    expect(toml).toContain('title = "pipelines"');
    expect(toml).toContain(join(reposDir, 'pipelines'));
    expect(toml).toContain('claude --settings');

    const settingsPath = join(settingsDir, `hooks-${session.launchToken}.json`);
    expect(existsSync(settingsPath)).toBe(true);
    expect(toml).toContain(settingsPath);
  });

  it('advances the item to in progress without starting a timer', async () => {
    await post(itemId);

    expect(getItemById(testDb, itemId)?.status).toBe('in_progress');
    // Only one timer may ever run, and an agent's wall clock is not the
    // user's hours. Handing work to an agent must not bill time.
    expect(getRunningTimer(testDb)).toBeNull();
  });

  it('moves the item to the top of today\'s plan when it is already on it', async () => {
    const other = createAdhocItem(testDb, { title: 'Other' }).id;
    const today = localDateString(new Date());
    addPlanItem(testDb, today, other);
    addPlanItem(testDb, today, itemId);

    await post(itemId);

    expect(getPlanItems(testDb, today).map((pi) => pi.itemId)).toEqual([itemId, other]);
  });

  it('does not add the item to today\'s plan when it is not already on it', async () => {
    const today = localDateString(new Date());
    await post(itemId);
    expect(getPlanItems(testDb, today)).toHaveLength(0);
  });

  it('rejects a working directory that is not a configured local repo', async () => {
    const res = await post(itemId, { workingDir: '/etc' });
    expect(res.status).toBe(400);
    expect(listAgentSessions(testDb)).toHaveLength(0);
  });

  it('404s for an unknown item', async () => {
    const res = await post(99999);
    expect(res.status).toBe(404);
  });

  it('400s when no working directory can be resolved', async () => {
    const bare = createAdhocItem(testDb, { title: 'No repo' }).id;
    const res = await post(bare);
    expect(res.status).toBe(400);
    expect(listAgentSessions(testDb)).toHaveLength(0);
  });
});
