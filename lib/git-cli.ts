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
 * Decide what a caller gets to see of a command's output: everything, or the
 * first `maxBytes` of it with `truncated` set. Pulled out on its own because
 * the ordinary (no-error) success path needs this exact decision too, and a
 * branch with no way to observe it independently is not a branch anyone can
 * trust — see the call site below for why that second call exists at all.
 */
export function capOutput(text: string, maxBytes: number): { stdout: string; truncated: boolean } {
  if (text.length > maxBytes) return { stdout: text.slice(0, maxBytes), truncated: true };
  return { stdout: text, truncated: false };
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
          if (overflowed) {
            // This branch already knows truncation happened -- that is what
            // the error means -- even though Node hands back `text` cut to
            // (about) maxBytes, so capOutput's own length check can no
            // longer tell "the output was exactly this long" from "the
            // output was cut to this length". Only the slicing is shared;
            // `truncated: true` here comes from the error, not from capOutput.
            return resolve({ ok: true, stdout: capOutput(text, maxBytes).stdout, truncated: true });
          }

          logWarn('git', `git ${args[0]} failed in ${cwd}`, error);
          return resolve({ ok: false, stdout: '', truncated: false });
        }

        // maxBuffer is not always enforced before the callback on every
        // platform, so the same cap is applied here rather than trusted to
        // have already happened. This exact call is not something an
        // integration test can force to fire -- execFile's own maxBuffer is
        // set to this same maxBytes, so Node's kill wins the race on a
        // platform where it works at all -- but it shares capOutput with the
        // branch above, and capOutput's own tests verify the slicing and
        // truncation logic directly, so a break here is still caught.
        resolve({ ok: true, ...capOutput(text, maxBytes) });
      }
    );
  });
}
