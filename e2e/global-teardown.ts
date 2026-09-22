import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DIFF_FIXTURE_DIR_PREFIX, TRANSCRIPT_FIXTURE_PREFIX } from './seed-agent-sessions';

// The other end of global-setup's db wipe. Every seedAgentSessions call
// writes a throwaway git repository (or two) and a JSONL transcript fixture
// straight into os.tmpdir() -- see lib/git-cli.test.ts for the same
// construction, which cleans up in its own afterAll. Unlike E2E_DB_PATH,
// which the *next* run's global-setup deletes before writing a fresh one,
// nothing else in this suite ever revisits os.tmpdir(): left alone, these
// would accumulate one set per run, forever, on whatever machine runs this
// suite. Removed here, once, after the whole run finishes, so a run that
// seeds these fixtures also cleans up after itself.
export default function globalTeardown(): void {
  const tmp = os.tmpdir();
  let entries: string[];
  try {
    entries = fs.readdirSync(tmp);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith(DIFF_FIXTURE_DIR_PREFIX) && !entry.startsWith(TRANSCRIPT_FIXTURE_PREFIX)) continue;
    fs.rmSync(path.join(tmp, entry), { recursive: true, force: true });
  }
}
