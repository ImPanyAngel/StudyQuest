# StudyQuest Phase 1 — Core Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A desktop Obsidian plugin where you set up a prestige run (dates, courses, objectives), see completion on a Home screen, self-check objectives to silver, and have exams auto-complete as sat — all stored as an append-only event log in the vault.

**Architecture:** A pure TypeScript core (no Obsidian imports) holds event types, replay with validity rules, derived values and action planning; it is fully unit-tested with an injected clock. A small store wraps the core and talks to the vault through a `LogPort` interface. The UI is one Obsidian `ItemView` built with plain DOM (`createEl`) and CSS, with Home, Course and Setup screens.

**Tech Stack:** TypeScript 5, Obsidian API (`obsidian` npm package), esbuild (Obsidian sample-plugin setup), Vitest, Node 26.

**Spec:** `docs/superpowers/specs/2026-11-16-phase-1-core-loop-design.md` — read it alongside this plan. The spec is the source of truth for behaviour; this plan fixes names, files and tests.

## Global Constraints

- Plugin id `studyquest`, name `StudyQuest`, `isDesktopOnly: true`, `minAppVersion: "1.5.0"`.
- Nothing under `src/core/` imports from `obsidian`.
- The log is append-only: the plugin never rewrites, reorders or deletes lines.
- Log files: `StudyQuest/log/<run-id>.md`, one JSON object per line.
- Event ids: `e_` + 26-char ULID (Crockford base32). Timestamps `t`: ISO 8601 UTC (`Date.prototype.toISOString()`).
- User-entered dates are local calendar dates `YYYY-MM-DD`. "Today" is the local date of the injected clock.
- Undo/correction window: an undo or correction is valid if its `t` is **at most 30 minutes** after the event it targets.
- Objective ID: `<run>/<COURSE>-<CODE><NN>`, codes `LEC ASG LAB RDG PRG EXM`, `NN` zero-padded to 2 digits.
- Exam week: `end − 7 days` … `end`, inclusive.
- Percentages: `Math.floor(100 * done / total)`; no objectives → `null` (shown as "—").
- Tests run with `TZ=Europe/Amsterdam` (set in the npm script) so date tests are deterministic.
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (shown once below; apply to every commit).
- No runtime dependencies besides `obsidian` (dev). No UI framework.

## Review Focus

1. **Exam auto-sat around midnight.** The check must use the *local* date, not UTC: an exam on 27 Jan must not turn sat at 23:30 local on 27 Jan, and must at 00:00:30 local on 28 Jan. → test in Task 5 (`examsDueForSat`) and replay rule in Task 4.
2. **Last Progress step writes two events in the same millisecond.** `step_completed` must sort before `objective_completed`, or replay rejects the completion. → monotonic id factory test in Task 2, and a `planAction` test in Task 6 that replays the produced events.
3. **Duplicate lines in the log** (a sync glitch or a copied line) must not double-count or break state. → replay dedupe test in Task 3.
4. **Double-click on Self check** fires two dispatches; only one completion may be written. → store serialisation test in Task 7.
5. **A log file without a trailing newline** (hand-edited in Obsidian) must not get the next event glued onto its last line. → `joinForAppend` test in Task 7.

---

## File Structure

```
manifest.json, versions.json, package.json, tsconfig.json,
esbuild.config.mjs, vitest.config.ts, styles.css
src/
  main.ts                  plugin entry: view, ribbon, command, status bar, midnight timer
  core/
    result.ts              Result<T> type
    dates.ts               LocalDate helpers
    events.ts              event types, kinds, id factory
    log-format.ts          parse / format log lines
    ids.ts                 run id + objective id helpers
    state.ts               State model types + emptyState
    replay.ts              applyEvent + replay (all validity rules)
    derive.ts              percentages, resit, current run, ordering, undo availability, auto-sat due
    actions.ts             Action type, planAction, planAutoSat
  store/
    quest-store.ts         QuestStore + LogPort interface + joinForAppend
    vault-log.ts           LogPort implementation on Obsidian's Vault
  ui/
    view.ts                StudyQuestView (ItemView), tab switcher, routing
    home.ts                Home screen
    course.ts              Course view
    setup.ts               Setup screen
    complete-menu.ts       "Complete?" popover
    status-bar.ts          status-bar badge
tests/core/*.test.ts, tests/store/*.test.ts
```

---

### Task 1: Scaffold and date helpers

