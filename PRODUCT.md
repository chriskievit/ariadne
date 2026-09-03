# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary user is Chris, a software engineer who works across GitHub and Azure
DevOps day to day and also fields ad-hoc requests (face-to-face, email,
Teams). He is currently the sole user and the tool is built around his
personal workflow. Multi-user support is not ruled out as a future
possibility, but nothing in the product today assumes or builds toward a
second account — see Capabilities and Constraints.

## Product Purpose

Ariadne gives Chris a clear, at-a-glance overview of his work and the mental
space to process it. It pulls GitHub (PRs, review requests, mentions), Azure
DevOps (assigned work items, comments, sprint iterations), and ad-hoc
requests into one ranked view, tracks sprint progress, and lets him pick
what he's working on and log time against it. It is explicitly not trying
to manage his calendar. It will propose a day when asked, and only when
asked, with its reasoning shown and nothing written until he accepts; what
it will not do is decide for him or arrange his time on its own.

## Positioning

"The anti-autopilot": a transparent, read-only thread through GitHub, Azure
DevOps, and ad-hoc work signals, not an algorithm that runs the day. No
other personal tool combines all three source types into one view. The
category it's positioned against (deliberately unnamed as specific rivals
in user-facing copy) is autoscheduling productivity tools like Motion,
Reclaim.ai, Sunsama, and Akiflow, which auto-arrange calendars and rank
work with opaque, ML-driven priority.

## Operating Context

- Runs as a single local Next.js app (frontend + API routes together),
  either via `npm run dev`/`npm start` or self-hosted via Docker.
- Data lives in a local SQLite file (`better-sqlite3`); no separate database
  server, no cloud sync.
- On first run, Chris adds GitHub and Azure DevOps personal access tokens
  (read-only scopes) in Settings; tokens are stored in the SQLite `settings`
  table in plaintext, the same trust model as a `.env` file.
- Syncs automatically every 5 minutes while the dashboard is open, plus a
  manual Refresh button.
- Ariadne has no login of its own when run locally; exposing it beyond
  loopback requires setting `ARIADNE_AUTH_TOKEN` for Basic Auth.
- Day-to-day usage: reviewing the ranked dashboard, starting/completing
  items (local-only status, cascades only touch Ariadne's own `items`
  table), tracking sprint progress, and logging time via a timer/report
  view.

## Capabilities and Constraints

- **Personal, local-only, single-user today.** SQLite file on the machine,
  no account system, no multi-tenant backend. A second user/account is an
  explicitly undecided future possibility, not a planned feature — do not
  build toward it speculatively, but don't foreclose it either (e.g. avoid
  hardcoding single-user assumptions in ways that would make later support
  painful for no reason).
- **Read-only against source systems, always.** Ariadne never writes back
  to GitHub or Azure DevOps. Actions like Start/Complete, even when they
  cascade to linked items, only ever touch Ariadne's own local `items`
  table.
- **Transparent, deterministic scoring, not AI-driven.** Urgency is a
  visible point formula (own PR approved, mentioned, stale, due soon, ...)
  in `lib/scoring.ts`, not an opaque ML ranking. Every score chip on the
  dashboard opens to show exactly which rules fired and which didn't. One
  term in the formula is set by hand rather than observed: an ad-hoc item's
  priority (low/medium/high). It is shown under its own "what you set"
  heading, separate from what the sources report, and it is the only such
  term. Three non-point rules also affect ordering and must stay disclosed
  wherever the scoring is explained: `sortByUrgency()` promotes every
  in-progress item above everything else regardless of score,
  `sortStarredFirst()` lifts starred items to the top of their group
  whatever they score, and ad-hoc items are exempt from the attention
  threshold. The suggestion rules (three selectable algorithms, how a
  duration is resolved, what the preference cap does) are generated from the
  same constants the engine reads and published in the same reference dialog
  as the scoring rules, so neither can drift from the code.
