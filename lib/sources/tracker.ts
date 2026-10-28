import type { Source } from '../types';

// Sources whose items carry an upstream state (upstream_status plus
// status_category). Pure: used by client components.
const TRACKER_SOURCES: ReadonlySet<Source> = new Set<Source>(['ado_workitem', 'jira_issue']);

export function isTrackerSource(source: Source): boolean {
  return TRACKER_SOURCES.has(source);
}
