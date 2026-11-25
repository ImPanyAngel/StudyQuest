# Runs Without an End Date — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A run can be created with a start date and no end date, and the end date can be added later.

**Architecture:** `end` becomes optional (`end?: LocalDate`) on the two run events, the two run actions and `RunState`. Replay owns the rules (validation, the lock clock via a new `RunState.datesSetAt`). Derive answers "has it ended / which run is current / can the dates be edited". The UI asks derive and formats "no end date".

**Tech Stack:** TypeScript, Obsidian plugin API, Vitest (`npm test`), `npm run build` (tsc + esbuild).

**Spec:** `docs/superpowers/specs/2026-11-25-open-end-run-design.md`

## Global Constraints

- An event with no end date omits the `end` key; it is never `null` and never `""`.
- Old logs (every run has an end) must replay to exactly the same state as before.
- Display copy: "no end date" (e.g. `Mon 9 Nov 2026 → no end date`, Hall card `no end date`).
- Exam form copy when the run has no end: `Set an end date to add exams.`
- The 30-minute window (`withinUndoWindow`) is unchanged; only what it is measured from changes.

## Review Focus

1. A blank End field in Setup (draft `""` or missing) must create or correct a run with no end, not fail with "Dates must be valid YYYY-MM-DD dates."
2. Home, Setup, the run page and the Hall must render a no-end run without calling `examWeek(undefined)` or `formatShort(undefined)`.
3. The daily check (`planDailyCheck`) must never close a no-end run, however far in the future "today" is.
4. A no-end run whose dates are edited days after creation must accept the edit. Once the end is set, a further edit more than 30 minutes later must be refused.
5. Sorting by end (`currentRun`, `runsDueToClose`, `unseenPrestige`, `hallRuns`) must put no-end runs last and not throw.

---

### Task 0: Branch and commit the two small UI tweaks

- [ ] **Step 1:** `git checkout -b open-end-run`
- [ ] **Step 2:** Commit the already-made "Mark Done" + objectives `x/y` change on its own:
```bash
git add src/ui/complete-menu.ts src/ui/home.ts styles.css
git commit -m "feat: Mark Done wording and objectives done/total count on Home"
```
- [ ] **Step 3:** Commit the spec and this plan: `git add docs/superpowers && git commit -m "docs: spec and plan for runs without an end date"`

### Task 1: Optional end in the log and replay

**Files:**
- Modify: `src/core/events.ts` (QuarterCreated, QuarterDatesCorrected: `end?: LocalDate`)
- Modify: `src/core/state.ts` (RunState: `end?: LocalDate`, add `datesSetAt: string`)
- Modify: `src/core/log-format.ts` (drop `end` from REQUIRED for both types; in `wellFormed`, `end` if present must be a string)
- Modify: `src/core/replay.ts` (`checkRunDates`, `datedObjectivesFit`, `quarterCreated`, `quarterDatesCorrected`, `quarterClosed`, `objectiveAdded`)
- Modify: `tests/core/fixtures.ts`: add `ev.createdOpen(name = Q2.name, start = Q2.start, t = at(0))` and `ev.correctedOpen(run, start, t)`, both without an `end` key
- Test: `tests/core/replay-runs.test.ts`, `tests/core/replay-objectives.test.ts`, `tests/core/log-format.test.ts`

