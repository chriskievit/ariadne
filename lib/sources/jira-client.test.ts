import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchJiraData,
  adfMentions,
  selectActiveSprint,
  statusCategoryOf,
  resetJiraCachesForTest,
  MAX_ISSUES,
} from './jira-client';
import { classifyError } from '../sync-status';

const ME = 'acc-me';
const SPRINT_FIELD = 'customfield_10777';
const config = { site: 'https://acme.atlassian.net/', email: 'me@acme.test', token: 'tok' };

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
function fail(status: number, body = 'nope') {
  return { ok: false, status, json: async () => ({}), text: async () => body } as Response;
}

const sprint = (id: number, name: string, state = 'active', endDate = '2026-11-07T16:00:00.000Z') => ({
  id,
  name,
  state,
  startDate: '2026-10-24T08:00:00.000Z',
  endDate,
});

function issue(key: string, extra: Record<string, unknown> = {}) {
  return {
    key,
    fields: {
      summary: `Summary of ${key}`,
      status: { name: 'In Progress', statusCategory: { key: 'indeterminate' } },
      duedate: null,
      updated: '2026-10-27T09:00:00.000+0000',
      [SPRINT_FIELD]: [sprint(7, 'PLAT Sprint 7')],
      ...extra,
    },
  };
}

const mentionOf = (id: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hey ' }, { type: 'mention', attrs: { id } }] }],
});

type Routes = {
  search?: (params: URLSearchParams) => Response;
  comments?: (key: string) => Response;
  fields?: () => Response;
  myself?: () => Response;
};

function route(routes: Routes) {
  const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
  fetchMock.mockImplementation(async (url: string) => {
    const u = new URL(url);
    expect(u.host).toBe('acme.atlassian.net');
    const path = u.pathname.replace('/rest/api/3', '');
    if (path === '/myself') return routes.myself?.() ?? json({ accountId: ME });
    if (path === '/field') {
      return (
        routes.fields?.() ??
        json([
          { id: 'summary', schema: { type: 'string' } },
          { id: SPRINT_FIELD, schema: { type: 'array', custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
        ])
      );
    }
    if (path === '/search/jql') return routes.search?.(u.searchParams) ?? json({ issues: [] });
    const comment = path.match(/^\/issue\/([^/]+)\/comment$/);
    if (comment) return routes.comments?.(decodeURIComponent(comment[1])) ?? json({ comments: [] });
    throw new Error(`Unexpected URL: ${url}`);
  });
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  resetJiraCachesForTest();
});

describe('fetchJiraData', () => {
  it('maps an issue to a jira_issue item', async () => {
    route({ search: () => json({ issues: [issue('PLAT-1', { duedate: '2026-11-01' })] }) });
    const { items } = await fetchJiraData(config);
    expect(items).toEqual([
      {
        source: 'jira_issue',
        externalId: 'PLAT-1',
        title: 'Summary of PLAT-1',
        url: 'https://acme.atlassian.net/browse/PLAT-1',
        reason: 'assigned',
        dueDate: '2026-11-01',
        sprintIteration: 'PLAT Sprint 7',
        rawUpdatedAt: '2026-10-27T09:00:00.000+0000',
        upstreamStatus: 'In Progress',
        statusCategory: 'in_progress',
        repo: null,
      },
    ]);
  });

  it('sends only GET requests, with Basic email:token auth', async () => {
    const fetchMock = route({ search: () => json({ issues: [issue('PLAT-1')] }) });
    await fetchJiraData(config);
    expect(fetchMock).toHaveBeenCalled();
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(init.headers.Authorization).toBe('Basic ' + Buffer.from('me@acme.test:tok').toString('base64'));
    }
  });

  it('uses the default JQL, or the custom one when set, and asks for the Sprint field', async () => {
    const seen: URLSearchParams[] = [];
    route({ search: (p) => (seen.push(p), json({ issues: [] })) });
    await fetchJiraData(config);
    await fetchJiraData({ ...config, jql: '  project = PLAT  ' });
    expect(seen[0].get('jql')).toBe('assignee = currentUser() AND sprint in openSprints()');
    expect(seen[1].get('jql')).toBe('project = PLAT');
    expect(seen[0].get('fields')).toBe(`summary,status,duedate,updated,${SPRINT_FIELD}`);
  });

  it('follows nextPageToken until it is gone', async () => {
    const tokens: (string | null)[] = [];
    route({
      search: (p) => {
        tokens.push(p.get('nextPageToken'));
        if (!p.get('nextPageToken')) return json({ issues: [issue('PLAT-1')], nextPageToken: 'a' });
        if (p.get('nextPageToken') === 'a') return json({ issues: [issue('PLAT-2')], nextPageToken: 'b' });
        return json({ issues: [issue('PLAT-3')], isLast: true });
      },
    });
    const { items, truncated } = await fetchJiraData(config);
    expect(tokens).toEqual([null, 'a', 'b']);
    expect(items.map((i) => i.externalId)).toEqual(['PLAT-1', 'PLAT-2', 'PLAT-3']);
    expect(truncated).toBe(false);
  });

  it(`stops at ${MAX_ISSUES} issues and says so`, async () => {
    let page = 0;
    route({
      search: () => {
        page += 1;
        const issues = Array.from({ length: 100 }, (_, i) => issue(`PLAT-${page * 100 + i}`));
        return json({ issues, nextPageToken: `p${page}` });
      },
    });
    const { items, truncated } = await fetchJiraData(config);
    expect(page).toBe(5);
    expect(items).toHaveLength(MAX_ISSUES);
    expect(truncated).toBe(true);
  });

  it('looks the Sprint field up once per site', async () => {
    const fieldCalls = vi.fn(() =>
      json([{ id: SPRINT_FIELD, schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } }])
    );
    route({ fields: fieldCalls, search: () => json({ issues: [issue('PLAT-1')] }) });
    await fetchJiraData(config);
    await fetchJiraData(config);
    expect(fieldCalls).toHaveBeenCalledTimes(1);
  });

  it('syncs without a sprint when the site has no Sprint field', async () => {
    const seen: URLSearchParams[] = [];
    route({
      fields: () => json([{ id: 'summary', schema: { type: 'string' } }]),
      search: (p) => (seen.push(p), json({ issues: [issue('PLAT-1')] })),
    });
    const { items, sprint: active } = await fetchJiraData(config);
    expect(seen[0].get('fields')).toBe('summary,status,duedate,updated');
    expect(items[0].sprintIteration).toBeNull();
    expect(active).toBeNull();
  });

  it('returns the active sprint, and tags only the issues in it', async () => {
    route({
      search: () =>
        json({
          issues: [
            issue('PLAT-1'),
            issue('PLAT-2'),
            issue('OPS-1', { [SPRINT_FIELD]: [sprint(9, 'OPS Sprint 3')] }),
            issue('PLAT-3', { [SPRINT_FIELD]: null }),
          ],
        }),
    });
    const { items, sprint: active } = await fetchJiraData(config);
    expect(active).toEqual({
      name: 'PLAT Sprint 7',
      startDate: '2026-10-24T08:00:00.000Z',
      endDate: '2026-11-07T16:00:00.000Z',
    });
    expect(items.map((i) => i.sprintIteration)).toEqual(['PLAT Sprint 7', 'PLAT Sprint 7', null, null]);
  });

  it('marks an issue as a mention when a comment mentions me', async () => {
    route({
      search: () => json({ issues: [issue('PLAT-1'), issue('PLAT-2'), issue('PLAT-3')] }),
      comments: (key) => {
        if (key === 'PLAT-1') return json({ comments: [{ body: mentionOf(ME) }] });
        if (key === 'PLAT-2') return json({ comments: [{ body: mentionOf('acc-someone-else') }] });
        return json({ comments: [] });
      },
    });
    const { items } = await fetchJiraData(config);
    expect(items.map((i) => i.reason)).toEqual(['mention', 'assigned', 'assigned']);
  });

  it('keeps an issue as assigned when its comment fetch fails', async () => {
    route({
      search: () => json({ issues: [issue('PLAT-1'), issue('PLAT-2')] }),
      comments: (key) => (key === 'PLAT-1' ? fail(500) : json({ comments: [{ body: mentionOf(ME) }] })),
    });
    const { items } = await fetchJiraData(config);
    expect(items.map((i) => i.reason)).toEqual(['assigned', 'mention']);
  });

  it.each([
    [401, 'auth'],
    [403, 'scope'],
    [429, 'rate_limit'],
  ] as const)('reports a %i so the sync status can name the fix', async (status, cause) => {
    route({ myself: () => fail(status) });
    const error = await fetchJiraData(config).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect(classifyError((error as Error).message, 'Jira').cause).toBe(cause);
  });
});

