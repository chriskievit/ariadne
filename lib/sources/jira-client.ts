import type { NewSyncedItemInput, StatusCategory } from '../types';
import { DEFAULT_JIRA_JQL } from '../config';
import { normalizeJiraSite } from './configured';
import type { SprintInfo } from './types';

export interface JiraConfig {
  site: string;
  email: string;
  token: string;
  // Empty or missing means DEFAULT_JIRA_JQL.
  jql?: string;
}

export interface JiraSyncResult {
  items: NewSyncedItemInput[];
  sprint: SprintInfo | null;
  // True when the search stopped at MAX_ISSUES with more left.
  truncated: boolean;
}

const PAGE_SIZE = 100;
export const MAX_ISSUES = 500;
// How many comment fetches run at once. Enough to keep a 30-issue sprint
// quick, few enough to stay clear of Jira's per-user rate limit.
const COMMENT_CONCURRENCY = 5;
const SPRINT_FIELD_SCHEMA = 'com.pyxis.greenhopper.jira:gh-sprint';

// The Sprint field is a custom field whose id differs per site
// (customfield_10020 on most, not all). Looked up once per site for the life
// of the process; null means the site has no Sprint field at all.
const sprintFieldBySite = new Map<string, string | null>();

export function resetJiraCachesForTest(): void {
  sprintFieldBySite.clear();
}

function authHeader(config: JiraConfig): string {
  return 'Basic ' + Buffer.from(`${config.email}:${config.token}`).toString('base64');
}

// Same wording contract as the ADO and GitHub clients: classifyError() reads
// "rate limit", "missing a required scope" and "401" out of these messages.
// Jira answers a 404 for an issue you cannot see, so 403 here really is scope.
async function jiraApiError(res: Response): Promise<Error> {
  const body = (await res.text()).slice(0, 300);
  if (res.status === 401) {
    return new Error(`Jira authentication failed (401): check the email and API token. ${body}`);
  }
  if (res.status === 429) {
    return new Error(`Jira rate limit exceeded: ${body}`);
  }
  if (res.status === 403) {
    return new Error(`Jira API error 403 (token may be missing a required scope): ${body}`);
  }
  return new Error(`Jira API error ${res.status}: ${body}`);
}

// GET only, and no init parameter, so there is no way to pass a method:
// Ariadne never writes to Jira.
async function jiraGet(config: JiraConfig, path: string): Promise<any> {
  const res = await fetch(`https://${normalizeJiraSite(config.site)}/rest/api/3${path}`, {
    method: 'GET',
    headers: { Authorization: authHeader(config), Accept: 'application/json' },
  });
  if (!res.ok) throw await jiraApiError(res);
  return res.json();
}

async function fetchAccountId(config: JiraConfig): Promise<string> {
  const me = await jiraGet(config, '/myself');
  return me.accountId;
}

async function fetchSprintFieldId(config: JiraConfig): Promise<string | null> {
  const site = normalizeJiraSite(config.site);
  if (sprintFieldBySite.has(site)) return sprintFieldBySite.get(site) ?? null;
  const fields: any[] = await jiraGet(config, '/field');
  const id = fields.find((f) => f.schema?.custom === SPRINT_FIELD_SCHEMA)?.id ?? null;
  sprintFieldBySite.set(site, id);
  return id;
}

async function searchIssues(
  config: JiraConfig,
  sprintField: string | null
): Promise<{ issues: any[]; truncated: boolean }> {
  const jql = config.jql?.trim() || DEFAULT_JIRA_JQL;
  const fields = ['summary', 'status', 'duedate', 'updated', ...(sprintField ? [sprintField] : [])].join(',');
  const issues: any[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ jql, fields, maxResults: String(PAGE_SIZE) });
    if (pageToken) params.set('nextPageToken', pageToken);
    const page = await jiraGet(config, `/search/jql?${params}`);
    issues.push(...(page.issues ?? []));
    pageToken = page.nextPageToken ?? undefined;
  } while (pageToken && issues.length < MAX_ISSUES);
  return { issues: issues.slice(0, MAX_ISSUES), truncated: issues.length > MAX_ISSUES || !!pageToken };
}

