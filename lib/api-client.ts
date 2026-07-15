import type { TimeReport } from '@/lib/report';
import type { LocalRepo } from '@/lib/warp';

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

export async function startItem(id: number) {
  await fetch(`/api/items/${id}/start`, { method: 'POST' });
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

export async function fetchLocalRepos(): Promise<LocalRepo[]> {
  const res = await fetch('/api/local-repos');
  return res.json();
}

export async function openInClaude(id: number, workingDir?: string): Promise<{ warpUrl?: string; error?: string }> {
  const res = await fetch(`/api/items/${id}/open-claude`, {
    method: 'POST',
    body: JSON.stringify(workingDir ? { workingDir } : {}),
  });
  return res.json();
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
