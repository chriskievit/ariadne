import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedAgentSessions } from './seed-agent-sessions';
import { createItem, setRepoPathOverride, watchWarpNavigation } from './helpers';

// Opens the row's overflow menu and the "Open in Claude" picker on it,
// submitting the picker's default (and, in these specs, only) repo. Shared
// by both specs below: the second one calls it twice on the same item.
async function launchFromRow(page: Page, itemId: number) {
  const row = page.locator(`[data-row-id="${itemId}"]`);
  await row.waitFor();
  await row.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Open in Claude' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // The item has no repo, so ItemRow opened the working-directory picker.
  // handleOpenClaudeClick pre-selects the first configured repo
  // (repos[0]?.path), and this suite only ever configures one, so the
  // "Open" button is already enabled with no select interaction needed.
  await dialog.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

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

test('⌘K on / offers the dashboard-only wrap-up command', async ({ page }) => {
  // The negative case above pins that dashboard-only commands are absent
  // where Dashboard isn't mounted; this pins the other half -- that they are
  // genuinely present, not just "correctly missing everywhere" by accident
  // (e.g. a registration that silently never fires).
  await page.goto('/');

  await page.keyboard.press('Control+k');

  const palette = page.getByRole('dialog');
  await expect(palette.getByText('Wrap up the day')).toBeVisible();
});

test('Open in Claude on a row launches a tracked session that appears on the Work rail', async ({
  page,
  request,
}) => {
  // Replaces the old untracked /open-claude route: this is the assertion
  // that motivated the whole change. A launch that only wrote a Warp tab
  // config and nothing else left /work with no idea the session existed.
  const warpNav = watchWarpNavigation(page);
  const base = Date.now();
  await setRepoPathOverride(request, `e2e-launch-repo-${base}`, `/tmp/ariadne-e2e-launch-repo-${base}`);
  const title = `Launch row ${base}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  await launchFromRow(page, itemId);

  // Proof handleOpenClaude actually reached the `warpUrl` branch: the fetch
  // to /api/items/:id/agent-session landed, it was a new launch (not
  // `existing`), and window.location.href was assigned to it -- observed
  // here as the warp:// request Chromium still fires even though it never
  // resolves anywhere (see watchWarpNavigation).
  await expect.poll(() => warpNav.urls.at(-1)).toMatch(/^warp:\/\//);

  // /work is server-rendered from listSessionsForDisplay at request time
  // (app/work/page.tsx), so the session the POST above just created is
  // there on first paint -- no poll interval to wait out.
  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  // 'Launching' is the state a fresh session sits in until a hook event (or
  // the reconciler) moves it on; nothing in this spec sends one, so it is
  // the state that proves the row -- not just the item -- exists.
  await expect(rail.getByRole('button', { name: new RegExp(`${title}.*Launching`) })).toBeVisible();
});

test('launching twice on the same item shows the toast and creates no second session', async ({
  page,
  request,
}) => {
  const warpNav = watchWarpNavigation(page);
  const base = Date.now();
  await setRepoPathOverride(request, `e2e-launch-repo-existing-${base}`, `/tmp/ariadne-e2e-launch-repo-${base}`);
  const title = `Launch twice ${base}`;
  const itemId = await createItem(request, title);

  await page.goto('/');
  await launchFromRow(page, itemId);
  await expect.poll(() => warpNav.urls.at(-1)).toMatch(/^warp:\/\//);

  // The item never gets a `repo` from the route (only workingDir is
  // resolved, never persisted onto the item), so the picker opens again --
  // same as the first launch, submitting the same one configured repo.
  await launchFromRow(page, itemId);

  // The toast is the signal that the second launch's response has actually
  // been handled -- only after it lands is "no second request happened" a
  // claim about the finished round trip rather than one that got lucky on
  // timing against a fetch still in flight.
  await expect(
    page.getByText('This item already has an agent session. Find it in its Warp tab, or on the Work page.')
  ).toBeVisible();

  // No second navigation: the route withheld warpUrl for the `existing`
  // response, so handleOpenClaude never reaches the `window.location.href`
  // line a second time, and no second warp:// request is ever fired.
  expect(warpNav.urls).toHaveLength(1);

  const res = await request.get('/api/agent-sessions');
  const { sessions } = (await res.json()) as { sessions: { itemId: number }[] };
  expect(sessions.filter((session) => session.itemId === itemId)).toHaveLength(1);
});
