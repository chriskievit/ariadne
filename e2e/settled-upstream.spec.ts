import { test, expect } from '@playwright/test';
import { ensureNoRunningTimer } from './helpers';
import { seedSettledPair } from './seed-settled';

test('items already closed at the source offer Complete instead of Start', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  const { mergedPrId, doneAdoId, openPrId } = seedSettledPair(String(Date.now()));

  await page.goto('/');

  const mergedRow = page.locator(`[data-row-id="${mergedPrId}"]`);
  const doneRow = page.locator(`[data-row-id="${doneAdoId}"]`);
  const openRow = page.locator(`[data-row-id="${openPrId}"]`);

  // Both settled rows lead with Complete and hide Start behind the overflow
  // menu; the still-open PR keeps the ordinary Start affordance.
  await expect(mergedRow.getByRole('button', { name: 'Complete' })).toBeVisible();
  await expect(mergedRow.getByRole('button', { name: 'Start', exact: true })).toHaveCount(0);
  await expect(doneRow.getByRole('button', { name: 'Complete' })).toBeVisible();
  await expect(openRow.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await expect(openRow.getByRole('button', { name: 'Complete' })).toHaveCount(0);

  // The settled state is announced on the row itself, not just drawn.
  await expect(mergedRow).toHaveAttribute('aria-label', /done at the source/);
  await expect(openRow).not.toHaveAttribute('aria-label', /done at the source/);

  // The chip still opens the breakdown, so the score stays inspectable.
  await mergedRow.getByRole('button', { name: /done at the source/i }).click();
  await expect(page.getByRole('dialog').getByText('Done at the source')).toBeVisible();
  await page.keyboard.press('Escape');

  // Completing from a settled row runs the ordinary Complete dialog and moves
  // the item out of Signals.
  await mergedRow.getByRole('button', { name: 'Complete' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Mark complete')).toBeVisible();
  await dialog.getByLabel(/hours/i).fill('0');
  await dialog.getByRole('button', { name: 'Complete' }).click();

  await expect(page.locator(`[data-row-id="${mergedPrId}"]`)).toHaveCount(0);
});
