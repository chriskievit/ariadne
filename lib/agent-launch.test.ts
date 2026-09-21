import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sessionTabConfigName,
  sessionWarpUrl,
  sessionTabTitle,
  writeSessionTabConfig,
  removeSessionTabConfig,
  AGENT_TAB_COLOR,
} from './agent-launch';
import type { Item } from './types';

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 1, source: 'ado_workitem', externalId: '4318', title: 'Fix the pipeline', url: null,
    reason: 'assigned', category: null, dueDate: null, sprintIteration: null, rawUpdatedAt: null,
    status: 'inbox', createdAt: '2026-09-21T10:00:00.000Z', completedAt: null, adoStatus: null,
    prStatus: null, repo: 'pipelines', hasUnresolvedConversations: false, parked: false,
    todayDate: null, starred: false, snoozedUntil: null, triageState: 'none', wokeEarly: false,
    priority: null, prioritySetAt: null,
    ...overrides,
  };
}

describe('sessionWarpUrl', () => {
  it('addresses this session\'s own tab config, which opens a tab in the active window', () => {
    expect(sessionTabConfigName(7)).toBe('ariadne-session-7');
    expect(sessionWarpUrl(7)).toBe('warp://tab_config/ariadne-session-7');
  });
});

describe('sessionTabTitle', () => {
  it('names an Azure DevOps work item by number and repo', () => {
    expect(sessionTabTitle(item())).toBe('#4318 pipelines');
  });

  it('names a pull request by its number', () => {
    expect(sessionTabTitle(item({ source: 'github_pr', externalId: '81@pro4all/ariadne', repo: 'ariadne' })))
      .toBe('#81 ariadne');
  });

  it('falls back to the item title when there is no repo', () => {
    expect(sessionTabTitle(item({ source: 'adhoc', externalId: null, repo: null, title: 'Call the vendor' })))
      .toBe('Call the vendor');
  });

  it('truncates a long title so the tab stays readable', () => {
    const long = 'x'.repeat(80);
    expect(sessionTabTitle(item({ source: 'adhoc', externalId: null, repo: null, title: long })).length)
      .toBeLessThanOrEqual(32);
  });

  it('strips quotes and newlines, which would break the TOML', () => {
    expect(sessionTabTitle(item({ source: 'adhoc', externalId: null, repo: null, title: 'a"b\nc' })))
      .toBe('abc');
  });
});

describe('writeSessionTabConfig', () => {
  it('writes a single-pane tab config carrying the title, color, directory, and command', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));

    writeSessionTabConfig(
      { sessionId: 7, title: '#4318 pipelines', color: AGENT_TAB_COLOR, directory: '/w/pipelines', command: 'claude --settings "/tmp/s.json"' },
      dir
    );

    expect(readFileSync(join(dir, 'ariadne-session-7.toml'), 'utf8')).toBe(
      [
        'name = "ariadne-session-7"',
        'title = "#4318 pipelines"',
        'color = "yellow"',
        '[[panes]]',
        'id = "main"',
        'type = "terminal"',
        'directory = "/w/pipelines"',
        `commands = ["claude --settings \\"/tmp/s.json\\""]`,
        '',
      ].join('\n')
    );
  });

  it('creates the tab_configs directory if missing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    dir = join(parent, 'tab_configs');

    writeSessionTabConfig({ sessionId: 1, title: 't', color: 'yellow', directory: '/w', command: 'claude' }, dir);

    expect(existsSync(join(dir, 'ariadne-session-1.toml'))).toBe(true);
  });

  it('rejects a directory containing a quote or newline', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig(
        { sessionId: 1, title: 't', color: 'yellow', directory: '/w"\ncommands = ["evil"]', command: 'claude' },
        dir
      )
    ).toThrow(/must not contain quotes or newlines/);
  });

  // Warp hands the directory and the command to a shell, and bash expands
  // $() and backticks inside double quotes without breaking out of them.
  it('rejects a directory containing a command substitution', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig(
        { sessionId: 1, title: 't', color: 'yellow', directory: '/w/$(touch /tmp/pwned)', command: 'claude' },
        dir
      )
    ).toThrow(/shell expansion/);
  });

  it('rejects a command containing a backtick', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig(
        { sessionId: 1, title: 't', color: 'yellow', directory: '/w', command: 'claude `whoami`' },
        dir
      )
    ).toThrow(/shell expansion/);
  });

  // The title is displayed, never executed, so a work item called
  // "Fix $ formatting" must still launch.
  it('allows a dollar sign in the tab title', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig({ sessionId: 1, title: 'Fix $ formatting', color: 'yellow', directory: '/w', command: 'claude' }, dir)
    ).not.toThrow();
  });

  it('rejects a title containing a newline', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig({ sessionId: 1, title: 'a\nb', color: 'yellow', directory: '/w', command: 'claude' }, dir)
    ).toThrow(/must not contain quotes or newlines/);
  });

  it('rejects a colour outside Warp\'s fixed set, which is a hard parse error in Warp', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    expect(() =>
      writeSessionTabConfig({ sessionId: 1, title: 't', color: 'threadline', directory: '/w', command: 'claude' }, dir)
    ).toThrow(/colou?r/i);
  });
});

describe('removeSessionTabConfig', () => {
  it('deletes the config and tolerates it already being gone', () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-agent-launch-test-'));
    writeSessionTabConfig({ sessionId: 3, title: 't', color: 'yellow', directory: '/w', command: 'claude' }, dir);

    removeSessionTabConfig(3, dir);
    expect(existsSync(join(dir, 'ariadne-session-3.toml'))).toBe(false);
    expect(() => removeSessionTabConfig(3, dir)).not.toThrow();
  });
});
