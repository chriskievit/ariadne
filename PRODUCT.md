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
Work mode extends the same idea to work he has handed to a coding agent:
Ariadne opens the session, then shows whose turn it is across every live
session at once, so a handed-off ticket stays as visible as one he is
working himself.

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
- Work mode (`/work`) is the app's second face. Chris hands an item to a
  coding agent, and the Watch Floor shows every live session and whose
  turn it is in one rail.
- Launching a session writes a Warp launch configuration and opens a Warp
  tab in the item's configured local repo; Ariadne does not run the agent
  itself. Warp is the only terminal supported today. Treat that as the
  first adapter, not a settled commitment.
- Six agents are configured (Claude Code, Codex, Cursor Agent, OpenCode,
  Gemini CLI, Aider). Only Claude Code reports its own lifecycle back, via
  a per-session settings file Ariadne writes to disk carrying the launch
  token and, when set, `ARIADNE_AUTH_TOKEN` — the same trust model as the
  PATs in the settings table. An agent that cannot report is marked as not
  reporting rather than shown as silently healthy.

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
  table. One carve-out, named rather than blurred: Work mode launches a
  coding agent Chris chose, in a repo he configured, and that agent writes
  code and can open a pull request. Ariadne issues no such request itself.
  The blast radius grew even though its own API surface did not, and every
  diff and every push stays his to review. A second, smaller change to this
  posture: showing a session's branch and diff runs `git` as a subprocess
  (`lib/git-cli.ts`), the first process Ariadne itself has ever started.
  It is read-only — `rev-parse`, `symbolic-ref`, `merge-base`, `diff`, and
  nothing that writes — invoked through `execFile` with an argument array,
  never a shell, so a branch name containing shell metacharacters reaches
  git as data, not syntax. It runs under a five-second timeout and an
  output cap, so a pathological repository degrades to "no diff available"
  rather than hanging the pane. Read-only against source systems stays
  true; this is the first time getting there also means running a process.
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
- **Delegation is launched and watched, never supervised.** Chris chooses
  what to hand to an agent and which agent gets it. Ariadne opens the
  session and then only reports: it never picks the ticket, never answers
  the agent, never approves a diff, and never merges. Handing over marks
  the item in progress, because work has begun on it, and deliberately
  starts no timer: an agent working while Chris does something else must
  not bill his hours. The handover never adds the item to today's plan and
  only reorders it when it is already there, which preserves the
  Today/Signals exclusivity above. The roster's order is a fixed answer to
  "whose turn is it", not a second ranking: there is exactly one ranking
  number in Ariadne and it belongs to the score chip
  (`lib/agent-roster.ts`). Watching stops on Chris's word, but the agent
  does not: Ariadne holds no process handle for a launched session — Warp
  owns that process — so dismissing a session
  (`app/api/agent-sessions/[id]/dismiss/route.ts`) only stops Ariadne
  tracking it and deletes the Warp tab config that would have relaunched
  it; the agent keeps running until Chris stops it in Warp himself.
  Resuming a dismissed session is refused for the same reason: the
  original process may still be alive, and resuming would start a second
  one on the same conversation rather than reattaching to the first
  (`app/api/agent-sessions/[id]/resume/route.ts`). Parking, snoozing, and
  completing an item carry the identical honesty when a session is live.
  Park and Snooze offer a checkbox, checked by default, that stops
  tracking the session alongside the item action (`ItemRow.tsx`'s
  `agentDismissOption`, wired through an optional `dismissSessionId` on
  `handlePark`/`handleSnooze` in `Dashboard.tsx`); Complete does the same
  without asking, because declaring the work finished makes a session
  still tracked against it stale by definition, not a choice. All three
  call the same dismiss route Dismiss itself calls
  (`app/api/agent-sessions/[id]/dismiss/route.ts`), so none of them can
  say more than Dismiss is allowed to say: they end Ariadne's own record
  of the session, never the agent. Completing an item with a live session
  shows the agent's elapsed time beside the hours field as a
  `~`-prefixed reference labelled the agent's time (`ItemRow.tsx`); it is
  never written into the field itself, because an agent's wall clock is
  not the hours Chris logs for his own work. An agent session never
  consumes capacity either: handing off does not add the item to today's
  plan (above), and an agent's elapsed time never reaches `plan_items`, an
  estimate, or a logged-hours total — only Chris's own timer and his own
  hand-set estimates do that.
