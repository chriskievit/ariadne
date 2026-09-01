import { test, expect } from '@playwright/test';
import { seedNeedsYou } from './seed-needs-you';

test('the waiting-on-you stat explains itself and lists exactly what it counts', async ({ page, request }) => {
  const { waitingTitle, snoozedId, snoozedTitle, movingTitle } = seedNeedsYou('popover');
  await request.post(`/api/items/${snoozedId}/snooze`, { data: { option: 'next_week' } });

  await page.goto('/');

  const trigger = page.getByRole('button', { name: /waiting on you, show which$/ });
  await expect(trigger).toBeVisible();
  const count = Number((await trigger.innerText()).match(/\d+/)?.[0]);
  expect(count).toBeGreaterThan(0);

  await trigger.click();
  const popover = page.getByRole('dialog', { name: /waiting on you$/ });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText('The next move is yours on these');

  // The number and the list are the same set: every counted item is listed,
  // and nothing is listed that isn't counted.
  await expect(popover.locator('li')).toHaveCount(count);

  await expect(popover).toContainText(waitingTitle);
  await expect(popover).toContainText('Review requested');
  // Snoozed and non-needs-you items are counted by neither the header nor
  // the Signals sub-heading, so they must not appear here either.
  await expect(popover).not.toContainText(snoozedTitle);
  await expect(popover).not.toContainText(movingTitle);

  await popover.getByRole('button', { name: /Show these in Signals/ }).click();
  await expect(popover).toBeHidden();
  await expect(page.locator('#query-bar-input')).toHaveValue('group:waiting,blocked');
  await expect(page.getByText(waitingTitle)).toBeVisible();
  await expect(page.getByText(movingTitle)).toHaveCount(0);
});
