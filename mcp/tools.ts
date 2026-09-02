/**
 * Every tool the MCP server exposes, as data.
 *
 * Two rules hold this list to Ariadne's philosophy that the app never takes
 * action the user didn't trigger:
 *
 * 1. Narrow verbs only. One tool maps to exactly one route. No `triage_my_day`,
 *    no `auto_complete_stale`, nothing that infers intent from state.
 * 2. No silent guesses. `complete_item` demands an explicit durationHours, so a
 *    duration has to be asked for rather than invented.
 *
 * Deliberately absent: `POST /api/settings`, which writes arbitrary key/value
 * pairs including the GitHub and Azure DevOps PATs, and
 * `POST /api/items/:id/open-claude`, which spawns Claude in a terminal.
 */

import { z } from 'zod';
import type { AriadneClient } from './client';

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  annotations: ToolAnnotations;
  run: (client: AriadneClient, args: Record<string, unknown>) => Promise<unknown>;
}

const itemId = z.number().int().describe("The Ariadne item id, as returned by list_items");
const priorityValue = z.enum(['low', 'medium', 'high']);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date')
  .describe('A local date as YYYY-MM-DD');

const READ_ONLY: ToolAnnotations = { readOnlyHint: true };
const WRITES: ToolAnnotations = { readOnlyHint: false };

/** Builds `?a=1&b=2`, or '' when nothing is set. Skips undefined values. */
function query(params: Record<string, string | number | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length === 0 ? '' : `?${pairs.join('&')}`;
}

