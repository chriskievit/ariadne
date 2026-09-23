import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedLifecycleFixtures } from './seed-agent-sessions';
import { seedLinkedPairInProgress } from './seed-links';

type LifecycleFixtures = ReturnType<typeof seedLifecycleFixtures>;

// Tasks 2 through 7 of this phase changed ItemRow, Dashboard, the rail and
// three dialogs (park, complete, dismiss) with no unit coverage possible --
// this repo's Vitest runs `environment: 'node'`, no jsdom. This spec is the
// only behavioural coverage the lifecycle wiring between Planning and Work
// will ever have. Every assertion here is written against a regression it
// is known to catch, not merely to render a surface once.

function row(page: Page, itemId: number): Locator {
  return page.locator(`[data-row-id="${itemId}"]`);
}

// This suite's own fixtures exist only for one test's assertions, but the
// database they land in outlives it -- shared by the rest of this run, and
// by every spec file that runs after this one (today-reorder.spec.ts and
// work-mode.spec.ts both assert on exact Today/rail row counts and order).
// An item left pinned to Today, or sitting in In-progress forever because a
// test never parked or completed it, would silently change what those
// later specs count. Deletion cascades away its agent_sessions row too
// (DELETE /api/items/[id]/route.ts), so one call undoes both.
//
// The response is checked, not just fired and forgotten -- a delete that
// silently failed used to leave the item behind with nothing in this file's
// own output saying so, which is exactly the kind of leak task 8 exists to
// catch.
async function cleanupItem(page: Page, itemId: number): Promise<void> {
  const response = await page.request.delete(`/api/items/${itemId}`);
  if (!response.ok()) {
    throw new Error(`cleanup: DELETE /api/items/${itemId} failed (${response.status()})`);
  }
}

// seedLifecycleFixtures always creates all ten of its fixtures in one
// call -- a single seed call is simpler to reason about than ten, and
// this is fixture data, not the assertions themselves. That means every
// test using it must clean up all ten, not just the one or two ids it
// happens to name: a test that only deleted the id it read would still
// leave the rest sitting in Today/In-progress for the rest of the run,
// which is exactly the pollution this file exists to avoid. Every fixture
// test below calls this from a `finally` block, never as the last line of
// the test body -- a body that throws before reaching its own cleanup call
// used to leak the whole set, which is what let one failing assertion
// break today-reorder.spec.ts's exact row counts two files later. Attempts
// every id even if one delete throws, so one already-gone fixture never
// stops the rest from being cleaned up.
async function cleanupLifecycleFixtures(page: Page, fixtures: LifecycleFixtures): Promise<void> {
  const ids = [
    fixtures.todayWorkingItemId,
    fixtures.parkDeclineItemId,
    fixtures.parkAcceptItemId,
    fixtures.parkFailItemId,
    fixtures.completeElapsedItemId,
    fixtures.railTodayMarkedItemId,
    fixtures.railTodayUnmarkedItemId,
    fixtures.vocabParkedItemId,
    fixtures.parkedWithSessionItemId,
    fixtures.noSnoozeItemId,
  ];
  const errors: unknown[] = [];
  for (const id of ids) {
    try {
      await cleanupItem(page, id);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `cleanupLifecycleFixtures: ${errors.length} of ${ids.length} fixture deletes failed: ${errors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join('; ')}`
    );
  }
}

// This file can run alone, against a `next dev` server that has never
// served a single request -- every route it hits (the page, the rail, the
// item/session APIs) compiles on first use, and that compile can take
// several seconds longer than this suite's default 5s expect timeout.
// Every other spec file gets this warm-up for free by running after
// something else already has; this one cannot assume that. One throwaway
// page, closed before any test's own page opens, so it shares no state
// with them.
test.beforeAll(async ({ browser }) => {
  const warmupPage = await browser.newPage();
  await warmupPage.goto('/');
  await warmupPage.goto('/work');
  await warmupPage.close();
});

// Resolves the CSS var the browser's own way, rather than hard-coding an
// HSL->RGB conversion here that could quietly drift from app/globals.css's
// actual value and stop meaning anything.
async function resolvedGoldColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'hsl(var(--brand-gold))';
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  });
}

