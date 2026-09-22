import { test, expect } from '@playwright/test';
import { seedAgentSessions } from './seed-agent-sessions';

// Tasks 7 and 8 (the session pane and the diff view) have no unit coverage --
// this repo's Vitest runs `environment: 'node'`, with no jsdom and no
// testing-library, so a component test is not possible there. This spec is
// the only behavioural coverage either surface will ever have, and it is
// written to fail on the specific regressions each assertion guards against,
// not merely to render the page once.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Document-relative, not viewport-relative: the rail sits above the pane in
// the mobile stacked layout, and this suite reuses one on-disk database
// across runs, so the rail keeps growing taller as more sessions
// accumulate. Clicking a different rail row scrolls the page to a
// different point, which would make a plain boundingBox().y comparison
// fail for a reason that has nothing to do with the pane -- scroll
// position, not a real layout shift. Correcting for scrollY isolates the
// one thing this test is actually meant to catch: the action row moving
// because of what changed *inside* the pane.
async function documentTop(locator: import('@playwright/test').Locator): Promise<number> {
  return locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
}

test('the needs-you question shows only when it is your move, and never drags the action row with it', async ({
  page,
}) => {
  const { workingTitle, needsYouTitle, needsYouMessage } = seedAgentSessions('pane-question');

  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  const region = page.getByRole('region', { name: 'Session' });
  const actionRow = region.getByRole('button', { name: 'Dismiss' });

  // 375px and a comfortable desktop width. A previous review found the
  // action row held its position at desktop only -- it moved at phone
  // width when the header above it (title + state label) wrapped
  // differently for a longer state word. Both widths must hold now.
  for (const viewport of [
    { width: 375, height: 800 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);

    await rail.getByText(needsYouTitle).click();
    // Catches: the question box never rendering, or rendering for every
    // state instead of only needs_you -- either way, whoever is waiting on
    // a decision would not see it asked.
    await expect(region.getByText(needsYouMessage)).toBeVisible();
    await expect(actionRow).toBeVisible();
    const needsYouRowTop = await documentTop(actionRow);

    await rail.getByText(workingTitle).click();
    // Catches: the question box staying up for a session that is not
    // actually waiting on you -- a false alarm baked into the UI.
    await expect(region.getByText(needsYouMessage)).toHaveCount(0);
    await expect(actionRow).toBeVisible();
    const workingRowTop = await documentTop(actionRow);

    // The assertion the whole test exists for: swapping between a session
    // that needs you and one that doesn't changes the content below and
    // above the action row (the state label's word length, the question
    // box's presence) but must never move the row itself -- it is where a
    // person's eye and cursor return to on every session, and a shift here
    // turns a considered click on Dismiss into an accidental one.
    expect(needsYouRowTop).toBe(workingRowTop);
  }
});

test('the action row does not move when the diff resolves and the branch badge appears', async ({ page }) => {
  const { diffTitle, diffBranch, workingTitle } = seedAgentSessions('pane-badge-row');

  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  const region = page.getByRole('region', { name: 'Session' });
  const actionRow = region.getByRole('button', { name: 'Dismiss' });

  // The needs-you/working comparison above proves nothing about this
  // regression: neither of those sessions has a `cwd`, so their diff never
  // resolves to `available`, the branch badge never renders for either one,
  // and a badge placed above the action row would never have moved
  // anything in that test. Only a session that actually resolves a diff --
  // diffTitle, seeded with a real fixture repo -- can catch a badge
  // rendered in the wrong place. The diff request is held open so the
  // "before" measurement is taken from a genuinely unresolved pane, not
  // from whatever the network happened to return before the test looked.
  let releaseDiff = () => {};
  const diffHeld = new Promise<void>((resolve) => {
    releaseDiff = resolve;
  });
  await page.route('**/api/agent-sessions/*/diff', async (route) => {
    await diffHeld;
    await route.continue();
  });

  await rail.getByText(diffTitle).click();
  await expect(region.getByText('Loading the diff…')).toBeVisible();
  const beforeDiffTop = await documentTop(actionRow);

  releaseDiff();
  // Synchronise on the framing sentence, not the badge itself: the badge has
  // no role or test id of its own, and a mutation that renders it in two
  // places at once (the bug this test replays against) would make a
  // text-exact badge locator ambiguous and fail for the wrong reason. The
  // framing sentence is unique on the page (proven in the test below) and
  // only ever renders once the diff has actually resolved to `available`,
  // which is the one thing this test needs to know has happened.
  const resolved = region.getByText(new RegExp(`^On ${escapeRegExp(diffBranch)}, compared with [0-9a-f]{7,}$`));
  await expect(resolved).toBeVisible();
  const afterDiffTop = await documentTop(actionRow);

  // Catches: the branch badge rendering above the action row instead of
  // inside the Diff section below it. A badge that appears out of nowhere
  // the instant the diff resolves and shoves the row down mid-visit is
  // exactly the "appeared a moment before" hazard SessionPane's own comment
  // warns about -- a click aimed at Dismiss landing on whatever the badge
  // pushed into its place instead.
  expect(afterDiffTop).toBe(beforeDiffTop);

  // Cheap to also compare against a session whose diff never resolves at
  // all: the row must land in the same place regardless of which of the
  // two ends the "diff never available" vs "diff fully resolved" -- range
  // it is showing.
  await rail.getByText(workingTitle).click();
  await expect(actionRow).toBeVisible();
  const workingTop = await documentTop(actionRow);
  expect(workingTop).toBe(afterDiffTop);
});

test('the transcript reads oldest first, and the diff is framed as the branch, never as the session\'s own work', async ({
  page,
}) => {
  const {
    transcriptTitle,
    transcriptOldest,
    transcriptNewest,
    diffTitle,
    diffBranch,
    diffFixtureFile,
    diffEmptyTitle,
    diffEmptyBranch,
  } = seedAgentSessions('pane-transcript-diff');

  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  const region = page.getByRole('region', { name: 'Session' });

  await rail.getByText(transcriptTitle).click();
  const oldestEntry = region.getByText(transcriptOldest);
  const newestEntry = region.getByText(transcriptNewest);
  await expect(oldestEntry).toBeVisible();
  await expect(newestEntry).toBeVisible();
  const oldestBox = await oldestEntry.boundingBox();
  const newestBox = await newestEntry.boundingBox();
  expect(oldestBox).not.toBeNull();
  expect(newestBox).not.toBeNull();
  // Catches: a transcript rendered newest-first -- a stray reversal, or the
  // rail's own most-recent-first convention (used for the Ended list)
  // leaking into the pane -- which would read as the agent replying before
  // you asked anything.
  expect(oldestBox!.y).toBeLessThan(newestBox!.y);

  await rail.getByText(diffTitle).click();
  // Catches: relabelling this as "what the agent changed", which the diff
  // route cannot actually back up -- Ariadne records no base commit at
  // launch, so it cannot separate the agent's commits from ones already on
  // the branch. "On <branch>, compared with <base>" is the only framing
  // that stays true either way, and this pins the exact wording, not just
  // the presence of a diff.
  const framing = region.getByText(new RegExp(`^On ${escapeRegExp(diffBranch)}, compared with [0-9a-f]{7,}$`));
  await expect(framing).toBeVisible();

  // The fixture's branch carries one real, known change -- a deterministic
  // diff lets this assert the actual file and counts, not just that some
  // diff rendered. Catches --numstat parsing silently landing on the wrong
  // file or the wrong add/remove counts.
  await expect(region.getByText(diffFixtureFile)).toBeVisible();
  await expect(region.getByText('+3')).toBeVisible();
  await expect(region.getByText('-0')).toBeVisible();

  const patchToggle = region.getByRole('button', { name: /^Patch/ });
  const patch = region.locator('#session-diff-patch');
  await expect(patchToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(patch).toHaveCount(0);

  await patchToggle.click();
  // Catches: a disclosure that only opens (or is stuck open from the
  // start) -- half of "toggles both ways" is opening on demand.
  await expect(patchToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(patch).toBeVisible();
  // The patch itself is real diff output, not a stand-in -- one of the
  // fixture's own added lines must actually be in it.
  await expect(patch).toContainText('three');

  await patchToggle.click();
  // Catches: the other half -- a disclosure that opens but never closes
  // again would leave a multi-hundred-line patch permanently in the page.
  await expect(patchToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(patch).toHaveCount(0);

  await rail.getByText(diffEmptyTitle).click();
  // The diff route's other "available" variant: a branch that resolved a
  // base fine but has nothing on it yet. Catches this state being rendered
  // as unavailable (hiding a real, if empty, answer behind an error-shaped
  // message) or dropping "No changes yet." so it reads the same as the
  // populated case with an empty file list.
  const emptyFraming = region.getByText(
    new RegExp(`^On ${escapeRegExp(diffEmptyBranch)}, compared with [0-9a-f]{7,}\\. No changes yet\\.$`)
  );
  await expect(emptyFraming).toBeVisible();
  await expect(region.getByRole('button', { name: /^Patch/ })).toHaveCount(0);
});

test('dismissing a session drops it from the live rail and never claims the agent stopped', async ({ page }) => {
  const { dismissableTitle } = seedAgentSessions('pane-dismiss');

  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  const region = page.getByRole('region', { name: 'Session' });

  await rail.getByText(dismissableTitle).click();
  await region.getByRole('button', { name: 'Dismiss' }).click();

  const dialog = page.getByRole('dialog');
  // Catches: the copy drifting to imply Ariadne stops the agent. Ariadne
  // has no handle on the Warp process -- only Warp does -- so a person who
  // reads this as "stop" would not think to go and stop it themselves.
  await expect(dialog).toContainText('Stop tracking this session. The agent keeps running until you stop it in Warp.');

  await dialog.getByRole('button', { name: 'Dismiss' }).click();
  await expect(dialog).toHaveCount(0);

  // Catches: a dismissed session left showing in the live rail, which would
  // contradict the action a person just confirmed.
  await expect(rail).not.toContainText(dismissableTitle);

  const disclosure = rail.getByRole('button', { name: /^Ended · \d+$/ });
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  await disclosure.click();
  // Catches: a dismissal that removes the row from the live list but never
  // lands it anywhere -- neither tracked nor visible as history.
  await expect(rail).toContainText(dismissableTitle);
});

test('resume is never offered on a session Ariadne has already dismissed', async ({ page }) => {
  const { dismissedTitle } = seedAgentSessions('pane-resume-guard');

  await page.goto('/work');
  const rail = page.getByRole('navigation', { name: 'Agent sessions' });
  const region = page.getByRole('region', { name: 'Session' });

  // Seeded already-dismissed, so it starts behind Ended, not in the live
  // list.
  const disclosure = rail.getByRole('button', { name: /^Ended · \d+$/ });
  await disclosure.click();
  await rail.getByText(dismissedTitle).click();

  // Catches: offering Resume here. This session carries an agentSessionId
  // -- everything a working Resume button needs -- deliberately, because
  // the guard that must suppress it is `endReason === 'dismissed'`, not the
  // absence of the data a real dismissed-but-still-running session would
  // still have. Dismissal only ends Ariadne's own record; the agent behind
  // this row may still be running, and offering Resume would start a
  // second one on the same conversation.
  await expect(region.getByRole('button', { name: /Resume/ })).toHaveCount(0);
  // The pane still rendered the right session, not an empty state.
  await expect(region.getByRole('button', { name: 'Dismiss' })).toBeVisible();
});
