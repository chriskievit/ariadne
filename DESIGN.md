---
name: Ariadne
description: The anti-autopilot — a transparent, read-only dashboard for GitHub, Azure DevOps, and ad-hoc work
colors:
  backdrop: "hsl(240 10% 3.9%)"
  ink: "hsl(0 0% 98%)"
  surface: "hsl(240 5.9% 10%)"
  surface-raised: "hsl(240 3.7% 15.9%)"
  muted-ink: "hsl(240 5.5% 64.3%)"
  indigo-focus: "hsl(243 75% 65%)"
  indigo-focus-ink: "hsl(0 0% 100%)"
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
components:
  button-primary:
    backgroundColor: "{colors.indigo-focus}"
    textColor: "{colors.indigo-focus-ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.indigo-focus}"
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
  disclosure-toggle:
    backgroundColor: "{colors.backdrop}"
    textColor: "{colors.muted-ink}"
    typography: "{typography.micro}"
    padding: "0.75rem 0 0.25rem"
---

# Design System: Ariadne

## Overview

**Creative North Star: "The Night Instrument Panel"**

Ariadne reads like calm cockpit instrumentation, not a productivity app trying to earn a click. The surface sits in near-black by default (`enableSystem: false`, `defaultTheme: "dark"` — dark is not a preference toggle here, it is the intended resting state), so nothing on screen is competing for brightness. Precise mono numerals report scores, sprint counts, and elapsed time the way a gauge reports a reading: exact, tabular, unemotional. Color is an instrument, not decoration — indigo is reserved exclusively for things you can act on (buttons, links, focus), and a single warm gold thread, echoing the product's namesake myth, marks the thread you are on right now: identity, the running timer, and the day you have committed to. The type scale barely moves; hierarchy comes from weight and restraint, not size jumps, because a dense attention-triage surface earns its calm from what it refuses to shout about.

This is a deliberate rejection of the SaaS-dashboard palette-soup default: no gradient hero, no rainbow of status colors, no drop shadows pretending the interface is a stack of physical cards. The instrument-panel read only works if the panel stays quiet almost everywhere so the two or three signals that matter (a critical urgency chip, a stale-sync warning) can actually read as urgent.

**Key Characteristics:**
- Dark-first, near-black backdrop as the default resting state, not an alternate theme
- Indigo is interactive-only — it never appears as a status, urgency, or decorative color
- One brand accent (Threadline Gold), reserved for identity and for "this is your thread, live right now" — never for a source-reported state
- Mono, tabular-nums numerals for every instrument reading (scores, counts, elapsed time)
- A flat scale: hierarchy comes from weight and color restraint, not dramatic size changes
- Flat surfaces with barely-there shadows; depth exists only to separate stacked layers

## Colors

The palette reads as three tiers: a near-monochrome backdrop, one interactive hue, and a small, urgency-only accent set that only fires when something needs attention.

### Primary
- **Indigo Focus** (`hsl(243 75% 65%)` dark / `hsl(243 75% 59%)` light): The only interactive color in the system. Buttons' default variant, links, focus rings (`focus-visible:ring-ring`), and nothing else. Confirmed in code comments in `ScoreChip.tsx` and `ItemRow.tsx`: "Indigo never appears here — that channel is interactive-only." Never use it for a status pill, urgency chip, or any non-actionable signal.

### Secondary
- **Threadline Gold** (`hsl(41.4 53.8% 54.1%)`): The one constant brand accent, identical in light and dark mode (defined once on `:root`, never overridden). It carries two related jobs and no others, both versions of the same idea — the thread you are currently holding:
  1. **Identity.** Baked into the brand lockup artwork (`public/brand/ariadne-banner.png` and the app icons), and the focus ring on the two pieces of chrome adjacent to identity (the logo link and the search trigger, `TopBar.tsx`). These are the only two focus rings in the app that are not the neutral ring.
  2. **Your thread, live.** The pulsing dot on a running timer (`RunningTimerChip.tsx`, `ItemRow.tsx`), the left edge of the Today card (`TodaySection.tsx`), and the capacity figure for the day you have committed to (`TodaySection.tsx`, `PlanDayDialog.tsx`). The search-match highlight (`<mark>` in `ItemRow.tsx`, at 30% alpha) belongs here too: it marks the row you are currently looking for.

  What unites the second group is that none of it is reported by GitHub or Azure DevOps. It is all local, present-tense, and yours: the timer that is running, the day you chose, the row you are hunting. Source-reported state never gets gold — that is what Amber Watch and Signal Red are for.

