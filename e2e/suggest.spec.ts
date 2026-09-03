import { test, expect, type Page } from '@playwright/test';
import { createItem, hideExistingItems } from './helpers';

// Ad-hoc items are the only source an e2e run can create, so these specs
// cover the surface and the accept path. The lean is exercised in
// lib/suggest.test.ts instead: it only acts on the pull-request/work-item
// split, and ad-hoc rows are exempt from it by design.
async function seedPool(request: Parameters<typeof createItem>[0], stamp: number): Promise<string[]> {
  await hideExistingItems(request);
  const titles = [1, 2, 3, 4].map((n) => `Suggest candidate ${n} ${stamp}`);
  for (const title of titles) {
    await createItem(request, title);
  }
  return titles;
}

function pinButton(page: Page) {
  return page.getByRole('dialog').getByRole('button', { name: /Pin \d+ to today/ });
}

async function pinCount(page: Page): Promise<number> {
  return Number((await pinButton(page).textContent())!.match(/\d+/)![0]);
}

test('suggests a day, then pins only what the user keeps', async ({ page, request }) => {
  const titles = await seedPool(request, Date.now());

  await page.goto('/');
  // Keyboard entry, since keyboard-first is a durable principle here. Not
  // 'S': that letter is row-scope Star (see lib/keymap.ts).
  await page.keyboard.press('i');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('step 2 of 4');
  await expect(dialog.getByRole('radio', { name: 'Suggested' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('radio', { name: 'Balanced' })).toHaveAttribute('aria-checked', 'true');

  await expect(pinButton(page)).toBeEnabled();
  await expect(pinButton(page)).toContainText(String(titles.length));

  // With no logged time yet, every duration is a fixed default and the panel
  // has to say so rather than presenting a guess as a measurement.
  await expect(dialog).toContainText('Durations are rough defaults');

  // Switching algorithm keeps the panel in place rather than emptying it.
  await page.keyboard.press('2');
  await expect(dialog.getByRole('radio', { name: 'Quick wins' })).toHaveAttribute('aria-checked', 'true');
  await expect(pinButton(page)).toBeEnabled();

  // Unchecking drops the count on the button, and nothing is written yet.
  const before = await pinCount(page);
  await dialog.locator('input[type="checkbox"]').first().uncheck();
  await expect(pinButton(page)).toContainText(String(before - 1));

  await pinButton(page).click();

  // Accepting lands on the estimate step, where the durations it worked out
  // are offered as placeholders rather than written as estimates.
  await expect(dialog).toContainText('step 3 of 4');
  const accept = dialog.getByRole('button', { name: /Accept all rough durations/ });
  await expect(accept).toBeVisible();
  const roughInputs = dialog.locator('input[placeholder^="~"]');
  await expect(roughInputs.first()).toHaveValue('');
  expect(await roughInputs.count()).toBe(before - 1);

  await accept.click();
  await expect(accept).toHaveCount(0);
  await expect(roughInputs.first()).not.toHaveValue('');
});

test('dismissing a suggestion leaves the day exactly as it was', async ({ page, request }) => {
  await seedPool(request, Date.now());

  await page.goto('/');
  const grips = page.locator('button[aria-label^="Reorder "]');
  const before = await grips.count();

  await page.keyboard.press('i');
  const dialog = page.getByRole('dialog');
  await expect(pinButton(page)).toBeEnabled();
  await dialog.getByRole('button', { name: 'Dismiss' }).click();

  await expect(dialog).toBeHidden();
  await expect(grips).toHaveCount(before);
});

test('All signals stays the default mode and keeps its own copy', async ({ page, request }) => {
  await seedPool(request, Date.now());

  await page.goto('/');
  await page.keyboard.press('p');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('step 1 of 4');
  await dialog.getByRole('button', { name: 'Next' }).click();

  await expect(dialog).toContainText('step 2 of 4');
  await expect(dialog.getByRole('radio', { name: 'All signals' })).toHaveAttribute('aria-checked', 'true');
  // The claim belongs to this list, and must not appear over a suggestion.
  await expect(dialog).toContainText('Ordered by score. Nothing is recommended.');

  await dialog.getByRole('radio', { name: 'Suggested' }).click();
  await expect(dialog).not.toContainText('Ordered by score. Nothing is recommended.');
});
