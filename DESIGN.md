---
name: Ariadne
description: The anti-autopilot — a transparent, read-only dashboard for GitHub, Azure DevOps, and ad-hoc work
colors:
  backdrop: "hsl(240 10% 3.9%)"
  ink: "hsl(0 0% 98%)"
  surface: "hsl(240 5.9% 10%)"
  surface-raised: "hsl(240 3.7% 15.9%)"
  muted-ink: "hsl(240 5.5% 64.3%)"
  azure-focus: "hsl(214 90% 46%)"
  azure-focus-ink: "hsl(0 0% 100%)"
  azure-link: "hsl(214 90% 66%)"
  threadline-gold: "hsl(41.4 53.8% 54.1%)"
  signal-red: "hsl(358.8 100% 69.6%)"
  signal-red-ink: "hsl(0 0% 98%)"
  amber-watch: "hsl(38 92% 55%)"
  amber-watch-ink: "hsl(20 14% 4%)"
  success-green: "hsl(142 71% 45%)"
  success-green-ink: "hsl(0 0% 98%)"
  urgency-critical: "hsl(358 75% 59%)"
  urgency-critical-ink: "hsl(0 0% 8%)"
  slate-neutral: "hsl(240 5% 65%)"
  border-hairline: "hsl(0 0% 100% / 10%)"
  input-hairline: "hsl(0 0% 100% / 15%)"
  ring-default: "hsl(240 4.2% 46.3%)"
  series-github: "hsl(212.8 76.8% 56.1%)"
  series-ado: "hsl(159.2 72.7% 35.9%)"
  series-adhoc: "hsl(39.7 100% 39.4%)"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Inter, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
  micro:
    fontFamily: "Inter, ui-sans-serif, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
spacing:
  row-compact: "2.25rem"
  row-comfortable: "2.75rem"
  gap-sm: "0.5rem"
  gap-md: "0.75rem"
  gap-lg: "1.5rem"
  page-gutter: "1.5rem"
  topbar-height: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.azure-focus}"
    textColor: "{colors.azure-focus-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.azure-focus}"
  button-outline:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-ghost:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  button-link:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.azure-link}"
    rounded: "{rounded.md}"
    height: "2.25rem"
  badge-outline:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.625rem"
  badge-critical:
    backgroundColor: "{colors.urgency-critical}"
    textColor: "{colors.urgency-critical-ink}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.625rem"
  badge-success:
    backgroundColor: "{colors.success-green}"
    textColor: "{colors.success-green-ink}"
    rounded: "{rounded.md}"
    padding: "0.125rem 0.625rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  score-chip:
    rounded: "{rounded.sm}"
    typography: "{typography.mono}"
    height: "1.25rem"
    width: "1.5rem"
  segmented-track:
    backgroundColor: "{colors.backdrop}"
    rounded: "{rounded.md}"
    padding: "0.125rem"
    height: "2.25rem"
  segmented-thumb:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 0.75rem"
  disclosure-toggle:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.micro}"
    padding: "0.75rem 0 0.25rem"
---

# Design System: Ariadne

## Overview

**Creative North Star: "The Night Instrument Panel"**

Ariadne reads like calm cockpit instrumentation, not a productivity app trying to earn a click. The surface sits in near-black by default (`enableSystem: false`, `defaultTheme: "dark"` — dark is not a preference toggle here, it is the intended resting state), so nothing on screen is competing for brightness. Precise mono numerals report scores, sprint counts, and elapsed time the way a gauge reports a reading: exact, tabular, unemotional. Color is an instrument, not decoration — one azure, the cool complement of the gold, is reserved exclusively for things you can act on (buttons, links, focus), and a single warm gold thread, echoing the product's namesake myth, marks the thread you are on right now: identity, the running timer, and the day you have committed to. The type scale barely moves; hierarchy comes from weight and restraint, not size jumps, because a dense attention-triage surface earns its calm from what it refuses to shout about.

This is a deliberate rejection of the SaaS-dashboard palette-soup default: no gradient hero, no rainbow of status colors, no drop shadows pretending the interface is a stack of physical cards. The instrument-panel read only works if the panel stays quiet almost everywhere so the two or three signals that matter (a critical urgency chip, a stale-sync warning) can actually read as urgent.

**Key Characteristics:**
- Dark-first, near-black backdrop as the default resting state, not an alternate theme
- Azure is interactive-only — it never appears as a status, urgency, or decorative color
- One brand accent (Threadline Gold), reserved for identity and for "this is your thread, live right now" — never for a source-reported state
- Mono, tabular-nums numerals for every instrument reading (scores, counts, elapsed time)
- A flat scale: hierarchy comes from weight and color restraint, not dramatic size changes
- Flat surfaces with barely-there shadows; depth exists only to separate stacked layers

## Colors

The palette reads as three tiers: a near-monochrome backdrop, one interactive hue, and a small, urgency-only accent set that only fires when something needs attention.

