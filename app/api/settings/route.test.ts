import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { getSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

describe('/api/settings', () => {
  it('saves settings and returns them, redacting PAT values', async () => {
    const postRes = await POST(
      new Request('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [SETTINGS_KEYS.githubPat]: 'abc123', [SETTINGS_KEYS.adoOrg]: 'myorg' }),
      })
    );
    expect(postRes.status).toBe(200);

    // The PAT never comes back in the response body...
    const postBody = await postRes.json();
    expect(postBody[SETTINGS_KEYS.githubPat]).toBe('');
    expect(postBody[`${SETTINGS_KEYS.githubPat}.isSet`]).toBe('true');
    expect(postBody[SETTINGS_KEYS.adoOrg]).toBe('myorg');

    const getRes = await GET();
    const getBody = await getRes.json();
    expect(getBody[SETTINGS_KEYS.githubPat]).toBe('');
    expect(getBody[`${SETTINGS_KEYS.githubPat}.isSet`]).toBe('true');

    // ...but it's still stored and retrievable server-side for actual API calls.
    expect(getSetting(testDb, SETTINGS_KEYS.githubPat)).toBe('abc123');
  });

  it('does not overwrite a saved PAT when the field is omitted from the request body', async () => {
    await POST(
      new Request('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [SETTINGS_KEYS.githubPat]: 'keep-me' }),
      })
    );

    await POST(
      new Request('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [SETTINGS_KEYS.adoOrg]: 'myorg' }),
      })
    );

    expect(getSetting(testDb, SETTINGS_KEYS.githubPat)).toBe('keep-me');
  });
});
