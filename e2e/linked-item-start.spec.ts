import { test, expect } from '@playwright/test';
import { createItem, ensureNoRunningTimer } from './helpers';
import { seedLinkedPair } from './seed-links';

async function inProgressIds(request: import('@playwright/test').APIRequestContext): Promise<number[]> {
  const res = await request.get('/api/items');
  const body = await res.json();
  return (body.inProgress as { id: number }[]).map((i) => i.id);
}

test('starting a linked item with "Start both" moves both to In Progress even while another item is already running', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  const suffix = String(Date.now());
  const { prItemId, adoItemId, adoTitle } = seedLinkedPair(suffix);
  const otherTitle = `Already running ${suffix}`;
  const otherItemId = await createItem(request, otherTitle);

  await page.goto('/');

  // Start an unrelated item first so a timer is already running -- this is
  // the condition the bug report says makes the cascade fail entirely.
  const otherRow = page.locator(`[data-row-id="${otherItemId}"]`);
  await otherRow.waitFor();
  await otherRow.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.locator('header')).toContainText(otherTitle);

  const prRow = page.locator(`[data-row-id="${prItemId}"]`);
  await prRow.waitFor();
  await prRow.getByRole('button', { name: /^Start$/ }).click();

  await expect(page.getByRole('dialog', { name: /Start linked item/ })).toBeVisible();
  await page.getByRole('button', { name: /^Start both$/ }).click();

  await expect(page.getByRole('dialog', { name: 'A timer is already running' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch' }).click();

  // The link's timer starts second (after the item that was clicked), so it
  // ends up as the one live-running -- both still land in In Progress below.
  await expect(page.locator('header')).toContainText(adoTitle);

  const ids = await inProgressIds(request);
  expect(ids).toContain(prItemId);
  expect(ids).toContain(adoItemId);

  await ensureNoRunningTimer(request);
});
