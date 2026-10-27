import { fetchAdoData } from './ado-client';
import { SETTINGS_KEYS } from '../config';
import type { SourceAdapter } from './types';

export const adoAdapter: SourceAdapter = {
  key: 'ado',
  itemSource: 'ado_workitem',
  notConfiguredError: 'Azure DevOps settings not configured',
  isConfigured: (get) => !!(get(SETTINGS_KEYS.adoPat) && get(SETTINGS_KEYS.adoOrg) && get(SETTINGS_KEYS.adoProject)),
  async sync(get) {
    const { items, iteration } = await fetchAdoData({
      pat: get(SETTINGS_KEYS.adoPat) ?? '',
      org: get(SETTINGS_KEYS.adoOrg) ?? '',
      project: get(SETTINGS_KEYS.adoProject) ?? '',
      team: get(SETTINGS_KEYS.adoTeam) || undefined,
    });
    return { items, sprint: iteration };
  },
};