### Primary
- **Azure Focus** (`--primary`, `hsl(214 90% 46%)` dark / `hsl(214 88% 42%)` light): The only interactive color in the system. Buttons' default variant, the filled badge, the progress bar, the pick checkboxes in the suggestion panel, and nothing else. Confirmed in code comments in `ScoreChip.tsx` and `ItemRow.tsx`: "Azure never appears here — that channel is interactive-only." Never use it for a status pill, urgency chip, or any non-actionable signal.

  The hue is chosen, not inherited: 214 is the color-wheel complement of Threadline Gold's 41, so the panel's one warm accent has exactly one cool counterpart and the two never read as a palette. It also sits far from every state hue in the system (red 358, amber 38, green 142), which is what keeps an interactive control from being misread as an urgency band. The one adjacency worth knowing about is the GitHub report series at 212.8; the two are close in hue but never share a screen, since categorical color is confined to `/report` and a filled primary control is not.

- **Azure Link** (`--link`, `hsl(214 90% 66%)` dark / `hsl(214 88% 42%)` light): The same hue at the lightness interactive *text* needs. This is a deliberate two-value token, not drift: a fill dark enough to carry white label text at 4.5:1 is too dark to read as text against the near-black backdrop, and a text color light enough for the backdrop cannot carry white text as a fill. No single value satisfies both, so the fill and the text are separate tokens of one hue. Every `text-primary` link in the app was moved to `text-link` for this reason: the score chip's scoring link, the two Signals disclosure links, the Needs-you popover, the row's source link, and the `Button` `link` variant. A new interactive *text* color is `text-link`; a new interactive *surface* is `bg-primary`.

### Secondary
- **Threadline Gold** (`hsl(41.4 53.8% 54.1%)`): The one constant brand accent, identical in light and dark mode (defined once on `:root`, never overridden). It carries two related jobs and no others, both versions of the same idea — the thread you are currently holding:
  1. **Identity.** Baked into the brand lockup artwork (`public/brand/ariadne-banner.png` and the app icons), and the focus ring on the two pieces of chrome adjacent to identity (the logo link and the search trigger, `TopBar.tsx`). These are the only two focus rings in the app that are not the neutral ring.
  2. **Your thread, live.** The pulsing dot on a running timer (`RunningTimerChip.tsx`, `ItemRow.tsx`), the left edge of the Today card (`TodaySection.tsx`, a 2px `border-l`), and the capacity figure for the day you have committed to (`TodaySection.tsx`, `PlanDayDialog.tsx`, `SuggestPanel.tsx`). The search-match highlight (`<mark>` in `ItemRow.tsx`, at 30% alpha) belongs here too: it marks the row you are currently looking for.

  What unites the second group is that none of it is reported by GitHub or Azure DevOps. It is all local, present-tense, and yours: the timer that is running, the day you chose, the row you are hunting. Source-reported state never gets gold — that is what Amber Watch and Signal Red are for.

### Tertiary
- **Amber Watch** (`hsl(38 92% 55%)` dark / `hsl(38 92% 50%)` light): Warning, staleness, and the "high" urgency band. Shared value doubles as `--warning`, `--urgency-high`, and `--status-blocked` — one hue for "needs attention soon."
- **Signal Red** (destructive `hsl(358.8 100% 69.6%)` dark / `hsl(357.1 100% 45.3%)` light; urgency-critical `hsl(358 75% 59%)` dark / `hsl(358 75% 46%)` light — distinct tunings of the same hue): Destructive actions and the "critical" urgency band.
- **Success Green** (`hsl(142 71% 45%)` dark / `hsl(142 71% 35%)` light): Defined on the `Badge` component (`variant="success"`). Reserved for exactly one meaning: "this is saved or done and needs no action," never for a status that demands attention. It has three examined uses, each admitted against the Two-Band/color-scarcity rule below rather than by default:
  1. The "Token saved" indicator per integration on the Settings page (`SettingsForm.tsx`). Settings is a low-traffic configuration surface, not the dashboard's attention-triage view, so a quiet affirmative marker there doesn't compete with or dilute the urgency bands' scarcity.
  2. The settled check on the score chip (`ScoreChip.tsx`, driven by `lib/settled.ts`), which fires when the source system has finished an item that Ariadne, being read-only, still shows as open. This one does appear on the dashboard, and it is admitted anyway because it is the literal reserved meaning: the chip stops reporting a live urgency reading and reports "done, nothing left to do here." It cannot compete with the urgency bands because it replaces one — a row shows the check or a score, never both. The `gone` outcome (an ADO work item set to Removed) deliberately does **not** get the green: it left your plate without being finished, so it takes the neutral low-band treatment instead. Green here means you got it over the line.

  3. The Azure DevOps status pill when the work item's own state reads as finished (`adoStatusVariant()` in `lib/status-pill.ts`, matching `ADO_FINISHED_PATTERN`). This one is admitted because it adds no new green claim to the row: the pattern it matches is the same one `lib/settled.ts` uses to put the settled check on the score chip, so the green pill and the green check appear together or not at all. It labels the fact the chip is already reporting rather than introducing a second affirmative signal, and the file says so in its own comment — the two "must not drift apart." The `gone` branch stays consistent with the chip here too: a Removed work item takes `destructive`, not green.

  A fourth use needs the same examination, and specifically needs to answer why it isn't competing with the urgency bands.

