import { dropAfterClose } from "../../src/core/log-format";
import { replay } from "../../src/core/replay";
import { Q2, at, ev } from "./fixtures";

const R = Q2.run;
const DAY31 = "2027-01-31T08:00:00.000Z";

function base() {
  const created = ev.created();
  const course = ev.course(R, "C1");
  const l1 = ev.objective(R, "C1", "lecture", 1);
  const l2 = ev.objective(R, "C1", "lecture", 2);
  const done = ev.completed(l1.obj, "silver", at(3));
  return { events: [created, course, l1, l2, done], l1, l2 };
}

test("close is applied only once the Amsterdam date is after the end date", () => {
  const { events } = base();
  expect(replay([...events, ev.closed(R, 1, 2, 0, "2027-01-30T22:59:00.000Z")]).runs.get(R)!.closed).toBeUndefined();
  expect(replay([...events, ev.closed(R, 1, 2, 0, "2027-01-30T23:00:00.000Z")]).runs.get(R)!.closed).toEqual({
    done: 1,
    total: 2,
    tier: 0,
    at: "2027-01-30T23:00:00.000Z",
  });
});

test("close with impossible counts or tier is ignored", () => {
  const { events } = base();
  for (const bad of [ev.closed(R, 3, 2, 0, DAY31), ev.closed(R, -1, 2, 0, DAY31), ev.closed(R, 1, 2, 6, DAY31), ev.closed(R, 1, 2, 2.5, DAY31), ev.closed(R, 1.5, 2, 0, DAY31)]) {
    expect(replay([...events, bad]).runs.get(R)!.closed).toBeUndefined();
  }
});

test("close for an unknown run is ignored", () => {
  const { events } = base();
  const s = replay([...events, ev.closed("Nope", 0, 0, 0, DAY31)]);
  expect(s.runs.get(R)!.closed).toBeUndefined();
});

test("the first close is final: no recount, second close ignored", () => {
  const { events } = base();
  const s = replay([...events, ev.closed(R, 2, 2, 5, DAY31), ev.closed(R, 1, 2, 0, "2027-02-01T08:00:00.000Z")]);
  expect(s.runs.get(R)!.closed).toMatchObject({ done: 2, total: 2, tier: 5 });
});

test("after close, events touching the run are ignored; other runs still apply", () => {
  const { events, l2 } = base();
  const other = ev.created("2026-27 Q3", "2027-02-08", "2027-04-17", DAY31);
  const s = replay([
    ...events,
    ev.closed(R, 1, 2, 0, DAY31),
    ev.completed(l2.obj, "silver", "2027-01-31T09:00:00.000Z"),
    ev.objective(R, "C1", "lecture", 3, "2027-01-31T09:00:00.000Z"),
    ev.course(R, "C2", "2027-01-31T09:00:00.000Z"),
    other,
    ev.course("2026-27-Q3", "C9", "2027-01-31T09:00:00.000Z"),
  ]);
  expect(s.objectives.get(l2.obj)!.completed).toBeUndefined();
  expect([...s.objectives.keys()].filter((k) => k.startsWith(R))).toHaveLength(2);
  expect(s.runs.get(R)!.courses.has("C2")).toBe(false);
  expect(s.runs.get("2026-27-Q3")!.courses.has("C9")).toBe(true);
});

test("after close, steps and undos on the run are ignored", () => {
  const created = ev.created();
  const course = ev.course(R, "C1");
  const p = ev.objective(R, "C1", "progress", 1, at(2), { steps: ["a", "b"] });
  // A close inside the undo window (a run that ended long ago, created today).
  const old = ev.created("Old", "2026-10-01", "2026-10-15", at(0));
  const oc = ev.course("Old", "C1", at(1));
  const oo = ev.objective("Old", "C1", "lecture", 1, at(2));
  const s = replay([
    created,
    course,
    p,
    old,
    oc,
    oo,
    ev.closed("Old", 0, 1, 0, at(3)),
    ev.objectiveUndone(oo.obj, at(4)),
    ev.courseUndone("Old", "C1", at(4)),
    ev.step(p.obj, 0, at(4)),
  ]);
  expect(s.objectives.has(oo.obj)).toBe(true);
  expect(s.runs.get("Old")!.courses.has("C1")).toBe(true);
  expect(s.objectives.get(p.obj)!.stepsDone).toEqual([true, false]);
});

test("prestige_seen needs a closed run and applies once", () => {
  const { events } = base();
  expect(replay([...events, ev.seen(R, DAY31)]).runs.get(R)!.seenAt).toBeUndefined();
  const closed = [...events, ev.closed(R, 1, 2, 0, DAY31)];
  const s = replay([...closed, ev.seen(R, "2027-01-31T08:05:00.000Z"), ev.seen(R, "2027-01-31T08:06:00.000Z")]);
  expect(s.runs.get(R)!.seenAt).toBe("2027-01-31T08:05:00.000Z");
});

test("dropAfterClose drops a run's lines below its close, whatever their time", () => {
  const { events, l2 } = base();
  const close = ev.closed(R, 1, 2, 0, DAY31);
  const backdated = ev.completed(l2.obj, "silver", at(5));
  const seen = ev.seen(R, "2027-01-31T08:05:00.000Z");
  const otherRun = ev.course("2026-27-Q3", "C9", at(6));
  expect(dropAfterClose([...events, close, backdated, otherRun, seen])).toEqual([...events, close, otherRun, seen]);
});

test("dropAfterClose leaves a file without a close alone", () => {
  const { events } = base();
  expect(dropAfterClose(events)).toEqual(events);
});
