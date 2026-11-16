import { QuestStore, joinForAppend, type LogPort } from "../../src/store/quest-store";
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

test("runAutoSat writes sat for passed exams once, and zero on second run", async () => {
  const { log, store } = await setup();
  await store.dispatch({ type: "addObjective", run: Q2.run, course: "C1", kind: "exam", title: "Final", date: "2027-01-27" });
  now = new Date("2027-01-27T12:00:00.000Z");
  expect(await store.runAutoSat()).toBe(0);
  now = new Date("2027-01-28T08:00:00.000Z");
  expect(await store.runAutoSat()).toBe(1);
  expect(await store.runAutoSat()).toBe(0);
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