- **Settled vocabulary for the lifecycle actions, no two words for one
  meaning.** **Park** / **Unpark** / **Parked** name one concept: an
  in-progress item set aside and pulled back (`onPark`/`onUnpark` in
  `ItemRow.tsx`; the disclosure control reads `Parked · N` in
  `ItemSection.tsx`). **Stop timer** (`RunningTimerChip.tsx`, a `Square`
  icon) is the running-timer control, and it permanently stops the timer —
  there is no pause to come back to. **Dismiss** (`SessionPane.tsx`, and
  the same underlying action offered as a checkbox on `ItemRow.tsx`'s
  park/snooze cascades and triggered automatically by Complete) ends
  Ariadne's record of an agent session, and only that; see Delegation
  above for why it never stops the agent. **Resume** (labelled
  "Resume in a new tab", `SessionPane.tsx`) resumes an agent's conversation
  in a new Warp tab, and only that — it is refused outright for a
  dismissed session (`app/api/agent-sessions/[id]/resume/route.ts`)
  because the original process may still be alive. **Not now**
  (`SuggestPanel.tsx`) declines the Suggest-a-day panel; it is deliberately
  not "Dismiss", which already means something else in this app, and it
  sits beside the dialog's own corner close so a screen reader is never
  handed two controls with the same accessible name. **Back to queue**
  (`ItemRow.tsx`, the requeue action) moves an in-progress item back to
  Signals (`setStatus(db, id, 'inbox')`,
  `app/api/items/[id]/requeue/route.ts`).
- **Deliberately small surface.** Two faces (the ranked dashboard and the
  Work mode watch floor at `/work`), a time report, and Settings. New
  features are scoped tightly; real tradeoffs (like plaintext token
  storage) are accepted explicitly rather than hidden.
- **Keyboard-first is a durable principle, not just a roadmap feature.**
  Future surfaces should stay fast and usable via keyboard, not only mouse
  driven — this motivates the existing keyboard-shortcut layer and Cmd+K
  command palette work and should inform new UI beyond that specific
  roadmap.
- **Today and In-progress are independent axes, not one bucket each.**
  Today reflects a day's plan; In-progress reflects live work status.
  Today is built from `items.today_date` (`isPinnedToday()` in
  `lib/date.ts`, filtered by `getGroupedItems()` in `lib/dashboard.ts`),
  not from `plan_items`. The two usually agree, but `plan_items` states a
  different fact: it is the day's plan for capacity and logged-hours
  bookkeeping (`todayPlannedMinutes`/`todayLoggedMinutes`, also
  `lib/dashboard.ts`), and an item removed from the Today bucket
  (`today_date` cleared) keeps counting toward those totals through its
  `plan_items` row. The Watch Floor rail mirrors Planning's Today section
  the same way — `listItemIdsPinnedToday()` in `lib/items-repo.ts`, not
  `plan_items` — so the two surfaces cannot disagree about what Today
  means. An item pinned to today's plan stays visible in Today through
  Start/Pause/Complete and can legitimately appear in both Today and
  In-progress at once. Signals stays mutually exclusive of Today: an item
  exists in exactly one of Today / Signals at a time (pinning to today is a
  move out of Signals, not a copy). Preserve the Today/Signals exclusivity
  when touching item-state logic; do not reintroduce it between Today and
  In-progress.
- **Four independent axes, not one bucket each.** Status (`items.status`),
  parked (`items.parked`), Today (`items.today_date`), and an agent
  session's state (`agent_sessions.state`, a separate table keyed by
  `item_id`, `lib/db.ts`) are four separate facts about an item, and a
  session's state never implies one of the other three, nor do they imply
  it. An item can be `in_progress` with no session at all (started by
  hand), `in_progress` with a live session in any of its six states,
  parked with a session still `working`, or pinned to Today with a session
  that has since gone `stopped`. Dismissing a session
  (`dismissAgentSession()`, `lib/agent-sessions-repo.ts`) only stamps
  `endedAt`/`endReason` and leaves `state` untouched, and none of
  `setParked()`, `setTodayDate()`, or `setStatus()` (`lib/items-repo.ts`)
  ever writes to the `agent_sessions` table. Launching a session is the one
  place a session action reaches into status — it sets the item
  `in_progress` once, as part of handing the work over (see Delegation
  above) — but that is a one-time side effect of the handoff, not an
  ongoing coupling between the two axes afterward. This is the same lesson
  the Today/In-progress axis above already taught once: a session state
  never implies a status, and a status never implies a session state.

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
