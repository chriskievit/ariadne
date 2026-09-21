/**
 * The house logging convention: a scope, a message, and an optional detail.
 *
 * Ariadne runs on one machine in front of one person, so "logging" means the
 * terminal running `next dev` or `next start`. There is no transport, no
 * level configuration and no structured sink, because there is nowhere for
 * any of that to go.
 *
 * What it is for is the handful of places that must swallow a failure to
 * keep a promise elsewhere -- above all the agent hook receiver, which has
 * to answer 200 whatever happens because Claude Code runs it inline. Those
 * places still need to leave a trace, or the only symptom of a broken
 * database write is a session that quietly stops updating.
 *
 * Every caller is already inside a `catch`, so neither function may throw.
 */
function write(sink: 'warn' | 'error', scope: string, message: string, detail?: unknown): void {
  try {
    const line = `[ariadne:${scope}] ${message}`;
    if (detail === undefined) {
      console[sink](line);
    } else {
      console[sink](line, detail);
    }
  } catch {
    // A logger that can take down the thing it is reporting on is worse than
    // no logger. There is nowhere left to report this to.
  }
}

/** Something went wrong and the feature carried on without it. */
export function logWarn(scope: string, message: string, detail?: unknown): void {
  write('warn', scope, message, detail);
}

/** Something went wrong and the thing the caller was asked to do did not happen. */
export function logError(scope: string, message: string, detail?: unknown): void {
  write('error', scope, message, detail);
}
