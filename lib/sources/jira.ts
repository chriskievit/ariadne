import { fetchJiraData, MAX_ISSUES } from './jira-client';
import { SETTINGS_KEYS } from '../config';
import { SOURCE_CONFIGURED } from './configured';
import type { SourceAdapter } from './types';

export const jiraAdapter: SourceAdapter = {
  key: 'jira',
  itemSource: 'jira_issue',
  isConfigured: SOURCE_CONFIGURED.jira,
  async sync(get) {
    const { items, sprint, truncated } = await fetchJiraData({
      site: get(SETTINGS_KEYS.jiraSite) ?? '',
      email: get(SETTINGS_KEYS.jiraEmail) ?? '',
      token: get(SETTINGS_KEYS.jiraToken) ?? '',
      jql: get(SETTINGS_KEYS.jiraJql) ?? undefined,
    });
    // Not an error: sync_log.error would turn the source red for a sync that
    // worked. A query this wide is almost always a custom JQL to narrow down.
    if (truncated) console.warn(`Jira sync stopped at ${MAX_ISSUES} issues; narrow the JQL in Settings to see the rest.`);
    return { items, sprint };
  },
};
