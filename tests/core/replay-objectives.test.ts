import { applyEvent, replay } from "../../src/core/replay";
import type { QuestEvent } from "../../src/core/events";
import { Q2, at, ev } from "./fixtures";

const R = Q2.run;
const base = () => [ev.created(), ev.course(R, "C1", at(1))];
const state = (...extra: QuestEvent[]) => replay([...base(), ...extra]);
const rejected = expect.any(String);

test("adds a lecture with no date; rejects a lecture with a date", () => {
  const l = ev.objective(R, "C1", "lecture", 1);
  expect(state(l).objectives.get(l.obj)).toMatchObject({ kind: "lecture", title: "lecture 1", stepsDone: [], addedAt: at(2) });
  expect(applyEvent(state(), ev.objective(R, "C1", "lecture", 2, at(2), { date: "2026-12-01" }))).toEqual(rejected);
});

test("assignment requires a date inside the run", () => {
  const s = state();
  expect(applyEvent(s, ev.objective(R, "C1", "assignment", 1))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "C1", "assignment", 2, at(2), { date: "2027-01-31" }))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "C1", "assignment", 3, at(2), { date: "2027-01-30" }))).toBeNull();
});

test("exam date must be in exam week", () => {
  const s = state();
  expect(applyEvent(s, ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-22" }))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "C1", "exam", 2, at(2), { date: "2027-01-23" }))).toBeNull();
});

test("progress needs at least 2 non-empty steps", () => {
  const s = state();
  expect(applyEvent(s, ev.objective(R, "C1", "progress", 1, at(2), { steps: ["Ch 1"] }))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "C1", "progress", 2, at(2), { steps: ["Ch 1", " "] }))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "C1", "progress", 3, at(2), { steps: ["Ch 1", "Ch 2"] }))).toBeNull();
  expect(s.objectives.get(`${R}/C1-PRG03`)!.stepsDone).toEqual([false, false]);
});

test("rejects empty title, unknown course and wrong id prefix", () => {
  const s = state();
  expect(applyEvent(s, ev.objective(R, "C1", "lecture", 1, at(2), { title: "  " }))).toEqual(rejected);
  expect(applyEvent(s, ev.objective(R, "NOPE", "lecture", 1))).toEqual(rejected);
  expect(applyEvent(s, { ...ev.objective(R, "C1", "lecture", 1), obj: "other/C1-LEC01" })).toEqual(rejected);
});

test("ids are never reused: undone id cannot be re-added", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(l, ev.objectiveUndone(l.obj, at(5)));
  expect(s.objectives.has(l.obj)).toBe(false);
  expect(applyEvent(s, ev.objective(R, "C1", "lecture", 1, at(6)))).toEqual(rejected);
});

test("undo at 29 min applies, at 31 min ignored", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  expect(state(l, ev.objectiveUndone(l.obj, at(31))).objectives.has(l.obj)).toBe(false);
  expect(state(l, ev.objectiveUndone(l.obj, at(33))).objectives.has(l.obj)).toBe(true);
});

test("undo blocked after silver", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(l, ev.completed(l.obj, "silver", at(3)));
  expect(applyEvent(s, ev.objectiveUndone(l.obj, at(4)))).toEqual(rejected);
});

test("undo blocked after one progress step", () => {
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  const s = state(p, ev.step(p.obj, 0, at(3)));
  expect(applyEvent(s, ev.objectiveUndone(p.obj, at(4)))).toEqual(rejected);
});

test("course undo blocked once an objective in it is completed", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(l, ev.completed(l.obj, "silver", at(3)));
  expect(applyEvent(s, ev.courseUndone(R, "C1", at(4)))).toEqual(rejected);
});

test("silver on exam rejected; sat on lecture rejected; gold rejected", () => {
  const ex = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(ex, l);
  expect(applyEvent(s, ev.completed(ex.obj, "silver", "2027-01-29T10:00:00.000Z"))).toEqual(rejected);
  expect(applyEvent(s, ev.completed(l.obj, "sat", at(3)))).toEqual(rejected);
  expect(applyEvent(s, { ...ev.completed(l.obj, "silver", at(3)), tier: "gold" } as unknown as QuestEvent)).toEqual(rejected);
});

test("sat rejected on the exam day itself (local), accepted the next local day", () => {
  const ex = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const s = state(ex);
  expect(applyEvent(s, ev.completed(ex.obj, "sat", "2027-01-27T22:30:00.000Z"))).toEqual(rejected);
  expect(applyEvent(s, ev.completed(ex.obj, "sat", "2027-01-27T23:00:30.000Z"))).toBeNull();
  expect(s.objectives.get(ex.obj)!.completed).toEqual({ tier: "sat", at: "2027-01-27T23:00:30.000Z" });
});

test("progress: completion rejected until all steps done; accepted after", () => {
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  const s = state(p, ev.step(p.obj, 0, at(3)));
  expect(applyEvent(s, ev.completed(p.obj, "silver", at(4)))).toEqual(rejected);
  expect(applyEvent(s, ev.step(p.obj, 1, at(5)))).toBeNull();
  expect(applyEvent(s, ev.completed(p.obj, "silver", at(5)))).toBeNull();
});

test("step out of range or repeated is rejected; steps only on progress", () => {
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(p, l, ev.step(p.obj, 0, at(3)));
  expect(applyEvent(s, ev.step(p.obj, 0, at(4)))).toEqual(rejected);
  expect(applyEvent(s, ev.step(p.obj, 2, at(4)))).toEqual(rejected);
  expect(applyEvent(s, ev.step(p.obj, -1, at(4)))).toEqual(rejected);
  expect(applyEvent(s, ev.step(l.obj, 0, at(4)))).toEqual(rejected);
});

test("completing twice is rejected", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(l, ev.completed(l.obj, "silver", at(3)));
  expect(applyEvent(s, ev.completed(l.obj, "silver", at(4)))).toEqual(rejected);
});

test("completing an undone objective is rejected", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const s = state(l, ev.objectiveUndone(l.obj, at(3)));
  expect(applyEvent(s, ev.completed(l.obj, "silver", at(4)))).toEqual(rejected);
});

test("date correction refused if an exam would leave exam week", () => {
  const s = replay([
    ev.created(),
    ev.course(Q2.run, "C1"),
    ev.objective(Q2.run, "C1", "exam", 1, at(2), { date: "2027-01-24" }),
  ]);
  // New end 2027-02-06 → exam week 30 Jan – 6 Feb; 24 Jan falls out.
  expect(applyEvent(s, ev.corrected(Q2.run, Q2.start, "2027-02-06", at(10)))).toEqual(expect.any(String));
  expect(applyEvent(s, ev.corrected(Q2.run, Q2.start, "2027-01-29", at(10)))).toBeNull();
});

test("date correction refused if an assignment would fall outside the run", () => {
  const s = replay([
    ev.created(),
    ev.course(Q2.run, "C1"),
    ev.objective(Q2.run, "C1", "assignment", 1, at(2), { date: "2026-11-10" }),
  ]);
  expect(applyEvent(s, ev.corrected(Q2.run, "2026-11-11", Q2.end, at(10)))).toEqual(expect.any(String));
});

test("course undo removes its objectives but keeps their ids reserved", () => {
  const o = ev.objective(Q2.run, "C1", "lecture", 1, at(2));
  const s = replay([ev.created(), ev.course(Q2.run, "C1", at(1)), o, ev.courseUndone(Q2.run, "C1", at(20))]);
  expect(s.objectives.size).toBe(0);
  expect(s.everObjectiveIds.has(o.obj)).toBe(true);
});

