/** Per-run XP, coins and levels (roguelike: every run starts from zero), all derived from the replayed log. */
import type { State, ObjectiveState } from "./state";

export const XP = { lecture: 10, lab: 15, assignment: 40, exam: 50, readingBump: 5, readingFinished: 20, progress: 15 } as const;

export function objectiveXp(o: ObjectiveState): number {
  if (o.kind === "reading") return XP.readingBump * o.bumps.length + (o.completed ? XP.readingFinished : 0);
  return o.completed ? XP[o.kind] : 0;
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

/** Going from level L to L + 1 costs 50 + 10 × (L − 1) XP. */
export function levelFor(xp: number): LevelInfo {
  let level = 1;
  let left = xp;
  const step = (l: number) => 50 + 10 * (l - 1);
  while (left >= step(level)) {
    left -= step(level);
    level++;
  }
  return { level, xpIntoLevel: left, xpForNextLevel: step(level) };
}

export interface RunRewards {
  xp: number;
  /** Earned coins equal earned XP; phase 5b spends them. */
  coins: number;
  level: LevelInfo;
}

export function runRewards(s: State, run: string): RunRewards {
  let xp = 0;
  for (const o of s.objectives.values()) if (o.run === run) xp += objectiveXp(o);
  return { xp, coins: xp, level: levelFor(xp) };
}
