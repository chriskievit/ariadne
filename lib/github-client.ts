import type { NewSyncedItemInput } from './types';

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

    results.push({
      source: 'github_pr',
      externalId: externalId(pr, owner, repo),
      title: pr.title,
      url: pr.html_url,
      reason,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: pr.updated_at,
    });
  }
  return results;
}

async function fetchReviewRequestedItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(
    config.pat,
    `/search/issues?q=${encodeURIComponent(`type:pr review-requested:${username} is:open`)}`
  );
  return (items as GithubSearchItem[]).map((pr) => {
    const { owner, repo } = repoFromUrl(pr.repository_url);
    return {
      source: 'github_pr',
      externalId: externalId(pr, owner, repo),
      title: pr.title,
      url: pr.html_url,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: pr.updated_at,
    };
  });
}

async function fetchMentionItems(config: GithubConfig, username: string): Promise<NewSyncedItemInput[]> {
  const { items } = await githubFetch(config.pat, `/search/issues?q=${encodeURIComponent(`mentions:${username} is:open`)}`);
  return (items as GithubSearchItem[]).map((issue) => {
    const { owner, repo } = repoFromUrl(issue.repository_url);
    return {
      source: 'github_pr',
      externalId: externalId(issue, owner, repo),
      title: issue.title,
      url: issue.html_url,
      reason: 'mention',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: issue.updated_at,
    };
  });
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