- **Report series** (`hsl(212.8 76.8% 56.1%)` GitHub / `hsl(159.2 72.7% 35.9%)` Azure DevOps / `hsl(39.7 100% 39.4%)` ad-hoc): Three categorical hues, used only on the time-report charts (`ReportDashboard.tsx`, Recharts pie and bar). They identify a source, not a state, and they exist only on `/report` — a surface you go to deliberately rather than triage against. Keeping them off the dashboard is what stops the palette from reading as a rainbow where scarcity matters. Note the ad-hoc series sits close to Amber Watch in hue; that collision is tolerable only because the two never share a screen.

### Neutral
- **Backdrop** (`hsl(240 10% 3.9%)` dark / `hsl(0 0% 100%)` light): Page background.
- **Ink** (`hsl(0 0% 98%)` dark / `hsl(240 10% 3.9%)` light): Primary text.
- **Surface** (`hsl(240 5.9% 10%)` dark / `hsl(0 0% 100%)` light): Cards, popovers, dialogs — one step off the backdrop.
- **Surface Raised** (`hsl(240 3.7% 15.9%)` dark): Secondary buttons, muted backgrounds, hover accents — one step further off the backdrop.
- **Muted Ink** (`hsl(240 5.5% 64.3%)` dark / `hsl(240 4.2% 46.3%)` light): Secondary text, metadata, timestamps, and every disclosure control.
- **Slate Neutral** (`hsl(240 5% 65%)` dark / `hsl(240 5% 45%)` light): The "medium" and "low" urgency bands, and the neutral status pill. Deliberately colorless so only the top two urgency bands compete for attention.
- **Border Hairline** (`--border`, `hsl(0 0% 100% / 10%)` dark / `hsl(240 5.9% 90%)` light): Row dividers, card borders, and the seam inside the segmented control. An alpha-over-ink hairline in dark mode, not a separate flat gray.
- **Input Hairline** (`--input`, `hsl(0 0% 100% / 15%)` dark / `hsl(240 5.9% 90%)` light): The outline of anything that takes input — fields, the outline button, the search trigger, the segmented control's track. Half a step brighter than Border Hairline in dark mode, and identical to it in light mode, so a control's edge reads as an affordance against the backdrop without a structural divider having to shout. The two are one value in light mode and two in dark; use `border-input` for a control and `border-border` for a seam, whichever mode you are designing in.

### Named Rules
**The Interactive-Only Rule.** Azure Focus is the sole signal for "you can act on this." It never labels a state, a category, or an urgency level. If a new component needs a color for a clickable thing, it's this one; if it needs a color for a status, it's never this one.

**The One Thread Rule.** Threadline Gold marks the thread you are on, and nothing else: the brand lockup and its two identity-adjacent focus rings, plus the four present-tense local signals (running-timer pulse, the Today card's edge, today's capacity figure, the search match). The test for a new gold element is one question: *is this fact local, present-tense, and mine?* A figure GitHub or Azure DevOps reported is never gold, however important. Nor is a generic interactive control — that is Azure Focus's job. An agent session is the case that makes the test bite: however live it is, mid-turn and waiting on nothing, it never takes gold, because it fails the *mine* clause by definition — a delegated session is precisely the thread you are not holding (`lib/agent-session-display.ts`, `SessionRosterRow.tsx`). It is the same line Ariadne draws when it refuses to start a timer for an agent, and gold striped across six rail rows at once would spend the accent's scarcity for nothing.

**The Two-Band Rule.** Of the four urgency bands, only Critical and High are filled with color; Medium is an outline in a neutral hue and Low has no border at all. Visual weight must always fall off in the same direction as the score. A design that fills all four bands with color has broken the thesis that attention should be scarce.

## Typography

**Body Font:** Inter (loaded via `next/font/google` as `--font-sans`, with the system sans-serif stack)
**Mono/Numeral Font:** system monospace stack (`ui-monospace, SFMono-Regular, Menlo`)

**Character:** All-Inter, all-sans. There is no display or serif face in the system: the Ariadne wordmark is not set in type at all, it ships as artwork inside the brand banner. Inter runs at a narrow weight range (500–600) doing all the hierarchy work through boldness and color, not scale.