### Tertiary
- **Amber Watch** (`hsl(38 92% 55%)`): Warning, staleness, and the "high" urgency band. Shared value doubles as `--warning` and `--urgency-high` — one hue for "needs attention soon."
- **Signal Red** (`hsl(358.8 100% 69.6%)` destructive / `hsl(358 75% 59%)` urgency-critical, distinct tunings of the same hue): Destructive actions and the "critical" urgency band.
- **Success Green** (`hsl(142 71% 45%)`): Defined on the `Badge` component (`variant="success"`). Reserved for exactly one meaning: "this is saved or done and needs no action," never for a status that demands attention. It has two examined uses, each admitted against the Two-Band/color-scarcity rule below rather than by default:
  1. The "Token saved" indicator per integration on the Settings page (`SettingsForm.tsx`). Settings is a low-traffic configuration surface, not the dashboard's attention-triage view, so a quiet affirmative marker there doesn't compete with or dilute the urgency bands' scarcity.
  2. The settled check on the score chip (`ScoreChip.tsx`, driven by `lib/settled.ts`), which fires when the source system has finished an item that Ariadne, being read-only, still shows as open. This one does appear on the dashboard, and it is admitted anyway because it is the literal reserved meaning: the chip stops reporting a live urgency reading and reports "done, nothing left to do here." It cannot compete with the urgency bands because it replaces one — a row shows the check or a score, never both. The `gone` outcome (an ADO work item set to Removed) deliberately does **not** get the green: it left your plate without being finished, so it takes the neutral low-band treatment instead. Green here means you got it over the line.

  A third use needs the same examination, and specifically needs to answer why it isn't competing with the urgency bands.

- **Report series** (`hsl(212.8 76.8% 56.1%)` GitHub / `hsl(159.2 72.7% 35.9%)` Azure DevOps / `hsl(39.7 100% 39.4%)` ad-hoc): Three categorical hues, used only on the time-report charts (`ReportDashboard.tsx`, Recharts pie and bar). They identify a source, not a state, and they exist only on `/report` — a surface you go to deliberately rather than triage against. Keeping them off the dashboard is what stops the palette from reading as a rainbow where scarcity matters. Note the ad-hoc series sits close to Amber Watch in hue; that collision is tolerable only because the two never share a screen.

### Neutral
- **Backdrop** (`hsl(240 10% 3.9%)` dark / `hsl(0 0% 100%)` light): Page background.
- **Ink** (`hsl(0 0% 98%)` dark / `hsl(240 10% 3.9%)` light): Primary text.
- **Surface** (`hsl(240 5.9% 10%)` dark / `hsl(0 0% 100%)` light): Cards, popovers, dialogs — one step off the backdrop.
- **Surface Raised** (`hsl(240 3.7% 15.9%)` dark): Secondary buttons, muted backgrounds, hover accents — one step further off the backdrop.
- **Muted Ink** (`hsl(240 5.5% 64.3%)`): Secondary text, metadata, timestamps, and every disclosure control.
- **Slate Neutral** (`hsl(240 5% 65%)` dark / `hsl(240 5% 45%)` light): The "medium" and "low" urgency bands, and the neutral status pill. Deliberately colorless so only the top two urgency bands compete for attention.
- **Border Hairline** (`hsl(0 0% 100% / 10%)` dark / `hsl(240 5.9% 90%)` light): Row dividers, card borders. An alpha-over-ink hairline in dark mode, not a separate flat gray.

### Named Rules
**The Interactive-Only Rule.** Indigo Focus is the sole signal for "you can act on this." It never labels a state, a category, or an urgency level. If a new component needs a color for a clickable thing, it's this one; if it needs a color for a status, it's never this one.

**The One Thread Rule.** Threadline Gold marks the thread you are on, and nothing else: the brand lockup and its two identity-adjacent focus rings, plus the four present-tense local signals (running-timer pulse, the Today card's edge, today's capacity figure, the search match). The test for a new gold element is one question: *is this fact local, present-tense, and mine?* A figure GitHub or Azure DevOps reported is never gold, however important. Nor is a generic interactive control — that is Indigo Focus's job.

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