- **No auto-scheduling.** No auto-arranging of the calendar or the day.
  Ariadne surfaces signals; Chris decides what to work on and when.
  Planning rituals (e.g. a plan/wrap-up flow with capacity) support this
  decision without making it for him. Suggestion is the one place Ariadne
  proposes an answer. It runs only when asked, shows its reason for every
  pick and the provenance of every duration, writes nothing until Chris
  accepts, and never reorders or removes anything on its own. The score
  itself is never adjusted to produce a suggestion: the preference control
  is a cap on how much of the day each side of the work-item/pull-request
  split can take, not a weight on any score. Where that cap holds something
  back, the day is left with room in it rather than filled from the other
  side, and the rows it held back are listed, so the cost of the setting is
  visible rather than silent.
- **Deliberately small surface.** A dashboard route, a time report, and
  Settings. New features are scoped tightly; real tradeoffs (like plaintext
  token storage) are accepted explicitly rather than hidden.
- **Keyboard-first is a durable principle, not just a roadmap feature.**
  Future surfaces should stay fast and usable via keyboard, not only mouse
  driven — this motivates the existing keyboard-shortcut layer and Cmd+K
  command palette work and should inform new UI beyond that specific
  roadmap.
- **Today and In-progress are independent axes, not one bucket each.**
  Today reflects a day's plan (`today_date`/`plan_items`, unaffected by
  status changes); In-progress reflects live work status. An item pinned to
  today's plan stays visible in Today through Start/Pause/Complete and can
  legitimately appear in both Today and In-progress at once. Signals stays
  mutually exclusive of Today: an item exists in exactly one of Today /
  Signals at a time (pinning to today is a move out of Signals, not a
  copy). Preserve the Today/Signals exclusivity when touching item-state
  logic; do not reintroduce it between Today and In-progress.

## Brand Commitments

- Name: **Ariadne**. Tagline: "the anti-autopilot: a transparent, read-only
  thread through your GitHub, Azure DevOps, and ad-hoc work signals, not an
  algorithm that runs your day."
- Logo: the threaded-A mark. Brand lockup is `public/brand/ariadne-banner.png`
  (used in the app's top bar and at the top of the README); app icons and
  favicons are the `public/icon-*.png`, `public/favicon.ico`,
  `public/apple-touch-icon.png`, and `public/android-chrome-*.png` set.
- Voice: plain, declarative, calm, a little dry. No hype adjectives
  ("revolutionary", "powerful", "seamless"). No em-dashes in any
  user-facing or marketing copy. Never name competitor products in
  user-facing copy (describe the category/behavior contrasted with
  instead). Tone calibrated against well-known self-hosted/homelab OSS
  READMEs (e.g. Octobox, Glance), not SaaS marketing copy.

## Evidence on Hand

- `docs/screenshot-dashboard.png` — dashboard showing Today, In progress,
  and Signals grouped by GitHub, Azure DevOps, and ad-hoc.
- `docs/screenshot-empty-state.png` — first-run empty state prompting to
  add tokens in Settings or add an ad-hoc request.
- `docs/wireframes/` — wireframes for the 5-phase Issue #15 UI/UX roadmap
  (Foundation, Make the thesis visible, Speed and control, Shape of a day,
  Finish), rendered from an external proposal doc.
- No testimonials, benchmarks, pricing, or customer case studies exist;
  none should be fabricated. This is a personal/self-hosted tool, not a
  commercial product.

## Product Principles

- Give visibility and mental space, don't make decisions for the user.
- A suggestion is a proposal, never a commitment. Nothing the tool worked out
  for you becomes a number you own until you accept it.
- Keep ranking legible: if a score exists, its rules must be inspectable.
- Never write back to source systems; local state stays local.
- Accept real tradeoffs explicitly instead of hiding them behind false
  reassurance.
- Keep the surface small; scope new features tightly rather than growing a
  general-purpose work-management tool.
- Stay fast for a keyboard-driven power user, not just a mouse-driven one.
