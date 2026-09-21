import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHookSettings, writeHookSettings, hookSettingsPath } from './agent-hooks-config';

// Realistic tokens: writeHookSettings enforces a 16-64 char url-safe floor.
const TOKEN_A = 'tok-aaaaaaaaaaaaaaaa';
const TOKEN_B = 'tok-bbbbbbbbbbbbbbbb';

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('buildHookSettings', () => {
  it('registers every lifecycle hook Ariadne reads', () => {
    const settings = buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', null) as any;
    expect(Object.keys(settings.hooks).sort()).toEqual(
      ['Notification', 'PreToolUse', 'SessionEnd', 'SessionStart', 'Stop'].sort()
    );
  });

  // A hook that fails or hangs must never block the user's agent. Ariadne
  // being down is Ariadne's problem, not a reason the session stalls.
  it('makes every hook command time-bounded and non-fatal', () => {
    const settings = buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', null) as any;
    for (const event of Object.keys(settings.hooks)) {
      const entry = settings.hooks[event][0].hooks[0];
      expect(entry.type).toBe('command');
      expect(entry.command).toContain('-m 5');
      expect(entry.command).toMatch(/\|\| true$/);
      expect(entry.command).toContain('http://127.0.0.1:3000/api/agent-hooks/tok');
    }
  });

  it('sends the event name so the receiver never has to infer it', () => {
    const settings = buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', null) as any;
    expect(settings.hooks.PreToolUse[0].matcher).toBe('*');
  });

  it('omits credentials when no auth token is configured', () => {
    const settings = buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', null) as any;
    expect(settings.hooks.Stop[0].hooks[0].command).not.toContain('-u ');
  });

  // The middleware rejects every request when ARIADNE_AUTH_TOKEN is set, so
  // a hook with no credentials would silently 401 and the session would look
  // permanently stuck in launching.
  it('carries basic auth when an auth token is configured', () => {
    const settings = buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', 's3cret') as any;
    expect(settings.hooks.Stop[0].hooks[0].command).toContain(`-u ":s3cret"`);
  });

  it('rejects an auth token containing a quote', () => {
    expect(() => buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', 'a"b')).toThrow(
      /must not contain quotes/
    );
  });

  it('rejects a hook url containing a quote', () => {
    expect(() => buildHookSettings('http://127.0.0.1:3000/x"y', null)).toThrow(/must not contain quotes/);
  });

  it('rejects a hook url containing command substitution with $(', () => {
    expect(() => buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok$(touch /tmp/PWNED)', null)).toThrow(
      /must not contain.*dollar signs/
    );
  });

  it('rejects an auth token containing a backtick for command substitution', () => {
    expect(() => buildHookSettings('http://127.0.0.1:3000/api/agent-hooks/tok', 'sec`whoami`ret')).toThrow(
      /must not contain.*backticks/
    );
  });
});

describe('writeHookSettings', () => {
  it('writes a parseable settings file named for the launch token', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-hooks-test-'));

    const path = writeHookSettings(dir, TOKEN_A, 'http://127.0.0.1:3000', null);

    expect(path).toBe(hookSettingsPath(dir, TOKEN_A));
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toContain(`/api/agent-hooks/${TOKEN_A}`);
  });

  it('creates the directory when it is missing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'ariadne-hooks-test-'));
    dir = join(parent, 'nested');

    writeHookSettings(dir, TOKEN_B, 'http://127.0.0.1:3000', null);

    expect(existsSync(hookSettingsPath(dir, TOKEN_B))).toBe(true);
  });

  it('rejects a launch token that is not url-safe', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-hooks-test-'));
    expect(() => writeHookSettings(dir, '../escape', 'http://127.0.0.1:3000', null)).toThrow(/launch token/i);
  });
});
