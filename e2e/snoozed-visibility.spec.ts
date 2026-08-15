import { test, expect } from '@playwright/test';
import { createItem } from './helpers';

test('snoozed items are reachable from a Snoozed sub-list without typing a filter', async ({ page, request }) => {
  const title = `Snooze visibility test ${Date.now()}`;
  const itemId = await createItem(request, title);
  await request.post(`/api/items/${itemId}/snooze`, { data: { option: 'next_week' } });

  await page.goto('/');

  // Not visible in the main signals list without any filter applied.
  await expect(page.locator(`[data-row-id="${itemId}"]`)).toHaveCount(0);

  const snoozedToggle = page.getByRole('button', { name: /^Snoozed ·/ });
  await expect(snoozedToggle).toBeVisible();
  await snoozedToggle.click();

  const row = page.locator(`[data-row-id="${itemId}"]`);
  await expect(row).toBeVisible();
  await expect(row).toContainText(title);
});
