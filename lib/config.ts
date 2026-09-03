export const SETTINGS_KEYS = {
  githubPat: 'github.pat',
  adoPat: 'ado.pat',
  adoOrg: 'ado.org',
  adoProject: 'ado.project',
  adoTeam: 'ado.team',
  staleDays: 'github.staleDays',
  sprintName: 'sprint.name',
  sprintStart: 'sprint.start',
  sprintEnd: 'sprint.end',
  localReposBaseDir: 'warp.localReposBaseDir',
  repoPathOverrides: 'warp.repoPathOverrides',
  density: 'ui.density',
  savedViews: 'ui.savedViews',
  dailyCapacityMinutes: 'plan.dailyCapacityMinutes',
  longRunNudgeHours: 'plan.longRunNudgeHours',
  suggestAlgorithm: 'suggest.algorithm',
  suggestLean: 'suggest.lean',
} as const;

export const DEFAULT_STALE_DAYS = 3;
export const NEEDS_ATTENTION_THRESHOLD = 25;
export const DEFAULT_CAPACITY_MINUTES = 360; // 6h, per the wireframe's default
export const DEFAULT_LONG_RUN_NUDGE_HOURS = 2;

// Balanced is the default because it is the only one of the three that both
// protects a block for real work and clears the small stuff. Urgency first is
// the honest fallback, but on a day with one big overdue item it produces a
// plan with a single row in it.
export const DEFAULT_SUGGEST_ALGORITHM = 'balanced';

export type Density = 'comfortable' | 'compact';

// Compact wins on a screenshot and loses on a Tuesday afternoon — a tool
// opened dozens of times a day shouldn't ship at its tightest setting.
export const DEFAULT_DENSITY: Density = 'comfortable';

export const SPRINT_DONE_ADO_STATES = new Set(['done', 'ready for validation', 'ready for test']);
