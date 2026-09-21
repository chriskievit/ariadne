import { describe, it, expect } from 'vitest';
import { detectInstalledAgents } from './agent-detect';

describe('detectInstalledAgents', () => {
  it('reports the agents whose binary is on PATH, in registry order', () => {
    const present = new Set(['/usr/local/bin/codex', '/opt/bin/claude']);
    const found = detectInstalledAgents('/usr/local/bin:/opt/bin', (p) => present.has(p));
    expect(found).toEqual(['claude', 'codex']);
  });

  it('returns an empty list when nothing is installed', () => {
    expect(detectInstalledAgents('/usr/local/bin', () => false)).toEqual([]);
  });

  it('tolerates an empty PATH', () => {
    expect(detectInstalledAgents('', () => true)).toEqual([]);
  });

  it('finds a binary regardless of a trailing slash, single or double, on its PATH entry', () => {
    const present = new Set(['/usr/local/bin/claude']);
    expect(detectInstalledAgents('/usr/local/bin/', (p) => present.has(p))).toEqual(['claude']);
    expect(detectInstalledAgents('/usr/local/bin//', (p) => present.has(p))).toEqual(['claude']);
  });
});
