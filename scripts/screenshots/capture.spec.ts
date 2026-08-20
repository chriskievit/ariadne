import path from 'node:path';
import { test, expect } from '@playwright/test';
import { SCREENSHOT_DB_PATH } from './playwright.config';
import { resetScreenshotData, seedScreenshotData } from './seed';

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');

// Capture the whole page down to the end of `main`, top bar included, without
// the trailing empty background a fullPage shot of a short page would add.
async function captureContent(page: import('@playwright/test').Page, file: string): Promise<void> {
  // The dev server's floating dev-tools button is fixed to the viewport, so a
  // full-page shot drops it in the middle of the image.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const box = await page.locator('main').boundingBox();
  if (!box) throw new Error('No <main> to measure');
  const width = page.viewportSize()!.width;
  await page.screenshot({
    path: path.join(DOCS_DIR, file),
    // fullPage so the clip isn't capped at the viewport height -- the
    // dashboard is taller than the window.
    fullPage: true,
    clip: { x: 0, y: 0, width, height: Math.ceil(box.y + box.height + 24) },
    animations: 'disabled',
  });
}

test('captures the README screenshots', async ({ page }) => {
  // 1. First run: no tokens, nothing synced, nothing in the database.
  resetScreenshotData(SCREENSHOT_DB_PATH);
  await page.goto('/');
  await expect(page.getByText('Nothing synced yet')).toBeVisible();
  // Source status is client-fetched; on a fresh database it reports both
  // sources as never synced, which is part of what first run really looks like.
  await expect(page.getByText('GitHub failed to sync.')).toBeVisible();
  await expect(page.getByText('Azure DevOps failed to sync.')).toBeVisible();
  await captureContent(page, 'screenshot-empty-state.png');

  // 2. A working day, from seeded fictional data (never a live sync).
  seedScreenshotData(SCREENSHOT_DB_PATH);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Signals' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  // Client-fetched, so wait for it rather than racing the running-timer chip.
  await expect(page.getByLabel('Pause timer')).toBeVisible();
  await captureContent(page, 'screenshot-dashboard.png');
});
