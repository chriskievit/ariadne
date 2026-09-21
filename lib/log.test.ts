import { describe, it, expect, vi, afterEach } from 'vitest';
import { logWarn, logError } from './log';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logWarn', () => {
  it('prefixes the scope so a line can be traced to the code that wrote it', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logWarn('agent-hooks', 'could not apply event');
    expect(spy).toHaveBeenCalledWith('[ariadne:agent-hooks] could not apply event');
  });

  it('passes a detail through as a second argument rather than stringifying it', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const detail = new Error('boom');
    logWarn('agent-hooks', 'could not apply event', detail);
    expect(spy).toHaveBeenCalledWith('[ariadne:agent-hooks] could not apply event', detail);
  });
});

describe('logError', () => {
  it('writes to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logError('agent-launch', 'could not write the tab config');
    expect(spy).toHaveBeenCalledWith('[ariadne:agent-launch] could not write the tab config');
  });
});

describe('the logger itself', () => {
  it('never throws, because every caller is already inside a catch it must not disturb', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('console is gone');
    });
    expect(() => logWarn('agent-hooks', 'anything')).not.toThrow();
  });
});
