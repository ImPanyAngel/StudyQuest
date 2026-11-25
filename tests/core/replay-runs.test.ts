import type { QuestEvent } from "../../src/core/events";
import { applyEvent, replay, withinUndoWindow } from "../../src/core/replay";
import { emptyState } from "../../src/core/state";
import { Q2, at, ev } from "./fixtures";

test("creates a run", () => {
  const s = replay([ev.created()]);
  const r = s.runs.get(Q2.run)!;
  expect(r).toMatchObject({ id: Q2.run, name: Q2.name, start: Q2.start, end: Q2.end, createdAt: at(0) });
  expect(r.courses.size).toBe(0);
});

test("rejects run id not matching name", () => {
  const e = { ...ev.created(), run: "something-else" };
  expect(applyEvent(emptyState(), e)).toEqual(expect.any(String));
});

test("rejects a duplicate run id", () => {
  const s = emptyState();
  expect(applyEvent(s, ev.created())).toBeNull();
  expect(applyEvent(s, ev.created(Q2.name, "2027-02-01", "2027-04-01"))).toEqual(expect.any(String));
});

test("rejects end < start + 7 days", () => {
  expect(applyEvent(emptyState(), ev.created("A", "2026-11-09", "2026-11-15"))).toEqual(expect.any(String));
  expect(applyEvent(emptyState(), ev.created("A", "2026-11-09", "2026-11-16"))).toBeNull();
});

test("rejects invalid dates", () => {
  expect(applyEvent(emptyState(), ev.created("A", "2026-11-31", "2027-01-30"))).toEqual(expect.any(String));
});

test("overlapping runs are accepted", () => {
  const s = replay([ev.created(), ev.created("Career", "2026-09-01", "2027-07-15")]);
  expect([...s.runs.keys()].sort()).toEqual(["2026-27-Q2", "Career"]);
  expect(applyEvent(s, ev.created("Q3", Q2.end, "2027-04-10"))).toBeNull();
});

test("withinUndoWindow is inclusive at 30 minutes", () => {
  expect(withinUndoWindow(at(0), at(30))).toBe(true);
  expect(withinUndoWindow(at(0), at(31))).toBe(false);
  expect(withinUndoWindow(at(5), at(4))).toBe(false);
});

test("date correction at 29 min applies, at 31 min is ignored", () => {
  const ok = replay([ev.created(), ev.corrected(Q2.run, "2026-11-10", "2027-01-29", at(29))]);
  expect(ok.runs.get(Q2.run)).toMatchObject({ start: "2026-11-10", end: "2027-01-29" });
  const late = replay([ev.created(), ev.corrected(Q2.run, "2026-11-10", "2027-01-29", at(31))]);
  expect(late.runs.get(Q2.run)).toMatchObject({ start: Q2.start, end: Q2.end });
});

test("course added and undone within window; code can be added again", () => {
  const s = replay([ev.created(), ev.course(Q2.run, "C1", at(1)), ev.courseUndone(Q2.run, "C1", at(20))]);
  expect(s.runs.get(Q2.run)!.courses.size).toBe(0);
  expect(applyEvent(s, ev.course(Q2.run, "C1", at(25)))).toBeNull();
});

test("course undo at 31 min is ignored", () => {
  const s = replay([ev.created(), ev.course(Q2.run, "C1", at(1)), ev.courseUndone(Q2.run, "C1", at(32))]);
  expect(s.runs.get(Q2.run)!.courses.has("C1")).toBe(true);
});

test("rejects duplicate active course code and bad codes", () => {
  const s = replay([ev.created(), ev.course(Q2.run, "C1")]);
  expect(applyEvent(s, ev.course(Q2.run, "C1"))).toEqual(expect.any(String));
  expect(applyEvent(s, ev.course(Q2.run, "C-1"))).toEqual(expect.any(String));
  expect(applyEvent(s, ev.course("nope", "C2"))).toEqual(expect.any(String));
});

