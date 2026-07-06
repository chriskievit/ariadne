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

export async function completeItem(id: number, body: { durationMinutes?: number; note?: string } = {}) {
  const res = await fetch(`/api/items/${id}/complete`, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}

export async function undoItem(id: number) {
  await fetch(`/api/items/${id}/undo`, { method: 'POST' });
}

export async function requeueItem(id: number) {
  await fetch(`/api/items/${id}/requeue`, { method: 'POST' });
}

export async function createAdhocItemRequest(input: { title: string; category?: string; dueDate?: string }) {
  await fetch('/api/items', { method: 'POST', body: JSON.stringify(input) });
}

export async function deleteAdhocItem(id: number) {
  await fetch(`/api/items/${id}`, { method: 'DELETE' });
}
