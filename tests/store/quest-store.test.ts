import { QuestStore, joinForAppend, type LogPort } from "../../src/store/quest-store";
import { stains, unseenPrestige } from "../../src/core/derive";
import { Q2 } from "../core/fixtures";

class FakeLog implements LogPort {
  files = new Map<string, string>();
  failNext = false;
  async readAll() {
    return [...this.files.values()];
  }
  async append(runId: string, lines: string[]) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("disk full");
    }
    const text = this.files.get(runId) ?? "";
    this.files.set(runId, text + joinForAppend(text, lines));
  }
  count(type: string) {
    return [...this.files.values()].join("\n").split("\n").filter((l) => l.includes(`"type":"${type}"`)).length;
  }
}

let now = new Date("2026-11-16T10:00:00.000Z");
const clock = () => now;

async function setup() {
  now = new Date("2026-11-16T10:00:00.000Z");
  const log = new FakeLog();
  const store = new QuestStore(log, clock);
  await store.load();
  await store.dispatch({ type: "createRun", name: Q2.name, start: Q2.start, end: Q2.end });
  await store.dispatch({ type: "addCourse", run: Q2.run, code: "C1", name: "Course", folder: "C1/" });
  return { log, store };
}

test("joinForAppend adds a newline when the file lacks one", () => {
  expect(joinForAppend("", ["a"])).toBe("a\n");
  expect(joinForAppend("x\n", ["a", "b"])).toBe("a\nb\n");
  expect(joinForAppend("x", ["a"])).toBe("\na\n");
});

test("dispatch appends to the run's file and updates state", async () => {
  const { log, store } = await setup();
  expect([...log.files.keys()]).toEqual([Q2.run]);
  expect(log.files.get(Q2.run)!.trim().split("\n")).toHaveLength(2);
  expect(store.state.runs.get(Q2.run)!.courses.has("C1")).toBe(true);
});

test("rejected action writes nothing and returns the reason", async () => {
  const { log, store } = await setup();
  const before = log.files.get(Q2.run);
  const r = await store.dispatch({ type: "addCourse", run: Q2.run, code: "C1", name: "dup", folder: "x" });
  expect(r).toEqual({ ok: false, error: expect.any(String) });
  expect(log.files.get(Q2.run)).toBe(before);
});

test("a failed write returns an error and leaves state unchanged", async () => {
  const { log, store } = await setup();
  log.failNext = true;
  const r = await store.dispatch({ type: "addCourse", run: Q2.run, code: "C2", name: "n", folder: "f" });
  expect(r.ok).toBe(false);
  expect(store.state.runs.get(Q2.run)!.courses.has("C2")).toBe(false);
});

test("subscribers are notified after a change", async () => {
  const { store } = await setup();
  let calls = 0;
  const off = store.subscribe(() => calls++);
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "lecture", title: "L1" });
  off();
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "lecture", title: "L2" });
  expect(calls).toBe(1);
});

test("two concurrent selfChecks write exactly one completion", async () => {
  const { log, store } = await setup();
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "lecture", title: "L1" });
  const obj = `${Q2.run}/C1-LEC01`;
  const [a, b] = await Promise.all([store.dispatch({ type: "selfCheck", obj }), store.dispatch({ type: "selfCheck", obj })]);
  expect([a.ok, b.ok].sort()).toEqual([false, true]);
  expect(log.count("objective_completed")).toBe(1);
});

test("load replays existing files; a reloaded store has identical state", async () => {
  const { log, store } = await setup();
  await store.dispatch({ type: "bulkAddObjectives", run: Q2.run, course: "C1", kind: "lecture", prefix: "Lecture", from: 1, to: 3 });
  const again = new QuestStore(log, clock);
  await again.load();
  expect([...again.state.objectives.keys()]).toEqual([...store.state.objectives.keys()]);
  expect(again.state.runs.get(Q2.run)).toEqual(store.state.runs.get(Q2.run));
});

test("runDailyCheck writes sat for passed exams once, and zero on second run", async () => {
  const { log, store } = await setup();
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "exam", title: "Final", date: "2027-01-27" });
  now = new Date("2027-01-27T12:00:00.000Z");
  expect(await store.runDailyCheck()).toBe(0);
  now = new Date("2027-01-28T08:00:00.000Z");
  expect(await store.runDailyCheck()).toBe(1);
  expect(await store.runDailyCheck()).toBe(0);
  expect(log.count("objective_completed")).toBe(1);
  expect(store.state.objectives.get(`${Q2.run}/C1-EXM01`)!.completed?.tier).toBe("sat");
});

