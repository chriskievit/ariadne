/**
 * The MCP server's only route into Ariadne: HTTP against the running app.
 *
 * Deliberately not a direct SQLite reader. The API routes hold orchestration
 * the tables don't -- Start also floats the item to the top of today's plan,
 * Complete also closes the running timer -- so talking to the routes keeps a
 * single source of truth and avoids a second writer on the database file.
 */

export const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

export interface AriadneClientConfig {
  baseUrl: string;
  /** Only set when the operator has exposed Ariadne beyond loopback. */
  authToken?: string | null;
  fetchImpl?: typeof fetch;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class AriadneClient {
  private readonly baseUrl: string;
  private readonly authToken: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AriadneClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.authToken = config.authToken ?? null;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  del<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.authToken) {
      // Ariadne's middleware only reads the password half, so the username is
      // arbitrary -- see middleware.ts.
      headers.authorization = `Basic ${Buffer.from(`ariadne:${this.authToken}`).toString('base64')}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error(
        `Cannot reach Ariadne at ${this.baseUrl}. Is it running? Start it with \`npm run dev\`, ` +
          `or point the server at a different address with ARIADNE_URL.`,
        { cause },
      );
    }

    const text = await response.text();

    if (!response.ok) {
      throw new Error(apiErrorMessage(method, path, response.status, text));
    }

    if (text === '') return null as T;
    return JSON.parse(text) as T;
  }
}

function apiErrorMessage(method: Method, path: string, status: number, text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Not JSON -- fall through to the generic shape below.
  }
  return `Ariadne returned ${status} for ${method} ${path}: ${text}`;
}
