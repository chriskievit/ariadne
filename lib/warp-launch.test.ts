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
  it('creates the tab_configs directory if missing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'ariadne-launch-test-'));
    dir = join(parent, 'tab_configs');
    expect(existsSync(dir)).toBe(false);

    writeLaunchConfig('/some/working/dir', dir);

    expect(existsSync(dir)).toBe(true);
  });

  it('writes a Tab Config TOML file with the given directory and a claude startup command', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-launch-test-'));

    writeLaunchConfig('/some/working/dir', dir);

    const contents = readFileSync(join(dir, `${LAUNCH_CONFIG_NAME}.toml`), 'utf8');
    // Per https://docs.warp.dev/terminal/windows/tab-configs/, a single-pane
    // tab config is `name` + one `[[panes]]` table with directory/commands --
    // this replaces the Legacy Launch Configuration YAML format, which always
    // opens a new window instead of a tab in the active one.
    expect(contents).toBe(
      [
        'name = "ariadne"',
        '[[panes]]',
        'id = "main"',
        'type = "terminal"',
        'directory = "/some/working/dir"',
        'commands = ["claude"]',
        '',
      ].join('\n')
    );
  });

  it('overwrites an existing file for the same config name', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-launch-test-'));

    writeLaunchConfig('/first/dir', dir);
    writeLaunchConfig('/second/dir', dir);

    const contents = readFileSync(join(dir, `${LAUNCH_CONFIG_NAME}.toml`), 'utf8');
    expect(contents).toContain('directory = "/second/dir"');
    expect(contents).not.toContain('/first/dir');
  });
});

describe('WARP_LAUNCH_URL', () => {
  it('points at the ariadne tab config, which opens as a tab in the active window by default', () => {
    expect(WARP_LAUNCH_URL).toBe('warp://tab_config/ariadne');
  });
});
