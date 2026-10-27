import { fetchAdoData } from './ado-client';
import { SETTINGS_KEYS } from '../config';
import { SOURCE_CONFIGURED } from './configured';
import type { SourceAdapter } from './types';

export const adoAdapter: SourceAdapter = {
  key: 'ado',
  itemSource: 'ado_workitem',
  isConfigured: SOURCE_CONFIGURED.ado,
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
