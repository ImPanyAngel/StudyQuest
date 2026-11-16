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

test("rejects overlapping runs", () => {
  const s = replay([ev.created()]);
  expect(applyEvent(s, ev.created("Q3", Q2.end, "2027-04-10"))).toEqual(expect.any(String));
  expect(applyEvent(s, ev.created("Q3", "2027-01-31", "2027-04-10"))).toBeNull();
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
  applyEvent(s, ev.created("Overlap", "2026-12-01", "2027-02-01"));
  expect(JSON.stringify([...s.runs.keys()])).toBe(before);
});
