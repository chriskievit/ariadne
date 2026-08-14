import type { NewSyncedItemInput } from './types';

export interface AdoConfig {
  pat: string;
  org: string;
  project: string;
  team?: string;
}

export interface AdoSyncResult {
  items: NewSyncedItemInput[];
  iteration: { name: string; startDate: string; endDate: string } | null;
}

function authHeader(pat: string): string {
  return 'Basic ' + Buffer.from(':' + pat).toString('base64');
}

async function adoFetch(config: AdoConfig, url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: authHeader(config.pat),
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Azure DevOps API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchCurrentIteration(config: AdoConfig): Promise<AdoSyncResult['iteration']> {
  const team = config.team ?? config.project;
  const data = await adoFetch(
    config,
    `https://dev.azure.com/${config.org}/${config.project}/${team}/_apis/work/teamsettings/iterations?$timeframe=current&api-version=7.1`
  );
  const iteration = data.value?.[0];
  if (!iteration) return null;
  return { name: iteration.name, startDate: iteration.attributes.startDate, endDate: iteration.attributes.finishDate };
}

async function fetchAssignedWorkItemIds(config: AdoConfig): Promise<number[]> {
  // @CurrentIteration resolves relative to the team in the URL; omitting it
  // resolves against the project's default team, which can be a different sprint.
  const team = config.team ?? config.project;
  const wiql = {
    query:
      "SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.IterationPath] = @CurrentIteration AND [System.State] <> 'Closed'",
  };
  const result = await adoFetch(
    config,
    `https://dev.azure.com/${config.org}/${config.project}/${team}/_apis/wit/wiql?api-version=7.1`,
    { method: 'POST', body: JSON.stringify(wiql) } // READ-ONLY-QUERY: Azure DevOps requires POST to submit a WIQL query body; this never mutates
  );
  return (result.workItems ?? []).map((wi: any) => wi.id);
}

async function fetchWorkItemDetails(config: AdoConfig, ids: number[]): Promise<NewSyncedItemInput[]> {
  if (ids.length === 0) return [];
  const data = await adoFetch(
    config,
    `https://dev.azure.com/${config.org}/_apis/wit/workitems?ids=${ids.join(',')}&$expand=all&api-version=7.1`
  );
  return data.value.map((wi: any) => ({
    source: 'ado_workitem' as const,
    externalId: String(wi.id),
    title: wi.fields['System.Title'],
    url: wi._links.html.href,
    reason: 'assigned' as const,
    dueDate: wi.fields['Microsoft.VSTS.Scheduling.DueDate'] ?? null,
    sprintIteration: wi.fields['System.IterationPath'] ?? null,
    rawUpdatedAt: wi.fields['System.ChangedDate'],
    adoStatus: wi.fields['System.State'] ?? null,
    repo: null,
  }));
}

// v1 scopes mention detection to your assigned set to keep the WIQL surface
// small; mentions on work items not assigned to you are out of scope.
async function fetchMentionWorkItems(config: AdoConfig, ids: number[]): Promise<NewSyncedItemInput[]> {
  const mentioned: NewSyncedItemInput[] = [];
  for (const id of ids) {
    const comments = await adoFetch(
      config,
      `https://dev.azure.com/${config.org}/${config.project}/_apis/wit/workItems/${id}/comments?api-version=7.1-preview.3`
    );
    const hasMention = (comments.comments ?? []).some((c: any) => c.mentions?.length > 0);
    if (hasMention) {
      const [details] = await fetchWorkItemDetails(config, [id]);
      if (details) mentioned.push({ ...details, reason: 'mention' });
    }
  }
  return mentioned;
}

export async function fetchAdoData(config: AdoConfig): Promise<AdoSyncResult> {
  const [iteration, assignedIds] = await Promise.all([fetchCurrentIteration(config), fetchAssignedWorkItemIds(config)]);
  const [assignedItems, mentionItems] = await Promise.all([
    fetchWorkItemDetails(config, assignedIds),
    fetchMentionWorkItems(config, assignedIds),
  ]);

  const byExternalId = new Map<string, NewSyncedItemInput>();
  for (const item of [...mentionItems, ...assignedItems]) {
    if (!byExternalId.has(item.externalId)) byExternalId.set(item.externalId, item);
  }

  return { items: Array.from(byExternalId.values()), iteration };
}
