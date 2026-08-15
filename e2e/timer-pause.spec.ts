import { test, expect } from '@playwright/test';
import { createItem, ensureNoRunningTimer } from './helpers';

test('clicking the header Pause button stops the timer and hides the chip', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  const title = `Timer pause test ${Date.now()}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.getByRole('button', { name: /^Start$/ }).click();

  const pauseBtn = page.getByRole('button', { name: 'Pause timer' });
  await expect(pauseBtn).toBeVisible();
  await expect(page.locator('header')).toContainText(title);

  await pauseBtn.click();

  // The poll interval that could mask a caching regression is 5s -- assert
  // the chip clears well before that.
  await expect(pauseBtn).toBeHidden({ timeout: 2000 });
  await expect(page.locator('header')).not.toContainText(title);

  const runningRes = await request.get('/api/timer/running');
  expect(await runningRes.json()).toBeNull();
});

test('header timer chip disappears immediately when an item is parked from its row menu', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  const title = `Timer pause test ${Date.now()}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.getByRole('button', { name: /^Start$/ }).click();

  const pauseBtn = page.getByRole('button', { name: 'Pause timer' });
  await expect(pauseBtn).toBeVisible();
  await expect(page.locator('header')).toContainText(title);

  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: /Park/ }).click();

  // The poll interval that used to gate this update is 5s -- assert it
  // clears well before that so a regression back to poll-only updates fails.
  await expect(pauseBtn).toBeHidden({ timeout: 2000 });
});