test("replay dedupes duplicate lines", () => {
  const created = ev.created();
  const e = ev.course(Q2.run, "C1");
  const s = replay([created, e, e, { ...e }]);
  expect([...s.runs.get(Q2.run)!.courses.keys()]).toEqual(["C1"]);
});

test("replay orders by t regardless of input order", () => {
  const created = ev.created();
  const course = ev.course(Q2.run, "C1", at(1));
  const s = replay([course, created]);
  expect(s.runs.get(Q2.run)!.courses.has("C1")).toBe(true);
});

test("rejected events leave state untouched", () => {
  const s = replay([ev.created()]);
  const before = JSON.stringify([...s.runs.keys()]);
  expect(applyEvent(s, ev.created("Short", "2026-12-01", "2026-12-03"))).toEqual(expect.any(String));
  expect(JSON.stringify([...s.runs.keys()])).toBe(before);
});

test("replay never throws on a malformed event", () => {
  const bad = { id: "e_bad", t: at(5), type: "quarter_created" } as unknown as QuestEvent;
  expect(() => replay([ev.created(), bad])).not.toThrow();
  expect(replay([ev.created(), bad]).runs.size).toBe(1);
});

describe("runs with no end date", () => {
  test("creates a run with no end", () => {
    const r = replay([ev.createdOpen()]).runs.get(Q2.run)!;
    expect(r.end).toBeUndefined();
    expect("end" in r).toBe(false);
    expect(r.datesSetAt).toBe(at(0));
  });

  test("a run with no end still needs a valid start", () => {
    expect(applyEvent(emptyState(), ev.createdOpen("A", "2026-11-31"))).toEqual(expect.any(String));
  });

  test("no-end run dates stay editable for days", () => {
    const s = replay([ev.createdOpen(), ev.correctedOpen(Q2.run, "2026-11-10", at(60 * 24 * 5))]);
    expect(s.runs.get(Q2.run)!.start).toBe("2026-11-10");
  });

  test("setting the end later starts the 30-minute window then", () => {
    const s = replay([ev.createdOpen(), ev.corrected(Q2.run, Q2.start, Q2.end, at(600))]);
    const r = s.runs.get(Q2.run)!;
    expect(r.end).toBe(Q2.end);
    expect(r.datesSetAt).toBe(at(600));
    expect(applyEvent(s, ev.corrected(Q2.run, "2026-11-10", Q2.end, at(629)))).toBeNull();
    expect(applyEvent(s, ev.corrected(Q2.run, "2026-11-11", Q2.end, at(631)))).toBe("The run's dates are locked.");
  });

  test("blanking the end within the window is allowed", () => {
    const r = replay([ev.created(), ev.correctedOpen(Q2.run, Q2.start, at(10))]).runs.get(Q2.run)!;
    expect(r.end).toBeUndefined();
    expect("end" in r).toBe(false);
  });

  test("blanking the end is refused when the run has exams", () => {
    const s = replay([ev.created(), ev.course(Q2.run, "C1", at(1)), ev.objective(Q2.run, "C1", "exam", 1, at(2), { date: "2027-01-25" })]);
    expect(applyEvent(s, ev.correctedOpen(Q2.run, Q2.start, at(10)))).toEqual(expect.any(String));
    expect(s.runs.get(Q2.run)!.end).toBe(Q2.end);
  });

  test("a no-end run never closes", () => {
    const s = replay([ev.createdOpen()]);
    const close: QuestEvent = { id: "e_close", t: "2030-01-01T12:00:00.000Z", type: "quarter_closed", run: Q2.run, done: 0, total: 0, tier: 0 };
    expect(applyEvent(s, close)).toBe("The run hasn't ended yet.");
  });

  test("a run with an end records datesSetAt at creation", () => {
    expect(replay([ev.created()]).runs.get(Q2.run)!.datesSetAt).toBe(at(0));
  });
});
