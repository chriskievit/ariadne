import type { Source } from '../types';

// Sources whose items carry an upstream state (upstream_status plus
// status_category). Phase 2 adds 'jira_issue'. Pure: used by client components.
const TRACKER_SOURCES: ReadonlySet<Source> = new Set<Source>(['ado_workitem']);

export function isTrackerSource(source: Source): boolean {
  return TRACKER_SOURCES.has(source);
}
