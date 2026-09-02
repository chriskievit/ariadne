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

// Every spec shares one database, so rows seeded by earlier specs land in the
// same obligation groups a collapse test is trying to count. Marking them
// triage-done drops them out of Signals (SignalsBoard filters on
// `triageState !== 'done'`) without deleting anything a later spec might
// still want.
export async function hideExistingItems(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/items');
  const buckets = await res.json();
  const ids = (['today', 'signals', 'inProgress', 'parked'] as const).flatMap((bucket) =>
    (buckets[bucket] ?? []).map((item: { id: number }) => item.id)
  );
  for (const id of new Set(ids)) {
    await request.post(`/api/items/${id}/done`, { data: { done: true } });
  }
}
