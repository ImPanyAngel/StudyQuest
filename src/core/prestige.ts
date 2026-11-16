/** A run's prestige tier, 0 (unranked) to 5 (100%). Names are placeholders until a theme is chosen. */
export type PrestigeTier = 0 | 1 | 2 | 3 | 4 | 5;

/** Lowest percentage for tiers 5 down to 1. */
const THRESHOLDS: [PrestigeTier, number][] = [
  [5, 100],
  [4, 95],
  [3, 90],
  [2, 85],
  [1, 75],
];

export function tierFor(pct: number | null): PrestigeTier {
  if (pct === null) return 0;
  for (const [tier, min] of THRESHOLDS) if (pct >= min) return tier;
  return 0;
}

export function tierLabel(t: PrestigeTier): string {
  return t === 0 ? "Unranked" : `Tier ${t}`;
}

export function isPrestigeTier(n: unknown): n is PrestigeTier {
  return Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 5;
}
