import type { NewSyncedItemInput, PrStatus } from './types';

const GITHUB_API = 'https://api.github.com';

export interface GithubConfig {
  pat: string;
  staleDays: number;
}

// GitHub returns 403 for both an exhausted rate limit and a token that's
// missing a required scope; only the rate-limit headers tell them apart, and
// classifyError() needs that distinction to avoid a "just refresh" remedy on
// a permissions problem refreshing can't fix.
async function githubApiError(res: Response, label: string): Promise<Error> {
  const body = await res.text();
  if (res.status === 429 || (res.status === 403 && res.headers?.get('x-ratelimit-remaining') === '0')) {
    return new Error(`GitHub rate limit exceeded (${label}): ${body}`);
  }
  if (res.status === 403) {
    return new Error(`GitHub API error 403 (token may be missing a required scope): ${body}`);
  }
  return new Error(`GitHub API error ${res.status}: ${body}`);
}

async function githubFetch(pat: string, path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw await githubApiError(res, path);
  }
  return res.json();
}

async function githubGraphql(pat: string, query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST', // READ-ONLY-QUERY: GraphQL requires POST for a query body; this never mutates
    headers: {
      Authorization: `token ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw await githubApiError(res, 'graphql');
  }
  return res.json();
}

interface GithubSearchItem {
  number: number;
  title: string;
  html_url: string;
  repository_url: string;
  updated_at: string;
}

function repoFromUrl(repositoryUrl: string): { owner: string; repo: string } {
  const parts = repositoryUrl.split('/');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

function externalId(pr: GithubSearchItem, owner: string, repo: string): string {
  return `${pr.number}@${owner}/${repo}`;
}

export function parseLinkedAdoIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(/AB#(\d+)/gi)) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

interface PrStatusResult {
  prStatus: PrStatus | null;
  linkedAdoIds: string[];
}

async function fetchPrStatus(
  config: GithubConfig,
  owner: string,
  repo: string,
  number: number,
  fallbackTitle: string,
  reviews?: any[]
): Promise<PrStatusResult> {
  let detail: any;
  try {
    detail = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${number}`);
  } catch {
    // Not every synced item is actually a PR (e.g. a plain issue mention), and
    // transient failures shouldn't take down the whole sync — just skip the
    // pill, but still try to pick up a linked work item from the title alone.
    return { prStatus: null, linkedAdoIds: parseLinkedAdoIds(fallbackTitle) };
  }
  const linkedAdoIds = parseLinkedAdoIds(`${detail.title ?? ''}\n${detail.body ?? ''}`);
  if (detail.draft) return { prStatus: 'draft', linkedAdoIds };

  let reviewList: any[];
  if (reviews) {
    reviewList = reviews;
  } else {
    try {
      reviewList = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${number}/reviews`);
    } catch {
      return { prStatus: null, linkedAdoIds };
    }
  }
  const latestByUser = new Map<string, string>();
  for (const r of reviewList) {
    if (r.state === 'COMMENTED') continue;
    latestByUser.set(r.user.login, r.state); // reviews are returned oldest-first
  }
  const states = Array.from(latestByUser.values());
  if (states.includes('CHANGES_REQUESTED')) return { prStatus: 'changes_requested', linkedAdoIds };
  if (states.includes('APPROVED')) return { prStatus: 'approved', linkedAdoIds };
  return { prStatus: 'ready_for_review', linkedAdoIds };
}

const REVIEW_THREADS_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes { isResolved }
        }
      }
    }
  }
`;

async function fetchHasUnresolvedConversations(
  config: GithubConfig,
  owner: string,
  repo: string,
  number: number
): Promise<boolean> {
  try {
    const result = await githubGraphql(config.pat, REVIEW_THREADS_QUERY, { owner, repo, number });
    if (result.errors) return false;
    const nodes = result.data?.repository?.pullRequest?.reviewThreads?.nodes;
    if (!nodes) return false;
    return nodes.some((node: any) => node.isResolved === false);
  } catch {
    // A hiccup here (or the item not actually being a PR) should never abort the whole sync.
    return false;
  }
}

async function fetchAuthoredPrItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(
    config.pat,
    `/search/issues?q=${encodeURIComponent(`type:pr author:${username} is:open`)}`
  );

  const results: NewSyncedItemInput[] = [];
  for (const pr of items as GithubSearchItem[]) {
    const { owner, repo } = repoFromUrl(pr.repository_url);
    const reviews = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${pr.number}/reviews`);
    const hasApproval = reviews.some((r: any) => r.state === 'APPROVED');
    const ageDays = (Date.now() - new Date(pr.updated_at).getTime()) / 86_400_000;

    let reason: NewSyncedItemInput['reason'] = 'authored';
    if (hasApproval) reason = 'approved_unmerged';
    else if (reviews.length === 0 && ageDays > config.staleDays) reason = 'stale_own_pr';

    const { prStatus, linkedAdoIds } = await fetchPrStatus(config, owner, repo, pr.number, pr.title, reviews);
    const hasUnresolvedConversations = await fetchHasUnresolvedConversations(config, owner, repo, pr.number);

    results.push({
      source: 'github_pr',
      externalId: externalId(pr, owner, repo),
      title: pr.title,
      url: pr.html_url,
      reason,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: pr.updated_at,
      adoStatus: null,
      prStatus,
      hasUnresolvedConversations,
      repo,
      linkedAdoExternalIds: linkedAdoIds,
    });
  }
  return results;
}

async function fetchReviewRequestedItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(
    config.pat,
    `/search/issues?q=${encodeURIComponent(`type:pr review-requested:${username} is:open`)}`
  );
  return Promise.all(
    (items as GithubSearchItem[]).map(async (pr) => {
      const { owner, repo } = repoFromUrl(pr.repository_url);
      const { prStatus, linkedAdoIds } = await fetchPrStatus(config, owner, repo, pr.number, pr.title);
      const hasUnresolvedConversations = await fetchHasUnresolvedConversations(config, owner, repo, pr.number);
      return {
        source: 'github_pr' as const,
        externalId: externalId(pr, owner, repo),
        title: pr.title,
        url: pr.html_url,
        reason: 'review_requested' as const,
        dueDate: null,
        sprintIteration: null,
        rawUpdatedAt: pr.updated_at,
        adoStatus: null,
        prStatus,
        hasUnresolvedConversations,
        repo,
        linkedAdoExternalIds: linkedAdoIds,
      };
    })
  );
}

async function fetchMentionItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(config.pat, `/search/issues?q=${encodeURIComponent(`mentions:${username} is:open`)}`);
  return Promise.all(
    (items as GithubSearchItem[]).map(async (issue) => {
      const { owner, repo } = repoFromUrl(issue.repository_url);
      const { prStatus, linkedAdoIds } = await fetchPrStatus(config, owner, repo, issue.number, issue.title);
      const hasUnresolvedConversations = await fetchHasUnresolvedConversations(config, owner, repo, issue.number);
      return {
        source: 'github_pr' as const,
        externalId: externalId(issue, owner, repo),
        title: issue.title,
        url: issue.html_url,
        reason: 'mention' as const,
        dueDate: null,
        sprintIteration: null,
        rawUpdatedAt: issue.updated_at,
        adoStatus: null,
        prStatus,
        hasUnresolvedConversations,
        repo,
        linkedAdoExternalIds: linkedAdoIds,
      };
    })
  );
}

interface MergedCheckCandidate {
  id: number;
  externalId: string;
}

/**
 * GitHub search only returns `is:open` PRs, so a PR that merged since the last
 * sync simply stops appearing there instead of coming back with a "merged"
 * status. This re-checks items that fell out of that search directly against
 * the GitHub API to find which of them actually merged.
 */
export async function fetchMergedExternalIds(
  config: GithubConfig,
  candidates: MergedCheckCandidate[]
): Promise<Set<string>> {
  const merged = new Set<string>();
  await Promise.all(
    candidates.map(async (candidate) => {
      const match = candidate.externalId.match(/^(\d+)@([^/]+)\/(.+)$/);
      if (!match) return;
      const [, number, owner, repo] = match;
      try {
        const detail = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${number}`);
        if (detail.merged) merged.add(candidate.externalId);
      } catch {
        // Deleted repo, transient error, etc. — leave this item's status as-is.
      }
    })
  );
  return merged;
}

export async function fetchGithubItems(config: GithubConfig): Promise<NewSyncedItemInput[]> {
  const user = await githubFetch(config.pat, '/user');
  const username = user.login;

  const [authored, reviewRequested, mentions] = await Promise.all([
    fetchAuthoredPrItems(config, username),
    fetchReviewRequestedItems(config, username),
    fetchMentionItems(config, username),
  ]);

  // Priority order: authored (with stale/approved classification) beats a
  // generic review request, which beats a generic mention on the same PR.
  const byExternalId = new Map<string, NewSyncedItemInput>();
  for (const item of [...authored, ...reviewRequested, ...mentions]) {
    if (!byExternalId.has(item.externalId)) byExternalId.set(item.externalId, item);
  }
  return Array.from(byExternalId.values());
}
