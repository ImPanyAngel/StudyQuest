import { planAction, planAutoSat, type Action } from "../../src/core/actions";
import { createIdFactory, type QuestEvent } from "../../src/core/events";
import { replay } from "../../src/core/replay";
import { Q2, T0, at, ev } from "./fixtures";

const R = Q2.run;
const min = (m: number) => new Date(T0 + m * 60_000);
const ids = createIdFactory();

/** Plan an action and return the history with the new events appended. */
function run(history: QuestEvent[], a: Action, now: Date): { history: QuestEvent[]; events: QuestEvent[]; error?: string } {
  const r = planAction(replay(history), a, now, ids);
  if (!r.ok) return { history, events: [], error: r.error };
  return { history: [...history, ...r.value], events: r.value };
}

const base = (): QuestEvent[] => [ev.created(), ev.course(R, "C1", at(1))];

test("createRun derives id, trims, and rejects overlap", () => {
  const r = run([], { type: "createRun", name: " 2026-27 Q2 ", start: Q2.start, end: Q2.end }, min(0));
  expect(r.events).toMatchObject([{ type: "quarter_created", run: R, name: "2026-27 Q2", t: min(0).toISOString() }]);
  const o = run(r.history, { type: "createRun", name: "Overlap", start: "2026-12-01", end: "2027-02-01" }, min(1));
  expect(o.error).toEqual(expect.any(String));
});

test("addCourse trims fields", () => {
  const r = run([ev.created()], { type: "addCourse", run: R, code: " DSAIT4000 ", name: " ML ", folder: " DSAIT4000/ " }, min(1));
  expect(r.events).toMatchObject([{ type: "course_added", course: "DSAIT4000", name: "ML", folder: "DSAIT4000/" }]);
});

test("addObjective numbers per course+kind and never reuses after undo", () => {
  let h = base();
  const add = (m: number) => run(h, { type: "addObjective", run: R, course: "C1", kind: "lecture", title: "L" }, min(m));
  let r = add(2); h = r.history;
  expect(r.events[0]).toMatchObject({ obj: `${R}/C1-LEC01` });
  r = add(3); h = r.history;
  expect(r.events[0]).toMatchObject({ obj: `${R}/C1-LEC02` });
  r = run(h, { type: "undoObjective", obj: `${R}/C1-LEC02` }, min(4)); h = r.history;
  r = add(5);
  expect(r.events[0]).toMatchObject({ obj: `${R}/C1-LEC03` });
  const asg = run(h, { type: "addObjective", run: R, course: "C1", kind: "assignment", title: "A", date: "2026-12-01" }, min(5));
  expect(asg.events[0]).toMatchObject({ obj: `${R}/C1-ASG01`, date: "2026-12-01" });
});

test("bulk add Lecture 1..14 yields 14 events with titles and ids", () => {
  const r = run(base(), { type: "bulkAddObjectives", run: R, course: "C1", kind: "lecture", prefix: " Lecture ", from: 1, to: 14 }, min(2));
  expect(r.events).toHaveLength(14);
  expect(r.events[0]).toMatchObject({ obj: `${R}/C1-LEC01`, title: "Lecture 1" });
  expect(r.events[13]).toMatchObject({ obj: `${R}/C1-LEC14`, title: "Lecture 14" });
  expect(replay(r.history).objectives.size).toBe(14);
});

test("bulk add rejects progress, from > to, from < 1, and ranges over 50", () => {
  const b = (kind: "progress" | "lecture", from: number, to: number) =>
    run(base(), { type: "bulkAddObjectives", run: R, course: "C1", kind, prefix: "X", from, to }, min(2)).error;
  expect(b("progress", 1, 3)).toEqual(expect.any(String));
  expect(b("lecture", 3, 1)).toEqual(expect.any(String));
  expect(b("lecture", 0, 3)).toEqual(expect.any(String));
  expect(b("lecture", 1, 51)).toEqual(expect.any(String));
  expect(b("lecture", 1, 50)).toBeUndefined();
});

test("adds and self checks refused after run end", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const h = [...base(), l];
  const after = new Date("2027-01-31T10:00:00.000Z");
  expect(run(h, { type: "addCourse", run: R, code: "C2", name: "n", folder: "f" }, after).error).toEqual(expect.any(String));
  expect(run(h, { type: "addObjective", run: R, course: "C1", kind: "lecture", title: "x" }, after).error).toEqual(expect.any(String));
  expect(run(h, { type: "selfCheck", obj: l.obj }, after).error).toEqual(expect.any(String));
  expect(run(h, { type: "selfCheck", obj: l.obj }, new Date("2027-01-30T20:00:00.000Z")).error).toBeUndefined();
});

test("self check on a lecture writes silver", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const r = run([...base(), l], { type: "selfCheck", obj: l.obj }, min(40));
  expect(r.events).toMatchObject([{ type: "objective_completed", obj: l.obj, tier: "silver" }]);
});

test("self check on exam or progress is refused", () => {
  const ex = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-27" });
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  const h = [...base(), ex, p];
  expect(run(h, { type: "selfCheck", obj: ex.obj }, min(40)).error).toEqual(expect.any(String));
  expect(run(h, { type: "selfCheck", obj: p.obj }, min(40)).error).toEqual(expect.any(String));
});

test("last step yields step + silver, and replaying them completes the objective", () => {
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  let r = run([...base(), p], { type: "checkStep", obj: p.obj, step: 0 }, min(40));
  expect(r.events.map((e) => e.type)).toEqual(["step_completed"]);
  r = run(r.history, { type: "checkStep", obj: p.obj, step: 1 }, min(41));
  expect(r.events.map((e) => e.type)).toEqual(["step_completed", "objective_completed"]);
  expect(r.events[0].t).toBe(r.events[1].t);
  // Same t: order must come from the ids, and survive a shuffled replay.
  expect(replay([...r.history].reverse()).objectives.get(p.obj)!.completed).toMatchObject({ tier: "silver" });
});

test("undo at 31 min is refused with a reason", () => {
  const l = ev.objective(R, "C1", "lecture", 1, at(2));
  const h = [...base(), l];
  expect(run(h, { type: "undoObjective", obj: l.obj }, min(33)).error).toMatch(/undo/i);
  expect(run(h, { type: "undoCourse", run: R, code: "C1" }, min(32)).error).toEqual(expect.any(String));
  expect(run(h, { type: "correctRunDates", run: R, start: Q2.start, end: "2027-01-29" }, min(31)).error).toEqual(expect.any(String));
});

test("planAutoSat emits sat only for exams whose date < today", () => {
  const ex1 = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-24" });
  const ex2 = ev.objective(R, "C1", "exam", 2, at(2), { date: "2027-01-27" });
  const s = replay([...base(), ex1, ex2]);
  const out = planAutoSat(s, new Date("2027-01-27T12:00:00.000Z"), ids);
  expect(out).toMatchObject([{ type: "objective_completed", obj: ex1.obj, tier: "sat" }]);
  expect(planAutoSat(s, new Date("2027-01-23T12:00:00.000Z"), ids)).toEqual([]);
});

test("bulk add with a blank prefix uses the type's own name", () => {
  const r = run(base(), { type: "bulkAddObjectives", run: R, course: "C1", kind: "lab", prefix: "  ", from: 1, to: 2 }, min(2));
  expect(r.events.map((e) => (e as { title: string }).title)).toEqual(["Lab 1", "Lab 2"]);
});