A single dense information surface, not a marketing-style spacious one. The dashboard is one continuous column of sections and rows inside a `max-w-6xl` centered container; the top bar spans full width with a fixed 4-column grid (logo / running-timer chip / search trigger / actions) at a 16px horizontal page gutter (`px-6`).

Row density is a first-class, user-facing setting with exactly two states, both on a 4px grid: **comfortable** (2.75rem/44px = 11 × 4px) and **compact** (2.25rem/36px = 9 × 4px). Row height is fixed per mode so content can never reflow it; below the `sm` breakpoint (640px, the only breakpoint the system uses) rows wrap onto two lines instead of shrinking further. Sections stack vertically with `border-b` hairline dividers between rows rather than card gaps — the list itself is the container, individual rows are not cards.

Responsive behavior is mobile-down, not mobile-up: the row-actions cluster is always visible on touch (`opacity-100`) but recedes to `opacity-60` on hover-capable pointers until hover or focus, since a hidden-until-hover affordance only makes sense where hovering is possible.

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
- **Primary:** Indigo Focus background, white text, subtle shadow, `hover:bg-primary/90`. Reserved for the one clearly-primary action per context (Complete, the command-palette invocation is a ghost button, not this).
- **Outline / Ghost:** Transparent or backdrop background, Ink or Muted Ink text, hairline border on outline only. This is the default for row actions (Start, Complete on `ItemRow`) — deliberately not the filled Primary treatment, since every row's action competes with every other row's, and filling all of them would break the Two-Band attention gradient at the button level too.
- **Sizes:** `h-9` default / `h-8` small / `h-10` large / `h-9 w-9` icon-only. Density mode can push a button to `h-11` inline (see comfortable row height).
- **Not for disclosure.** A `Button` of any variant is the wrong primitive for expanding or collapsing a list; that has its own pattern below.

### Score Chip (signature component)
The system's most distinctive custom primitive, not a shadcn default. A small (`h-5`, `min-w-6`) mono, tabular-nums button, `0.25rem` radius, that opens a popover breakdown of exactly which scoring rules fired. Fill and border follow the Two-Band Rule: Low is borderless text, Medium is a neutral 2px outline, High and Critical are filled with Amber Watch / Signal Red respectively using dark ink (never white) as the foreground, per the paired `*-foreground` tokens. This is the component that makes "transparent, not opaque" a visible, clickable fact rather than a claim in the README.

**Settled state.** When the source system has closed an item Ariadne still shows as open, the chip stops reporting a number and reports the outcome instead: a `Check` glyph on Success Green for `finished`, a `Minus` glyph in the neutral low-band treatment for `gone`. The score stays fully inspectable in the popover underneath. A row shows a reading or an outcome, never both.

### Disclosure Control (signature pattern)
The house grammar for "there is more here, and here is exactly how much." Used in three places — `Snoozed · 3` and a group's `Lower scoring · 4` in `SignalsBoard.tsx`, and `Paused · 2` in `ItemSection.tsx` — and it must be used for any fourth.

- **Shape:** a bare `<button>`, never a `Button` component. Full width, `pt-3 pb-1`, no border, no background, no radius of its own.
- **Type:** Micro (`text-xs font-medium`) in Muted Ink, rising to Ink on hover. It is subordinate to every row it sits under and must never carry the visual weight of the content it hides.
- **Label:** a state, then an interpunct, then the count in the mono/tabular register: `Paused · 2`. The label names *what* the hidden rows are, not the act of revealing them. "Show more" is not a state and is not an acceptable label.
- **Semantics:** `aria-expanded` plus `aria-controls` pointing at the wrapper `div` that holds the collapsed rows, which carries the matching `id`. Toggles both ways, always; a one-way expansion is a defect.
- **Keyboard:** carries `data-row-nav` so `j`/`k` row navigation stops on it (`GlobalKeymapProvider.tsx`) rather than stepping over the rows it hides. Enter and Space activate it natively.
- **The count is a promise.** A group's header pill shows the true total; the disclosure accounts for the difference. If a cut would separate two rows the ranking scores identically, the cut moves rather than the truth (`visibleCount()` in `lib/grouping.ts`) — hiding one row while showing its equal claims a rank the score does not have.

