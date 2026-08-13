import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGithubItems, parseLinkedAdoIds, fetchMergedExternalIds } from './github-client';

function jsonResponse(body: any) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

/** Builds a GraphQL reviewThreads response for a given resolution state. */
function reviewThreadsResponse(isResolved: boolean[]) {
  return jsonResponse({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: { nodes: isResolved.map((resolved) => ({ isResolved: resolved })) },
        },
      },
    },
  });
}

const NO_THREADS_RESPONSE = reviewThreadsResponse([]);

describe('fetchGithubItems', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('classifies an authored PR with an approval as approved_unmerged', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 42,
              title: 'Add feature',
              html_url: 'https://github.com/acme/widgets/pull/42',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/pulls/42/reviews')) return jsonResponse([{ user: { login: 'reviewer1' }, state: 'APPROVED' }]);
      if (url.endsWith('/pulls/42')) return jsonResponse({ draft: false });
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('approved_unmerged');
    expect(result[0].prStatus).toBe('approved');
    expect(result[0].repo).toBe('widgets');
  });

  it('classifies an authored PR with no reviews past the stale threshold as stale_own_pr', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const staleDate = new Date(Date.now() - 10 * 86_400_000).toISOString();
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 7,
              title: 'Stale PR',
              html_url: 'https://github.com/acme/widgets/pull/7',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: staleDate,
            },
          ],
        });
      }
      if (url.includes('/pulls/7/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/7')) return jsonResponse({ draft: false });
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].reason).toBe('stale_own_pr');
    expect(result[0].prStatus).toBe('ready_for_review');
  });

  it('deduplicates a PR appearing in both review-requested and mentions, keeping review_requested', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const prPayload = {
      number: 9,
      title: 'Please review',
      html_url: 'https://github.com/acme/widgets/pull/9',
      repository_url: 'https://api.github.com/repos/acme/widgets',
      updated_at: '2026-07-01T00:00:00Z',
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [prPayload] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [prPayload] });
      if (url.includes('/pulls/9/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/9')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('review_requested');
  });

  it('marks a draft PR as draft regardless of review state', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 11,
              title: 'WIP',
              html_url: 'https://github.com/acme/widgets/pull/11',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/11/reviews')) return jsonResponse([{ user: { login: 'reviewer1' }, state: 'APPROVED' }]);
      if (url.endsWith('/pulls/11')) return jsonResponse({ draft: true });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].prStatus).toBe('draft');
    expect(result[0].repo).toBe('widgets');
  });

  it('treats a change request from one reviewer as changes_requested even if another reviewer approved', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 12,
              title: 'Needs changes',
              html_url: 'https://github.com/acme/widgets/pull/12',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/12/reviews')) {
        return jsonResponse([
          { user: { login: 'alice' }, state: 'APPROVED' },
          { user: { login: 'bob' }, state: 'CHANGES_REQUESTED' },
        ]);
      }
      if (url.endsWith('/pulls/12')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].prStatus).toBe('changes_requested');
  });

  it("uses a reviewer's later approval over their own earlier changes_requested", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 13,
              title: 'Now fixed',
              html_url: 'https://github.com/acme/widgets/pull/13',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/13/reviews')) {
        // Reviews are returned oldest-first; alice's later APPROVED supersedes her own earlier CHANGES_REQUESTED.
        return jsonResponse([
          { user: { login: 'alice' }, state: 'CHANGES_REQUESTED' },
          { user: { login: 'alice' }, state: 'APPROVED' },
        ]);
      }
      if (url.endsWith('/pulls/13')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].prStatus).toBe('approved');
  });

  it('does not let a plain issue mention (404 on /pulls) or a transient failure abort the whole sync', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 21,
              title: 'A real PR review request',
              html_url: 'https://github.com/acme/widgets/pull/21',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 99,
              title: 'A plain issue mentioning me',
              html_url: 'https://github.com/acme/widgets/issues/99',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/pulls/21/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/21')) return jsonResponse({ draft: false });
      if (url.endsWith('/pulls/99')) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' } as Response;
      }
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(2);

    const issueMention = result.find((r) => r.externalId === '99@acme/widgets');
    expect(issueMention).toBeDefined();
    expect(issueMention?.prStatus).toBeNull();
    expect(issueMention?.repo).toBe('widgets');

    const reviewRequested = result.find((r) => r.externalId === '21@acme/widgets');
    expect(reviewRequested).toBeDefined();
    expect(reviewRequested?.reason).toBe('review_requested');
    expect(reviewRequested?.prStatus).toBe('ready_for_review');
    expect(reviewRequested?.repo).toBe('widgets');
  });

  it('flags a PR with an unresolved review thread as having unresolved conversations', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 30,
              title: 'Has unresolved feedback',
              html_url: 'https://github.com/acme/widgets/pull/30',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/30/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/30')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return reviewThreadsResponse([true, false]);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].hasUnresolvedConversations).toBe(true);
  });

  it('does not flag a PR whose review threads are all resolved', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 31,
              title: 'All feedback addressed',
              html_url: 'https://github.com/acme/widgets/pull/31',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/31/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/31')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return reviewThreadsResponse([true, true]);
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].hasUnresolvedConversations).toBe(false);
  });

  it('does not flag a PR with no review threads at all', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 32,
              title: 'No conversations yet',
              html_url: 'https://github.com/acme/widgets/pull/32',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/32/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/32')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].hasUnresolvedConversations).toBe(false);
  });

  it('does not let a failed GraphQL call abort the sync, and defaults hasUnresolvedConversations to false', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 33,
              title: 'GraphQL is down',
              html_url: 'https://github.com/acme/widgets/pull/33',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('/pulls/33/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/33')) return jsonResponse({ draft: false });
      if (url.endsWith('/graphql')) {
        return { ok: false, status: 500, json: async () => ({}), text: async () => 'Internal Server Error' } as Response;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].prStatus).toBe('ready_for_review');
    expect(result[0].hasUnresolvedConversations).toBe(false);
  });
});

