import { planAction, planDailyCheck } from "../../src/core/actions";
import { hallRuns, isClosed, runScore, runsDueToClose, stains, unseenPrestige } from "../../src/core/derive";
import { createIdFactory, type QuestEvent } from "../../src/core/events";
import { replay } from "../../src/core/replay";
import { Q2, at, ev } from "./fixtures";

const R = Q2.run;
const ids = createIdFactory();
const DAY31 = new Date("2027-01-31T08:00:00.000Z");

/** Q2 with an exam on the last day and two lectures, one done. */
function q2(): { log: QuestEvent[]; l2: string } {
  const l1 = ev.objective(R, "C1", "lecture", 1);
  const l2 = ev.objective(R, "C1", "lecture", 2);
  const exam = ev.objective(R, "C1", "exam", 1, at(2), { date: "2027-01-30" });
  return { log: [ev.created(), ev.course(R, "C1"), l1, l2, exam, ev.completed(l1.obj, "silver", at(3))], l2: l2.obj };
}

test("planDailyCheck sats the last-day exam before closing, and the close counts it", () => {
  const { log } = q2();
  const events = planDailyCheck(replay(log), DAY31, ids);
  expect(events.map((e) => e.type)).toEqual(["objective_completed", "quarter_closed"]);
  expect(events[1]).toMatchObject({ run: R, done: 2, total: 3, tier: 0 });
  const s = replay([...log, ...events]);
  expect(runScore(s, R)).toEqual({ done: 2, total: 3, pct: 66, tier: 0 });
});

test("planDailyCheck does nothing on the end date itself (Amsterdam)", () => {
  expect(planDailyCheck(replay(q2().log), new Date("2027-01-30T22:00:00.000Z"), ids)).toEqual([]);
});

test("planDailyCheck closes several runs, oldest end first, and skips closed ones", () => {
  const a = ev.created("A", "2026-09-01", "2026-09-30", at(0));
  const b = ev.created("B", "2026-08-01", "2026-08-31", at(0));
  const c = ev.created("C", "2026-07-01", "2026-07-31", at(0));
  const s = replay([a, b, c, ev.closed("C", 0, 0, 0, at(1))]);
  const events = planDailyCheck(s, new Date(at(2)), ids);
  expect(events.map((e) => ("run" in e ? e.run : ""))).toEqual(["B", "A"]);
  expect(events[0]).toMatchObject({ type: "quarter_closed", done: 0, total: 0, tier: 0 });
});

test("runScore is live and tierless before close, frozen after", () => {
  const { log } = q2();
  expect(runScore(replay(log), R)).toEqual({ done: 1, total: 3, pct: 33, tier: null });
  // Stored counts win over the objectives, and tier comes from the event.
  expect(runScore(replay([...log, ev.closed(R, 3, 3, 5, DAY31.toISOString())]), R)).toEqual({ done: 3, total: 3, pct: 100, tier: 5 });
  expect(runScore(replay([...log, ev.closed(R, 0, 0, 0, DAY31.toISOString())]), R).pct).toBeNull();
});

test("stains are the open objectives of a closed run only", () => {
  const { log, l2 } = q2();
  expect(stains(replay(log), R)).toEqual([]);
  const s = replay([...log, ...planDailyCheck(replay(log), DAY31, ids)]);
  expect(isClosed(s.runs.get(R)!)).toBe(true);
  expect(stains(s, R).map((o) => o.id)).toEqual([l2]);
});

test("runsDueToClose and unseenPrestige order by end date", () => {
  const a = ev.created("A", "2026-09-01", "2026-09-30", at(0));
  const b = ev.created("B", "2026-08-01", "2026-08-31", at(0));
  const s = replay([a, b]);
  expect(runsDueToClose(s, "2026-10-01").map((r) => r.id)).toEqual(["B", "A"]);
  expect(runsDueToClose(s, "2026-09-30").map((r) => r.id)).toEqual(["B"]);
  const closed = replay([a, b, ev.closed("A", 0, 0, 0, at(1)), ev.closed("B", 0, 0, 0, at(1)), ev.seen("B", at(2))]);
  expect(unseenPrestige(closed).map((r) => r.id)).toEqual(["A"]);
});

test("hallRuns: unclosed by start ascending, closed by end descending", () => {
  const log = [
    ev.created("Old1", "2026-07-01", "2026-07-31", at(0)),
    ev.created("Old2", "2026-08-01", "2026-08-31", at(0)),
    ev.created("Later", "2027-02-08", "2027-04-17", at(0)),
    ev.created(),
    ev.closed("Old1", 0, 0, 0, at(1)),
    ev.closed("Old2", 0, 0, 0, at(1)),
  ];
  const h = hallRuns(replay(log));
  expect(h.open.map((r) => r.id)).toEqual([R, "Later"]);
  expect(h.closed.map((r) => r.id)).toEqual(["Old2", "Old1"]);
});

test("acknowledgePrestige needs a closed run", () => {
  const { log } = q2();
  expect(planAction(replay(log), { type: "acknowledgePrestige", run: R }, DAY31, ids).ok).toBe(false);
  const closed = replay([...log, ev.closed(R, 1, 3, 0, DAY31.toISOString())]);
  const r = planAction(closed, { type: "acknowledgePrestige", run: R }, DAY31, ids);
  expect(r.ok && r.value).toMatchObject([{ type: "prestige_seen", run: R }]);
});

test("self check on a closed run's objective is refused as closed", () => {
  const { log, l2 } = q2();
  const closed = replay([...log, ev.closed(R, 1, 3, 0, DAY31.toISOString())]);
  const r = planAction(closed, { type: "selfCheck", obj: l2 }, DAY31, ids);
  expect(r).toEqual({ ok: false, error: "This run is closed." });
});

describe("runs with no end date", () => {
  test("runsDueToClose skips a no-end run", () => {
    expect(runsDueToClose(replay([ev.createdOpen(), ev.created("Old", "2026-01-01", "2026-02-01")]), "2030-01-01").map((r) => r.id)).toEqual(["Old"]);
  });

  test("planDailyCheck never closes a no-end run", () => {
    expect(planDailyCheck(replay([ev.createdOpen()]), new Date("2030-01-01T08:00:00.000Z"), ids)).toEqual([]);
  });

  test("hallRuns and unseenPrestige sort no-end runs without throwing", () => {
    const s = replay([ev.createdOpen("Open", "2026-01-01"), ev.created("Old", "2026-01-01", "2026-02-01", at(-60)), ev.closed("Old", 0, 0, 0, at(0))]);
    expect(hallRuns(s).open.map((r) => r.id)).toEqual(["Open"]);
    expect(unseenPrestige(s).map((r) => r.id)).toEqual(["Old"]);
  });
});
