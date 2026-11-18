import { replay } from "../../src/core/replay";
import { levelFor, objectiveXp, runRewards } from "../../src/core/rewards";
import { Q2, at, ev } from "./fixtures";

const R = Q2.run;
const start = () => [ev.created(), ev.course(R, "C1")];
const xpOf = (events: Parameters<typeof replay>[0], obj: string) => objectiveXp(replay(events).objectives.get(obj)!);

describe("XP per objective", () => {
  test("lecture, lab and assignment earn 10, 15 and 40 when done; open earns 0", () => {
    const l = ev.objective(R, "C1", "lecture", 1);
    const b = ev.objective(R, "C1", "lab", 1);
    const a = ev.objective(R, "C1", "assignment", 1, at(2), { date: "2026-12-01" });
    const done = [...start(), l, b, a, ev.completed(l.obj, "silver", at(3), "L.md"), ev.completed(b.obj, "silver", at(3), "B.md"), ev.completed(a.obj, "silver", at(3), "A.md")];
    expect([xpOf(done, l.obj), xpOf(done, b.obj), xpOf(done, a.obj)]).toEqual([10, 15, 40]);
    expect(xpOf([...start(), l], l.obj)).toBe(0);
  });

  test("a sat exam earns 50", () => {
    const x = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
    expect(xpOf([...start(), x, ev.completed(x.obj, "sat", "2027-01-28T08:00:00.000Z")], x.obj)).toBe(50);
  });

  test("a reading earns 5 per live bump and 20 when finished", () => {
    const r = ev.objective(R, "C1", "reading", 1, at(2), { levels: ["Chapter"] });
    const three = [...start(), r, ev.bump(r.obj, 0, at(3)), ev.bump(r.obj, 0, at(4)), ev.bump(r.obj, 0, at(5))];
    expect(xpOf(three, r.obj)).toBe(15);
    expect(xpOf([...three, ev.bumpUndone(r.obj, at(6))], r.obj)).toBe(10);
    expect(xpOf([...start(), r, ev.bump(r.obj, 0, at(3)), ev.bump(r.obj, 0, at(4)), ev.completed(r.obj, "silver", at(5))], r.obj)).toBe(30);
  });

  test("a legacy reading earns 20 when finished", () => {
    const r = ev.objective(R, "C1", "reading", 1);
    expect(xpOf([...start(), r, ev.completed(r.obj, "silver", at(3))], r.obj)).toBe(20);
  });

  test("a progress objective earns 15 when finished, nothing for steps", () => {
    const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
    expect(xpOf([...start(), p, ev.step(p.obj, 0, at(3))], p.obj)).toBe(0);
    expect(xpOf([...start(), p, ev.step(p.obj, 0, at(3)), ev.step(p.obj, 1, at(4)), ev.completed(p.obj, "silver", at(4))], p.obj)).toBe(15);
  });
});

test("levelFor: 50 to reach level 2, then 10 more per level", () => {
  expect(levelFor(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 50 });
  expect(levelFor(49)).toEqual({ level: 1, xpIntoLevel: 49, xpForNextLevel: 50 });
  expect(levelFor(50)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 60 });
  expect(levelFor(109)).toEqual({ level: 2, xpIntoLevel: 59, xpForNextLevel: 60 });
  expect(levelFor(110)).toEqual({ level: 3, xpIntoLevel: 0, xpForNextLevel: 70 });
});

describe("runRewards", () => {
  test("overlapping runs keep separate XP; coins equal XP", () => {
    const career = ev.created("Career", "2026-09-01", "2027-07-15");
    const l = ev.objective(R, "C1", "lecture", 1);
    const k = ev.objective("Career", "CV", "lecture", 1);
    const s = replay([
      ...start(),
      career,
      ev.course("Career", "CV"),
      l,
      k,
      ev.completed(l.obj, "silver", at(3), "L.md"),
      ev.completed(k.obj, "silver", at(3), "K.md"),
    ]);
    expect(runRewards(s, R)).toEqual({ xp: 10, coins: 10, level: { level: 1, xpIntoLevel: 10, xpForNextLevel: 50 } });
    expect(runRewards(s, "Career").xp).toBe(10);
  });

  test("a run with no objectives starts at level 1 with nothing", () => {
    expect(runRewards(replay([ev.created()]), R)).toEqual({ xp: 0, coins: 0, level: { level: 1, xpIntoLevel: 0, xpForNextLevel: 50 } });
  });

  test("a closed run's stains add nothing", () => {
    const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
    const l1 = ev.objective("Old", "C1", "lecture", 1, at(2));
    const l2 = ev.objective("Old", "C1", "lecture", 2, at(2));
    const s = replay([old, ev.course("Old", "C1", at(1)), l1, l2, ev.completed(l1.obj, "silver", at(3), "X.md"), ev.closed("Old", 1, 2, 0, at(4))]);
    expect(runRewards(s, "Old").xp).toBe(10);
  });
});
