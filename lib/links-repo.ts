import type Database from 'better-sqlite3';
import type { Item, Status } from './types';
import { getSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';

export interface LinkedRef {
  source: 'ado_workitem' | 'github_pr';
  shortLabel: string;
  title: string;
  url: string;
  status: Status | null;
  itemId: number | null;
}

interface LinkRow {
  pr_item_id: number;
  ado_external_id: string;
}

function prShortLabel(externalId: string | null): string {
  const match = externalId?.match(/^(\d+)@/);
  return match ? `#${match[1]}` : '#?';
}

export function getLinksForItems(db: Database.Database, items: Item[]): Map<number, LinkedRef[]> {
  const result = new Map<number, LinkedRef[]>();

  const prIds = items.filter((item) => item.source === 'github_pr').map((item) => item.id);
  if (prIds.length === 0) return result;

  const placeholders = prIds.map(() => '?').join(',');
  const linkRows = db
    .prepare(`SELECT pr_item_id, ado_external_id FROM item_links WHERE pr_item_id IN (${placeholders})`)
    .all(...prIds) as LinkRow[];
  if (linkRows.length === 0) return result;

  const itemsById = new Map(items.map((item) => [item.id, item]));
  const adoItemsByExternalId = new Map(
    items.filter((item) => item.source === 'ado_workitem' && item.externalId !== null).map((item) => [item.externalId as string, item])
  );

  const org = getSetting(db, SETTINGS_KEYS.adoOrg);
  const project = getSetting(db, SETTINGS_KEYS.adoProject);

  function addLink(itemId: number, ref: LinkedRef): void {
    if (!result.has(itemId)) result.set(itemId, []);
    result.get(itemId)!.push(ref);
  }

  for (const row of linkRows) {
    const prItem = itemsById.get(row.pr_item_id);
    if (!prItem) continue;

    const adoItem = adoItemsByExternalId.get(row.ado_external_id);

    addLink(row.pr_item_id, {
      source: 'ado_workitem',
      shortLabel: `WI-${row.ado_external_id}`,
      title: adoItem ? adoItem.title : `WI-${row.ado_external_id}`,
      url:
        adoItem?.url ??
        (org && project
          ? `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_workitems/edit/${row.ado_external_id}`
          : ''),
      status: adoItem?.status ?? null,
      itemId: adoItem?.id ?? null,
    });

    if (adoItem) {
      addLink(adoItem.id, {
        source: 'github_pr',
        shortLabel: prShortLabel(prItem.externalId),
        title: prItem.title,
        url: prItem.url ?? '',
        status: prItem.status,
        itemId: prItem.id,
      });
    }
  }

  return result;
}
