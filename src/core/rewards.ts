/** Per-run XP, coins and levels (roguelike: every run starts from zero), all derived from the replayed log. */
import { courseObjectives } from "./derive";
import type { ObjectiveState, RunState, State } from "./state";

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
  /** Coins earned: equal to XP earned. */
  earned: number;
  /** Coins left: earned minus what live purchases cost. */
  coins: number;
  level: LevelInfo;
}

export function runRewards(s: State, run: string): RunRewards {
  let xp = 0;
  for (const o of s.objectives.values()) if (o.run === run) xp += objectiveXp(o);
  let spent = 0;
  for (const p of s.runs.get(run)?.purchases.values() ?? []) spent += p.price;
  return { xp, earned: xp, coins: xp - spent, level: levelFor(xp) };
}

// ── badges ──────────────────────────────────────────────────────────────

export type BadgeId = "course-complete" | "lecture-sweep" | "first-prestige" | "tier-3" | "tier-5";

export const BADGE_NAMES: Record<BadgeId, string> = {
  "course-complete": "Course complete",
  "lecture-sweep": "Lecture sweep",
  "first-prestige": "First prestige",
  "tier-3": "Tier 3 run",
  "tier-5": "Tier 5 run",
};

export interface Badge {
  id: BadgeId;
  name: string;
  /** In-run badges: the course that earned it. */
  course?: string;
}

const badge = (id: BadgeId, course?: string): Badge => (course ? { id, name: BADGE_NAMES[id], course } : { id, name: BADGE_NAMES[id] });

/** Badges won within a run, live: they hold while their condition does. In course order. */
export function runBadges(s: State, run: string): Badge[] {
  const r = s.runs.get(run);
  if (!r) return [];
  const out: Badge[] = [];
  for (const c of r.courses.values()) {
    const objs = courseObjectives(s, run, c.code);
    const lectures = objs.filter((o) => o.kind === "lecture");
    if (objs.length > 0 && objs.every((o) => o.completed)) out.push(badge("course-complete", c.code));
    if (lectures.length > 0 && lectures.every((o) => o.completed)) out.push(badge("lecture-sweep", c.code));
  }
  return out;
}

const PERMANENT: { id: BadgeId; qualifies: (closed: NonNullable<RunState["closed"]>) => boolean }[] = [
  { id: "first-prestige", qualifies: () => true },
  { id: "tier-3", qualifies: (c) => c.tier >= 3 },
  { id: "tier-5", qualifies: (c) => c.tier === 5 },
];

/** Badges kept for good, each credited to the first closed run that earned it (by close time, then run id). */
export function permanentBadges(s: State): (Badge & { run: string })[] {
  const closed = [...s.runs.values()]
    .filter((r) => r.closed)
    .sort((a, b) => a.closed!.at.localeCompare(b.closed!.at) || a.id.localeCompare(b.id));
  const out: (Badge & { run: string })[] = [];
  for (const p of PERMANENT) {
    const first = closed.find((r) => p.qualifies(r.closed!));
    if (first) out.push({ ...badge(p.id), run: first.id });
  }
  return out;
}

/** What a run shows in its badge list: its in-run badges, then the permanent ones it was first to earn. */
export function badgesEarnedBy(s: State, run: string): Badge[] {
  const permanent = permanentBadges(s)
    .filter((b) => b.run === run)
    .map(({ id, name }) => ({ id, name }));
  return [...runBadges(s, run), ...permanent];
}