### Hierarchy
- **Title** (600, 1.125rem/18px, leading-none, -0.01em tracking): Dialog and modal headings ("Mark complete", "Delete ad-hoc item?").
- **Body** (500, 1rem/16px, leading 1.4): Item row titles and other primary content — the ambient default text size, not an explicit utility class.
- **Label** (500, 0.875rem/14px, leading 1.3): Secondary UI text — descriptions, button labels, metadata lines, form labels.
- **Micro** (400–500, 0.75rem/12px): Badge and pill text, hover-card fine print, source metadata, disclosure controls.
- **Mono/Numeral** (600, 0.6875rem/11px, tabular-nums): The score chip's number, sprint counters ("4/17"), days-remaining, timer readouts, and every count carried by a disclosure control or a header pill. Always monospace, always tabular, never proportional — this is the "instrument reading" register and it must stay visually distinct from prose.

### Named Rules
**The Instrument Numeral Rule.** Any number that represents a live measurement (a score, a count, a duration) renders in the mono/tabular register, never in the body font. A count that looks like prose reads as a fact you already know; a count in mono digits reads as a live reading you should check. This is the rule most often broken by accident: a count interpolated into a sentence inherits the body font unless you wrap it.

**The Single Face Rule.** Inter is the only typeface in the system. There is no display font, no serif, and no second sans. A new heading, stat, or hero moment does its work with weight and color, because introducing a second face would turn a deliberately flat scale into a conventional one.

## Layout

A single dense information surface, not a marketing-style spacious one. Both the dashboard (`Dashboard.tsx`) and the top bar (`TopBar.tsx`) center on a `max-w-6xl` container at a 24px horizontal page gutter (`p-6` / `px-6`), so the bar's contents line up with the column beneath it even though the bar itself is full-bleed. The bar is a five-column grid, `1fr auto auto minmax(0,20rem) 1fr` at 4rem tall: logo, mode switch, running-timer chip, search trigger, actions. The switch sits in the centre cluster rather than joining the logo in the left column, because a left column carrying both the lockup and the switch would outgrow the action cluster opposite it and drag the whole cluster off centre — the outer columns only balance each other when nothing but the logo and the icon buttons live in them. Every child is pinned to its column with an explicit `col-start-*` (`TopBar.tsx`): `RunningTimerChip` renders nothing while no timer is running, and without the pins, grid auto-placement would slide everything after it one track left the moment the chip goes empty, walking the action cluster out of its own column. From `sm` up, both outer tracks are floored at `10.0625rem` (161px) — the logo's own rendered width at its fixed `h-8` — so a shrinking viewport compresses the search field before it ever touches the lockup; below `sm` the floor is dropped, because an un-shrinkable 322px of outer tracks at that width turns a cramped bar into a worse problem than a compressed logo. The two outer tracks are always sized identically to each other: it is that symmetry, not their absolute width, that keeps the centre cluster centred, so the floor value can never change on one side without the other.

**The scroll gap.** With a timer running, the bar's non-shrinking content — the two floored outer tracks, the mode switch, and the running-timer chip's own intrinsic width — comes to roughly 860px, none of which the `minmax(0,20rem)` search track can absorb by shrinking further once it hits zero. From `sm` (640px), where the floor engages, up to about 860px, that arithmetic doesn't close and the page scrolls horizontally instead of the bar reflowing. This is why the floor is gated on `sm` rather than left on everywhere: below 640px the floor is dropped so the logo compresses instead, which is the lesser evil only at the very narrowest widths and not a fix for the scroll range above it. Closing that range means deciding what the bar drops first at narrow widths, and nobody has made that call yet — this is a known limitation, not a resolved one.

**The Watch Floor.** `/work` (`WatchFloor.tsx`) is a narrow roster rail (`18rem`) beside one full-width session pane, `sm:grid-cols-[18rem_minmax(0,1fr)]`, stacking to a single column below `sm`. It sits inside the same `max-w-6xl` container at the same 24px gutter (`p-6`) as the dashboard, and it uses no breakpoint the system does not already have.

Row density is a first-class, user-facing setting with exactly two states, both on a 4px grid: **comfortable** (2.75rem/44px = 11 × 4px) and **compact** (2.25rem/36px = 9 × 4px). Row height is fixed per mode so content can never reflow it; below the `sm` breakpoint (640px) rows wrap onto two lines instead of shrinking further. Sections stack vertically with `border-b` hairline dividers between rows rather than card gaps — the list itself is the container, individual rows are not cards.

`sm` is the only breakpoint the layout uses. The one other breakpoint in the codebase is `md:text-sm` on `Input` and `Textarea`, the stock 16px-on-mobile rule that stops iOS zooming a focused field; it is a field-level fix, not a layout tier, and new work should not read it as an invitation to add one.

Responsive behavior is mobile-down, not mobile-up: the row-actions cluster is always visible at narrow widths (`opacity-100`) and recedes to `opacity-60` from `sm` up, rising to full on `group-hover` or `group-focus-within`. Note that the gate is viewport width, not pointer capability — there is no `hover: hover` media query — so a wide touch screen gets the receded treatment. That is a deliberate simplification rather than an oversight: the recede is 60% opacity, not `display: none`, so the actions stay visible and tappable either way, and width is the signal that actually correlates with having room for them.