**Files:**
- Create: `manifest.json`, `versions.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `vitest.config.ts`, `styles.css`, `src/main.ts`, `src/core/result.ts`, `src/core/dates.ts`
- Test: `tests/core/dates.test.ts`

**Interfaces:**
- Produces:
  - `type Result<T> = { ok: true; value: T } | { ok: false; error: string }` and helpers `ok<T>(v: T): Result<T>`, `err<T>(e: string): Result<T>` in `src/core/result.ts`
  - `type LocalDate = string` (`YYYY-MM-DD`)
  - `isLocalDate(s: string): boolean` — format and real calendar date
  - `localDateOf(d: Date): LocalDate` — local time zone
  - `addDays(d: LocalDate, n: number): LocalDate`
  - `daysBetween(a: LocalDate, b: LocalDate): number` — `b − a`
  - `examWeek(end: LocalDate): { from: LocalDate; to: LocalDate }`
  - `formatShort(d: LocalDate): string` — e.g. `"Sat 30 Jan 2027"`
  - `type Clock = () => Date`

- [ ] **Step 1: Scaffold the project**

Mirror the official obsidian-sample-plugin layout: `esbuild.config.mjs` bundles `src/main.ts` → `main.js` (CJS, `obsidian`/`electron`/`@codemirror/*` external, `npm run dev` watches, `npm run build` runs `tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`). `manifest.json`: id `studyquest`, name `StudyQuest`, version `0.1.0`, `minAppVersion` `1.5.0`, `isDesktopOnly` true, description "Turns each university quarter into a game run.". `versions.json`: `{"0.1.0": "1.5.0"}`. devDependencies: `obsidian`, `typescript`, `esbuild`, `builtin-modules`, `@types/node`, `vitest`, `tslib`. Scripts: `"test": "TZ=Europe/Amsterdam vitest run"`. `tsconfig.json`: strict, `target ES2022`, `lib ["DOM","ES2022"]`. `src/main.ts`: an empty `Plugin` subclass with `onload() {}`. `styles.css`: empty.

Run: `npm install && npm run build`
Expected: exits 0, `main.js` created.

- [ ] **Step 2: Write the failing tests** in `tests/core/dates.test.ts`

```ts
test("isLocalDate", () => {
  expect(isLocalDate("2027-01-30")).toBe(true);
  expect(isLocalDate("2027-02-30")).toBe(false);
  expect(isLocalDate("2027-1-30")).toBe(false);
});
test("addDays crosses months and DST", () => {
  expect(addDays("2027-01-30", 3)).toBe("2027-02-02");
  expect(addDays("2027-03-27", 2)).toBe("2027-03-29"); // DST change 28 Mar
});
test("daysBetween", () => expect(daysBetween("2026-11-09", "2027-01-30")).toBe(82));
test("examWeek", () => expect(examWeek("2027-01-30")).toEqual({ from: "2027-01-23", to: "2027-01-30" }));
test("localDateOf uses local time", () => {
  expect(localDateOf(new Date("2027-01-27T23:30:00Z"))).toBe("2027-01-28"); // 00:30 CET
});
test("formatShort", () => expect(formatShort("2027-01-30")).toBe("Sat 30 Jan 2027"));
```

- [ ] **Step 3: Run to verify failure** — `npm test` → FAIL (module not found).
- [ ] **Step 4: Implement `src/core/result.ts` and `src/core/dates.ts`** — do date arithmetic on UTC-midnight `Date`s built from the parts, so DST never shifts a day.
- [ ] **Step 5: Run** — `npm test` → PASS; `npm run build` → exit 0.
- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold plugin; add date helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Event types, id factory, log format, ids

**Files:**
- Create: `src/core/events.ts`, `src/core/log-format.ts`, `src/core/ids.ts`
- Test: `tests/core/events.test.ts`, `tests/core/log-format.test.ts`, `tests/core/ids.test.ts`

**Interfaces:**
- Consumes: `Result`, `LocalDate` (Task 1)
- Produces (`events.ts`):
  - `type Kind = "lecture" | "assignment" | "lab" | "reading" | "progress" | "exam"`
  - `const KINDS: Kind[]`, `const DATED_KINDS: Kind[] = ["assignment", "exam"]`, `const BULK_KINDS: Kind[] = ["lecture", "lab", "reading"]`
  - `type Tier = "silver" | "sat"` (gold added in phase 4)
  - Event interfaces sharing `{ id: string; t: string }` with discriminant `type`, exactly the spec's fields: `QuarterCreated`, `QuarterDatesCorrected`, `CourseAdded`, `CourseUndone`, `ObjectiveAdded` (`date?: LocalDate`, `steps?: string[]`, `source: "manual"`), `ObjectiveUndone`, `StepCompleted`, `ObjectiveCompleted`; union `QuestEvent`.
  - `type IdFactory = (now: Date) => string`
  - `createIdFactory(random: () => number = Math.random): IdFactory` — ULID, monotonic within the same millisecond (increment the 80-bit random part).
- Produces (`log-format.ts`):
  - `parseLog(text: string): QuestEvent[]` — one JSON object per line; skips blank lines, invalid JSON, non-objects, objects without string `id`/`t`/`type`, and unknown `type`s.
  - `formatEvent(e: QuestEvent): string` — `JSON.stringify` with keys in order `id, t, type, …rest`.
- Produces (`ids.ts`):
  - `runIdFromName(name: string): Result<string>` — trim; whitespace runs → `-`; drop chars outside `[A-Za-z0-9-]`; empty → error.
  - `isCourseCode(code: string): boolean` — `/^[A-Za-z0-9]+$/`
  - `TYPE_CODES: Record<Kind, string>` (`LEC ASG LAB RDG PRG EXM`)
  - `objectiveId(run: string, course: string, kind: Kind, n: number): string` → `"2026-27-Q2/DSAIT4000-LEC05"`

- [ ] **Step 1: Write the failing tests**

```ts
// events.test.ts
test("id format", () => expect(createIdFactory()(new Date())).toMatch(/^e_[0-9A-HJKMNP-TV-Z]{26}$/));
test("ids sort by time", () => {
  const f = createIdFactory();
  expect(f(new Date(1000)) < f(new Date(2000))).toBe(true);
});
test("ids are monotonic within one millisecond", () => {
  const f = createIdFactory(() => 0.999999);
  const now = new Date(5000);
  const a = f(now), b = f(now), c = f(now);
  expect(a < b && b < c).toBe(true);
});

// log-format.test.ts
test("parseLog skips junk and unknown types", () => {
  const text = [
    '{"id":"e_1","t":"2026-11-16T10:00:00.000Z","type":"course_undone","run":"R","course":"C"}',
    "", "not json", "[1,2]", '{"id":"e_2","type":"course_undone"}',
    '{"id":"e_3","t":"2026-11-16T10:00:00.000Z","type":"purchase"}',
  ].join("\n");
  expect(parseLog(text).map(e => e.id)).toEqual(["e_1"]);
});
test("formatEvent puts id, t, type first and round-trips", () => {
  const e = { id: "e_1", t: "2026-11-16T10:00:00.000Z", type: "course_undone", run: "R", course: "C" } as QuestEvent;
  expect(formatEvent(e).startsWith('{"id":"e_1","t":"2026-11-16T10:00:00.000Z","type":"course_undone"')).toBe(true);
  expect(parseLog(formatEvent(e))).toEqual([e]);
});

// ids.test.ts
test("runIdFromName", () => {
  expect(runIdFromName("2026-27 Q2")).toEqual({ ok: true, value: "2026-27-Q2" });
  expect(runIdFromName("  Thesis  2027 / Q1-3 ")).toEqual({ ok: true, value: "Thesis-2027--Q1-3" });
  expect(runIdFromName("  ").ok).toBe(false);
});
test("objectiveId", () => {
  expect(objectiveId("2026-27-Q2", "DSAIT4000", "lecture", 5)).toBe("2026-27-Q2/DSAIT4000-LEC05");
  expect(objectiveId("R", "C", "exam", 123)).toBe("R/C-EXM123");
});
test("isCourseCode", () => { expect(isCourseCode("DSAIT4000")).toBe(true); expect(isCourseCode("DS-1")).toBe(false); });
```

- [ ] **Step 2: Run** — `npm test` → FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules per Interfaces.
- [ ] **Step 4: Run** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(core): event types, ids and log format"` (+ trailer).

---

### Task 3: State model and replay — runs and courses

**Files:**
- Create: `src/core/state.ts`, `src/core/replay.ts`
- Test: `tests/core/replay-runs.test.ts`
- Create: `tests/core/fixtures.ts` (event builder helpers for all core tests)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (`state.ts`):

```ts
interface RunState { id: string; name: string; start: LocalDate; end: LocalDate; createdAt: string; courses: Map<string, CourseState>; }
interface CourseState { code: string; name: string; folder: string; addedAt: string; }
interface ObjectiveState {
  id: string; run: string; course: string; kind: Kind; title: string; source: "manual";
  date?: LocalDate; steps?: string[]; stepsDone: boolean[];
  addedAt: string; completed?: { tier: Tier; at: string };
}
interface State {
  runs: Map<string, RunState>;              // insertion order = creation order
  objectives: Map<string, ObjectiveState>;  // active only, insertion order = add order
  everObjectiveIds: Set<string>;            // includes undone, never shrinks
}
function emptyState(): State;
```

- Produces (`replay.ts`):
  - `applyEvent(state: State, e: QuestEvent): string | null` — mutates `state`; returns `null` if applied or a human-readable rejection reason (state untouched on rejection).
  - `replay(events: QuestEvent[]): State` — dedupe by `id` (first wins), sort by `t` then `id`, fold with `applyEvent`, ignoring rejections.
  - `withinUndoWindow(targetT: string, t: string): boolean` — `0 ≤ t − targetT ≤ 30 min`.
- `fixtures.ts`: `ev.created(run, start, end, t)`, `ev.course(run, code, t)`, etc. returning complete events with deterministic ids. Exact helper shapes are the builder's call.

Rules in this task (spec "Prestige run", "Course", "Replay validity"):
- `quarter_created`: `run === runIdFromName(name).value`; run id unused; `start`/`end` valid; `daysBetween(start, end) ≥ 7`; no inclusive overlap with any existing run.
- `quarter_dates_corrected`: run exists; within window of `createdAt`; same date rules (overlap check excludes itself); every active objective of the run with a `date` stays valid — assignments in `[start, end]`, exams in the new exam week.
- `course_added`: run exists; `isCourseCode`; code not active in the run.
- `course_undone`: course active; within window of its `addedAt`; no objective in that course has `completed` or any `stepsDone`; removes the course and its active objectives (they stay in `everObjectiveIds`).

- [ ] **Step 1: Write the failing tests**

```ts
test("creates a run", ...)            // runs.get("2026-27-Q2") has name/start/end/createdAt
test("rejects run id not matching name", ...)
test("rejects end < start + 7 days", ...)   // start 2026-11-09, end 2026-11-15 → rejected; 2026-11-16 → ok
test("rejects overlapping runs", ...)       // second run starting on first run's end date → rejected
test("date correction at 29 min applies, at 31 min is ignored", ...)
test("date correction refused if an exam would leave exam week", ...)
test("course added and undone within window", ...)  // course gone; same code can be added again afterwards
test("course undo at 31 min is ignored", ...)
test("replay dedupes duplicate lines", () => {
  const e = ev.course("R", "C1", T0);
  const s = replay([created, e, e, { ...e }]);
  expect([...s.runs.get("R")!.courses.keys()]).toEqual(["C1"]);
});
test("replay orders by t regardless of input order", ...)
```

Each test asserts on the resulting `State`, and rejection tests assert `applyEvent(...)` returns a non-null string.

- [ ] **Step 2: Run** — `npm test` → FAIL.
- [ ] **Step 3: Implement** `state.ts` and the run/course half of `replay.ts`.
- [ ] **Step 4: Run** — `npm test` → PASS.
- [ ] **Step 5: Commit** — `"feat(core): replay runs and courses"` (+ trailer).

---

### Task 4: Replay — objectives, steps and completions

**Files:**
- Modify: `src/core/replay.ts`
- Test: `tests/core/replay-objectives.test.ts`

**Interfaces:**
- Consumes: Task 3 (`applyEvent`, `State`, fixtures).
- Produces: no new exports; `applyEvent` handles the four objective events.

Rules (spec "Objective", "Completion and marks", "Replay validity"):
- `objective_added`: run and course active; `obj` not in `everObjectiveIds` and has prefix `${run}/${course}-`; `kind` in `KINDS`; `title.trim()` non-empty; `date` present iff kind in `DATED_KINDS` — assignment `start ≤ date ≤ end`, exam within `examWeek(end)`; `steps` present iff `progress`, length ≥ 2, each trimmed non-empty. Adds to `objectives` and `everObjectiveIds`, `stepsDone` all false.
- `objective_undone`: active; within window of `addedAt`; not completed and no step done. Removes from `objectives`.
- `step_completed`: active progress objective; not completed; `0 ≤ step < steps.length`; step not already done.
- `objective_completed`: active; not completed; tier `silver` → kind ≠ exam and (if progress) all steps done; tier `sat` → kind = exam and `localDateOf(new Date(t)) > date`; any other tier rejected.

- [ ] **Step 1: Write the failing tests**

```ts
test("adds a lecture with no date; rejects a lecture with a date", ...)
test("assignment requires a date inside the run", ...)        // end+1 rejected, end accepted
test("exam date must be in exam week", ...)                    // end-8 rejected, end-7 accepted
test("progress needs ≥2 non-empty steps", ...)
test("ids are never reused: undone id cannot be re-added", ...)
test("undo at 29 min applies, at 31 min ignored", ...)
test("undo blocked after silver", ...)
test("undo blocked after one progress step", ...)
test("course undo blocked once an objective in it is completed", ...)
test("silver on exam rejected; sat on lecture rejected; gold rejected", ...)
test("sat rejected on the exam day itself (local), accepted the next local day", () => {
  // exam date 2027-01-27; t "2027-01-27T22:30:00.000Z" (23:30 CET) → rejected
  // t "2027-01-27T23:00:30.000Z" (00:00:30 CET on 28th) → applied
});
test("progress: completion rejected until all steps done; accepted after", ...)
test("step out of range or repeated is rejected", ...)
test("completing twice is rejected", ...)
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** the objective half of `applyEvent`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `"feat(core): replay objectives and completions"` (+ trailer).

---

### Task 5: Derived values

**Files:**
- Create: `src/core/derive.ts`
- Test: `tests/core/derive.test.ts`

**Interfaces:**
- Consumes: `State`, dates, events.
- Produces:
  - `percent(done: number, total: number): number | null`
  - `courseProgress(s: State, run: string, course: string): { done: number; total: number; pct: number | null }`
  - `runProgress(s: State, run: string): { done: number; total: number; pct: number | null }`
  - `isResit(s: State, run: string, course: string): boolean` — same code active in a run with an earlier `start`.
  - `currentRun(s: State, today: LocalDate): RunState | null` — spec rule (containing → next upcoming → most recent past).
  - `runEnded(run: RunState, today: LocalDate): boolean` — `today > end`.
  - `shortName(run: RunState): string` — last space-separated word of `name`.
  - `courseObjectives(s: State, run: string, course: string): ObjectiveState[]` — add order.
  - `type HomeRow = { obj: ObjectiveState; overdue: boolean; soon: boolean; clickable: boolean }`
  - `homeRows(s: State, run: string, today: LocalDate): { dated: HomeRow[]; anytime: HomeRow[] }` — open objectives only. `dated`: kind in `DATED_KINDS`, by `date` then add order. `anytime`: grouped by course in course order, then add order. `overdue` = assignment with `date < today`; `soon` = `today ≤ date ≤ today+2`; `clickable` = kind ≠ exam.
  - `undoDeadline(addedAt: string): Date` — `addedAt + 30 min`.
  - `canUndoObjective(o: ObjectiveState, now: Date): boolean`, `canUndoCourse(s: State, run: string, code: string, now: Date): boolean`, `canCorrectRun(run: RunState, now: Date): boolean`
  - `examsDueForSat(s: State, today: LocalDate): ObjectiveState[]` — open exams with `date < today`, all runs.

- [ ] **Step 1: Write the failing tests**

```ts
test("percent floors and handles empty", () => {
  expect(percent(0, 0)).toBeNull();
  expect(percent(199, 200)).toBe(99);
  expect(percent(2, 2)).toBe(100);
});
test("progress objective counts once; silver and sat both count", ...)
test("undone objectives excluded from totals", ...)
test("run % is over all objectives, not an average of courses", () => {
  // course A: 1/1 done, course B: 0/3 → run 25, not 50
});
test("isResit true only when an earlier run has the code", ...)
test("currentRun: containing, else next upcoming, else latest past, else null", ...)
test("shortName", () => expect(shortName(run("2026-27 Q2"))).toBe("Q2"));
test("homeRows ordering, overdue, soon, exams not clickable", ...)
test("canUndoObjective false at 31 min and after completion", ...)
test("examsDueForSat uses strict date < today", () => {
  // exam 2027-01-27: today 2027-01-27 → []; today 2027-01-28 → [exam]
});
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `derive.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `"feat(core): derived values"` (+ trailer).

---

### Task 6: Actions

**Files:**
- Create: `src/core/actions.ts`
- Test: `tests/core/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:

```ts
type Action =
  | { type: "createRun"; name: string; start: LocalDate; end: LocalDate }
  | { type: "correctRunDates"; run: string; start: LocalDate; end: LocalDate }
  | { type: "addCourse"; run: string; code: string; name: string; folder: string }
  | { type: "undoCourse"; run: string; code: string }
  | { type: "addObjective"; run: string; course: string; kind: Kind; title: string; date?: LocalDate; steps?: string[] }
  | { type: "bulkAddObjectives"; run: string; course: string; kind: Kind; prefix: string; from: number; to: number }
  | { type: "undoObjective"; obj: string }
  | { type: "selfCheck"; obj: string }
  | { type: "checkStep"; obj: string; step: number };

function planAction(s: State, a: Action, now: Date, newId: IdFactory): Result<QuestEvent[]>;
function planAutoSat(s: State, now: Date, newId: IdFactory): QuestEvent[];
function runOf(e: QuestEvent, s: State): string;  // which log file an event belongs in
```

Behaviour:
- Every produced event gets `t = now.toISOString()` and `id = newId(now)`.
- `planAction` builds the events, then applies them in order to `structuredClone(s)` with `applyEvent`; the first rejection becomes `err(reason)`. This keeps replay as the single source of rules.
- Rules that depend on "now" live here, not in replay: `addCourse`, `addObjective`, `bulkAddObjectives`, `selfCheck`, `checkStep` → `err("This run has ended")` when `runEnded(run, localDateOf(now))`.
- `createRun` derives `run` via `runIdFromName`. Inputs are trimmed.
- `addObjective` / bulk: the number for each new objective = count of ids in `everObjectiveIds` with prefix `${run}/${course}-${TYPE_CODES[kind]}` + 1 (+ index for bulk).
- `bulkAddObjectives`: only `BULK_KINDS`; `1 ≤ from ≤ to`; `to − from + 1 ≤ 50`; titles `"${prefix.trim()} ${n}"`.
- `selfCheck` on a progress objective → `err` (steps only). On an exam → `err`.
- `checkStep` on the last open step returns `[step_completed, objective_completed(silver)]`, same `t`.
- `planAutoSat` → one `objective_completed` (tier `sat`) per `examsDueForSat(s, localDateOf(now))`.
- `runOf`: `run` field when present, else the run of the objective in `obj`.

- [ ] **Step 1: Write the failing tests**

```ts
test("createRun derives id and rejects overlap", ...)
test("addObjective numbers per course+kind and never reuses after undo", () => {
  // add LEC01, LEC02, undo LEC02 → next add is LEC03
});
test("bulk add Lecture 1..14 yields 14 events with titles and ids LEC01..LEC14", ...)
test("bulk add rejects progress, from > to, and ranges over 50", ...)
test("adds and self checks refused after run end", ...)
test("self check on exam or progress is refused", ...)
test("last step yields step + silver, and replaying them completes the objective", () => {
  const r = planAction(s, { type: "checkStep", obj, step: 1 }, now, createIdFactory());
  expect(r.ok && r.value.map(e => e.type)).toEqual(["step_completed", "objective_completed"]);
  // replay(previousEvents.concat(r.value)) → objective completed silver
});
test("undo at 31 min is refused with a reason", ...)
test("planAutoSat emits sat only for exams whose date < today", ...)
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `actions.ts`.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `"feat(core): action planning"` (+ trailer).

---

### Task 7: Store and vault log

**Files:**
- Create: `src/store/quest-store.ts`, `src/store/vault-log.ts`
- Test: `tests/store/quest-store.test.ts`

**Interfaces:**
- Consumes: core (Tasks 1–6).
- Produces (`quest-store.ts`):

```ts
interface LogPort {
  readAll(): Promise<string[]>;                           // contents of every log file
  append(runId: string, lines: string[]): Promise<void>;
}
function joinForAppend(existing: string, lines: string[]): string;  // text to append
class QuestStore {
  constructor(log: LogPort, clock: Clock, newId?: IdFactory);
  readonly state: State;
  load(): Promise<void>;                                  // readAll → parseLog → replay; notify
  dispatch(a: Action): Promise<Result<void>>;
  runAutoSat(): Promise<number>;                          // events written
  subscribe(fn: () => void): () => void;
}
```

- `dispatch` and `runAutoSat` are serialised through one promise queue, so a second call plans against the state after the first one finished.
- After a successful plan: append the lines, grouped by `runOf`, then add the events to the in-memory list, replay and notify. If append throws, return `err` and don't change state.
- `joinForAppend(existing, lines)`: `lines.join("\n") + "\n"`, prefixed with `"\n"` when `existing` is non-empty and doesn't end in `"\n"`.
- `vault-log.ts`: `class VaultLog implements LogPort` with `constructor(vault: Vault, folder = "StudyQuest/log")`. `append` creates the folder and file if needed and uses `vault.process(file, text => text + joinForAppend(text, lines))`. Also `onChange(cb): EventRef[]`, which registers vault `modify`/`create` events for paths under the folder. Not unit-tested; checked by hand in Task 10.

- [ ] **Step 1: Write the failing tests** (fake `LogPort` backed by a `Map<string, string>`, fixed clock)

```ts
test("joinForAppend adds a newline when the file lacks one", () => {
  expect(joinForAppend("", ["a"])).toBe("a\n");
  expect(joinForAppend("x\n", ["a", "b"])).toBe("a\nb\n");
  expect(joinForAppend("x", ["a"])).toBe("\na\n");
});
test("dispatch appends to the run's file and updates state", ...)
test("rejected action writes nothing and returns the reason", ...)
test("two concurrent selfChecks write exactly one completion", async () => {
  const [a, b] = await Promise.all([store.dispatch(check), store.dispatch(check)]);
  expect([a.ok, b.ok].sort()).toEqual([false, true]);
  expect(countLines(fake, "objective_completed")).toBe(1);
});
test("load replays existing files; a reloaded store has identical state", ...)
test("runAutoSat writes sat for passed exams once, and zero on second run", ...)
```

- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** `quest-store.ts` and `vault-log.ts`.
- [ ] **Step 4: Run** — `npm test` → PASS; `npm run build` → exit 0.
- [ ] **Step 5: Commit** — `"feat(store): quest store and vault log"` (+ trailer).

---

### Task 8: Plugin shell, view and Home

**Files:**
- Modify: `src/main.ts`, `styles.css`
- Create: `src/ui/view.ts`, `src/ui/home.ts`, `src/ui/complete-menu.ts`, `src/ui/status-bar.ts`

**Interfaces:**
- Consumes: `QuestStore`, `VaultLog`, derive functions.
- Produces:
  - `VIEW_TYPE = "studyquest-view"`
  - `type Route = { tab: "home" } | { tab: "setup" } | { tab: "course"; run: string; course: string }`
  - `class StudyQuestView extends ItemView { navigate(r: Route): void }` — re-renders on store notifications; `getDisplayText()` → `"StudyQuest"`; icon `"trophy"`.
  - `renderHome(el: HTMLElement, store: QuestStore, nav: (r: Route) => void, clock: Clock): void`
  - `openCompleteMenu(anchor: HTMLElement, obj: ObjectiveState, store: QuestStore): void`
  - `class StatusBadge { constructor(el: HTMLElement, store: QuestStore, clock: Clock, onClick: () => void) }`

`main.ts` `onload`:
1. Create `VaultLog` and `QuestStore` (clock `() => new Date()`).
2. Register the view; add a ribbon icon (`trophy`, "Open StudyQuest") and the command `open-studyquest` / "Open StudyQuest". Both open or reveal the view on Home.
3. Add the status-bar badge.
4. On `app.workspace.onLayoutReady`: `await store.load()`, then `store.runAutoSat()`, then schedule the midnight check. Wire `VaultLog.onChange` → `store.load()` (debounced 250 ms).
5. Midnight check: `setTimeout` to the next local midnight + 5 s → `runAutoSat()`, then reschedule. Clear the timer on unload via `this.register`.

Home (spec "Screens → Home"; mockup `home-v2.html`):
- Tab bar: **Home**, **Setup**.
- Top row: completion ring (CSS `conic-gradient`) with run %, labelled with the run name; exam-week line `Exam week: <formatShort(from)> → <formatShort(to)>`; course list rows (code, name, bar, `pct` or "—", `RESIT` tag) that navigate to the course route on click; the character box (static grey placeholder figure, CSS only).
- Objectives: `homeRows` → dated rows, an "anytime" divider, then anytime rows. Each row shows a type tag, `CODE · title`, the date (or `overdue`), and `n/m` for progress. `soon` and `overdue` rows get CSS classes. Clickable rows open the complete menu.
- No run → a message with a button to Setup.
- After the run's end date, rows aren't clickable.

Complete menu: a popover anchored to the row, titled "Complete?". It shows "AI check" disabled with the sub-label "arrives in phase 4". Non-progress objectives get "Self check → silver" (dispatch `selfCheck`). Progress objectives list each step instead, open ones clickable (dispatch `checkStep`) and done ones ticked. Errors from `dispatch` show as an Obsidian `Notice`. Clicking outside closes it.

Status badge: `"<shortName> <pct>%"` (or `"—"`), or `"StudyQuest"` with no run. Click opens Home.

Styling: StudyQuest's own CSS variables scoped under `.studyquest`. Wireframe look like the mockups, readable in light and dark Obsidian themes.

- [ ] **Step 1: Implement** the files above.
- [ ] **Step 2: Build** — `npm run build` → exit 0; `npm test` → PASS.
- [ ] **Step 3: Commit** — `"feat(ui): plugin shell, view, home, complete menu, status badge"` (+ trailer).

---

### Task 9: Course view

**Files:**
- Create: `src/ui/course.ts`
- Modify: `src/ui/view.ts` (route to it)

**Interfaces:**
- Consumes: `courseObjectives`, `courseProgress`, `isResit`, `openCompleteMenu`, `Route`.
- Produces: `renderCourse(el: HTMLElement, store: QuestStore, route: Extract<Route, { tab: "course" }>, nav: (r: Route) => void, clock: Clock): void`

Spec "Screens → Course view"; mockup `course-v1.html`:
- "← Home" link, header (code, name, bar, %, `RESIT`), then every objective in add order.
- Each row: type tag, title, date if any, `n/m` for progress, and a mark badge (`open` / `SILVER` / `SAT`, with distinct styles).
- Open, non-exam rows open the complete menu, unless the run has ended.
- An unknown course (e.g. it was undone) → a message plus a link back to Home.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Build** — `npm run build` → exit 0.
- [ ] **Step 3: Commit** — `"feat(ui): course view"` (+ trailer).

---

### Task 10: Setup screen and manual verification

**Files:**
- Create: `src/ui/setup.ts`
- Modify: `src/ui/view.ts`

**Interfaces:**
- Consumes: `planAction` via `store.dispatch`, `canUndoObjective`, `canUndoCourse`, `canCorrectRun`, `undoDeadline`, `examWeek`, `DATED_KINDS`, `BULK_KINDS`.
- Produces: `renderSetup(el: HTMLElement, store: QuestStore, clock: Clock): void`

Spec "Screens → Setup"; mockup `setup-v1.html`. Three sections:
1. **Run dates.** A run selector (all runs plus "New run…", defaulting to the current run). New run form: name, start, end (`<input type="date">`), then Create. An existing run shows its dates, the derived exam week, and — while `canCorrectRun` — editable dates with Save and a countdown to `undoDeadline(createdAt)`; otherwise read-only, labelled "locked".
2. **Courses.** List of the selected run's courses (code, name, folder, `RESIT`), each with an Undo button and countdown while `canUndoCourse`. Add form: code, name, vault folder (defaults to `<code>/`).
3. **Objectives.** A course picker; that course's objectives with Undo plus countdown while `canUndoObjective`. Add form: type select; title; a date input shown only for `DATED_KINDS` (labelled "due date" for assignments, "exam date" for exams); a steps textarea (one per line) only for `progress`. Bulk form: type limited to `BULK_KINDS`, prefix, from, to. A disabled "Import roadmap / schedule — phase 5" button.
- Every form dispatches and shows `Notice` on error; on success, clear the form.
- While Setup is visible, re-render every 30 s so countdowns and lock states update (`registerInterval`).
- After the run's end date, the add forms are disabled with the note "This run has ended".

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Build and test** — `npm run build` → exit 0; `npm test` → PASS.
- [ ] **Step 3: Install into a test vault.** Ask the user which vault to use (a throwaway vault is recommended for the first run). Symlink the repo folder to `<vault>/.obsidian/plugins/studyquest`, reload Obsidian, and enable the plugin.
- [ ] **Step 4: Manual check** — every item must hold:
  - Create run "2026-27 Q2", 2026-11-09 → 2027-01-30. Exam week shows Sat 23 Jan → Sat 30 Jan 2027. `StudyQuest/log/2026-27-Q2.md` exists, one JSON line.
  - Add two courses; bulk add Lecture 1–14; add an assignment, a progress objective (3 steps) and an exam on 2027-01-27.
  - Home: ring, course %, exam line, dated rows first, then "anytime" grouped by course; the status bar shows "Q2 0%".
  - Self check a lecture → silver; % updates in the ring, course list, status bar and course view.
  - Tick progress steps; after the last one the objective shows SILVER.
  - Undo works on a fresh objective; the Undo button disappears once it's completed.
  - Restart Obsidian → identical state.
  - Copy a line in the log file to duplicate it → state unchanged after reload.
  - Exam auto-sat (do this first, before creating Q2, since runs can't overlap): create run "Test T1" from today−10 days to today+3 days, add a course and an exam dated yesterday, then reload the plugin → SAT. Afterwards delete `StudyQuest/log/Test-T1.md` by hand. This is the only time a log file is touched by hand, and only in the throwaway vault.
- [ ] **Step 5: Commit** — `"feat(ui): setup screen"` (+ trailer).
