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
} as const;

export const DEFAULT_STALE_DAYS = 3;
export const NEEDS_ATTENTION_THRESHOLD = 25;

export const SPRINT_DONE_ADO_STATES = new Set(['done', 'ready for validation', 'ready for test']);
