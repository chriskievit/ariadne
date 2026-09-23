import { describe, it, expect, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { agentTabConfigDir, agentSettingsDir } from './agent-paths';

const ORIGINAL_TAB_CONFIG_DIR = process.env.ARIADNE_WARP_TAB_CONFIG_DIR;
const ORIGINAL_SETTINGS_DIR = process.env.ARIADNE_AGENT_SETTINGS_DIR;

afterEach(() => {
  if (ORIGINAL_TAB_CONFIG_DIR === undefined) delete process.env.ARIADNE_WARP_TAB_CONFIG_DIR;
  else process.env.ARIADNE_WARP_TAB_CONFIG_DIR = ORIGINAL_TAB_CONFIG_DIR;
  if (ORIGINAL_SETTINGS_DIR === undefined) delete process.env.ARIADNE_AGENT_SETTINGS_DIR;
  else process.env.ARIADNE_AGENT_SETTINGS_DIR = ORIGINAL_SETTINGS_DIR;
});

describe('agentTabConfigDir', () => {
  it('defaults to ~/.warp/tab_configs when no override is set', () => {
    delete process.env.ARIADNE_WARP_TAB_CONFIG_DIR;
    expect(agentTabConfigDir()).toBe(join(homedir(), '.warp', 'tab_configs'));
  });

  it('uses ARIADNE_WARP_TAB_CONFIG_DIR when set, so the e2e suite never touches the real ~/.warp', () => {
    process.env.ARIADNE_WARP_TAB_CONFIG_DIR = '/tmp/some-e2e-dir/tab_configs';
    expect(agentTabConfigDir()).toBe('/tmp/some-e2e-dir/tab_configs');
  });
});

describe('agentSettingsDir', () => {
  it('defaults to ~/.ariadne/agent-sessions when no override is set', () => {
    delete process.env.ARIADNE_AGENT_SETTINGS_DIR;
    expect(agentSettingsDir()).toBe(join(homedir(), '.ariadne', 'agent-sessions'));
  });

  it('uses ARIADNE_AGENT_SETTINGS_DIR when set, so the e2e suite never touches the real ~/.ariadne', () => {
    process.env.ARIADNE_AGENT_SETTINGS_DIR = '/tmp/some-e2e-dir/agent-sessions';
    expect(agentSettingsDir()).toBe('/tmp/some-e2e-dir/agent-sessions');
  });
});
