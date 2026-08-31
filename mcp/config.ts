import { DEFAULT_BASE_URL } from './client';

export interface ResolvedConfig {
  baseUrl: string;
  authToken: string | null;
}

/**
 * ARIADNE_AUTH_TOKEN is deliberately the same name the app uses, so a setup
 * that has exposed Ariadne beyond loopback configures both halves with one
 * value.
 */
export function resolveConfig(env: Record<string, string | undefined>): ResolvedConfig {
  return {
    baseUrl: trimmed(env.ARIADNE_URL) ?? DEFAULT_BASE_URL,
    authToken: trimmed(env.ARIADNE_AUTH_TOKEN) ?? null,
  };
}

function trimmed(value: string | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}