Long lists are cut rather than scrolled: an obligation group renders its highest-scoring rows and collapses the remainder behind a disclosure control. The cut is a visual rule with a semantic constraint — see the Disclosure Control component and `lib/grouping.ts`.

## Elevation & Depth

Flat by default, with the barely-there `shadow-sm`/`shadow` values Tailwind ships out of the box — never a custom, more dramatic shadow. This is a deliberate extension of the instrument-panel thesis: surfaces don't pretend to be physical objects stacked on a desk, they're panels in the same plane, differentiated by the neutral color steps (Backdrop → Surface → Surface Raised) more than by shadow. Where a shadow does appear (cards, the default button, badges), it is there only to separate one flat layer from the one behind it, not to imply weight, hover lift, or tactility.

### Shadow Vocabulary
- **Surface separation** (Tailwind `shadow` / `shadow-sm`, unmodified defaults): Cards, the default button variant, and filled badges. Signals "this sits above the backdrop," nothing more.
- **Drag lift** (Tailwind `shadow-lg`, plus an opaque `bg-background` and `z-10`, `SortableRows.tsx`): The one admitted exception to the flat rule, and the only place in the system that uses a shadow heavier than `shadow`. A row being dragged is the single moment where tactility is the literal truth rather than a metaphor: the row has genuinely left the plane of the list and needs to occlude what it passes over. It reverts to flat the instant the drag ends. Do not reach for this value for hover, focus, or emphasis.

### Named Rules
**The Flat-By-Default Rule.** Depth comes from the neutral color scale (Backdrop / Surface / Surface Raised), not from shadow intensity. A new component reaching for a heavier shadow to "lift" itself is fighting the instrument-panel read; reach for the next neutral step instead. The drag lift is the exception that proves it: it is allowed precisely because the element really is airborne.

## Shapes

A restrained two-step corner scale, deliberately not one uniform radius. Interactive controls (buttons, inputs, badges, the score chip) use the small end (`0.25–0.375rem`) so they read as precise, clickable instrumentation. Containers (cards, dialogs) use the larger `0.75rem` so they read as distinct panels holding that instrumentation, not as one more control. The score chip — the system's most "instrument-like" element — uses the smallest radius in the scale (`0.25rem`), reinforcing that it is a reading, not a button.

Borders are hairline and low-contrast (`hsl(0 0% 100% / 10%)` in dark mode — an alpha-over-ink line, not a flat gray), used for row dividers and card outlines. There is no decorative border weight anywhere in the system; a border only ever marks a structural seam.

## Components

### Buttons
- **Shape:** `0.375rem` radius (rounded-md), consistent across all variants.
- **Primary:** Azure Focus background, white text, subtle shadow, `hover:bg-primary/90`. Reserved for the one clearly-primary action per context (Complete, the command-palette invocation is a ghost button, not this).
- **Outline / Ghost:** Transparent or backdrop background, Ink or Muted Ink text, hairline border on outline only. This is the default for row actions (Start, Complete on `ItemRow`) — deliberately not the filled Primary treatment, since every row's action competes with every other row's, and filling all of them would break the Two-Band attention gradient at the button level too.
- **Link:** Azure Link text, `underline-offset-4`, underline on hover, no fill and no border. The only `Button` variant that carries the text value of the interactive hue rather than the fill value, for the reason given under Azure Link. A link that sits inside body copy is usually a bare `<button className="text-link">` instead; this variant is for a link that has to line up in a row of buttons.
- **Sizes:** `h-9` default / `h-8` small (`px-3 text-xs`) / `h-10` large (`px-8`) / `h-9 w-9` icon-only. Density mode can push a button to `h-11` inline (see comfortable row height).
- **Focus:** `ring-1 ring-ring` with `ring-offset-2 ring-offset-background`, so the ring sits outside the button rather than on it. The offset is load-bearing, not decoration: the ring is pinned to the neutral hue by the Named Rules, and a neutral hairline drawn on top of the filled Primary variant disappears into the fill. Offset against the backdrop it reads at full contrast on every variant without borrowing Azure Focus or Threadline Gold.
- **Not for disclosure.** A `Button` of any variant is the wrong primitive for expanding or collapsing a list; that has its own pattern below.

### Score Chip (signature component)
The system's most distinctive custom primitive, not a shadcn default. A small (`h-5`, `min-w-6`) mono, tabular-nums button, `0.25rem` radius, that opens a popover breakdown of exactly which scoring rules fired. Fill and border follow the Two-Band Rule: Low is borderless text, Medium is a neutral 2px outline, High and Critical are filled with Amber Watch / Signal Red respectively using dark ink (never white) as the foreground, per the paired `*-foreground` tokens. This is the component that makes "transparent, not opaque" a visible, clickable fact rather than a claim in the README.

**Settled state.** When the source system has closed an item Ariadne still shows as open, the chip stops reporting a number and reports the outcome instead: a `Check` glyph on Success Green for `finished`, a `Minus` glyph in the neutral low-band treatment for `gone`. The score stays fully inspectable in the popover underneath. A row shows a reading or an outcome, never both.

