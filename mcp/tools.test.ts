import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { AriadneClient } from './client';
import { TOOLS, toolByName } from './tools';

type Recorded = { method: string; path: string; body?: unknown };

function stubClient(result: unknown = { ok: true }): {
  calls: Recorded[];
  client: AriadneClient;
} {
  const calls: Recorded[] = [];
  const client = {
    get: async (path: string) => {
      calls.push({ method: 'GET', path });
      return result;
    },
    post: async (path: string, body?: unknown) => {
      calls.push({ method: 'POST', path, body });
      return result;
    },
    put: async (path: string, body?: unknown) => {
      calls.push({ method: 'PUT', path, body });
      return result;
    },
    del: async (path: string) => {
      calls.push({ method: 'DELETE', path });
      return result;
    },
  } as unknown as AriadneClient;
  return { calls, client };
}

async function invoke(name: string, args: Record<string, unknown> = {}): Promise<Recorded> {
  const tool = toolByName(name);
  if (!tool) throw new Error(`No such tool: ${name}`);
  const parsed = z.object(tool.inputSchema).parse(args);
  const { calls, client } = stubClient();
  await tool.run(client, parsed);
  expect(calls).toHaveLength(1);
  return calls[0];
}

describe('tool registry hygiene', () => {
  it('gives every tool a unique snake_case name', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('gives every tool a title and a description', () => {
    for (const tool of TOOLS) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
    }
  });

  it('finds tools by name and returns undefined for unknown ones', () => {
    expect(toolByName('start_item')?.name).toBe('start_item');
    expect(toolByName('nope')).toBeUndefined();
  });
});

describe('the excluded routes stay excluded', () => {
  it('exposes no tool that writes settings', async () => {
    // Settings writes accept arbitrary key/value pairs, which includes the
    // GitHub and Azure DevOps PATs. Reading is fine, the route redacts.
    for (const tool of TOOLS) {
      if (tool.annotations.readOnlyHint) continue;
      const { calls, client } = stubClient();
      await tool.run(client, permissiveArgs(tool.inputSchema)).catch(() => undefined);
      for (const call of calls) expect(call.path).not.toContain('/api/settings');
    }
  });

  it('exposes no tool that spawns Claude via open-claude', () => {
    for (const tool of TOOLS) {
      expect(tool.name).not.toContain('claude');
    }
  });
});

describe('annotations', () => {
  it('marks every read tool read-only and every write tool not', async () => {
    for (const tool of TOOLS) {
      const { calls, client } = stubClient();
      await tool.run(client, permissiveArgs(tool.inputSchema)).catch(() => undefined);
      const usedOnlyGet = calls.every((c) => c.method === 'GET');
      expect(Boolean(tool.annotations.readOnlyHint), `${tool.name} readOnlyHint`).toBe(usedOnlyGet);
    }
  });

  it('flags delete_item as destructive and says so in the description', () => {
    const tool = toolByName('delete_item');
    expect(tool?.annotations.destructiveHint).toBe(true);
    expect(tool?.description.toLowerCase()).toMatch(/cannot be undone|no undo|permanent/);
  });

  it('does not flag reversible writes as destructive', () => {
    for (const name of ['park_item', 'snooze_item', 'add_to_today', 'star_item']) {
      expect(toolByName(name)?.annotations.destructiveHint, name).not.toBe(true);
    }
  });
});

describe('read tools map to their routes', () => {
  it.each([
    ['list_items', {}, 'GET', '/api/items'],
    ['get_today', {}, 'GET', '/api/today/summary'],
    ['get_today', { date: '2026-08-31' }, 'GET', '/api/today/summary?date=2026-08-31'],
    ['get_plan', { date: '2026-08-31' }, 'GET', '/api/plan?date=2026-08-31'],
    ['get_running_timer', {}, 'GET', '/api/timer/running'],
    ['get_sprint', {}, 'GET', '/api/sprint'],
    ['get_sync_status', {}, 'GET', '/api/sync-status'],
    ['get_settings', {}, 'GET', '/api/settings'],
    ['list_local_repos', {}, 'GET', '/api/local-repos'],
    ['list_saved_views', {}, 'GET', '/api/saved-views'],
    [
      'get_report',
      { start: '2026-08-01', end: '2026-08-31' },
      'GET',
      '/api/report?start=2026-08-01&end=2026-08-31',
    ],
    [
      'get_calibration',
      { start: '2026-08-01', end: '2026-08-31' },
      'GET',
      '/api/calibration?start=2026-08-01&end=2026-08-31',
    ],
  ])('%s %o hits %s %s', async (name, args, method, path) => {
    const call = await invoke(name as string, args as Record<string, unknown>);
    expect(call.method).toBe(method);
    expect(call.path).toBe(path);
  });
});

