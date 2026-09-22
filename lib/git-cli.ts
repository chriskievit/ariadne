import { execFile } from 'node:child_process';
import { logWarn } from './log';

// A git call that has not answered in this long is not going to be useful to
// a pane that repaints every few seconds. A pathological repository must
// degrade into "no diff available", never into a hung request.
export const GIT_TIMEOUT_MS = 5000;

// A diff is rendered in a browser. Past this the page is the problem, not
// the repository, so the read is cut and the caller says it was cut.
export const GIT_MAX_BUFFER = 512 * 1024;

export interface GitResult {
  ok: boolean;
  stdout: string;
  truncated: boolean;
}

export interface RunGitOptions {
  maxBytes?: number;
}

/**
 * Run one read-only git command and hand back what it said.
 *
 * This is the only place in Ariadne that starts a process, and the shape is
 * deliberate. `execFile` with an argument array means the arguments reach
 * git as argv and are never parsed by a shell, so a branch name containing
 * `$(...)`, a semicolon or a quote is data rather than syntax. There is no
 * `exec`, no `shell: true`, and no string concatenation anywhere in this
 * file; a future caller that wants those should have to add them here, in
 * front of this comment, rather than reach for them casually.
 *
 * It never throws and never rejects. Every caller is rendering a pane, and
 * a repository that has been moved, deleted or was never a repository at
 * all is an ordinary Tuesday, not an exception worth unwinding a request
 * for.
 */
export function runGit(cwd: string, args: string[], options: RunGitOptions = {}): Promise<GitResult> {
  const maxBytes = options.maxBytes ?? GIT_MAX_BUFFER;

  return new Promise<GitResult>((resolve) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: maxBytes, encoding: 'utf8', windowsHide: true },
      (error, stdout) => {
        const text = typeof stdout === 'string' ? stdout : '';

        if (error) {
          // ERR_CHILD_PROCESS_STDIO_MAXBUFFER means the command worked and
          // said more than we asked for, which is a truncated success. Every
          // other error is a real failure, and the partial output is not
          // trustworthy enough to hand back.
          const overflowed = (error as NodeJS.ErrnoException).code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
          if (overflowed) return resolve({ ok: true, stdout: text.slice(0, maxBytes), truncated: true });

          logWarn('git', `git ${args[0]} failed in ${cwd}`, error);
          return resolve({ ok: false, stdout: '', truncated: false });
        }

        // maxBuffer is not always enforced before the callback on every
        // platform, so the cut is applied here too rather than trusted.
        if (text.length > maxBytes) return resolve({ ok: true, stdout: text.slice(0, maxBytes), truncated: true });

        resolve({ ok: true, stdout: text, truncated: false });
      }
    );
  });
}
