import { test, expect } from '@playwright/test';
import { ensureNoRunningTimer, hideExistingItems } from './helpers';
import { seedAssignedItems } from './seed-collapse';

// A group collapses to its highest-scoring rows, but the cut may never fall
// inside a run of equal scores: rows on the same score lost no comparison,
// so hiding one and showing another claims a ranking the score does not
// have. Every case here is about that promise, plus the two groups the cut
// is not allowed to touch at all.
//
// `assigned` scores 10; anything untouched for more than 5 days adds +15.
// So a 30-day row is 25 and a 1-day row is 10, and a count of each builds a
// tie run of a known length. All of them land in "Lower priority", the group
// that does collapse.

test('the cut extends past five rather than splitting a run of equal scores', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  await hideExistingItems(request);
  // Six rows at 25, then three at 10. The five-row target lands inside the
  // 25s, so the cut has to slide to six and keep them together.
  seedAssignedItems(`tie-${Date.now()}`, [
    { ageDays: 30, count: 6 },
    { ageDays: 1, count: 3 },
  ]);

  await page.goto('/');
  const section = page.locator('section').filter({ hasText: 'Lower priority' }).first();
  await section.waitFor();

  await expect(section.locator('[data-row-id]')).toHaveCount(6);
  await expect(section.getByRole('button', { name: /Lower scoring/ })).toContainText('3');

  // The point of the whole exercise: no row scoring 25 is hidden while
  // another row scoring 25 is on screen.
  await expect(section.getByRole('button', { name: /Urgency 25 of 105/ })).toHaveCount(6);
});

test('the disclosure toggles both ways and keeps its label while open', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  await hideExistingItems(request);
  seedAssignedItems(`toggle-${Date.now()}`, [
    { ageDays: 30, count: 5 },
    { ageDays: 1, count: 2 },
  ]);

  await page.goto('/');
  const section = page.locator('section').filter({ hasText: 'Lower priority' }).first();
  await section.waitFor();

  // Five rows at 25 then two at 10: the score changes exactly at the
  // target, so the cut falls at five and needs no extending.
  await expect(section.locator('[data-row-id]')).toHaveCount(5);
  const disclosure = section.getByRole('button', { name: /Lower scoring/ });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

  await disclosure.click();
  await expect(section.locator('[data-row-id]')).toHaveCount(7);
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  // It must survive expansion rather than unmounting under the user's focus,
  // and it must still say how many rows it is holding.
  await expect(disclosure).toContainText('2');

  await disclosure.click();
  await expect(section.locator('[data-row-id]')).toHaveCount(5);
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
});

test('j reaches the disclosure instead of stepping over the rows it hides', async ({
  page,
  request,
}) => {
  await ensureNoRunningTimer(request);
  await hideExistingItems(request);
  seedAssignedItems(`keys-${Date.now()}`, [
    { ageDays: 30, count: 5 },
    { ageDays: 1, count: 2 },
  ]);

  await page.goto('/');
  const section = page.locator('section').filter({ hasText: 'Lower priority' }).first();
  await section.waitFor();

  // Focus lands on row 1, so five presses walk rows 2-5 and then step onto
  // the disclosure instead of jumping to the next group.
  await section.locator('[data-row-id]').first().focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('j');

  const disclosure = section.getByRole('button', { name: /Lower scoring/ });
  await expect(disclosure).toBeFocused();

  // And Enter on it works, so the keyboard route is complete rather than
  // just reachable.
  await page.keyboard.press('Enter');
  await expect(section.locator('[data-row-id]')).toHaveCount(7);
});

test('"Waiting on you" never collapses, however many rows it holds', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  await hideExistingItems(request);
  // Nine mentions, all stale, so they all tie at 55 -- the exact shape that
  // hid a review request behind the old cut. This group owes action on every
  // row, so the header count has to be a promise the rows keep.
  seedAssignedItems(`waiting-${Date.now()}`, [{ ageDays: 30, count: 9 }], 'mention');

  await page.goto('/');
  const waiting = page.locator('section').filter({ hasText: 'Waiting on you' }).first();
  await waiting.waitFor();

  await expect(waiting.locator('[data-row-id]')).toHaveCount(9);
  await expect(waiting.getByRole('button', { name: /Lower scoring/ })).toHaveCount(0);
});

test('a query is never collapsed, so filtering shows the whole answer', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  await hideExistingItems(request);
  seedAssignedItems(`query-${Date.now()}`, [
    { ageDays: 30, count: 5 },
    { ageDays: 1, count: 2 },
  ]);

  await page.goto('/');
  const section = page.locator('section').filter({ hasText: 'Lower priority' }).first();
  await section.waitFor();
  await expect(section.locator('[data-row-id]')).toHaveCount(5);

  // Narrowing to the same set is an explicit request to see it. All 7 match
  // `source:ado`, so all 7 have to render and the disclosure has to go.
  await page.locator('body').press('/');
  await page.keyboard.type('source:ado');

  const filtered = page.locator('section').filter({ hasText: 'Lower priority' }).first();
  await expect(filtered.locator('[data-row-id]')).toHaveCount(7);
  await expect(filtered.getByRole('button', { name: /Lower scoring/ })).toHaveCount(0);
});