describe('item write tools map to their routes', () => {
  it.each([
    ['start_item', { itemId: 7 }, 'POST', '/api/items/7/start', {}],
    ['start_item', { itemId: 7, withTimer: false }, 'POST', '/api/items/7/start', { withTimer: false }],
    [
      'complete_item',
      { itemId: 7, durationHours: 1.5 },
      'POST',
      '/api/items/7/complete',
      { durationHours: 1.5 },
    ],
    [
      'complete_item',
      { itemId: 7, durationHours: 0, note: 'no work needed' },
      'POST',
      '/api/items/7/complete',
      { durationHours: 0, note: 'no work needed' },
    ],
    ['stop_timer', { itemId: 7 }, 'POST', '/api/items/7/stop-timer', undefined],
    ['requeue_item', { itemId: 7 }, 'POST', '/api/items/7/requeue', undefined],
    ['undo_completion', { itemId: 7 }, 'POST', '/api/items/7/undo', undefined],
    ['park_item', { itemId: 7 }, 'POST', '/api/items/7/park', undefined],
    ['unpark_item', { itemId: 7 }, 'POST', '/api/items/7/unpark', undefined],
    ['snooze_item', { itemId: 7, option: 'tomorrow' }, 'POST', '/api/items/7/snooze', { option: 'tomorrow' }],
    ['unsnooze_item', { itemId: 7 }, 'DELETE', '/api/items/7/snooze', undefined],
    ['star_item', { itemId: 7, starred: true }, 'POST', '/api/items/7/star', { starred: true }],
    ['set_triage_done', { itemId: 7, done: true }, 'POST', '/api/items/7/done', { done: true }],
    ['add_to_today', { itemId: 7 }, 'POST', '/api/items/7/today', {}],
    ['add_to_today', { itemId: 7, date: '2026-09-01' }, 'POST', '/api/items/7/today', { date: '2026-09-01' }],
    ['remove_from_today', { itemId: 7 }, 'DELETE', '/api/items/7/today', undefined],
    ['delete_item', { itemId: 7 }, 'DELETE', '/api/items/7', undefined],
    ['sync_now', {}, 'POST', '/api/sync', undefined],
    ['create_item', { title: 'Write the thing' }, 'POST', '/api/items', { title: 'Write the thing' }],
    [
      'create_item',
      { title: 'Write the thing', category: 'admin', dueDate: '2026-09-05' },
      'POST',
      '/api/items',
      { title: 'Write the thing', category: 'admin', dueDate: '2026-09-05' },
    ],
  ])('%s %o hits %s %s', async (name, args, method, path, body) => {
    const call = await invoke(name as string, args as Record<string, unknown>);
    expect(call.method).toBe(method);
    expect(call.path).toBe(path);
    expect(call.body).toEqual(body);
  });
});