### Badges / Pills
- **Style:** `0.375rem` radius, `border`, `text-xs font-semibold`, one badge per row maximum (see `ItemRow`'s inline-badge precedence logic — extra reason pills move to a hover-card rather than piling up).
- **State:** `outline` is the default/neutral treatment for reason pills (approved, mentioned, review-requested); filled variants (`destructive`, `warning`, `blocked`, `success`) are reserved for states that demand action or, for `success`, the one affirmative meaning documented under Success Green.

### Cards / Containers
- **Corner Style:** `0.75rem` radius (rounded-xl), the largest radius in the system.
- **Background:** Surface, one step off the backdrop.
- **Shadow Strategy:** Default Tailwind `shadow` only; see Elevation & Depth.
- **Border:** Hairline, low-contrast. The Today card is the one card with a colored edge — a 2px Threadline Gold left border marking the day you committed to, per The One Thread Rule.
- **Internal Padding:** `1.5rem` (p-6), trimmed to `1.5rem 1.5rem 0` between header and content.

### Inputs / Fields
- **Style:** `0.375rem` radius, hairline border, transparent/backdrop background, `shadow-sm`.
- **Focus:** `ring-1 ring-ring` — the neutral focus ring, not Indigo Focus and not Threadline Gold; those two are reserved per the Named Rules above.
- **Error:** Signal Red text below the field, not a red border on the field itself.

### Segmented Control
`SegmentedChoice.tsx`, the shared primitive for **a value the user sets by hand**, as opposed to one a source reported. A radiogroup of adjacent segments; the selected segment carries full opacity and the unselected ones drop to 60%, with an optional readout beside each label in the mono/tabular register. Selection is signalled by opacity and weight, not by a fill, so it stays visually quieter than any urgency band — the urgency channel belongs to the score chip, and a coloured control here would read as a fifth band and break the Two-Band Rule. One tab stop, arrow keys to move, per the radiogroup pattern.

Three consumers, and the rationale is the same in all three:
- **Priority** (`PrioritySegments.tsx`): the ad-hoc item's hand-set priority, `low`/`medium`/`high`, each showing its point contribution (`+0`, `+20`, `+40`). Clearable, because "I haven't decided" is a real state and the one every item starts in.
- **Suggestion algorithm** (`SuggestPanel.tsx`): Urgency first / Quick wins / Balanced, no readout, filling the panel's width.
- **Suggestion lean** (`SuggestPanel.tsx`): five notches, each stating the whole split it produces (`80/20` … `20/80`) rather than one side of it. A bare `20` sitting next to the "PRs" axis label reads as "pull requests get 20", which is the opposite of what that notch means, so the compact pair is the label and the spoken name spells it out in full.

Equal-width segments are opt-in (`fill`), so a control sized by its content keeps its proportions when the primitive is reused.

### Drag Handle
`SortableRows.tsx`, used only in Today and step 3 of Plan the day, where the list is hand-ordered rather than score-ordered. A 16px `GripVertical` glyph in Muted Ink, `cursor-grab` becoming `cursor-grabbing`, `touch-none` so a touch drag doesn't scroll the page. The row it belongs to takes the Drag lift shadow while moving. A handle appears only where order is genuinely the user's to set; a score-ordered list must never show one.

### Navigation (Top Bar)
Sticky, full-bleed, `backdrop-blur` translucent over the backdrop color, hairline bottom border. Four-column grid: the Ariadne brand banner at 32px height (`public/brand/ariadne-banner.png`, a self-contained dark lockup that reads the same in light and dark mode), running-timer chip, `⌘K` search trigger, then icon-button actions (Report, Settings, theme toggle). The logo link and search trigger are the only two controls in the entire app whose focus ring is Threadline Gold instead of the neutral ring — a deliberate, small tell that these two controls are "about the product's identity," not just generic navigation.

### Report Charts
`ReportDashboard.tsx` only. A Recharts pie (time by source) and bar (daily series), colored from the three Report series hues and nothing else. Charts get no gridline decoration, no gradient fills, and no drop shadows; they are readings rendered large, consistent with the instrument-panel thesis. This is the only surface in the app that carries categorical color.

## Do's and Don'ts

### Do:
- **Do** keep Indigo Focus exclusively on things the user can click or activate.
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
