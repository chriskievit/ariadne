import { test, expect, type Locator, type Page } from '@playwright/test';
import { createItem } from './helpers';

// The grip's accessible name is "Reorder <title>", so the handles alone give
// us Today's order without depending on row internals. Other specs may leave
// their own items pinned, so keep only the ones this test created.
async function gripOrder(scope: Page | Locator, titles: string[]): Promise<string[]> {
  const labels = await scope
    .locator('button[aria-label^="Reorder "]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace('Reorder ', '')).filter((title) => titles.includes(title));
}

async function pinTwoItems(request: Parameters<typeof createItem>[0], stamp: number) {
  const titles = [`Reorder first ${stamp}`, `Reorder second ${stamp}`];
  for (const title of titles) {
    const itemId = await createItem(request, title);
    // The same path the 't' pin uses: sets today_date and adds the plan item.
    await request.post(`/api/items/${itemId}/today`, { data: {} });
  }
  return titles;
}

// Positions are asserted by shape, not value: every test in this file leaves
// its items pinned, so Today's length depends on what ran before.
function pickedUp(title: string): RegExp {
  return new RegExp(`Picked up ${title}, position \\d+ of \\d+\\.`);
}

function movedTo(title: string): RegExp {
  return new RegExp(`${title} moved to position \\d+ of \\d+\\.`);
}

function reorderResponse(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes('/api/plan/items/reorder') && res.request().method() === 'PUT'
  );
}

test('a Today row can be reordered by keyboard and the new order persists', async ({ page, request }) => {
  const [first, second] = await pinTwoItems(request, Date.now());

  await page.goto('/');
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([first, second]);

  // Focus the grip, lift, move down one, drop. Each step waits for the drag
  // state to settle -- keys sent back-to-back outrun the sensor -- which also
  // asserts the announcements a screen reader would hear.
  const live = page.locator('[role="status"][aria-live]');
  const grip = page.getByRole('button', { name: `Reorder ${first}` });
  const persisted = reorderResponse(page);
  await grip.focus();
  await page.keyboard.press('Space');
  await expect(grip).toHaveAttribute('aria-pressed', 'true');
  await expect(live).toContainText(pickedUp(first));
  await page.keyboard.press('ArrowDown');
  await expect(live).toContainText(movedTo(first));
  await page.keyboard.press('Space');
  expect((await persisted).status()).toBe(200);

  await expect.poll(() => gripOrder(page, [first, second])).toEqual([second, first]);

  // The order is server state, not just local component state.
  await page.reload();
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([second, first]);

  // Escape abandons a drag without reordering.
  await page.getByRole('button', { name: `Reorder ${second}` }).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([second, first]);
});

test('a Today row can be dragged with the mouse', async ({ page, request }) => {
  const [first, second] = await pinTwoItems(request, Date.now() + 1);

  await page.goto('/');
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([first, second]);

  const from = await page.getByRole('button', { name: `Reorder ${first}` }).boundingBox();
  const to = await page.getByRole('button', { name: `Reorder ${second}` }).boundingBox();
  if (!from || !to) throw new Error('grip handles are not visible');

  const persisted = reorderResponse(page);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Clear the 4px activation distance first, then travel past the next row's
  // midpoint so closestCenter picks it as the drop target.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 5, { steps: 10 });
  await page.mouse.up();
  expect((await persisted).status()).toBe(200);

  await expect.poll(() => gripOrder(page, [first, second])).toEqual([second, first]);
});

test('step 3 of Plan the day reorders the same list Today shows', async ({ page, request }) => {
  const [first, second] = await pinTwoItems(request, Date.now() + 2);

  await page.goto('/');
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([first, second]);

  await page.keyboard.press('p');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('step 1 of 4');
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog).toContainText('step 3 of 4');
  await expect.poll(() => gripOrder(dialog, [first, second])).toEqual([first, second]);

  const live = dialog.locator('[role="status"][aria-live]');
  const grip = dialog.getByRole('button', { name: `Reorder ${first}` });
  const persisted = reorderResponse(page);
  await grip.focus();
  await page.keyboard.press('Space');
  await expect(grip).toHaveAttribute('aria-pressed', 'true');
  await expect(live).toContainText(pickedUp(first));
  await page.keyboard.press('ArrowDown');
  await expect(live).toContainText(movedTo(first));
  await page.keyboard.press('Space');
  expect((await persisted).status()).toBe(200);

  await expect.poll(() => gripOrder(dialog, [first, second])).toEqual([second, first]);

  // Closing the dialog, Today shows the order chosen in the ritual -- one list,
  // not two.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => gripOrder(page, [first, second])).toEqual([second, first]);
});