test("DayTicker fires once per new local day, including after a long sleep", async () => {
  const { DayTicker } = await import("../../src/store/quest-store");
  let t = new Date("2026-11-16T22:00:00.000Z"); // 23:00 CET
  let calls = 0;
  const ticker = new DayTicker(() => t, () => calls++);
  ticker.check();
  expect(calls).toBe(0);
  t = new Date("2026-11-17T07:00:00.000Z"); // woke up 08:00 next day
  ticker.check();
  ticker.check();
  expect(calls).toBe(1);
});

/** Q2 with an exam on its last day and two lectures, one self-checked. */
async function endedQ2() {
  const { log, store } = await setup();
  await store.dispatch({ type: "bulkAddObjectives", run: Q2.run, course: "C1", kind: "lecture", prefix: "Lecture", from: 1, to: 2 });
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "exam", title: "Final", date: "2027-01-30" });
  await store.dispatch({ type: "selfCheck", obj: `${Q2.run}/C1-LEC01` });
  now = new Date("2027-01-31T08:00:00.000Z");
  return { log, store };
}

test("daily check after the end date writes the last-day sat, then the close counting it", async () => {
  const { log, store } = await endedQ2();
  expect(await store.runDailyCheck()).toBe(2);
  const lines = log.files.get(Q2.run)!.trim().split("\n");
  expect(lines.slice(-2).map((l) => JSON.parse(l).type)).toEqual(["objective_completed", "quarter_closed"]);
  expect(JSON.parse(lines.at(-1)!)).toMatchObject({ done: 2, total: 3, tier: 0 });
  expect(await store.runDailyCheck()).toBe(0);
});

test("after acknowledging, a reload doesn't bring the Prestige Up screen back", async () => {
  const { log, store } = await endedQ2();
  await store.runDailyCheck();
  expect(unseenPrestige(store.state).map((r) => r.id)).toEqual([Q2.run]);
  expect((await store.dispatch({ type: "acknowledgePrestige", run: Q2.run })).ok).toBe(true);
  const again = new QuestStore(log, clock);
  await again.load();
  expect(unseenPrestige(again.state)).toEqual([]);
});

test("a backdated line pasted below the close doesn't change the frozen run", async () => {
  const { log, store } = await endedQ2();
  await store.runDailyCheck();
  const obj = `${Q2.run}/C1-LEC02`;
  const line = JSON.stringify({ id: "e_ZZZZZZZZZZZZZZZZZZZZZZZZZZ", t: "2027-01-31T07:59:00.000Z", type: "objective_completed", obj, tier: "silver" });
  log.files.set(Q2.run, log.files.get(Q2.run)! + line + "\n");
  await store.load();
  expect(store.state.objectives.get(obj)!.completed).toBeUndefined();
  expect(stains(store.state, Q2.run).map((o) => o.id)).toEqual([obj]);
});

test("two concurrent acknowledges write one prestige_seen", async () => {
  const { log, store } = await endedQ2();
  await store.runDailyCheck();
  const a = { type: "acknowledgePrestige" as const, run: Q2.run };
  const [x, y] = await Promise.all([store.dispatch(a), store.dispatch(a)]);
  expect([x.ok, y.ok].sort()).toEqual([false, true]);
  expect(log.count("prestige_seen")).toBe(1);
});

test("an invalid close line doesn't hide later work or bring Prestige Up back", async () => {
  const { log, store } = await setup();
  // A malformed close (done > total) lands in the file before the run has ended.
  const bad = JSON.stringify({ id: "e_00000000000000000000000001", t: "2027-01-31T08:00:00.000Z", type: "quarter_closed", run: Q2.run, done: 9, total: 1, tier: 0 });
  log.files.set(Q2.run, log.files.get(Q2.run)! + bad + "\n");
  await store.load();
  await store.dispatch({ type: "addCourse", run: Q2.run, code: "C2", name: "Course 2", folder: "C2/" });
  await store.load();
  expect(store.state.runs.get(Q2.run)!.courses.has("C2")).toBe(true);

  now = new Date("2027-01-31T10:00:00.000Z");
  expect(await store.runDailyCheck()).toBe(1);
  await store.dispatch({ type: "acknowledgePrestige", run: Q2.run });
  const again = new QuestStore(log, clock);
  await again.load();
  expect(await again.runDailyCheck()).toBe(0);
  expect(unseenPrestige(again.state)).toEqual([]);
  expect(log.count("quarter_closed")).toBe(2); // the bad one plus one real close
});
