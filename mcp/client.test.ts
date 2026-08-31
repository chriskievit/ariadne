import { describe, it, expect } from 'vitest';
import { AriadneClient } from './client';

type FetchCall = { url: string; init: RequestInit | undefined };

/**
 * Records what the client asked for and replies with whatever the test
 * wants. Injected rather than mocked globally so each test can see the
 * exact request the tool layer built.
 */
function recordingFetch(response: {
  status?: number;
  body?: unknown;
  bodyText?: string;
}): { calls: FetchCall[]; fetchImpl: typeof fetch } {
  const calls: FetchCall[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const text = response.bodyText ?? JSON.stringify(response.body ?? {});
    return new Response(text, {
      status: response.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('AriadneClient', () => {
  it('resolves a GET against the configured base URL', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: { today: [] } });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    const result = await client.get('/api/today/summary');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:3000/api/today/summary');
    expect(calls[0].init?.method).toBe('GET');
    expect(result).toEqual({ today: [] });
  });

  it('sends a JSON body on POST', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: { id: 1 } });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await client.post('/api/items/1/complete', { durationHours: 1.5 });

    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe(JSON.stringify({ durationHours: 1.5 }));
    expect(new Headers(calls[0].init?.headers).get('content-type')).toBe('application/json');
  });

  it('omits the body entirely when a POST has no payload', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: {} });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await client.post('/api/items/1/park');

    expect(calls[0].init?.body).toBeUndefined();
  });

  it('strips a trailing slash from the base URL rather than doubling it', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: {} });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000/', fetchImpl });

    await client.get('/api/items');

    expect(calls[0].url).toBe('http://127.0.0.1:3000/api/items');
  });

  it('sends Basic auth when an auth token is configured', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: {} });
    const client = new AriadneClient({
      baseUrl: 'http://127.0.0.1:3000',
      authToken: 'sekrit',
      fetchImpl,
    });

    await client.get('/api/items');

    const sent = new Headers(calls[0].init?.headers).get('authorization');
    expect(sent).toBe(`Basic ${Buffer.from('ariadne:sekrit').toString('base64')}`);
  });

  it('sends no authorization header when no token is configured', async () => {
    const { calls, fetchImpl } = recordingFetch({ body: {} });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await client.get('/api/items');

    expect(new Headers(calls[0].init?.headers).get('authorization')).toBeNull();
  });

  it("surfaces the API's own error message on a 4xx", async () => {
    const { fetchImpl } = recordingFetch({
      status: 400,
      body: { error: 'durationHours is required and must be >= 0' },
    });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await expect(client.post('/api/items/1/complete', {})).rejects.toThrow(
      'durationHours is required and must be >= 0',
    );
  });

  it('falls back to status and path when an error response is not JSON', async () => {
    const { fetchImpl } = recordingFetch({ status: 401, bodyText: 'Authentication required.' });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await expect(client.get('/api/items')).rejects.toThrow(
      'Ariadne returned 401 for GET /api/items: Authentication required.',
    );
  });

  it('explains how to start Ariadne when the connection is refused', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await expect(client.get('/api/items')).rejects.toThrow(
      /Cannot reach Ariadne at http:\/\/127\.0\.0\.1:3000/,
    );
    await expect(client.get('/api/items')).rejects.toThrow(/npm run dev/);
  });

  it('treats an empty 200 body as null rather than throwing', async () => {
    const { fetchImpl } = recordingFetch({ status: 200, bodyText: '' });
    const client = new AriadneClient({ baseUrl: 'http://127.0.0.1:3000', fetchImpl });

    await expect(client.get('/api/items')).resolves.toBeNull();
  });
});
