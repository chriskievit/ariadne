import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createItem, ensureNoRunningTimer } from './helpers';

// Three row-menu items open a dialog: Snooze, Delete and Open in Claude. The
// dialog mounts while the menu is still up, and Radix keeps a single
// module-level "original" value for <body>'s pointer-events: a modal menu has
// already written `none` there, so the dialog captures `none` as the value to
// restore and writes it back when it closes. The page then swallows every
// click until a reload -- no error, no visible cause.
//
// ItemRow's menu is `modal={false}` to keep that capture clean. These tests
// fail if it goes back to modal, which is why they assert on real clicks and
// not just on the style value.
async function bodyPointerEvents(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).pointerEvents);
}

async function openRowMenuItem(page: Page, itemId: number, name: string | RegExp) {
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name }).click();
  await page.getByRole('dialog').waitFor();
}

for (const item of [
  { menuItem: /^Snooze/, dialogName: /snooze/i },
  { menuItem: 'Delete', dialogName: /delete/i },
  { menuItem: 'Open in Claude', dialogName: /claude/i },
]) {
  test(`dismissing the ${String(item.menuItem)} dialog leaves the page clickable`, async ({
    page,
    request,
  }) => {
    await ensureNoRunningTimer(request);
    const itemId = await createItem(request, `Menu dialog ${String(item.menuItem)} ${Date.now()}`);

    await page.goto('/');
    await openRowMenuItem(page, itemId, item.menuItem);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    expect(await bodyPointerEvents(page)).not.toBe('none');

    // The style is the mechanism; this is the symptom. Opening the same row's
    // menu again has to actually work.
    const row = page.locator(`[data-row-id="${itemId}"]`);
    await row.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
  });
}

test('deleting a row from its menu leaves the rest of the page clickable', async ({ page, request }) => {
  await ensureNoRunningTimer(request);
  const doomedId = await createItem(request, `Doomed ${Date.now()}`);
  const survivorId = await createItem(request, `Survivor ${Date.now()}`);

  await page.goto('/');
  await openRowMenuItem(page, doomedId, 'Delete');
  await page.getByRole('dialog').getByRole('button', { name: /^Delete$/ }).click();

  await expect(page.locator(`[data-row-id="${doomedId}"]`)).toHaveCount(0);
  expect(await bodyPointerEvents(page)).not.toBe('none');

  // The row that unmounted took its open dialog with it; the surviving row
  // must still respond.
  const survivor = page.locator(`[data-row-id="${survivorId}"]`);
  await survivor.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
});
