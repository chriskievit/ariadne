import { test, expect } from '@playwright/test';
import { createItem } from './helpers';

test('typing a filter shows a removable pill and a persistent clear button', async ({ page, request }) => {
  // The dashboard replaces Signals (and its filter bar) with a first-run
  // empty state when there are no items anywhere -- seed one so the bar is
  // actually on the page regardless of what other tests have left behind.
  await createItem(request, `Filter bar test ${Date.now()}`);

  await page.goto('/');

  const input = page.getByLabel('Filter signals');
  await input.fill('source:github flaky');

  const filterPill = page.getByRole('group', { name: 'Active filters' });
  await expect(filterPill.getByText('source:github')).toBeVisible();
  await expect(filterPill.getByText('flaky')).toBeVisible();

  const clearButton = page.getByRole('button', { name: 'Clear filters' });
  await expect(clearButton).toBeVisible();

  await clearButton.click();
  await expect(input).toHaveValue('');
  await expect(page.getByRole('group', { name: 'Active filters' })).toHaveCount(0);
});

test('removing a single filter pill only drops that filter', async ({ page, request }) => {
  await createItem(request, `Filter bar test ${Date.now()}`);

  await page.goto('/');

  const input = page.getByLabel('Filter signals');
  await input.fill('source:github group:blocked');

  await page.getByRole('button', { name: 'Remove filter source:github' }).click();
  await expect(input).toHaveValue('group:blocked');
});