describe('parseLinkedAdoIds', () => {
  it('extracts an AB# reference case-insensitively', () => {
    expect(parseLinkedAdoIds('Fixes AB#41363')).toEqual(['41363']);
    expect(parseLinkedAdoIds('fixes ab#41363')).toEqual(['41363']);
  });

  it('dedupes a repeated reference', () => {
    expect(parseLinkedAdoIds('AB#1 mentioned twice: AB#1')).toEqual(['1']);
  });

  it('returns multiple distinct references in order of first appearance', () => {
    expect(parseLinkedAdoIds('Fixes AB#1, also related to AB#2')).toEqual(['1', '2']);
  });

  it('returns an empty array when there is no reference', () => {
    expect(parseLinkedAdoIds('Just a normal PR description')).toEqual([]);
  });
});

describe('fetchGithubItems linked ADO ids', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('extracts a linked ADO work item id from the PR body', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 50,
              title: 'feat(#41363): prevent deletion',
              html_url: 'https://github.com/acme/widgets/pull/50',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/pulls/50/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/50')) {
        return jsonResponse({ draft: false, title: 'feat(#41363): prevent deletion', body: 'Fixes AB#41363' });
      }
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].linkedAdoExternalIds).toEqual(['41363']);
  });

  it('falls back to parsing the PR title when the detail fetch fails', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('review-requested%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 60,
              title: 'AB#77 quick fix',
              html_url: 'https://github.com/acme/widgets/pull/60',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.endsWith('/pulls/60')) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => 'Not Found' } as Response;
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].linkedAdoExternalIds).toEqual(['77']);
  });

  it('returns an empty array when the PR references no work item', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/user')) return jsonResponse({ login: 'chris' });
      if (url.includes('author%3Achris')) {
        return jsonResponse({
          items: [
            {
              number: 70,
              title: 'Unrelated PR',
              html_url: 'https://github.com/acme/widgets/pull/70',
              repository_url: 'https://api.github.com/repos/acme/widgets',
              updated_at: '2026-07-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.includes('/pulls/70/reviews')) return jsonResponse([]);
      if (url.endsWith('/pulls/70')) return jsonResponse({ draft: false, title: 'Unrelated PR', body: 'No work item here.' });
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      if (url.endsWith('/graphql')) return NO_THREADS_RESPONSE;
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].linkedAdoExternalIds).toEqual([]);
  });
});

describe('fetchMergedExternalIds', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('includes candidates whose PR is now merged', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/repos/acme/widgets/pulls/42')) return jsonResponse({ merged: true });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchMergedExternalIds({ pat: 'x', staleDays: 3 }, [{ id: 1, externalId: '42@acme/widgets' }]);
    expect(result.has('42@acme/widgets')).toBe(true);
  });

  it('excludes candidates whose PR is still open (e.g. fell off a search page)', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/repos/acme/widgets/pulls/42')) return jsonResponse({ merged: false });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchMergedExternalIds({ pat: 'x', staleDays: 3 }, [{ id: 1, externalId: '42@acme/widgets' }]);
    expect(result.has('42@acme/widgets')).toBe(false);
  });

  it('excludes candidates whose lookup fails (deleted repo, network error, etc.)', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation(async () => ({ ok: false, status: 404, text: async () => 'Not Found' }) as Response);

    const result = await fetchMergedExternalIds({ pat: 'x', staleDays: 3 }, [{ id: 1, externalId: '42@acme/widgets' }]);
    expect(result.size).toBe(0);
  });
});
