import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGithubItems } from './github-client';

function jsonResponse(body: any) {
  return { ok: true, json: async () => body, text: async () => '' } as Response;
}

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
      if (url.includes('/pulls/42/reviews')) return jsonResponse([{ state: 'APPROVED' }]);
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('approved_unmerged');
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
      if (url.includes('review-requested%3Achris')) return jsonResponse({ items: [] });
      if (url.includes('mentions%3Achris')) return jsonResponse({ items: [] });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result[0].reason).toBe('stale_own_pr');
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
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await fetchGithubItems({ pat: 'x', staleDays: 3 });
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('review_requested');
  });
});
