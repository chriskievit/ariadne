import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAdoData } from './ado-client';

function jsonResponse(body: any) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

describe('fetchAdoData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches the current iteration and assigned work items', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) {
        return jsonResponse({ value: [{ name: 'Sprint 42', attributes: { startDate: '2026-06-29', finishDate: '2026-07-12' } }] });
      }
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 101 }] });
      if (url.includes('/workitems?ids=101')) {
        return jsonResponse({
          value: [
            {
              id: 101,
              fields: {
                'System.Title': 'Fix login bug',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/101' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.iteration).toEqual({ name: 'Sprint 42', startDate: '2026-06-29', endDate: '2026-07-12' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ externalId: '101', reason: 'assigned', title: 'Fix login bug' });
  });

  it('marks a work item as mention when a comment mentions the user', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) return jsonResponse({ value: [] });
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 202 }] });
      if (url.includes('/workitems?ids=202')) {
        return jsonResponse({
          value: [
            {
              id: 202,
              fields: {
                'System.Title': 'Review design doc',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/202' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [{ mentions: [{ id: 'chris' }] }] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.items[0].reason).toBe('mention');
  });

  it('scopes the assigned work item query to the configured team so @CurrentIteration resolves correctly', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) {
        return jsonResponse({ value: [{ name: 'Sprint 6', attributes: { startDate: '2026-06-19', finishDate: '2026-07-02' } }] });
      }
      if (url.includes('/wiql')) {
        // Only the team-scoped WIQL endpoint should resolve @CurrentIteration to this team's sprint.
        if (url.includes('/Team Documents/_apis/wit/wiql')) {
          return jsonResponse({ workItems: [{ id: 101 }] });
        }
        return jsonResponse({ workItems: [] });
      }
      if (url.includes('/workitems?ids=101')) {
        return jsonResponse({
          value: [
            {
              id: 101,
              fields: {
                'System.Title': 'Fix login bug',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 6',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/101' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project', team: 'Team Documents' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ externalId: '101', reason: 'assigned' });
  });

  it('requests $expand so the work item response includes _links.html', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) return jsonResponse({ value: [] });
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 101 }] });
      if (url.includes('/workitems?ids=101')) {
        // Azure DevOps omits _links entirely unless $expand is requested.
        if (!url.includes('$expand=all')) {
          return jsonResponse({
            value: [{ id: 101, fields: { 'System.Title': 'Fix login bug', 'System.ChangedDate': '2026-07-01T00:00:00Z' } }],
          });
        }
        return jsonResponse({
          value: [
            {
              id: 101,
              fields: {
                'System.Title': 'Fix login bug',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/101' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.items[0]).toMatchObject({ externalId: '101', url: 'https://dev.azure.com/org/project/_workitems/edit/101' });
  });

  it('maps System.State to adoStatus', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('teamsettings/iterations')) return jsonResponse({ value: [] });
      if (url.includes('/wiql')) return jsonResponse({ workItems: [{ id: 101 }] });
      if (url.includes('/workitems?ids=101')) {
        return jsonResponse({
          value: [
            {
              id: 101,
              fields: {
                'System.Title': 'Fix login bug',
                'Microsoft.VSTS.Scheduling.DueDate': null,
                'System.IterationPath': 'Project\\Sprint 42',
                'System.ChangedDate': '2026-07-01T00:00:00Z',
                'System.State': 'Ready for Test',
              },
              _links: { html: { href: 'https://dev.azure.com/org/project/_workitems/edit/101' } },
            },
          ],
        });
      }
      if (url.includes('/comments')) return jsonResponse({ comments: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchAdoData({ pat: 'x', org: 'org', project: 'project' });
    expect(result.items[0].adoStatus).toBe('Ready for Test');
  });
});
