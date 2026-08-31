import { test, expect } from '@playwright/test';
import { createItem, ensureNoRunningTimer } from './helpers';

test('deleting an item with logged time is refused with an explanation, not silently ignored', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  const title = `Delete refusal test ${Date.now()}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();

  // Starting it opens a time log, which is the history a delete must not
  // quietly discard.
  await row.getByRole('button', { name: /^Start$/ }).click();
  await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();

  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await page.getByRole('button', { name: /^Delete$/ }).click();

  await expect(page.getByText(/logged time and cannot be deleted/i)).toBeVisible();
  await expect(row).toBeVisible();

  await ensureNoRunningTimer(request);
});

test('deleting an untouched ad-hoc item still works', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  const title = `Delete clean test ${Date.now()}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();

  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();
  await page.getByRole('button', { name: /^Delete$/ }).click();

  await expect(row).toBeHidden();
});
