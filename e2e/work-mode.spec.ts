import { test, expect } from '@playwright/test';
import { seedAgentSessions } from './seed-agent-sessions';

test('the mode switch reframes the app and the rail orders by whose turn it is', async ({ page }) => {
  const { workingTitle, needsYouTitle, neverRegisteredTitle, endedTitle } = seedAgentSessions('switch');

  await page.goto('/');

  const modes = page.getByRole('radiogroup', { name: 'Mode' });
  await expect(modes.getByRole('radio', { name: 'Planning' })).toHaveAttribute('aria-checked', 'true');

  await modes.getByRole('radio', { name: 'Work' }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(modes.getByRole('radio', { name: 'Work' })).toHaveAttribute('aria-checked', 'true');

  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  await expect(rail).toBeVisible();

  // A row's accessible name is a concatenation of its title and state label
  // (and "no reporting" for an agent Ariadne cannot hear from). Pin that a
  // row stays reachable by role and name, rather than only by the
  // data-row-id hook the rest of this spec uses -- a regression that moved
  // the title or the label out of the button's text content would still
  // pass every other assertion here.
  await expect(rail.getByRole('button', { name: new RegExp(`${needsYouTitle}.*Needs you`) })).toBeVisible();

  // Needs-you sorts above working, because the next move is yours on one of
  // them and not on the other. Both are read from the rail as rendered.
  const liveTitles = await rail.locator('[data-row-id]').allInnerTexts();
  const needsYouIndex = liveTitles.findIndex((text) => text.includes(needsYouTitle));
  const workingIndex = liveTitles.findIndex((text) => text.includes(workingTitle));
  expect(needsYouIndex).toBeGreaterThanOrEqual(0);
  expect(workingIndex).toBeGreaterThan(needsYouIndex);

  // Every state carries a word, not only a colour.
  await expect(rail).toContainText('Needs you');
  await expect(rail).toContainText('Working');

  // An ended session is behind the disclosure, not in the live list.
  await expect(rail).not.toContainText(endedTitle);
  const disclosure = rail.getByRole('button', { name: /^Ended · \d+$/ });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(rail).toContainText(endedTitle);
  // Two-way, always.
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(rail).not.toContainText(endedTitle);

  // The glance state answers "is anything waiting on me" before you click.
  // `role="region"` is explicit on the <section> (Task 6), so this does not
  // depend on a browser promoting a bare aria-label into the region role.
  await expect(page.getByRole('region', { name: 'Session' })).toContainText('Needs you');

  // The failure a person can act on explains itself.
  await rail.getByText(neverRegisteredTitle).click();
  await expect(page.getByRole('region', { name: 'Session' })).toContainText('trust a folder');
});

test('Report belongs to neither mode', async ({ page }) => {
  await page.goto('/report');
  const modes = page.getByRole('radiogroup', { name: 'Mode' });
  await expect(modes.getByRole('radio', { name: 'Planning' })).toHaveAttribute('aria-checked', 'false');
  await expect(modes.getByRole('radio', { name: 'Work' })).toHaveAttribute('aria-checked', 'false');
});

test('⌘K opens the command palette on /work, without the dashboard-only commands', async ({ page }) => {
  await page.goto('/work');

  await page.keyboard.press('Control+k');

  const palette = page.getByRole('dialog');
  await expect(palette.getByPlaceholder('Search signals, jump to a view, or type a filter…')).toBeVisible();

  // "Go to" commands have no dashboard dependency, so they work everywhere.
  await expect(palette.getByText('Dashboard', { exact: true })).toBeVisible();

  // Wrap-up and the scoring reference live in Dashboard's own state, which
  // isn't mounted on /work -- CommandPaletteHost leaves them off the palette
  // here rather than offering a command with nothing behind it.
  await expect(palette.getByText('Wrap up the day')).toHaveCount(0);
  await expect(palette.getByText('How Ariadne ranks things')).toHaveCount(0);
  await expect(palette.getByText('Add an ad-hoc item')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});