describe('adfMentions', () => {
  it('finds a mention at any depth', () => {
    const nested = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: ME } }] }] }],
        },
      ],
    };
    expect(adfMentions(nested, ME)).toBe(true);
  });

  it('ignores mentions of someone else, and bodies with none', () => {
    expect(adfMentions(mentionOf('other'), ME)).toBe(false);
    expect(adfMentions({ type: 'doc', content: [{ type: 'paragraph', content: [] }] }, ME)).toBe(false);
    expect(adfMentions(null, ME)).toBe(false);
  });
});

describe('statusCategoryOf', () => {
  it('maps the three Jira categories and nothing else', () => {
    expect(statusCategoryOf('new')).toBe('todo');
    expect(statusCategoryOf('indeterminate')).toBe('in_progress');
    expect(statusCategoryOf('done')).toBe('done');
    expect(statusCategoryOf('undefined')).toBeNull();
    expect(statusCategoryOf(undefined)).toBeNull();
  });
});

describe('selectActiveSprint', () => {
  it('picks the active sprint holding the most issues', () => {
    const a = sprint(1, 'A');
    const b = sprint(2, 'B');
    expect(selectActiveSprint([[a], [b], [b], [sprint(3, 'Closed', 'closed')]])?.name).toBe('B');
  });

  it('breaks a tie on the earliest end', () => {
    const late = sprint(1, 'Late', 'active', '2026-11-20T00:00:00.000Z');
    const early = sprint(2, 'Early', 'active', '2026-11-06T00:00:00.000Z');
    expect(selectActiveSprint([[late], [early]])?.name).toBe('Early');
  });

  it('returns null without an active sprint', () => {
    expect(selectActiveSprint([[sprint(1, 'Future', 'future')], null, undefined])).toBeNull();
  });
});
