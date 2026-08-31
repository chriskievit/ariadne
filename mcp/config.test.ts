import { describe, it, expect } from 'vitest';
import { resolveConfig } from './config';
import { DEFAULT_BASE_URL } from './client';

describe('resolveConfig', () => {
  it('defaults to loopback on the port Ariadne serves', () => {
    expect(resolveConfig({})).toEqual({ baseUrl: DEFAULT_BASE_URL, authToken: null });
  });

  it('takes the base URL from ARIADNE_URL', () => {
    expect(resolveConfig({ ARIADNE_URL: 'http://127.0.0.1:4000' }).baseUrl).toBe(
      'http://127.0.0.1:4000',
    );
  });

  it('takes the auth token from ARIADNE_AUTH_TOKEN, matching the app env var', () => {
    expect(resolveConfig({ ARIADNE_AUTH_TOKEN: 'sekrit' }).authToken).toBe('sekrit');
  });

  it('treats blank env vars as unset rather than as empty values', () => {
    expect(resolveConfig({ ARIADNE_URL: '  ', ARIADNE_AUTH_TOKEN: '' })).toEqual({
      baseUrl: DEFAULT_BASE_URL,
      authToken: null,
    });
  });
});