**Interfaces:**
- Produces: `RunState.end?: LocalDate`, `RunState.datesSetAt: string` (equals `createdAt` on create; set to the event's `t` when a correction takes `end` from undefined to a date; otherwise unchanged). Exported `datesLocked(run: RunState, t: string): boolean` from `replay.ts`: `run.end !== undefined && !withinUndoWindow(run.datesSetAt, t)`.

- [ ] **Step 1: Write failing tests**

`replay-runs.test.ts`:
- `"creates a run with no end"`: `replay([ev.createdOpen()])` gives a run where `end` is `undefined`, `"end" in run` is false, and `datesSetAt === at(0)`.
- `"a run with no end still needs a valid start"`: `applyEvent(emptyState(), ev.createdOpen("A", "2026-11-31"))` is a string.
- `"no-end run dates stay editable for days"`: `replay([ev.createdOpen(), ev.correctedOpen(Q2.run, "2026-11-10", at(60 * 24 * 5))])` gives `start: "2026-11-10"`.
- `"setting the end later starts the 30-minute window then"`: create open at `at(0)`, correct to `(Q2.start, Q2.end)` at `at(600)`. Now `end === Q2.end` and `datesSetAt === at(600)`. A correction at `at(629)` applies, and a further one at `at(631)` is refused (`applyEvent` returns `"The run's dates are locked."`).
- `"blanking the end within the window is allowed, unless the run has exams"`: `ev.created()`, then `ev.correctedOpen(Q2.run, Q2.start, at(10))` gives no end. Then a second state with a course, an exam on `"2027-01-25"` and `ev.correctedOpen` at `at(10)` is refused with a string.
- `"a no-end run never closes"`: `applyEvent` of a `quarter_closed` for an open run at `"2030-01-01T12:00:00.000Z"` returns `"The run hasn't ended yet."`.
- `"old logs replay unchanged"`: the existing `"creates a run"` test also asserts `datesSetAt === at(0)`.

`replay-objectives.test.ts`:
- `"no end: assignments may be due on any date"`: on an open run with course C1, assignments dated `"2020-01-01"` and `"2035-06-30"` are both accepted.
- `"no end: exams are refused"`: an exam with any date is refused with `"Set an end date to add exams."`.
- `"setting an end refuses if an assignment falls outside"`: open run, assignment due `"2027-03-01"`, then `ev.corrected(Q2.run, Q2.start, Q2.end, at(10))` is refused (a string).

`log-format.test.ts`:
- `"quarter_created and quarter_dates_corrected parse without end"`: lines without `end` parse. With `"end": 5` they are skipped.

- [ ] **Step 2:** `npx vitest run tests/core` should fail on the new tests only.
- [ ] **Step 3: Implement**
  - `checkRunDates(start, end?)`: start must be valid. If an end is given, it must be valid and at least 7 days after the start.
  - `datedObjectivesFit(state, run, start, end?)`: with no end, assignments are unchecked, and any exam returns `` `"${o.title}" needs an end date for its exam week.` `` With an end, the checks are as today.
  - `quarterCreated`: copy `end` only when defined (no `end: undefined` key). Set `datesSetAt: e.t`.
  - `quarterDatesCorrected`: refuse with `"The run's dates are locked."` when `datesLocked(run, e.t)`. After validating, set `datesSetAt = e.t` if `run.end === undefined && e.end !== undefined`. Assign the end, or `delete run.end` when absent.
  - `quarterClosed`: refuse `"The run hasn't ended yet."` when `run.end === undefined` too.
  - `objectiveAdded`: with no end, assignments may have any valid date, and exams are refused with `"Set an end date to add exams."`.
- [ ] **Step 4:** `npm test` passes in full.
- [ ] **Step 5:** Commit `feat: runs may have no end date (log and replay)`.

### Task 2: Derive and actions

**Files:**
- Modify: `src/core/derive.ts` (`runEnded`, `currentRun`, `byEnd`, `canCorrectRun`)
- Modify: `src/core/actions.ts` (`createRun` / `correctRunDates`: `end?: LocalDate`; omit the key when undefined or `""`)
- Modify: `src/core/dates.ts`: add `formatRunDates(start: LocalDate, end?: LocalDate): string`
- Test: `tests/core/derive.test.ts`, `tests/core/actions.test.ts`, `tests/core/dates.test.ts`

**Interfaces:**
- Consumes: `RunState.end?`, `datesLocked` from Task 1.
- Produces: `runEnded(run, today)` returns false when there's no end. `canCorrectRun(run, now)` is `!datesLocked(run, now.toISOString())`. `formatRunDates("2026-11-09")` returns `"Mon 9 Nov 2026 → no end date"`, and with an end, `"<formatShort(start)> → <formatShort(end)>"`.

- [ ] **Step 1: Write failing tests**
  - derive: `"runEnded is false forever without an end"` (today `"2099-01-01"`).
  - derive: `"currentRun prefers a run with an end over one without, both containing today"`.
  - derive: `"a no-end run started before today is current"`.
  - derive: `"runsDueToClose skips a no-end run"`.
  - derive: `"canCorrectRun is true days later without an end, false 31 min after the end was set"`.
  - actions: `"createRun with a blank end writes an event without end"`: `plan(state, { type: "createRun", name: "X", start: Q2.start, end: "" })` is ok, and the event has no `end` key. Same for `end: undefined` and for `correctRunDates`.
  - actions: `"planDailyCheck never closes a no-end run"` (now = 2030).
  - dates: the two `formatRunDates` cases.
- [ ] **Step 2:** The new tests fail.
- [ ] **Step 3: Implement**
  - `byEnd`: undefined sorts after any date, and two undefined ends are equal.
  - `currentRun`: "containing" means `start <= today && (end === undefined || today <= end)`. Sort with `byEnd`, then start, then name. `past` only includes runs with an end.
- [ ] **Step 4:** `npm test` passes.
- [ ] **Step 5:** Commit `feat: derive and actions handle runs without an end`.

### Task 3: UI

**Files:**
- Modify: `src/ui/setup.ts` (new-run form, correction form, locked/closed lines, exam-week hint, exam form)
- Modify: `src/ui/home.ts` (exam line)
- Modify: `src/ui/run-page.ts:30`
- Modify: `src/ui/hall.ts:32`

**Interfaces:**
- Consumes: `formatRunDates`, `canCorrectRun`, `runEnded` from Task 2.

- [ ] **Step 1: Implement**
  - Setup new run: pass `end: ui.drafts["run.end"] || undefined`. Hint: `Dates come from the university calendar. Leave End blank if you don't know it yet. Dates lock 30 minutes after the end is set.`
  - Setup correction: same `|| undefined` for the end draft (an emptied field means "no end"). When there's no end, the hint reads `No end date yet. Dates stay editable until you set one.` instead of the minutes left. Minutes left count from `run.datesSetAt`.
  - Setup closed/locked lines and run page: use `formatRunDates(run.start, run.end)`.
  - Setup exam-week hint: only when `run.end` is set. In the objectives section, when the kind is `exam` and there's no end, show `Set an end date to add exams.` in place of the date field and add button.
  - Home: with no end, the exam line is the existing `" "` placeholder. Never call `examWeek` without an end.
  - Hall: `r.start > today ? starts … : r.end ? ends … : "no end date"`.
- [ ] **Step 2:** `npm run build` passes (tsc will flag any remaining `run.end` used as a definite `LocalDate`, so fix each one).
- [ ] **Step 3:** `npm test` passes.
- [ ] **Step 4:** Commit `feat: Setup, Home, Hall and run page show runs without an end`.
