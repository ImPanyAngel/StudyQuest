import {
  canCorrectRun,
  canUndoCourse,
  canUndoObjective,
  courseObjectives,
  courseProgress,
  chosenRun,
  currentRun,
  examsDueForSat,
  homeRows,
  isResit,
  openRuns,
  percent,
  runEnded,
  runHasExams,
  runProgress,
  shortName,
  undoDeadline,
} from "../../src/core/derive";
import { replay } from "../../src/core/replay";
import { Q2, T0, at, ev } from "./fixtures";

const R = Q2.run;
const min = (m: number) => new Date(T0 + m * 60_000);

test("percent floors and handles empty", () => {
  expect(percent(0, 0)).toBeNull();
  expect(percent(199, 200)).toBe(99);
  expect(percent(2, 2)).toBe(100);
  expect(percent(1, 3)).toBe(33);
});

test("progress objective counts once; silver and sat both count; undone excluded", () => {
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b", "c"] });
  const l1 = ev.objective(R, "C1", "lecture", 1, at(2));
  const l2 = ev.objective(R, "C1", "lecture", 2, at(2));
  const ex = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const s = replay([
    ev.created(),
    ev.course(R, "C1"),
    p, l1, l2, ex,
    ev.step(p.obj, 0, at(3)),
    ev.completed(l1.obj, "silver", at(3)),
    ev.objectiveUndone(l2.obj, at(4)),
    ev.completed(ex.obj, "sat", "2027-01-28T10:00:00.000Z"),
  ]);
  expect(courseProgress(s, R, "C1")).toEqual({ done: 2, total: 3, pct: 66 });
});

test("course with no objectives has null pct", () => {
  const s = replay([ev.created(), ev.course(R, "C1")]);
  expect(courseProgress(s, R, "C1")).toEqual({ done: 0, total: 0, pct: null });
});

test("run % is over all objectives, not an average of courses", () => {
  const a = ev.objective(R, "A", "lecture", 1);
  const s = replay([
    ev.created(),
    ev.course(R, "A"),
    ev.course(R, "B"),
    a,
    ev.objective(R, "B", "lecture", 1),
    ev.objective(R, "B", "lecture", 2),
    ev.objective(R, "B", "lecture", 3),
    ev.completed(a.obj, "silver", at(3)),
  ]);
  expect(runProgress(s, R)).toEqual({ done: 1, total: 4, pct: 25 });
});

test("isResit true only when an earlier run has the code", () => {
  const s = replay([
    ev.created("2026-27 Q1", "2026-09-01", "2026-11-07"),
    ev.course("2026-27-Q1", "C1"),
    ev.created(),
    ev.course(R, "C1"),
    ev.course(R, "C2"),
  ]);
  expect(isResit(s, R, "C1")).toBe(true);
  expect(isResit(s, R, "C2")).toBe(false);
  expect(isResit(s, "2026-27-Q1", "C1")).toBe(false);
});

test("currentRun: containing, else next upcoming, else latest past, else null", () => {
  expect(currentRun(replay([]), "2026-11-16")).toBeNull();
  const s = replay([
    ev.created("P1", "2026-01-01", "2026-02-01"),
    ev.created("P2", "2026-03-01", "2026-04-01"),
    ev.created("U1", "2027-03-01", "2027-04-01"),
    ev.created("U2", "2027-05-01", "2027-06-01"),
  ]);
  expect(currentRun(s, "2026-03-15")!.id).toBe("P2");
  expect(currentRun(s, "2026-11-16")!.id).toBe("U1");
  expect(currentRun(s, "2027-12-01")!.id).toBe("U2");
});

describe("overlapping runs", () => {
  const career = () => ev.created("Career", "2026-09-01", "2027-07-15");

  test("currentRun prefers the containing run that ends soonest", () => {
    expect(currentRun(replay([career(), ev.created()]), "2026-11-16")!.id).toBe(R);
    expect(currentRun(replay([ev.created(), career()]), "2026-11-16")!.id).toBe(R);
  });

  test("openRuns lists runs that aren't closed, by start then name", () => {
    const s = replay([
      ev.created("Old", "2026-10-01", "2026-10-15", at(-60)),
      ev.closed("Old", 0, 0, 0, at(-1)),
      ev.created(),
      ev.created("B side", "2026-11-09", "2026-12-20"),
      career(),
    ]);
    expect(openRuns(s).map((r) => r.id)).toEqual(["Career", "2026-27-Q2", "B-side"]);
  });

  test("chosenRun uses the remembered open run, else falls back to currentRun", () => {
    const s = replay([
      ev.created("Old", "2026-10-01", "2026-10-15", at(-60)),
      ev.closed("Old", 0, 0, 0, at(-1)),
      ev.created(),
      career(),
    ]);
    expect(chosenRun(s, "Career", "2026-11-16")!.id).toBe("Career");
    for (const remembered of ["Old", "nope", undefined]) expect(chosenRun(s, remembered, "2026-11-16")!.id).toBe(R);
  });
});

