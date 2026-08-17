import { test, expect } from '@playwright/test';

test('settings page groups fields into sections with per-source connection badges', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sync & scoring' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Local repos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Azure DevOps' })).toBeVisible();

  // The e2e database starts empty each run, so neither PAT is saved yet.
  await expect(page.getByText('No token saved')).toHaveCount(2);

  await expect(page.getByRole('button', { name: 'How urgency is scored' })).toBeVisible();
});

test('saving a field round-trips after reload', async ({ page }) => {
  await page.goto('/settings');

  const staleDaysInput = page.getByLabel('Stale PR threshold (days)');
  await staleDaysInput.fill('7');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved.');

  await page.reload();
  await expect(page.getByLabel('Stale PR threshold (days)')).toHaveValue('7');
});