**Focus.** The chip is the one control that departs from the button focus treatment: `ring-2 ring-ring ring-offset-1` rather than `ring-1 ring-offset-2`. At `h-5` a 1px ring two pixels out reads as a smudge beside the row's own hairlines, so the ring is doubled and pulled in tight against the chip. Same neutral hue, same offset-against-backdrop principle, tuned for a 20px target.

### Disclosure Control (signature pattern)
The house grammar for "there is more here, and here is exactly how much." Used in six places — `Snoozed · 3` and a group's `Lower scoring · 4` in `SignalsBoard.tsx`, `Paused · 2` in `ItemSection.tsx`, `Ended · N` in the Watch Floor rail (`SessionRosterRail.tsx`), and `Didn't fit · N` / `Deferred by your lean · N` in the suggestion panel (`SuggestPanel.tsx`) — and it must be used for any seventh.

- **Shape:** a bare `<button>`, never a `Button` component. Full width, `pt-3 pb-1`, no border, no background, no radius of its own.
- **Type:** Micro (`text-xs font-medium`) in Muted Ink, rising to Ink on hover. It is subordinate to every row it sits under and must never carry the visual weight of the content it hides.
- **Label:** a state, then an interpunct, then the count in the mono/tabular register: `Paused · 2`. The label names *what* the hidden rows are, not the act of revealing them. "Show more" is not a state and is not an acceptable label.
- **Semantics:** `aria-expanded` plus `aria-controls` pointing at the wrapper `div` that holds the collapsed rows, which carries the matching `id`. Toggles both ways, always; a one-way expansion is a defect.
- **Keyboard:** should carry `data-row-nav` so `j`/`k` row navigation stops on it (`GlobalKeymapProvider.tsx`) rather than stepping over the rows it hides. Enter and Space activate it natively. **`Lower scoring`, `Ended` (`SessionRosterRail.tsx`), and both suggestion-panel controls (`Didn't fit` / `Deferred by your lean`, `SuggestPanel.tsx`) currently do.** `Snoozed` (`SignalsBoard.tsx`) and `Paused` (`ItemSection.tsx`) are reachable by Tab but invisible to `j`/`k`, so a keyboard user walking the list with `j` steps straight past them and never learns the rows exist. Treat the attribute as required on all six; two of them are outstanding.
- **The count is a promise.** A group's header pill shows the true total; the disclosure accounts for the difference. If a cut would separate two rows the ranking scores identically, the cut moves rather than the truth (`visibleCount()` in `lib/grouping.ts`) — hiding one row while showing its equal claims a rank the score does not have.

