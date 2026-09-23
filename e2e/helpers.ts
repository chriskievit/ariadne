import type { APIRequestContext, Page } from '@playwright/test';

export async function createItem(request: APIRequestContext, title: string): Promise<number> {
  const res = await request.post('/api/items', { data: { title } });
  const item = await res.json();
  return item.id;
}

// Points a named local repo at a directory, the same setting Settings'
// "Local repos" section writes. ItemRow's Claude picker (and the
// agent-session route's own workingDir check) both read this list, so a
// launch spec that goes through the picker needs at least one entry here.
// The directory itself is never read from disk on this path -- only written,
// unescaped, into a Warp tab config's TOML -- so it does not need to exist.
export async function setRepoPathOverride(request: APIRequestContext, name: string, path: string): Promise<void> {
  const res = await request.post('/api/settings', { data: { 'warp.repoPathOverrides': `${name}=${path}` } });
  if (!res.ok()) throw new Error(`Could not set the repo path override (${res.status()}).`);
}

// A launch's warpUrl is a warp:// tab-config URL (lib/agent-launch.ts's
// sessionWarpUrl). Chromium under test has no handler for that scheme, so
// `window.location.href = warpUrl` resolves nowhere: the current page never
// unloads, and `location.href` itself never changes to reflect the
// assignment -- there is nothing to read back afterwards. (Monkey-patching
// Location.prototype's href setter to catch the assignment directly does
// not work either: this build of Chromium defines `href` as a
// non-configurable own property of the `location` object, not an
// overridable accessor on its prototype.) What Chromium does still do is
// fire a Network request for the attempted navigation, which this listens
// for -- the one observable trace the assignment leaves, and proof
// handleOpenClaude reached its `warpUrl` branch without depending on Warp
// being installed to actually receive it.
export function watchWarpNavigation(page: Page): { urls: string[] } {
  const capture = { urls: [] as string[] };
  page.on('request', (request) => {
    if (request.url().startsWith('warp://')) capture.urls.push(request.url());
  });
  return capture;
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