// Comment bodies are Atlassian Document Format: a tree of nodes, where a
// mention can sit at any depth (inside a list item, a table cell, a panel).
export function adfMentions(node: unknown, accountId: string): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as { type?: string; attrs?: { id?: string }; content?: unknown[] };
  if (n.type === 'mention' && n.attrs?.id === accountId) return true;
  return Array.isArray(n.content) && n.content.some((child) => adfMentions(child, accountId));
}

// A failed comment fetch must not fail the sync: the issue is still yours, it
// just syncs as assigned.
async function isMentioned(config: JiraConfig, key: string, accountId: string): Promise<boolean> {
  try {
    const data = await jiraGet(config, `/issue/${encodeURIComponent(key)}/comment?maxResults=100`);
    return (data.comments ?? []).some((c: any) => adfMentions(c.body, accountId));
  } catch {
    return false;
  }
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const CATEGORY: Record<string, StatusCategory> = { new: 'todo', indeterminate: 'in_progress', done: 'done' };

export function statusCategoryOf(key: string | undefined): StatusCategory | null {
  return (key && CATEGORY[key]) || null;
}

interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

// The sprint comes from the issues, not from a board: of the active sprints
// they sit in, the one holding most of them. A tie goes to the one ending
// first, since that is the deadline closest to hand.
export function selectActiveSprint(sprintLists: (JiraSprint[] | null | undefined)[]): JiraSprint | null {
  const counts = new Map<number, { sprint: JiraSprint; count: number }>();
  for (const list of sprintLists) {
    for (const sprint of list ?? []) {
      if (sprint.state !== 'active') continue;
      const entry = counts.get(sprint.id) ?? { sprint, count: 0 };
      entry.count += 1;
      counts.set(sprint.id, entry);
    }
  }
  let best: { sprint: JiraSprint; count: number } | null = null;
  for (const entry of counts.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && (entry.sprint.endDate ?? '￿') < (best.sprint.endDate ?? '￿'))
    ) {
      best = entry;
    }
  }
  return best?.sprint ?? null;
}

export async function fetchJiraData(config: JiraConfig): Promise<JiraSyncResult> {
  const site = normalizeJiraSite(config.site);
  const [accountId, sprintField] = await Promise.all([fetchAccountId(config), fetchSprintFieldId(config)]);
  const { issues, truncated } = await searchIssues(config, sprintField);

  const sprintOf = (issue: any): JiraSprint[] | null => (sprintField ? issue.fields?.[sprintField] ?? null : null);
  const active = selectActiveSprint(issues.map(sprintOf));
  const mentioned = await mapLimited(issues, COMMENT_CONCURRENCY, (issue) => isMentioned(config, issue.key, accountId));

  const items: NewSyncedItemInput[] = issues.map((issue, i) => {
    const inActive = active !== null && (sprintOf(issue) ?? []).some((s) => s.id === active.id);
    return {
      source: 'jira_issue' as const,
      externalId: issue.key,
      title: issue.fields?.summary ?? issue.key,
      url: `https://${site}/browse/${issue.key}`,
      reason: mentioned[i] ? ('mention' as const) : ('assigned' as const),
      dueDate: issue.fields?.duedate ?? null,
      sprintIteration: inActive ? active.name : null,
      rawUpdatedAt: issue.fields?.updated ?? null,
      upstreamStatus: issue.fields?.status?.name ?? null,
      statusCategory: statusCategoryOf(issue.fields?.status?.statusCategory?.key),
      repo: null,
    };
  });

  const sprint =
    active && active.startDate && active.endDate
      ? { name: active.name, startDate: active.startDate, endDate: active.endDate }
      : null;

  return { items, sprint, truncated };
}
