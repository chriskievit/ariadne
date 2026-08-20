# Contributing to Ariadne

Ariadne is a single-maintainer personal tool that other people are welcome to
fork, self-host, and improve. Contributions are genuinely welcome — the
expectations below are here so you don't waste effort, not to gatekeep.

## Before you start

**Open an issue before a large PR.** Ariadne has a deliberately small surface:
a dashboard route, a time report, and Settings. That's a real design constraint,
not an accident, so a well-built feature can still be declined for being outside
it. A short issue first saves you from building something that gets turned down.

Small, obvious fixes — a bug, a typo, a broken link — can go straight to a PR.

## Running locally

Node 22 (see `.nvmrc`).

```bash
npm install
npm run dev
```

The app runs at `http://127.0.0.1:3000`. On first run, open **Settings** to add
GitHub and Azure DevOps personal access tokens with read-only scopes. They're
stored in the local SQLite database, so nothing you configure while developing
leaves your machine.

Docker is also supported — see the self-hosting section of the README.

## Testing

**A PR is expected to arrive end-to-end tested.** Cover new or changed behaviour
with tests in the framework that already exists here — please don't introduce
another one:

- **Logic, repositories, API routes** → a Vitest `*.test.ts` alongside the file
  it covers, following the existing pattern in `lib/` and `app/api/`.
- **Anything a user can see or click** → a Playwright spec in `e2e/`, reusing
  the helpers in `e2e/helpers.ts` and seeding its own state.

If you're changing code whose tests are missing, add them as part of the PR
rather than leaving the gap where you found it.

The e2e suite runs single-worker with no retries, so a test that only passes
sometimes counts as failing. Tests must be self-contained and not depend on
each other's leftovers.

```bash
npm test          # Vitest
npm run test:e2e  # Playwright
```

## README screenshots

The images in `docs/` are generated, not hand-captured. `npm run screenshots`
starts a dev server against a throwaway database, seeds the fictional data in
`scripts/screenshots/seed.ts`, and writes `docs/screenshot-dashboard.png` and
`docs/screenshot-empty-state.png`. It never talks to GitHub or Azure DevOps, so
no real repo, work item, or person can leak into a screenshot. Re-run it when a
UI change makes the README images out of date, and keep the seeded states ones
the app can actually reach on its own.

## What CI enforces

CI runs on every pull request and mirrors these commands exactly. Run them
locally first — it's faster than waiting for a red build:

```bash
npm test                              # unit and route tests
npx tsc --noEmit                      # type check
npm run build                         # production build
npm run test:e2e                      # end-to-end tests
npm audit --omit=dev --audit-level=high   # production dependency audit
```

CI also greps `lib/github-client.ts` and `lib/ado-client.ts` for non-GET request
methods. See below.

## Project invariants

These aren't style preferences. A PR that breaks one won't be merged.

**Read-only, always.** Ariadne never writes back to GitHub or Azure DevOps.
Actions like Start and Complete only ever touch Ariadne's own local `items`
table. This is enforced in CI: any `POST`/`PUT`/`PATCH`/`DELETE` method string
in the provider clients fails the build unless it's an explicitly marked
`READ-ONLY-QUERY` (GitHub GraphQL and Azure DevOps WIQL both require POST to
carry a query body).

**Local-only and single-user.** No account system, no cloud sync, no
multi-tenant backend. Just a SQLite file on the user's machine.

**Transparent scoring.** Urgency is a deterministic, readable point formula in
`lib/scoring.ts`, and every score chip opens to show which rules fired. New
scoring rules go in that table and stay explainable. No opaque ranking.

**Honest tradeoffs.** Where a limitation exists — tokens stored in plaintext
locally, for instance — it's documented rather than hidden. Keep it that way.

## Commits

This repo uses [Conventional Commits](https://www.conventionalcommits.org/) with
the Angular preset, and releases are fully automated by semantic-release on
merge to `main`. Your commit type decides the version bump:

| Prefix | Effect |
| --- | --- |
| `feat:` | minor release |
| `fix:` | patch release |
| `BREAKING CHANGE:` in the body | major release |
| `docs:`, `chore:`, `ci:`, `refactor:`, `test:` | no release |

**Don't hand-edit `CHANGELOG.md`, the `version` field in `package.json`, or
`package-lock.json` versions.** semantic-release owns all three and will
overwrite your changes.

## Pull requests

- One focused change per PR. Unrelated refactoring makes review harder and
  usually gets asked out again.
- Say what you changed and why. If there's a tradeoff, name it — that's more
  useful than a clean-looking diff.
- Link the issue it addresses, if there is one.
- Expect review comments. This is a personal tool with opinions baked in;
  questions about an approach aren't a rejection of it.

## Working with AI agents

Agents are welcome here. Ariadne is largely built with them, so it would be odd
to ask contributors not to use them. There's no disclosure requirement.

**But the person who opens the PR owns the diff.** That means:

- You understand every line you're submitting and can explain why it's there.
- You can answer review questions about it without going back to re-derive the
  reasoning.
- You ran `npm test` and `npm run test:e2e` locally and they passed.
- The tests are real tests, not assertions shaped to match whatever the code
  currently does.

A PR that reads as unreviewed agent output — tests that don't test anything,
invented APIs, changes to files the task never needed to touch, a description
that doesn't match the diff — will be closed rather than reviewed line by line.
Review time is the scarce resource on a single-maintainer project, and that's
the whole reason for the rule.

## Code of conduct

Participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE) that covers this project.
