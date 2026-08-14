# Dashboard wireframes

Phase-by-phase wireframes for the UI/UX pass tracked in #15. Each page shows the dashboard as it
would look after one shippable phase, with numbered callouts and a change ledger keyed to the
task IDs from the source proposal.

## Viewing

These are self-contained HTML files. Open `index.html` in a browser and follow the links, or:

```bash
open docs/wireframes/index.html
```

GitHub will not render them in the browser, so clone or download the folder to view.

| File | Covers |
|---|---|
| [`index.html`](index.html) | Current dashboard redrawn, the three structural gaps, the phase ladder, and every open question answered |
| [`phase-0-foundation.html`](phase-0-foundation.html) | Design tokens, urgency bands, badge pass preview, density, greyscale proof |
| [`phase-1-thesis.html`](phase-1-thesis.html) | Score chip, breakdown popover, one ranked list grouped by actionability, status key |
| [`phase-2-speed-and-control.html`](phase-2-speed-and-control.html) | Focused row, shortcut sheet, local triage, query grammar, command palette |
| [`phase-3-shape-of-a-day.html`](phase-3-shape-of-a-day.html) | Per-source freshness, sprint progress, the four-step planning ritual, Today planned, wrap up |
| [`phase-4-finish.html`](phase-4-finish.html) | Microcopy, the scoring reference, empty and error states, 1024 / 375 layouts |
| `wireframe.css` | Shared stylesheet. Document chrome and a faithful copy of the app's dark tokens |

The document uses two registers deliberately: warm ink and a serif face is the reviewer talking,
cool black and sans is the product. The gold thread is the only element that crosses between them,
because inside the product it marks Today, and nothing else.

## Phases

Dependency order matters. Every phase is a state the dashboard can live in indefinitely.

| Phase | Tasks | Outcome |
|---|---|---|
| 0. Foundation | P0 | One colour system, a 4px grid, urgency no longer carried by colour alone |
| 1. Make the thesis visible | P1, P2, P4, P10 items 1 to 5 | Numeric score on every row with its arithmetic one keypress away, one full-width ranked list grouped by obligation |
| 2. Speed and control | P3, P5, P6, P12 | Keyboard-first, locally triageable, sliceable, instant |
| 3. The shape of a day | P7, P9, P8 | Deliberate choosing, honest capacity, trustworthy freshness |
| 4. Finish | P11, P10 items 6 to 9 | Copy, the transparency surface, responsive and accessibility floor |

If only one phase ever ships, phase 1 is the one. It closes the gap between what the README claims
and what the interface shows.

## What the wireframes settled

The source proposal left nine product decisions open. All nine are answered on `index.html`. The
three that matter most, because the codebase already had an opinion:

**Score bands needed no deriving.** `getPriorityTier()` in `lib/scoring.ts` already cuts at 60, 40
and 25, aligned with `NEEDS_ATTENTION_THRESHOLD`, and the maximum achievable score is 105
(`approved_unmerged` 45, plus due 25, plus unresolved conversations 20, plus stale 15). The chip
inherits the tier that already sorts the list, so its colour and the sort order cannot disagree.

**Ad-hoc placement was already solved, invisibly.** `getGroupedItems()` exempts
`source === 'adhoc'` from the 25-point threshold. Keep the exemption and the shared formula, and
make the exemption visible with a `Kept visible` marker, rather than giving ad-hoc a privileged
always-visible group. Ranking by origin is the thing P2 exists to delete.

**Two sort rules are invisible today and must be disclosed.** `sortByUrgency()` promotes every
in-progress item above everything else regardless of score, and the ad-hoc threshold exemption
overrides the number on screen. A scoring reference that lists only the point table would be
technically accurate and practically a lie, so phase 4 documents both.

## Deliberate deviations from the proposal

**`approved_unmerged` goes in "Waiting on you", not "Moving without you".** It is the highest
scoring reason in the whole formula at 45 points. The repo already believes it is the most urgent
thing that can happen to you, and it is urgent precisely because the ball is now in your court to
merge. Filing it as informational would put the top-scoring reason in the quiet group.

**The section is titled "Signals, 19" with a "12 need something from you" sub-line.** Folding the
old "Everything else, 9" card into the ranked list would otherwise make the headline count jump
from 10 to 19 and read as new work arriving. Two numbers, two denominators.

**"Lower priority" lands in phase 1, not phase 4.** P2 creates the label and P11 renames it.
Renaming a label you created in the same pass costs nothing.

## What the wireframes found in the code

Four things the source proposal could not know from a screenshot:

- `TIER_DOT_CLASS.medium` is `bg-primary`. Indigo currently carries urgency, status and
  interactivity at once, which is a stronger version of the critique than the screenshot suggests.
- `adoStatusVariant()` has no branch for `Blocked`, so it falls through to `outline`, the calmest
  treatment available. Phase 0 contains a genuine bug fix, not just a recolour.
- `ShutdownDialog.tsx` already builds most of P7's wrap-up ritual: completed today, still open,
  total hours logged, carry to tomorrow. What it lacks is the plan it was measured against, an
  estimate comparison, and a name that says what it does. It is currently reached from a link
  called "Review my day" sitting in the Today header, where a planning control belongs.
- Rows must stay one fixed-height line. At the 960px content column that gives titles about 78
  characters, comfortably past the 60-character floor the proposal sets, against roughly 30 in
  today's source columns.

## Guardrails these wireframes hold to

From #15, checked on every page:

- One row grammar: one primary action, one overflow menu, one inline badge. The pin button moves
  into the overflow menu, which reduces the row rather than adding to it.
- Parked stays a dimmed sub-list inside In progress, never a duplicate section.
- Today and In progress stay disjoint buckets.
- The sprint header stays an ambient single-row status line, not a card.

The one guardrail these wireframes knowingly exceed is scope. #15 calls this a polish pass, but its
own guardrails point at P2, which deletes the source-column layout outright. Source as container is
not in the guardrails, and removing it is what buys the full titles, the strict score order, and the
400px of reclaimed space that everything else depends on.

## Source

`ariadne-ui-ux-proposal.md` v1.0, dated 2026-08-14, with `ariadne-market-research.html` as its
companion. Both live outside the repo. Comparators studied: Graphite, Octobox, GitHub Inbox,
Linear, Sunsama, Motion, Reclaim, Glance, Raycast GitHub, LinearB.
