import type { APIRequestContext } from '@playwright/test';

export async function createItem(request: APIRequestContext, title: string): Promise<number> {
  const res = await request.post('/api/items', { data: { title } });
  const item = await res.json();
  return item.id;
}
