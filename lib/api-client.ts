import type { TimeReport } from '@/lib/report';
import type { LocalRepo } from '@/lib/warp';
import { localDateString, addDays } from '@/lib/date';
import type { Item, Plan } from '@/lib/types';
import type { SnoozeOption } from '@/lib/snooze';
import type { SourceStatus } from '@/lib/sync-status';
import type { CalibrationEntry } from '@/lib/calibration';

export async function fetchDashboardData() {
  const [itemsRes, sprintRes] = await Promise.all([fetch('/api/items'), fetch('/api/sprint')]);
  const items = await itemsRes.json();
  const sprint = await sprintRes.json();
  return { ...items, sprint };
}

export async function triggerSync() {
  const res = await fetch('/api/sync', { method: 'POST' });
  return res.json();
}

export async function startItem(id: number, options?: { withTimer?: boolean }) {
  await fetch(`/api/items/${id}/start`, {
    method: 'POST',
    body: JSON.stringify({ withTimer: options?.withTimer ?? true }),
  });
}

export async function completeItem(id: number, body: { durationHours: number; note?: string }) {
  const res = await fetch(`/api/items/${id}/complete`, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}

export async function undoItem(id: number) {
  await fetch(`/api/items/${id}/undo`, { method: 'POST' });
}

export async function requeueItem(id: number) {
  await fetch(`/api/items/${id}/requeue`, { method: 'POST' });
}

export async function parkItem(id: number) {
  await fetch(`/api/items/${id}/park`, { method: 'POST' });
}

export async function unparkItem(id: number) {
  await fetch(`/api/items/${id}/unpark`, { method: 'POST' });
}

export interface TodaySummaryResponse {
  planned: Item[];
  doneToday: (Item & { hoursLoggedToday: number; estimateMinutes: number | null })[];
  hoursLoggedToday: number;
  plan: Plan;
  plannedMinutes: number;
}

export async function pinToday(id: number, date?: string) {
  await fetch(`/api/items/${id}/today`, { method: 'POST', body: JSON.stringify(date ? { date } : {}) });
}

export async function unpinToday(id: number) {
  await fetch(`/api/items/${id}/today`, { method: 'DELETE' });
}

export async function carryToTomorrow(id: number) {
  const tomorrow = addDays(localDateString(new Date()), 1);
  return pinToday(id, tomorrow);
}

export async function starItem(id: number, starred: boolean) {
  await fetch(`/api/items/${id}/star`, { method: 'POST', body: JSON.stringify({ starred }) });
}

export async function snoozeItem(id: number, option: SnoozeOption) {
  await fetch(`/api/items/${id}/snooze`, { method: 'POST', body: JSON.stringify({ option }) });
}

export async function unsnoozeItem(id: number) {
  await fetch(`/api/items/${id}/snooze`, { method: 'DELETE' });
}

export async function setItemDone(id: number, done: boolean) {
  await fetch(`/api/items/${id}/done`, { method: 'POST', body: JSON.stringify({ done }) });
}

export async function fetchSavedViews() {
  const res = await fetch('/api/saved-views');
  return res.json();
}

export async function createSavedView(input: { label: string; query: string; shortcut: string | null }) {
  const res = await fetch('/api/saved-views', { method: 'POST', body: JSON.stringify(input) });
  return res.json();
}

export async function deleteSavedView(id: string) {
  const res = await fetch(`/api/saved-views?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchTodaySummary(): Promise<TodaySummaryResponse> {
  const res = await fetch('/api/today/summary');
  return res.json();
}

export async function fetchTodaySummaryFor(date: string): Promise<TodaySummaryResponse> {
  const res = await fetch(`/api/today/summary?date=${date}`);
  return res.json();
}

export async function fetchLocalRepos(): Promise<LocalRepo[]> {
  const res = await fetch('/api/local-repos');
  return res.json();
}

export async function openInClaude(id: number, workingDir?: string): Promise<{ warpUrl?: string; error?: string }> {
  const res = await fetch(`/api/items/${id}/open-claude`, {
    method: 'POST',
    body: JSON.stringify(workingDir ? { workingDir } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.error ?? 'Could not open Claude session.' };
  }
  return body;
}

export async function createAdhocItemRequest(input: { title: string; category?: string; dueDate?: string }) {
  await fetch('/api/items', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteAdhocItem(id: number) {
  await fetch(`/api/items/${id}`, { method: 'DELETE' });
}

export async function fetchTimeReport(start: string, end: string): Promise<TimeReport> {
  const res = await fetch(`/api/report?start=${start}&end=${end}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch time report: ${res.status}`);
  }
  return res.json();
}

export async function fetchPlan(date: string) {
  const res = await fetch(`/api/plan?date=${date}`);
  return res.json();
}

export async function updatePlan(date: string, input: { capacityMinutes?: number; note?: string | null }): Promise<Plan> {
  const res = await fetch('/api/plan', { method: 'POST', body: JSON.stringify({ date, ...input }) });
  return res.json();
}

export async function saveWrapUpNote(date: string, note: string) {
  return updatePlan(date, { note });
}

export async function addToPlan(date: string, itemId: number) {
  const res = await fetch('/api/plan/items', { method: 'POST', body: JSON.stringify({ date, itemId }) });
  return res.json();
}

export async function removeFromPlan(date: string, itemId: number) {
  await fetch(`/api/plan/items?date=${date}&itemId=${itemId}`, { method: 'DELETE' });
}

export async function reorderPlan(date: string, orderedItemIds: number[]) {
  const res = await fetch('/api/plan/items/reorder', {
    method: 'PUT',
    body: JSON.stringify({ date, orderedItemIds }),
  });
  return res.json();
}

export async function setEstimate(date: string, itemId: number, minutes: number | null) {
  await fetch('/api/plan/items/estimate', { method: 'POST', body: JSON.stringify({ date, itemId, minutes }) });
}

export async function fetchRunningTimer() {
  const res = await fetch('/api/timer/running');
  return res.json();
}

export async function stopTimerRequest(id: number) {
  await fetch(`/api/items/${id}/stop-timer`, { method: 'POST' });
}

export async function fetchSourceStatuses(): Promise<SourceStatus[]> {
  const res = await fetch('/api/sync-status');
  return res.json();
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const res = await fetch('/api/settings');
  return res.json();
}

export async function fetchCalibration(start: string, end: string): Promise<CalibrationEntry[]> {
  const res = await fetch(`/api/calibration?start=${start}&end=${end}`);
  return res.json();
}
