import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { AriadneClient } from './client';
import { TOOLS } from './tools';
import { createServer } from './server';

type FetchCall = { url: string; method: string | undefined; body: string | undefined };

/**
 * Stands up a real MCP client and server on a linked in-memory transport, so
 * these tests exercise the actual protocol rather than a stand-in for it. Only
 * the HTTP hop into Ariadne is faked.
 */
async function connected(respond: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: String(url),
      method: init?.method,
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof fetch;

  const server = createServer(
    new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl }),
  );
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return { client, calls };
}

const jsonOk = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('createServer', () => {
  it('advertises every tool in the registry', async () => {
    const { client } = await connected(() => jsonOk({}));

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
  });

  it('carries titles and annotations through to the client', async () => {
    const { client } = await connected(() => jsonOk({}));

    const { tools } = await client.listTools();
    const deleteTool = tools.find((t) => t.name === 'delete_item');
    const listTool = tools.find((t) => t.name === 'list_items');

    expect(deleteTool?.annotations?.destructiveHint).toBe(true);
    expect(listTool?.annotations?.readOnlyHint).toBe(true);
    expect(listTool?.title).toBeTruthy();
  });

  it('performs the underlying request when a tool is called', async () => {
    const { client, calls } = await connected(() => jsonOk({ id: 7, status: 'in_progress' }));

    const result = await client.callTool({ name: 'start_item', arguments: { itemId: 7 } });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:3000/api/items/7/start');
    expect(calls[0].method).toBe('POST');
    expect(result.isError).toBeFalsy();
    expect((result.content as { type: string; text: string }[])[0].text).toContain('in_progress');
  });

  it('rejects a call whose arguments fail the input schema', async () => {
    const { client, calls } = await connected(() => jsonOk({}));

    const result = await client.callTool({
      name: 'complete_item',
      arguments: { itemId: 7 },
    }).catch((error: Error) => error);

    // Either shape is acceptable, so long as Ariadne was never touched.
    const rejected = result instanceof Error || (result as { isError?: boolean }).isError === true;
    expect(rejected).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("reports the route's own error message instead of crashing", async () => {
    const { client } = await connected(
      () =>
        new Response(JSON.stringify({ error: 'durationHours is required and must be >= 0' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const result = await client.callTool({
      name: 'complete_item',
      arguments: { itemId: 7, durationHours: 1 },
    });

    expect(result.isError).toBe(true);
    expect((result.content as { type: string; text: string }[])[0].text).toContain(
      'durationHours is required',
    );
  });

  it('explains how to start Ariadne when it is not running', async () => {
    const { client } = await connected(() => {
      throw new TypeError('fetch failed');
    });

    const result = await client.callTool({ name: 'list_items', arguments: {} });

    expect(result.isError).toBe(true);
    expect((result.content as { type: string; text: string }[])[0].text).toMatch(
      /Cannot reach Ariadne/,
    );
  });

  it('stays connected and usable after a failed call', async () => {
    let fail = true;
    const { client } = await connected(() => {
      if (fail) throw new TypeError('fetch failed');
      return jsonOk({ recovered: true });
    });

    await client.callTool({ name: 'list_items', arguments: {} });
    fail = false;
    const result = await client.callTool({ name: 'list_items', arguments: {} });

    expect(result.isError).toBeFalsy();
    expect((result.content as { type: string; text: string }[])[0].text).toContain('recovered');
  });
  it('reports an empty read as null rather than as "Done."', async () => {
    // GET /api/timer/running answers `null` when nothing is running. Calling
    // that "Done." tells the model an action succeeded instead of telling it
    // the answer is "nothing".
    const { client } = await connected(() => jsonOk(null));

    const result = await client.callTool({ name: 'get_running_timer', arguments: {} });

    const text = (result.content as { type: string; text: string }[])[0].text;
    expect(text).toBe('null');
    expect(text).not.toContain('Done');
  });

  it('still confirms a write that returns no body', async () => {
    // DELETE /api/plan/items answers 204 with an empty body, where "Done." is
    // the useful thing to say.
    const { client } = await connected(() => new Response(null, { status: 204 }));

    const result = await client.callTool({
      name: 'remove_plan_item',
      arguments: { date: '2026-08-31', itemId: 1 },
    });

    expect((result.content as { type: string; text: string }[])[0].text).toBe('Done.');
  });
});
