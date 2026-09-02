import { test, expect } from '@playwright/test';
import { createItem, ensureNoRunningTimer } from './helpers';
import { seedSettledPair } from './seed-settled';

test('capturing an ad-hoc item with a high priority is a keyboard-only gesture that outranks a review request', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  const title = `Priority capture ${Date.now()}`;

  await page.goto('/');
  // The whole point of the feature: someone is at your desk, so `a` opens
  // the form and the first field already has focus.
  await page.locator('body').press('a');
  const titleInput = page.getByLabel('Title');
  await expect(titleInput).toBeFocused();
  await titleInput.fill(title);

  const priority = page.getByRole('radiogroup', { name: 'Priority (optional)' });
  await expect(priority.getByRole('radio', { name: /High/ })).toHaveAttribute('aria-checked', 'false');
  await priority.getByRole('radio', { name: /High/ }).click();
  await expect(priority.getByRole('radio', { name: /High/ })).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // 10 for being ad-hoc + 40 for the priority. Nothing else can fire on a
  // brand new ad-hoc item.
  const row = page.locator(`[data-row-id]`).filter({ hasText: title });
  await row.waitFor();
  await expect(row.getByRole('button', { name: /Urgency 50 of 75/ })).toBeVisible();
});

test('the score popover separates what you set from what the sources report', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  const title = `Priority provenance ${Date.now()}`;
  const itemId = await createItem(request, title);
  await request.post(`/api/items/${itemId}/priority`, { data: { priority: 'medium' } });

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.getByRole('button', { name: /Urgency 30 of 75/ }).click();

  const popover = page.getByRole('dialog', { name: /Why 30/ });
  await expect(popover.getByText('What you set')).toBeVisible();
  await expect(popover.getByText('You marked this medium')).toBeVisible();
  await expect(popover.getByText('set today')).toBeVisible();
  await expect(popover.getByText('What the sources report')).toBeVisible();

  // 30 clears the needs-attention threshold on its own, so the ad-hoc
  // exemption is retired and the popover has to say so -- otherwise the
  // "Kept visible" badge just vanishes when you raise something.
  await expect(popover.getByText(/no longer needs the ad-hoc exemption/i)).toBeVisible();
});

test('the priority action is present but refused on a row that came from a source system', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  // The e2e database starts empty, so a synced row has to be seeded straight
  // into sqlite -- a real sync is not available to a test.
  const { openPrId } = seedSettledPair(`priority-${Date.now()}`);

  await page.goto('/');
  const syncedRow = page.locator(`[data-row-id="${openPrId}"]`);
  await syncedRow.waitFor();
  await syncedRow.getByRole('button', { name: 'More actions' }).click();

  const priorityItem = page.getByRole('menuitem', { name: /Priority/ });
  await expect(priorityItem).toBeVisible();
  await expect(priorityItem).toBeDisabled();
  await expect(priorityItem).toContainText('ad-hoc only');
});

test('the f key cycles priority on a focused ad-hoc row without firing the global p binding', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  const title = `Priority cycle ${Date.now()}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.focus();

  // Unset -> high on the first press, because raising something is the only
  // reason to reach for the key.
  await row.press('f');
  await expect(row.getByRole('button', { name: /Urgency 50 of 75/ })).toBeVisible();

  await row.press('f');
  await expect(row.getByRole('button', { name: /Urgency 30 of 75/ })).toBeVisible();

  await row.press('f');
  await expect(row.getByRole('button', { name: /Urgency 10 of 75/ })).toBeVisible();

  // No dialog should have opened at any point: the plan-the-day dialog is on
  // the global `p`, and a row binding must never collide with it.
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
