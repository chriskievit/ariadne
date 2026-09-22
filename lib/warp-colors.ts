// Warp's own tab-colour palette, in one place. Extracted out of
// agent-launch.ts (which writes tab config files and so touches node:fs,
// making it unimportable from client code) precisely so client code has
// somewhere safe to get this list from -- following the same split as
// agents.ts (pure registry, client-safe) versus agent-detect.ts (probes the
// filesystem, server-only).
//
// The union type, not just the array, is the point: a swatch keyed as
// Record<WarpColor, string> makes a ninth colour added here a `tsc` error at
// the swatch definition, rather than a silently blank dot the day Warp ships
// one.
export const WARP_COLORS = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const;

export type WarpColor = (typeof WARP_COLORS)[number];

export function isWarpColor(value: string): value is WarpColor {
  return (WARP_COLORS as readonly string[]).includes(value);
}