test("runHasExams turns true once an exam is added", () => {
  const h = [ev.created(), ev.course(R, "C1"), ev.objective(R, "C1", "lecture", 1)];
  expect(runHasExams(replay(h), R)).toBe(false);
  expect(runHasExams(replay([...h, ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" })]), R)).toBe(true);
});

test("runEnded is strict after end", () => {
  const r = replay([ev.created()]).runs.get(R)!;
  expect(runEnded(r, "2027-01-30")).toBe(false);
  expect(runEnded(r, "2027-01-31")).toBe(true);
});

test("shortName", () => {
  const s = replay([ev.created()]);
  expect(shortName(s.runs.get(R)!)).toBe("Q2");
});

test("courseObjectives in add order", () => {
  const a = ev.objective(R, "C1", "lecture", 1, at(2));
  const b = ev.objective(R, "C1", "assignment", 1, at(3), { date: "2026-12-01" });
  const s = replay([ev.created(), ev.course(R, "C1"), ev.course(R, "C2"), a, ev.objective(R, "C2", "lecture", 1, at(2)), b]);
  expect(courseObjectives(s, R, "C1").map((o) => o.id)).toEqual([a.obj, b.obj]);
});

test("homeRows ordering, overdue, soon, exams not clickable", () => {
  const asgLate = ev.objective(R, "C2", "assignment", 1, at(2), { date: "2026-12-10" });
  const asgOver = ev.objective(R, "C1", "assignment", 1, at(3), { date: "2026-11-20" });
  const asgSoon = ev.objective(R, "C1", "assignment", 2, at(4), { date: "2026-11-24" });
  const exam = ev.objective(R, "C1", "exam", 1, at(5), { date: "2027-01-27" });
  const c2lec = ev.objective(R, "C2", "lecture", 1, at(6));
  const c1lec = ev.objective(R, "C1", "lecture", 1, at(7));
  const c1done = ev.objective(R, "C1", "lecture", 2, at(8));
  const s = replay([
    ev.created(),
    ev.course(R, "C1", at(1)),
    ev.course(R, "C2", at(1)),
    asgLate, asgOver, asgSoon, exam, c2lec, c1lec, c1done,
    ev.completed(c1done.obj, "silver", at(9)),
  ]);
  const rows = homeRows(s, R, "2026-11-22");
  expect(rows.dated.map((r) => r.obj.id)).toEqual([asgOver.obj, asgSoon.obj, asgLate.obj, exam.obj]);
  expect(rows.dated.map((r) => [r.overdue, r.soon, r.clickable])).toEqual([
    [true, false, true],
    [false, true, true],
    [false, false, true],
    [false, false, false],
  ]);
  expect(rows.anytime.map((r) => r.obj.id)).toEqual([c1lec.obj, c2lec.obj]);
});

test("undo availability", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = replay([ev.created(), ev.course(R, "C1", at(1)), l]);
  const o = s.objectives.get(l.obj)!;
  expect(undoDeadline(o.addedAt)).toEqual(min(32));
  expect(canUndoObjective(o, min(31))).toBe(true);
  expect(canUndoObjective(o, min(33))).toBe(false);
  expect(canUndoCourse(s, R, "C1", min(30))).toBe(true);
  expect(canUndoCourse(s, R, "C1", min(32))).toBe(false);
  expect(canCorrectRun(s.runs.get(R)!, min(30))).toBe(true);
  expect(canCorrectRun(s.runs.get(R)!, min(31))).toBe(false);
  const done = replay([ev.created(), ev.course(R, "C1", at(1)), l, ev.completed(l.obj, "silver", at(3))]);
  expect(canUndoObjective(done.objectives.get(l.obj)!, min(4))).toBe(false);
  expect(canUndoCourse(done, R, "C1", min(4))).toBe(false);
});

test("examsDueForSat uses strict date < today", () => {
  const ex = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const s = replay([ev.created(), ev.course(R, "C1"), ex]);
  expect(examsDueForSat(s, "2027-01-27")).toEqual([]);
  expect(examsDueForSat(s, "2027-01-28").map((o) => o.id)).toEqual([ex.obj]);
  const sat = replay([ev.created(), ev.course(R, "C1"), ex, ev.completed(ex.obj, "sat", "2027-01-28T10:00:00.000Z")]);
  expect(examsDueForSat(sat, "2027-01-29")).toEqual([]);
});

test("examsDueForSat skips closed runs", () => {
  const ex = ev.objective(Q2.run, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const s = replay([ev.created(), ev.course(Q2.run, "C1"), ex, ev.closed(Q2.run, 0, 1, 0, "2027-01-31T08:00:00.000Z")]);
  expect(s.runs.get(Q2.run)!.closed).toBeDefined();
  expect(examsDueForSat(s, "2027-02-01")).toEqual([]);
});
