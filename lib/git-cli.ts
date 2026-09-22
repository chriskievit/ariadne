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

  // execFile's own maxBuffer is deliberately larger than the cap callers
  // reason about. If it were equal to maxBytes, Node would kill the child
  // the instant output crossed the cap and our own trim below could never
  // run -- git would always be the one deciding truncation, not us. Giving
  // it headroom means output that's over the cap but not wildly so finishes
  // normally and gets trimmed cleanly here; Node's kill stays as the
  // backstop for output so large it isn't worth buffering at all.
  const execMaxBuffer = maxBytes * 2;

  return new Promise<GitResult>((resolve) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: execMaxBuffer, encoding: 'utf8', windowsHide: true },
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
            // the error means -- so truncated is asserted directly rather
            // than inferred from capOutput's length check. Only the slicing
            // is shared; the flag comes from the error, not from capOutput.
            return resolve({ ok: true, stdout: capOutput(text, maxBytes).stdout, truncated: true });
          }

          logWarn('git', `git ${args[0]} failed in ${cwd}`, error);
          return resolve({ ok: false, stdout: '', truncated: false });
        }

        // execFile's own maxBuffer is deliberately larger than maxBytes (see
        // execMaxBuffer above), so output that lands between the two -- over
        // the cap but within the buffer -- reaches here intact rather than
        // getting the child killed mid-write. This is where that band gets
        // trimmed to what the caller actually asked for.
        resolve({ ok: true, ...capOutput(text, maxBytes) });
      }
    );
  });
}