describe('plan and saved-view write tools map to their routes', () => {
  it.each([
    [
      'set_plan',
      { date: '2026-08-31', capacityMinutes: 300, note: 'light day' },
      'POST',
      '/api/plan',
      { date: '2026-08-31', capacityMinutes: 300, note: 'light day' },
    ],
    [
      'add_plan_item',
      { date: '2026-08-31', itemId: 7 },
      'POST',
      '/api/plan/items',
      { date: '2026-08-31', itemId: 7 },
    ],
    [
      'remove_plan_item',
      { date: '2026-08-31', itemId: 7 },
      'DELETE',
      '/api/plan/items?date=2026-08-31&itemId=7',
      undefined,
    ],
    [
      'reorder_plan_items',
      { date: '2026-08-31', orderedItemIds: [3, 1, 2] },
      'PUT',
      '/api/plan/items/reorder',
      { date: '2026-08-31', orderedItemIds: [3, 1, 2] },
    ],
    [
      'set_plan_item_estimate',
      { date: '2026-08-31', itemId: 7, minutes: 45 },
      'POST',
      '/api/plan/items/estimate',
      { date: '2026-08-31', itemId: 7, minutes: 45 },
    ],
    [
      'create_saved_view',
      { label: 'Stale PRs', query: 'is:pr stale' },
      'POST',
      '/api/saved-views',
      { label: 'Stale PRs', query: 'is:pr stale' },
    ],
    [
      'reorder_saved_views',
      { orderedIds: ['a', 'b'] },
      'PUT',
      '/api/saved-views',
      { orderedIds: ['a', 'b'] },
    ],
    ['delete_saved_view', { id: 'abc' }, 'DELETE', '/api/saved-views?id=abc', undefined],
  ])('%s %o hits %s %s', async (name, args, method, path, body) => {
    const call = await invoke(name as string, args as Record<string, unknown>);
    expect(call.method).toBe(method);
    expect(call.path).toBe(path);
    expect(call.body).toEqual(body);
  });

  it('percent-encodes query values rather than pasting them raw', async () => {
    const call = await invoke('delete_saved_view', { id: 'a b&c' });
    expect(call.path).toBe('/api/saved-views?id=a%20b%26c');
  });
});

describe('input schemas refuse nonsense before it reaches the API', () => {
  function parse(name: string, args: Record<string, unknown>) {
    return z.object(toolByName(name)!.inputSchema).safeParse(args);
  }

  it('requires durationHours on complete_item', () => {
    expect(parse('complete_item', { itemId: 1 }).success).toBe(false);
    expect(parse('complete_item', { itemId: 1, durationHours: 2 }).success).toBe(true);
  });

  it('rejects a negative durationHours, matching the route', () => {
    expect(parse('complete_item', { itemId: 1, durationHours: -1 }).success).toBe(false);
    expect(parse('complete_item', { itemId: 1, durationHours: 0 }).success).toBe(true);
  });

  it('accepts only the four real snooze options', () => {
    for (const option of ['later_today', 'tomorrow', 'next_week', 'until_activity']) {
      expect(parse('snooze_item', { itemId: 1, option }).success, option).toBe(true);
    }
    expect(parse('snooze_item', { itemId: 1, option: 'next_year' }).success).toBe(false);
  });

  it('requires an integer itemId', () => {
    expect(parse('start_item', { itemId: 1.5 }).success).toBe(false);
    expect(parse('start_item', { itemId: 'seven' }).success).toBe(false);
    expect(parse('start_item', {}).success).toBe(false);
  });

  it('requires a non-empty title on create_item', () => {
    expect(parse('create_item', { title: '' }).success).toBe(false);
    expect(parse('create_item', {}).success).toBe(false);
  });

  it('requires ISO dates where the routes compare them as strings', () => {
    expect(parse('get_report', { start: '01-08-2026', end: '2026-08-31' }).success).toBe(false);
    expect(parse('get_report', { start: '2026-08-01', end: '2026-08-31' }).success).toBe(true);
  });

  it('requires both ends of a report range', () => {
    expect(parse('get_report', { start: '2026-08-01' }).success).toBe(false);
  });
});

/**
 * Builds an argument object good enough to let any tool's run() reach the
 * client, so the sweep tests above can see which routes it touches.
 */
function permissiveArgs(shape: z.ZodRawShape): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const key of Object.keys(shape)) {
    if (key === 'itemId') args[key] = 1;
    else if (key === 'orderedItemIds') args[key] = [1];
    else if (key === 'orderedIds') args[key] = ['a'];
    else if (key === 'option') args[key] = 'tomorrow';
    else if (key.endsWith('Hours') || key.endsWith('Minutes') || key === 'minutes') args[key] = 1;
    else if (key === 'starred' || key === 'done' || key === 'withTimer') args[key] = true;
    else if (key === 'date' || key === 'start' || key === 'end' || key === 'dueDate') args[key] = '2026-08-31';
    else args[key] = 'x';
  }
  return args;
}