### Badges / Pills
- **Style:** `0.375rem` radius, `border`, `text-xs font-semibold`, one badge per row maximum (see `ItemRow`'s inline-badge precedence logic — extra reason pills move to a hover-card rather than piling up).
- **State:** `outline` is the default/neutral treatment for reason pills (approved, mentioned, review-requested); filled variants (`destructive`, `warning`, `blocked`, `success`) are reserved for states that demand action or, for `success`, the one affirmative meaning documented under Success Green. `secondary` is the quiet middle case — Surface Raised fill, no hue — used for an Azure DevOps state that reads as in-flight (`active`, `committed`, `doing`, `in progress`). It is a fill without a signal, which is exactly right for "someone is on this and nothing is being asked of you."
- **Not the `default` variant.** `Badge variant="default"` is Azure Focus and must not be used for a status; `lib/status-pill.ts` says so in its own comment. It exists because shadcn ships it.

### Agent Session State
`lib/agent-session-display.ts`, the single source for how a Work mode session reads on screen. The rail (`SessionRosterRow.tsx`), the glance state, and the selected-session pane all read the same table (`agentStateDisplay()`) rather than each keeping its own copy of the words.

- **Six states, each with a glyph and a word.** `needs_you` (`Hand`), `failed` (`AlertTriangle`), `ready` (`FileDiff`), `working` (`Loader`, the rail's only motion — `motion-safe:animate-spin`), `launching` (`CircleDashed`), `stopped` (`CircleSlash`). Colour is a third channel and never the only one: the glyph and the label both carry the state on their own, so the rail stays legible with colour taken away.
- **Two-Band Rule again.** Only `needs_you` (Amber Watch, `warning`) and `failed` (Signal Red, `destructive`) are filled; the other four take the neutral treatment. A rail where all six states were coloured would carry no more signal than one where none were.
- **Fidelity tier.** Not every agent reports its own lifecycle — only Claude Code fires the hooks Ariadne listens for (`sessionFidelity()`). An agent that cannot report is marked `no reporting` with a `RadioTower` glyph (`SessionRosterRow.tsx`) rather than shown as a silent healthy session, because a state the tool cannot see is worse than one it admits to not seeing.
- **No gold.** Nothing in this vocabulary is ever Threadline Gold, however live the session — see The One Thread Rule.

### Cards / Containers
- **Corner Style:** `0.75rem` radius (rounded-xl), the largest radius in the system.
- **Background:** Surface, one step off the backdrop.
- **Shadow Strategy:** Default Tailwind `shadow` only; see Elevation & Depth.
- **Border:** Hairline, low-contrast. The Today card is the one card with a colored edge — a 2px Threadline Gold left border marking the day you committed to, per The One Thread Rule.
- **Internal Padding:** `1.5rem` (p-6), trimmed to `1.5rem 1.5rem 0` between header and content.

### Inputs / Fields
- **Style:** `0.375rem` radius, hairline border, transparent/backdrop background, `shadow-sm`.
- **Focus:** `ring-1 ring-ring` — the neutral focus ring, not Azure Focus and not Threadline Gold; those two are reserved per the Named Rules above.
- **Error:** Signal Red text below the field, not a red border on the field itself.

### Segmented Control
`SegmentedChoice.tsx`, the shared primitive for **a value the user sets by hand**, as opposed to one a source reported. A radiogroup of adjacent segments, with an optional readout beside each label in the mono/tabular register. Selection is signalled by weight, dimming (unselected segments drop to 80%) and one neutral step of fill, never by hue — the urgency channel belongs to the score chip, and a coloured control here would read as a fifth band and break the Two-Band Rule. One tab stop, arrow keys to move, per the radiogroup pattern.

**Track and thumb, one outline.** The frame is a track: a single hairline `border-input` outline around the whole control, `h-9`, with `p-0.5` of padding. The selected segment is a `bg-accent` thumb at `rounded-sm` filled *within* that gutter, so the fill never touches the frame. This is the rule that matters, because the alternative fails visibly: with the fill running to the container's edge, a selected first or last segment erases the frame's own border along two sides and the control reads as one lopsided filled cell hanging out of a box rather than as a selection inside a track.

**Segments carry no borders.** A per-segment divider at the same weight as the container turns one control into a grid of buttons. Instead a hairline seam (`bg-border`, `inset-y-1`, 1px) is drawn between two neighbours only when *both* are unselected — the thumb's fill already separates the selected segment from whatever sits beside it, so a seam there would double the boundary. The seam is inset from the track's top and bottom so it reads as a division inside one object.

**Label and readout are centred as a pair.** The two share a baseline inside an inner `inline-flex items-baseline`, and that block is then centred in the segment, so a segment with a readout sits at the same height as one without.

**Focus is inset.** `ring-1 ring-ring ring-inset` on the segment, not the offset ring the buttons use. A segment has neighbours on both sides and a track edge 2px away, so an offset ring would either collide with the next segment or spill over the frame; drawn inside the segment's own box it lands cleanly whichever notch has focus. This is one of four focus treatments in the system, three of them inside the same 64px top bar: offset for buttons and fields, responding to nothing but the backdrop around them; tight-and-doubled for the score chip, responding to its 20px target; inset here, responding to the neighbours on both sides; and offset-in-gold for the logo link and the search trigger (`TopBar.tsx`), responding to the One Thread Rule rather than to size at all — the ring is the same offset geometry as a button's, but Threadline Gold in place of the neutral ring, because these two controls are marked as "about the product's identity" and nothing else earns that hue. Each is a response to the target's size, surroundings, or meaning, not a free choice.

Five consumers, and the rationale is the same in all five:
- **Priority** (`PrioritySegments.tsx`): the ad-hoc item's hand-set priority, `low`/`medium`/`high`, each showing its point contribution (`+0`, `+20`, `+40`). Clearable, because "I haven't decided" is a real state and the one every item starts in.
- **Suggestion algorithm** (`SuggestPanel.tsx`): Urgency first / Quick wins / Balanced, no readout, filling the panel's width.
- **Suggestion lean** (`SuggestPanel.tsx`): five notches, each stating the whole split it produces (`80/20` … `20/80`) rather than one side of it. A bare `20` sitting next to the "PRs" axis label reads as "pull requests get 20", which is the opposite of what that notch means, so the compact pair is the label and the spoken name spells it out in full. The two axis ends (`PRs`, `work items`) sit in a micro caption *beneath* the control rather than beside it, so this control spans the same width as the algorithm control stacked above it instead of being indented by its own labels. The caption is `aria-hidden`: the group's `aria-label` and each notch's spoken name already carry the axis.
- **Plan-the-day step 2** (`PlanDayDialog.tsx`, `ariaLabel="How to choose today's work"`): Suggested / All signals. A suggestion is a way of choosing rather than a separate act, so it lives as a mode inside the step that already picks what to work on, instead of becoming a fifth step with its own list to reconcile against the fourth's. `All signals` is the default — the suggestion is a mode you opt into, not the resting state.
- **Mode switch** (`ModeSwitch.tsx`): Planning / Work, two notches, no readout, routing rather than local state — its value is read from the current pathname and a selection pushes a route, so the mode survives a reload and each face's data renders server-side. It is the first consumer whose value can be `null` for a reason other than "not decided": Report and Settings belong to neither mode, and the control shows nothing selected there rather than claim a mode you are not in.

Equal-width segments are opt-in (`fill`), so a control sized by its content keeps its proportions when the primitive is reused.

### Drag Handle
`SortableRows.tsx`, used only in Today and step 3 of Plan the day, where the list is hand-ordered rather than score-ordered. A 16px `GripVertical` glyph in Muted Ink, `cursor-grab` becoming `cursor-grabbing`, `touch-none` so a touch drag doesn't scroll the page. The row it belongs to takes the Drag lift shadow while moving. A handle appears only where order is genuinely the user's to set; a score-ordered list must never show one.

### Navigation (Top Bar)
Sticky (`top-0 z-40`), full-bleed, hairline bottom border, and translucent: `bg-background/95`, dropping to `bg-background/80` behind a `backdrop-blur` where the browser supports the filter. Five-column grid (see Layout for the template and its floors): the Ariadne brand banner at 32px height (`public/brand/ariadne-banner.png`, a self-contained dark lockup that reads the same in light and dark mode), the Planning/Work mode switch, running-timer chip, `⌘K` search trigger, then icon-button actions (Report, Settings, theme toggle). The logo link and search trigger are the only two controls in the entire app whose focus ring is Threadline Gold instead of the neutral ring — a deliberate, small tell that these two controls are "about the product's identity," not just generic navigation.

The logo is also the system's one piece of decorative motion: `motion-safe:group-hover:scale-[1.03]`, a 3% lift on hover. It is confined to the wordmark on purpose. Everything else that moves does so because state changed (the timer's `animate-pulse`, the accordion's height transition, a `transition-colors` on hover), and a panel of instruments that animates for pleasure stops reading as instrumentation. The `motion-safe:` prefix is not optional here; `globals.css` also carries a global `prefers-reduced-motion` block that collapses every animation and transition to 0.01ms.

### Report Charts
`ReportDashboard.tsx` only. A Recharts pie (time by source) and bar (daily series), colored from the three Report series hues and nothing else. Charts get no gridline decoration, no gradient fills, and no drop shadows; they are readings rendered large, consistent with the instrument-panel thesis. This is the only surface in the app that carries categorical color.

## Do's and Don'ts

### Do:
- **Do** keep Azure Focus exclusively on things the user can click or activate.
- **Do** render every live measurement (scores, counts, durations) in the mono/tabular-nums register, including counts that sit inside a label.
- **Do** let visual weight fall off across the urgency scale — Critical and High filled, Medium outlined, Low borderless.
- **Do** use the larger `0.75rem` radius only for containers (cards, dialogs) and the smaller `0.25–0.375rem` radii for controls and instrumentation.
- **Do** treat dark mode as the default resting state when choosing new colors, not as a theme variant bolted on afterward.
- **Do** use the Disclosure Control pattern for anything that hides rows, and give it a label that names a state (`Snoozed · 3`), `aria-expanded`, `aria-controls`, a two-way toggle, and `data-row-nav`.
- **Do** ask of any proposed gold element: is this fact local, present-tense, and mine? If not, it is not gold.
- **Do** reach for `SegmentedChoice` for any value the user sets by hand, and keep it quieter than any urgency band.
- **Do** mark a number the tool worked out for the user, and leave a number the user set unmarked. The suggestion panel prefixes a derived duration with `~` in Muted Ink and states a real estimate plainly in Ink; a guess that looks like a commitment is the most misleading thing an inspectable ranking can do.

### Don't:
- **Don't** put Threadline Gold on anything a source system reported, on a report series, or on a generic interactive control. Identity and your live thread are its whole remit.
- **Don't** add a fifth or sixth urgency color, or fill the Medium/Low bands — the scarcity of color is what makes Critical/High legible at a glance.
- **Don't** bring the Report series hues onto the dashboard. Categorical color is confined to `/report`, and that confinement is what keeps the triage surface quiet.
- **Don't** reach for a heavier or colored shadow to convey emphasis; use the neutral surface-step scale instead. `shadow-lg` belongs to an in-flight drag and nowhere else.
- **Don't** introduce a second typeface of any kind. Inter carries everything; the wordmark is artwork.
- **Don't** re-typeset or recolor the wordmark. The banner and icon PNGs in `public/` are the only approved lockups.
- **Don't** stack more than one inline badge per row; additional context belongs in the hover-card, per the existing overflow pattern.
- **Don't** use a `Button` component to expand or collapse a list, and don't label such a control "Show N more" — it names an action instead of a state, and it can claim a ranking the score does not have.
- **Don't** treat `--chart-4`, `--chart-5`, or the eight `--sidebar-*` tokens as part of this system. They are unused shadcn scaffolding left in `globals.css` and `tailwind.config.ts`; nothing renders them, and new work should not start.