// Checks every channel a gold regression could plausibly use -- text
// colour, background, border, or (for the SVG glyph) fill/stroke -- rather
// than just `color`, which a background-tinted mistake would sail past.
async function usesGold(locator: Locator, goldRgb: string): Promise<boolean> {
  return locator.evaluate((el, gold) => {
    const style = getComputedStyle(el);
    return [style.color, style.backgroundColor, style.borderColor, style.fill, style.stroke].some(
      (value) => value === gold
    );
  }, goldRgb);
}

// Dashboard's liveSessions map loads asynchronously after mount
// (refreshLiveSessions), separately from the item list itself. Acting on a
// row before it lands would make handleParkClick skip the confirmation
// dialog entirely -- it only asks when liveSession is defined -- and every
// assertion downstream would be testing the wrong path. Waiting for the
// marker is also proof the session actually attached to this item.
async function openParkDialog(page: Page, itemId: number): Promise<Locator> {
  const target = row(page, itemId);
  await expect(target.locator('[title="Working"]')).toBeVisible({ timeout: 10_000 });
  await target.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Park', exact: true }).click();
  return page.getByRole('dialog');
}

test("a Today row with a working session shows the state's word, never in Threadline Gold", async ({ page }) => {
  const fixtures = seedLifecycleFixtures('today-word-gold');
  try {
    const { todayWorkingItemId } = fixtures;

    await page.goto('/');
    const target = row(page, todayWorkingItemId);
    // The marker's title attribute is the same word agentStateDisplay hands
    // the rail (SessionRosterRow) -- this locator failing means the two
    // surfaces have drifted apart, not just that the word is missing.
    const marker = target.locator('[title="Working"]');
    await expect(marker).toBeVisible();
    await expect(marker).toContainText('Working');

    const goldRgb = await resolvedGoldColor(page);

    // Positive control: the Today card's own left edge IS legitimately gold
    // (TodaySection.tsx) -- proving the detection method actually recognises
    // gold when it is there. A check that can never fire true would pass even
    // if the marker below went gold, which is exactly the failure mode a
    // naive page-wide "no gold anywhere" assertion would have.
    const todayHeading = page.getByRole('heading', { name: 'Today', exact: true });
    const cardHasGoldEdge = await todayHeading.evaluate((headingEl, gold) => {
      let node: Element | null = headingEl;
      for (let i = 0; i < 6 && node; i += 1) {
        if (getComputedStyle(node).borderLeftColor === gold) return true;
        node = node.parentElement;
      }
      return false;
    }, goldRgb);
    expect(cardHasGoldEdge).toBe(true);

    // The actual assertion: this rule is two phases old, and the issue behind
    // this phase asked for the opposite, so it will be re-proposed. A
    // delegated session is not the thread you are holding (see
    // lib/agent-session-display.ts and SessionRosterRow.tsx's header
    // comments) -- gold belongs to the running-timer dot, never to this.
    expect(await usesGold(marker, goldRgb)).toBe(false);
    expect(await usesGold(marker.locator('svg'), goldRgb)).toBe(false);
    expect(await usesGold(marker.locator('span'), goldRgb)).toBe(false);
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('parking an item with a live session asks first, and declining leaves the session live', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('park-decline');
  try {
    const { parkDeclineTitle, parkDeclineItemId } = fixtures;

    await page.goto('/');
    const dialog = await openParkDialog(page, parkDeclineItemId);
    await expect(dialog).toContainText('Park this item?');

    // Declining the dismiss-too offer, not the park itself -- parking is the
    // action the user actually asked for, and stays checked-by-default only
    // because an agent left working on an item you just parked is the
    // incoherent case, not because declining should mean cancelling.
    await dialog.locator(`#dismiss-session-${parkDeclineItemId}`).uncheck();
    await dialog.getByRole('button', { name: 'Park', exact: true }).click();
    await expect(dialog).toBeHidden();

    // ItemRow closes this dialog the instant it fires the request, without
    // waiting on it (confirmParkCascade never awaits onPark) -- the dialog
    // closing is not proof the park has landed. Dashboard only re-renders the
    // row out of "In progress" once its own handlePark has actually finished,
    // so waiting for that is the real synchronisation point for the API and
    // rail checks below, not a fixed sleep guessing how long a fetch takes.
    await expect(row(page, parkDeclineItemId)).toHaveCount(0, { timeout: 15_000 });

    const buckets = await (await page.request.get('/api/items')).json();
    expect(buckets.parked.some((item: { id: number }) => item.id === parkDeclineItemId)).toBe(true);

    // The never-filtered invariant, and the one most likely to be broken by a
    // well-meaning change: a declined dismiss must leave the session exactly
    // where it was, live in the rail's own list, not merely "not deleted"
    // somewhere the rail no longer shows.
    await page.goto('/work');
    const rail = page.getByRole('navigation', { name: 'Agent sessions' });
    await expect(rail).toContainText(parkDeclineTitle);
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('accepting the dismiss offer ends the session, and the item is parked either way', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('park-accept');
  try {
    const { parkAcceptTitle, parkAcceptItemId } = fixtures;

    await page.goto('/');
    const dialog = await openParkDialog(page, parkAcceptItemId);
    // Checked by default -- accepting means leaving the offer alone.
    await expect(dialog.locator(`#dismiss-session-${parkAcceptItemId}`)).toBeChecked();
    await dialog.getByRole('button', { name: 'Park', exact: true }).click();
    await expect(dialog).toBeHidden();

    // See the decline test above: handlePark's dismissSession + refresh only
    // resolve after the dialog has already closed, so this is what actually
    // proves both the park and the dismiss have landed before checking either.
    await expect(row(page, parkAcceptItemId)).toHaveCount(0, { timeout: 15_000 });

    const buckets = await (await page.request.get('/api/items')).json();
    expect(buckets.parked.some((item: { id: number }) => item.id === parkAcceptItemId)).toBe(true);

    await page.goto('/work');
    const rail = page.getByRole('navigation', { name: 'Agent sessions' });
    // Dismissed, not merely hidden: gone from the live list...
    await expect(rail).not.toContainText(parkAcceptTitle);
    // ...and behind Ended instead, same grammar as SessionPane's own dismiss
    // (session-pane.spec.ts) -- tracked as history, not vanished outright.
    await rail.getByRole('button', { name: /^Ended · \d+$/ }).click();
    await expect(rail).toContainText(parkAcceptTitle);
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('a park that fails with a server error does not dismiss the session', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('park-fail');
  try {
    const { parkFailTitle, parkFailItemId } = fixtures;

    await page.goto('/');
    // parkItem never checked res.ok before this phase, so a 500 here still
    // ran the dismiss and told nobody -- this is the regression this
    // assertion exists to keep fixed.
    await page.route(`**/api/items/${parkFailItemId}/park`, (routeHandle) =>
      routeHandle.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) })
    );

    const dialog = await openParkDialog(page, parkFailItemId);
    // Left checked (the default, "accept the dismiss too") on purpose: this
    // is what makes the assertion below mean something. If dismiss fired
    // unconditionally, the session would end even though nothing else did.
    await dialog.getByRole('button', { name: 'Park', exact: true }).click();

    // The user sees an error rather than a silent, incorrect success.
    await expect(page.getByText('Could not park the item.')).toBeVisible();

    const buckets = await (await page.request.get('/api/items')).json();
    expect(buckets.parked.some((item: { id: number }) => item.id === parkFailItemId)).toBe(false);
    expect(buckets.inProgress.some((item: { id: number }) => item.id === parkFailItemId)).toBe(true);

    await page.goto('/work');
    const rail = page.getByRole('navigation', { name: 'Agent sessions' });
    await expect(rail).toContainText(parkFailTitle);
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test("completing shows the agent's elapsed time, never the user's hours", async ({ page }) => {
  const fixtures = seedLifecycleFixtures('complete-elapsed');
  try {
    const { completeElapsedItemId } = fixtures;

    await page.goto('/');
    const target = row(page, completeElapsedItemId);
    await expect(target.locator('[title="Working"]')).toBeVisible();
    await target.getByRole('button', { name: 'Complete', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Completing stops tracking this session');

    // `~`-prefixed and labelled as the agent's own clock -- formatElapsed
    // renders "m:ss" or "h:mm:ss", and registeredAt was seeded five minutes
    // in the past specifically so this has a real, non-zero duration: a
    // dialog reading the wrong field would still show *something* at 0:00,
    // which a zero-elapsed fixture would let straight through.
    await expect(dialog.getByText(/^~\d+(:\d{2}){1,2} agent's time$/)).toBeVisible();

    // The field beside it is genuinely empty, not merely showing a
    // placeholder that reads the same as a filled-in value -- toHaveValue
    // checks the input's actual value, not its rendered placeholder text.
    await expect(page.locator(`#duration-${completeElapsedItemId}`)).toHaveValue('');

    // Never submitted -- this item would otherwise sit in In-progress forever.
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test("the rail's Today mark mirrors Planning's Today section (today_date), not plan_items", async ({ page }) => {
  const fixtures = seedLifecycleFixtures('rail-today-mark');
  try {
    const { railTodayMarkedTitle, railTodayUnmarkedTitle } = fixtures;

    await page.goto('/work');
    const rail = page.getByRole('navigation', { name: 'Agent sessions' });

    const markedRow = rail.locator('[data-row-id]').filter({ hasText: railTodayMarkedTitle });
    await expect(markedRow).toContainText('Today');

    // The divergent case an earlier implementation got backwards: in today's
    // plan_items, but today_date is unset. Planning's own Today section
    // (getGroupedItems, lib/dashboard.ts) would not show this item either --
    // plan_items is capacity-and-logged-hours bookkeeping for the day, not
    // what Today shows -- so the rail must not mark it.
    const unmarkedRow = rail.locator('[data-row-id]').filter({ hasText: railTodayUnmarkedTitle });
    await expect(unmarkedRow).toBeVisible();
    await expect(unmarkedRow).not.toContainText('Today');
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('the parked group discloses its count, and the way back in reads Unpark', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('vocab-parked');
  try {
    const { vocabParkedTitle } = fixtures;

    await page.goto('/');
    // Same grammar as the rail's own "Ended · N": a state, an interpunct, the
    // count. Not asserting the exact count -- this DB is shared across the
    // whole run, and other specs leave their own parked items behind.
    const disclosure = page.getByRole('button', { name: /^Parked · \d+$/ });
    await expect(disclosure).toBeVisible();
    await disclosure.click();

    // Scoped to this fixture's own title rather than to the first "Unpark" on
    // the page: the shared DB can carry other parked rows in from earlier
    // specs by the time this one runs. Two levels up, not one: the title
    // sits in its own wrapper div alongside the agent marker (task 3), and
    // the row itself -- Unpark's actual parent -- is one level above that.
    const titleEl = page.getByText(vocabParkedTitle, { exact: true });
    const parkedRow = titleEl.locator('xpath=../..');
    await expect(parkedRow.getByRole('button', { name: 'Unpark', exact: true })).toBeVisible();
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('a parked row with a live session still shows the agent marker', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('parked-with-session');
  try {
    const { parkedWithSessionTitle } = fixtures;

    await page.goto('/');
    // The collapsed Parked row is a different render branch from the full
    // row (ItemRow's `item.parked && !fullDetailWhenParked` early return) --
    // opening the disclosure and reading the marker off *that* branch is the
    // only way this test can catch the bug it backs: a fix that only worked
    // on the full-detail row would still leave this early-returned one bare.
    const disclosure = page.getByRole('button', { name: /^Parked · \d+$/ });
    await expect(disclosure).toBeVisible();
    await disclosure.click();

    // Two levels up -- see the vocab-parked test above for why one is not
    // enough: the title's immediate parent is only the marker's own wrapper.
    const titleEl = page.getByText(parkedWithSessionTitle, { exact: true });
    const parkedRow = titleEl.locator('xpath=../..');
    await expect(parkedRow.locator('[title="Working"]')).toBeVisible();
    await expect(parkedRow.getByRole('button', { name: 'Unpark', exact: true })).toBeVisible();
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test('a row with no onSnooze never offers a snooze picker, from the menu or the keyboard', async ({ page }) => {
  const fixtures = seedLifecycleFixtures('no-snooze');
  try {
    const { noSnoozeItemId } = fixtures;

    await page.goto('/');
    const target = row(page, noSnoozeItemId);
    await target.waitFor();

    // The menu route: ItemSection never passes onSnooze at all, so the menu
    // must not offer the item that leads to it.
    await target.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('menuitem', { name: /^Snooze/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    // The keyboard route: this is the actual bug (task 2) -- 'e' used to
    // open the picker regardless of onSnooze, on every row, and the "Snooze
    // this item?" dialog it led to had no working Snooze button behind it.
    await target.focus();
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await cleanupLifecycleFixtures(page, fixtures);
  }
});

test("a linked-item complete cascade never fires when the main item's own complete fails", async ({ page }) => {
  const suffix = `complete-cascade-fail-${Date.now()}`;
  const { prItemId, adoItemId } = seedLinkedPairInProgress(suffix);
  try {
    await page.goto('/');

    // The regression this backs: closeCompleteCascade used to fire the main
    // item's onComplete and then the linked-item loop unconditionally, so a
    // 500 on the main item still completed everything linked to it -- the
    // user saw "Completed. Undo" right beside "Could not complete the item."
    // This is the primary-action-first rule task 4 exists to enforce.
    await page.route(`**/api/items/${prItemId}/complete`, (routeHandle) =>
      routeHandle.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) })
    );

    const prRow = row(page, prItemId);
    await prRow.waitFor();
    await prRow.getByRole('button', { name: 'Complete', exact: true }).click();

    const markCompleteDialog = page.getByRole('dialog', { name: 'Mark complete' });
    await markCompleteDialog.locator(`#duration-${prItemId}`).fill('1');
    await markCompleteDialog.getByRole('button', { name: 'Complete', exact: true }).click();

    const cascadeDialog = page.getByRole('dialog', { name: /Complete linked item/ });
    await expect(cascadeDialog).toBeVisible();
    await cascadeDialog.getByRole('button', { name: /^Complete (it|all)$/ }).click();

    await expect(page.getByText('Could not complete the item.')).toBeVisible();

    // closeCompleteCascade's own cascade loop is fire-and-forget, with no UI
    // signal at all when it runs -- the toast above only ever reports the
    // main item's own outcome. Without a deliberate wait here, a regression
    // that dropped the gate and re-introduced the unconditional loop would
    // still often pass this assertion on a fast dev server, simply because
    // the buggy cascade's own network round trip had not landed yet when the
    // buckets below were fetched. A network idle wait, not a fixed sleep --
    // the real bug this backs makes an extra request, so waiting for the
    // page's outstanding requests to settle is what actually gives it the
    // chance to land before the assertion below runs.
    await page.waitForLoadState('networkidle');

    // The primary action failed, so the cascade must never have fired --
    // both items are exactly where they started, not "PR failed, ADO done".
    const buckets = await (await page.request.get('/api/items')).json();
    expect(buckets.inProgress.some((item: { id: number }) => item.id === prItemId)).toBe(true);
    expect(buckets.inProgress.some((item: { id: number }) => item.id === adoItemId)).toBe(true);
  } finally {
    await page.request.delete(`/api/items/${prItemId}`);
    await page.request.delete(`/api/items/${adoItemId}`);
  }
});

// The running-timer control's "Stop timer" name is covered by
// e2e/timer-pause.spec.ts, which finds it by that exact name, clicks it and
// proves it stops the timer. It is deliberately not re-asserted here: doing
// so needs a real timer, and a started-then-stopped timer writes a time_logs
// row on an ad-hoc item that nothing can delete (ItemHasLoggedTimeError).
// suggest.spec.ts expects the "rough defaults" copy, which only shows while
// fewer than MIN_SAMPLES_FOR_MEDIAN (3) ad-hoc logs exist in the shared e2e
// database -- and two other specs already leave one each. A third turned
// suggest.spec red whenever the whole suite ran.

test("the Suggest panel's decline reads Not now", async ({ page }) => {
  await page.goto('/');
  // 'i' opens Plan the day straight at the suggested step regardless of
  // whether Today already has picks -- see lib/keymap.ts and
  // GlobalKeymapProvider's case 'i'.
  await page.keyboard.press('i');

  const dialog = page.getByRole('dialog');
  const decline = dialog.getByRole('button', { name: 'Not now', exact: true });
  await expect(decline).toBeVisible();
  await decline.click();
  await expect(dialog).toBeHidden();
});
