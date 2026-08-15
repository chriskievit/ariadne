import type { APIRequestContext } from '@playwright/test';

export async function createItem(request: APIRequestContext, title: string): Promise<number> {
  const res = await request.post('/api/items', { data: { title } });
  const item = await res.json();
  return item.id;
}

// Tests share one dev server (and its "at most one running timer" global
// state) across the whole run -- stop whatever a prior test left running so
// each test starts from a known state instead of racing the switch-timer
// dialog it didn't expect.
export async function ensureNoRunningTimer(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/timer/running');
  const timer = await res.json();
  if (timer) await request.post(`/api/items/${timer.itemId}/stop-timer`);
}
