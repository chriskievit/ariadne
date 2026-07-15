import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeLaunchConfig, WARP_LAUNCH_URL, LAUNCH_CONFIG_NAME } from './warp-launch';

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('writeLaunchConfig', () => {
  it('creates the launch_configurations directory if missing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'activitydash-launch-test-'));
    dir = join(parent, 'launch_configurations');
    expect(existsSync(dir)).toBe(false);

    writeLaunchConfig('/some/working/dir', dir);

    expect(existsSync(dir)).toBe(true);
  });

  it('writes a YAML file with the given cwd and a claude startup command', () => {
    dir = mkdtempSync(join(tmpdir(), 'activitydash-launch-test-'));

    writeLaunchConfig('/some/working/dir', dir);

    const contents = readFileSync(join(dir, `${LAUNCH_CONFIG_NAME}.yaml`), 'utf8');
    expect(contents).toContain('cwd: /some/working/dir');
    expect(contents).toContain('exec: claude');
  });

  it('overwrites an existing file for the same config name', () => {
    dir = mkdtempSync(join(tmpdir(), 'activitydash-launch-test-'));

    writeLaunchConfig('/first/dir', dir);
    writeLaunchConfig('/second/dir', dir);

    const contents = readFileSync(join(dir, `${LAUNCH_CONFIG_NAME}.yaml`), 'utf8');
    expect(contents).toContain('cwd: /second/dir');
    expect(contents).not.toContain('/first/dir');
  });
});

describe('WARP_LAUNCH_URL', () => {
  it('points at the activitydash launch configuration', () => {
    expect(WARP_LAUNCH_URL).toBe('warp://launch/activitydash');
  });
});
