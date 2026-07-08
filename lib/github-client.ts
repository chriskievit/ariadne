import type { NewSyncedItemInput, PrStatus } from './types';

const GITHUB_API = 'https://api.github.com';

export interface GithubConfig {
  pat: string;
  staleDays: number;
}

async function githubFetch(pat: string, path: string): Promise<any> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function githubGraphql(pat: string, query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `token ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL error ${res.status}: ${await res.text()}`);
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

async function fetchPrStatus(
  config: GithubConfig,
  owner: string,
  repo: string,
  number: number,
  reviews?: any[]
): Promise<PrStatus | null> {
  let detail: any;
  try {
    detail = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${number}`);
  } catch {
    // Not every synced item is actually a PR (e.g. a plain issue mention), and
    // transient failures shouldn't take down the whole sync — just skip the pill.
    return null;
  }
  if (detail.draft) return 'draft';

  let reviewList: any[];
  if (reviews) {
    reviewList = reviews;
  } else {
    try {
      reviewList = await githubFetch(config.pat, `/repos/${owner}/${repo}/pulls/${number}/reviews`);
    } catch {
      return null;
    }
  }
  const latestByUser = new Map<string, string>();
  for (const r of reviewList) {
    if (r.state === 'COMMENTED') continue;
    latestByUser.set(r.user.login, r.state); // reviews are returned oldest-first
  }
  const states = Array.from(latestByUser.values());
  if (states.includes('CHANGES_REQUESTED')) return 'changes_requested';
  if (states.includes('APPROVED')) return 'approved';
  return 'ready_for_review';
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

    const prStatus = await fetchPrStatus(config, owner, repo, pr.number, reviews);
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
      const prStatus = await fetchPrStatus(config, owner, repo, pr.number);
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
      };
    })
  );
}

async function fetchMentionItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(config.pat, `/search/issues?q=${encodeURIComponent(`mentions:${username} is:open`)}`);
  return Promise.all(
    (items as GithubSearchItem[]).map(async (issue) => {
      const { owner, repo } = repoFromUrl(issue.repository_url);
      const prStatus = await fetchPrStatus(config, owner, repo, issue.number);
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
      };
    })
  );
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
