import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const ORIGINAL_TOKEN = process.env.ARIADNE_AUTH_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.ARIADNE_AUTH_TOKEN;
  else process.env.ARIADNE_AUTH_TOKEN = ORIGINAL_TOKEN;
});

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${btoa(`${user}:${pass}`)}`;
}

describe('middleware', () => {
  it('allows every request through when ARIADNE_AUTH_TOKEN is unset', () => {
    delete process.env.ARIADNE_AUTH_TOKEN;
    const res = middleware(new NextRequest('http://localhost/settings'));
    expect(res.status).toBe(200);
  });

  it('rejects a request with no Authorization header once a token is configured', () => {
    process.env.ARIADNE_AUTH_TOKEN = 'secret';
    const res = middleware(new NextRequest('http://localhost/settings'));
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toContain('Basic');
  });

  it('rejects a wrong password', () => {
    process.env.ARIADNE_AUTH_TOKEN = 'secret';
    const req = new NextRequest('http://localhost/settings', {
      headers: { authorization: basicAuthHeader('any', 'wrong') },
    });
    expect(middleware(req).status).toBe(401);
  });

  it('rejects a malformed Authorization header', () => {
    process.env.ARIADNE_AUTH_TOKEN = 'secret';
    const req = new NextRequest('http://localhost/settings', {
      headers: { authorization: 'not-basic-auth' },
    });
    expect(middleware(req).status).toBe(401);
  });

  it('allows a correct password regardless of the username portion', () => {
    process.env.ARIADNE_AUTH_TOKEN = 'secret';
    const req = new NextRequest('http://localhost/settings', {
      headers: { authorization: basicAuthHeader('anything', 'secret') },
    });
    expect(middleware(req).status).toBe(200);
  });
});