/** Drops undefined keys so an optional argument doesn't become an explicit null. */
function body(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

// Typed loosely on purpose: each run() re-narrows its own args, and the
// registry is heterogeneous by nature.
function define<Shape extends z.ZodRawShape>(tool: {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  annotations: ToolAnnotations;
  run: (client: AriadneClient, args: z.infer<z.ZodObject<Shape>>) => Promise<unknown>;
}): ToolDefinition {
  return tool as unknown as ToolDefinition;
}

export const TOOLS: readonly ToolDefinition[] = [
  // ---------------------------------------------------------------- reads
  define({
    name: 'list_items',
    title: 'List all items',
    description:
      "Every item Ariadne knows about, grouped into today, signals, in-progress and parked, each scored by urgency. This is the starting point for finding an item's id.",
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/items'),
  }),
  define({
    name: 'get_today',
    title: "Get today's summary",
    description:
      "What is planned, in progress and already done for a given day, with hours logged and estimates. Defaults to today when no date is given.",
    inputSchema: { date: isoDate.optional() },
    annotations: READ_ONLY,
    run: (client, { date }) => client.get(`/api/today/summary${query({ date })}`),
  }),
  define({
    name: 'get_plan',
    title: 'Get the plan for a day',
    description: "A day's capacity, note and hand-ordered plan items.",
    inputSchema: { date: isoDate },
    annotations: READ_ONLY,
    run: (client, { date }) => client.get(`/api/plan${query({ date })}`),
  }),
  define({
    name: 'get_running_timer',
    title: 'Get the running timer',
    description: 'The item whose timer is currently running, if any, and how long it has been going.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/timer/running'),
  }),
  define({
    name: 'get_sprint',
    title: 'Get sprint progress',
    description: 'Progress through the configured Azure DevOps sprint iteration.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/sprint'),
  }),
  define({
    name: 'get_sync_status',
    title: 'Get sync status',
    description: 'When Ariadne last synced with GitHub and Azure DevOps, and whether it failed.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/sync-status'),
  }),
  define({
    name: 'get_report',
    title: 'Get the time report',
    description: 'Hours logged per item and per category over a date range, inclusive of both ends.',
    inputSchema: { start: isoDate, end: isoDate },
    annotations: READ_ONLY,
    run: (client, { start, end }) => client.get(`/api/report${query({ start, end })}`),
  }),
  define({
    name: 'get_calibration',
    title: 'Get estimate calibration',
    description: 'How estimates compared with actual logged time over a date range.',
    inputSchema: { start: isoDate, end: isoDate },
    annotations: READ_ONLY,
    run: (client, { start, end }) => client.get(`/api/calibration${query({ start, end })}`),
  }),
  define({
    name: 'get_settings',
    title: 'Get settings',
    description:
      'Ariadne\'s settings, with secrets redacted. Personal access tokens are never returned in full and cannot be changed through this server.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/settings'),
  }),
  define({
    name: 'list_local_repos',
    title: 'List configured local repos',
    description: 'The local checkout paths configured in Settings.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/local-repos'),
  }),
  define({
    name: 'list_saved_views',
    title: 'List saved views',
    description: 'The saved dashboard search queries, in their display order.',
    inputSchema: {},
    annotations: READ_ONLY,
    run: (client) => client.get('/api/saved-views'),
  }),

  // --------------------------------------------------------- item writes
  define({
    name: 'create_item',
    title: 'Create an ad-hoc item',
    description:
      'Adds an item that did not come from GitHub or Azure DevOps. Use this for work that only exists in your head.',
    inputSchema: {
      title: z.string().min(1).describe('What the item is'),
      category: z.string().optional().describe('Optional grouping label'),
      dueDate: isoDate.optional(),
      priority: priorityValue
        .optional()
        .describe(
          'Starting priority. high adds 40 to the score, medium 20, low 0. Ad-hoc items have no review activity or staleness to earn points from, so this is how they earn a place in the ranking.'
        ),
    },
    annotations: WRITES,
    run: (client, { title, category, dueDate, priority }) =>
      client.post('/api/items', body({ title, category, dueDate, priority })),
  }),
  define({
    name: 'start_item',
    title: 'Start an item',
    description:
      "Moves the item to in-progress, starts its timer, and floats it to the top of today's plan if it is on it. Pass withTimer false to change status without timing.",
    inputSchema: {
      itemId,
      withTimer: z.boolean().optional().describe('Defaults to true'),
    },
    annotations: WRITES,
    run: (client, { itemId: id, withTimer }) =>
      client.post(`/api/items/${id}/start`, body({ withTimer })),
  }),
  define({
    name: 'complete_item',
    title: 'Complete an item',
    description:
      'Marks the item done and closes its timer with the hours you give. durationHours is required and is never inferred, so ask the user how long it took rather than guessing.',
    inputSchema: {
      itemId,
      durationHours: z.number().min(0).describe('Hours to log against this item. Ask, do not guess.'),
      note: z.string().optional().describe('Optional note stored on the time log'),
    },
    annotations: WRITES,
    run: (client, { itemId: id, durationHours, note }) =>
      client.post(`/api/items/${id}/complete`, body({ durationHours, note })),
  }),
  define({
    name: 'stop_timer',
    title: 'Stop the timer on an item',
    description: 'Stops timing without changing the item status. Use this for a pause, not a completion.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.post(`/api/items/${id}/stop-timer`),
  }),
  define({
    name: 'requeue_item',
    title: 'Requeue an item to the inbox',
    description: 'Closes the running timer with the elapsed time and sends the item back to the inbox.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.post(`/api/items/${id}/requeue`),
  }),
  define({
    name: 'undo_completion',
    title: 'Undo a completion',
    description: 'Reverses the last completion: drops that time log and puts the item back in progress.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.post(`/api/items/${id}/undo`),
  }),
  define({
    name: 'park_item',
    title: 'Park an item',
    description: 'Stops any running timer and moves the item to the parked sub-list. Reversible with unpark_item.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.post(`/api/items/${id}/park`),
  }),
  define({
    name: 'unpark_item',
    title: 'Unpark an item',
    description: 'Brings a parked item back into the normal lists.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.post(`/api/items/${id}/unpark`),
  }),
  define({
    name: 'snooze_item',
    title: 'Snooze an item',
    description: 'Hides the item until later today, tomorrow, next week, or until there is activity on it.',
    inputSchema: {
      itemId,
      option: z.enum(['later_today', 'tomorrow', 'next_week', 'until_activity']),
    },
    annotations: WRITES,
    run: (client, { itemId: id, option }) => client.post(`/api/items/${id}/snooze`, { option }),
  }),
  define({
    name: 'unsnooze_item',
    title: 'Unsnooze an item',
    description: 'Clears a snooze so the item comes back immediately.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.del(`/api/items/${id}/snooze`),
  }),
  define({
    name: 'star_item',
    title: 'Star or unstar an item',
    description: 'Marks the item as starred, or clears the star when starred is false.',
    inputSchema: { itemId, starred: z.boolean() },
    annotations: WRITES,
    run: (client, { itemId: id, starred }) => client.post(`/api/items/${id}/star`, { starred }),
  }),
  define({
    name: 'set_priority',
    title: 'Set an item priority',
    description:
      'Sets the hand-set priority on an ad-hoc item, or clears it when priority is null. high adds 40 to the score, medium 20, low 0. Only ad-hoc items can carry one: Ariadne never re-ranks work that came from GitHub or Azure DevOps, and the call is refused on those.',
    inputSchema: { itemId, priority: priorityValue.nullable() },
    annotations: WRITES,
    run: (client, { itemId: id, priority }) => client.post(`/api/items/${id}/priority`, { priority }),
  }),
  define({
    name: 'set_triage_done',
    title: 'Mark an item triaged',
    description:
      'Sets the triage state, which is about having dealt with a signal rather than having finished the work. Use complete_item to finish work.',
    inputSchema: { itemId, done: z.boolean() },
    annotations: WRITES,
    run: (client, { itemId: id, done }) => client.post(`/api/items/${id}/done`, { done }),
  }),
  define({
    name: 'add_to_today',
    title: "Add an item to a day's plan",
    description: "Pins the item to a day's plan. Defaults to today when no date is given.",
    inputSchema: { itemId, date: isoDate.optional() },
    annotations: WRITES,
    run: (client, { itemId: id, date }) => client.post(`/api/items/${id}/today`, body({ date })),
  }),
  define({
    name: 'remove_from_today',
    title: "Remove an item from today's plan",
    description: 'Unpins the item from whichever day it is planned for, without changing its status.',
    inputSchema: { itemId },
    annotations: WRITES,
    run: (client, { itemId: id }) => client.del(`/api/items/${id}/today`),
  }),
  define({
    name: 'delete_item',
    title: 'Delete an item',
    description:
      'Permanently deletes the item and its links. This cannot be undone, and a synced item will reappear on the next sync. An item with logged time is refused, since deleting it would rewrite the time report -- park it instead. Prefer park_item or set_triage_done unless the user explicitly asked for a delete.',
    inputSchema: { itemId },
    annotations: { readOnlyHint: false, destructiveHint: true },
    run: (client, { itemId: id }) => client.del(`/api/items/${id}`),
  }),
  define({
    name: 'sync_now',
    title: 'Sync with GitHub and Azure DevOps',
    description:
      'Pulls fresh items from GitHub and Azure DevOps. Read-only against both: Ariadne never writes back to either.',
    inputSchema: {},
    annotations: WRITES,
    run: (client) => client.post('/api/sync'),
  }),

  // --------------------------------------------------------- plan writes
  define({
    name: 'set_plan',
    title: "Set a day's capacity and note",
    description: "Creates or updates a day's plan: how many minutes are available, plus an optional note.",
    inputSchema: {
      date: isoDate,
      capacityMinutes: z.number().int().min(0),
      note: z.string().nullable().optional(),
    },
    annotations: WRITES,
    run: (client, { date, capacityMinutes, note }) =>
      client.post('/api/plan', body({ date, capacityMinutes, note })),
  }),
  define({
    name: 'add_plan_item',
    title: "Add an item to a day's plan",
    description:
      "Lower-level counterpart to add_to_today: adds plan membership without setting the item's own today date. Prefer add_to_today.",
    inputSchema: { date: isoDate, itemId },
    annotations: WRITES,
    run: (client, { date, itemId: id }) => client.post('/api/plan/items', { date, itemId: id }),
  }),
  define({
    name: 'remove_plan_item',
    title: "Remove an item from a day's plan",
    description: "Removes plan membership for one item on one day. Prefer remove_from_today.",
    inputSchema: { date: isoDate, itemId },
    annotations: WRITES,
    run: (client, { date, itemId: id }) =>
      client.del(`/api/plan/items${query({ date, itemId: id })}`),
  }),
  define({
    name: 'reorder_plan_items',
    title: "Reorder a day's plan",
    description:
      "Sets the hand-picked order of a day's plan. List every item id already on that day: ids you leave out keep their old positions and can end up colliding with the new ones. Call get_plan first to see the current membership.",
    inputSchema: { date: isoDate, orderedItemIds: z.array(z.number().int()) },
    annotations: WRITES,
    run: (client, { date, orderedItemIds }) =>
      client.put('/api/plan/items/reorder', { date, orderedItemIds }),
  }),
  define({
    name: 'set_plan_item_estimate',
    title: 'Estimate a planned item',
    description: 'Sets how many minutes an item on a given day is expected to take.',
    inputSchema: { date: isoDate, itemId, minutes: z.number().int().min(0) },
    annotations: WRITES,
    run: (client, { date, itemId: id, minutes }) =>
      client.post('/api/plan/items/estimate', { date, itemId: id, minutes }),
  }),

  // --------------------------------------------------- saved view writes
  define({
    name: 'create_saved_view',
    title: 'Save a dashboard view',
    description: 'Saves a search query as a named view, optionally bound to a keyboard shortcut.',
    inputSchema: {
      label: z.string().min(1),
      query: z.string().min(1).describe('A dashboard search query'),
      shortcut: z.string().nullable().optional(),
    },
    annotations: WRITES,
    run: (client, { label, query: q, shortcut }) =>
      client.post('/api/saved-views', body({ label, query: q, shortcut })),
  }),
  define({
    name: 'reorder_saved_views',
    title: 'Reorder saved views',
    description:
      'Sets the display order of the saved views. Must list every saved view id exactly once: an incomplete or duplicated list is refused rather than applied. Call list_saved_views first and pass every id back. Use delete_saved_view to remove one.',
    inputSchema: { orderedIds: z.array(z.string()) },
    annotations: WRITES,
    run: (client, { orderedIds }) => client.put('/api/saved-views', { orderedIds }),
  }),
  define({
    name: 'delete_saved_view',
    title: 'Delete a saved view',
    description: 'Removes a saved view. The items it matched are untouched.',
    inputSchema: { id: z.string().min(1) },
    annotations: WRITES,
    run: (client, { id }) => client.del(`/api/saved-views${query({ id })}`),
  }),
];

export function toolByName(name: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
