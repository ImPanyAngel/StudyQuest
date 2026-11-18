# Overlapping Runs and a Run Switch: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Runs may overlap. A dropdown at the far right of the tab bar picks the run that Home, the badge and Setup show, and the choice is remembered across restarts.

**Architecture:** Replay drops its overlap rule. Pure helpers in `derive.ts` choose and list runs. A small holder with no Obsidian imports, `src/store/run-choice.ts`, keeps the chosen id, saves it, and notifies listeners. `main.ts` loads it from plugin data and passes it to the view and the badge.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5. Unchanged.

**Spec:** `docs/superpowers/specs/2026-11-18-run-switch-design.md`

## Global Constraints

- No event changes. Old logs replay unchanged: the overlap rule only ever refused runs, and planning never wrote an overlapping run.
- Plugin data is `{ run?: string }`, saved with `saveData`.
- The switch lists open runs only, sorted by `start` then `name`, and is hidden when fewer than 2 exist.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The remembered run closes while Obsidian is open.** At midnight the Prestige Up screen shows. Afterwards the switch no longer lists the closed run, and Home falls back to another run. → `chosenRun` ignores closed runs (Task 1 test).
2. **Two runs end on the same day.** Both close and both Prestige Up screens queue, as today. → Existing behaviour; covered by the manual check.
3. **`data.json` is missing, or holds an id that no longer exists.** The fallback is used without an error. → `chosenRun` test for an unknown id.

---

### Task 1: Core — overlap allowed, choosing runs

**Files:** modify `src/core/replay.ts` (`checkRunDates`) and `src/core/derive.ts`. Tests go in `tests/core/replay-runs.test.ts`, `tests/core/actions.test.ts` and `tests/core/derive.test.ts`.

**Interfaces (derive.ts):**
- `currentRun(s, today)`: when several runs contain today, return the one with the earliest `end`. Ties go to the earliest `start`, then to the name.
- `openRuns(s: State): RunState[]`
- `chosenRun(s: State, remembered: string | undefined, today: LocalDate): RunState | null`. Returns the remembered run when it exists and isn't closed; otherwise `currentRun`.
- `runHasExams(s: State, run: string): boolean`

- [ ] **Step 1: Failing tests.**
  - Replace `rejects overlapping runs` with `overlapping runs are accepted`. A Q2 run plus `created("Career", "2026-09-01", "2027-07-15")` replays both.
  - In the `createRun` test, the overlapping create now succeeds. Rename the test to `createRun derives id and trims`.
  - `currentRun` with Q2 and Career both containing `2026-11-16` returns Q2, the one that ends soonest.
  - `openRuns` is ordered by start, then by name, and leaves out closed runs.
  - `chosenRun` returns:
    - the remembered open run;
    - the fallback for a remembered run that is closed;
    - the fallback for an unknown id;
    - the fallback for `undefined`.
  - `runHasExams` is false for a run with only lectures and true once an exam is added.
- [ ] **Step 2: Run `npm test`** and confirm the new tests fail.
- [ ] **Step 3: Implement.** Remove the overlap loop and its now-unused `self` parameter, if nothing else uses it.
- [ ] **Step 4: Confirm** `npm test` is green and `npm run build` exits 0.
- [ ] **Step 5: Commit** with the message `feat(core): runs may overlap; choosing the run to show`.

### Task 2: Run-choice holder

**Files:** create `src/store/run-choice.ts` and test it in `tests/store/run-choice.test.ts`.

**Interfaces:**
`class RunChoice { constructor(initial: string | undefined, save: (id: string) => void); get(): string | undefined; set(id: string): void; subscribe(fn: () => void): () => void }`

- `set` with the current id does nothing.
- Otherwise `set` stores the id, calls `save(id)`, then notifies each listener.

- [ ] **Step 1: Failing tests.**
  - `get()` returns the initial id.
  - `set("B")` calls `save` once with `"B"` and calls the listener once.
  - A second `set("B")` calls neither.
  - After unsubscribing, the listener isn't called.
- [ ] **Step 2: Run the tests and confirm they fail.** Then implement, confirm `npm test` is green, and commit with the message `feat(store): remembered run choice`.

### Task 3: UI wiring

**Files:** modify `src/main.ts`, `src/ui/view.ts`, `src/ui/home.ts`, `src/ui/status-bar.ts`, `src/ui/setup.ts` and `styles.css`.

The UI imports `obsidian`, so these changes have no unit tests. They're verified by the build and by the manual check.

- [ ] **Step 1:** Wire it up.
  - **`main.ts`:** in `onload`, run `const data = ((await this.loadData()) ?? {}) as { run?: string }`, then create `new RunChoice(data.run, (id) => void this.saveData({ ...data, run: id }))`. Pass it to the view and the badge. The badge subscribes to it.
  - **View:**
    - Store the choice.
    - Add a `select.sq-run-switch` at the end of `.sq-tabs` when `openRuns(s).length >= 2`. Its value is the `chosenRun` id.
    - On change: call `choice.set(id)`, set `setupUi.run = id`, then refresh.
    - Pass the chosen run id to Home.
    - Re-render on choice changes.
  - **Home:** take the run to show as a parameter instead of calling `currentRun`. Render the exam-week line only when `runHasExams`.
  - **Badge:** use `chosenRun(state, choice.get(), today)`.
  - **Setup:**
    - When `ui.run` is unset or invalid, use the `chosenRun` id, or `"new"` if there is none.
    - When the picker changes to an open run, call `choice.set`.
    - After `createRun` succeeds, call `choice.set(newId)`.
    - Setup receives the choice as a parameter.
  - **CSS:** `.studyquest .sq-run-switch { margin-left: auto; align-self: center; font-size: 12px; }`
- [ ] **Step 2: Confirm** `npm run build` exits 0 and `npm test` is green.
- [ ] **Step 3: Commit** the code with the spec and this plan. Message: `feat(ui): run switch in the tab bar`.

### Task 4: User check

- [ ] Ask the user to check each item:
  - create a run that overlaps Q2; the switch appears;
  - switching changes Home and the badge;
  - reloading Obsidian keeps the chosen run;
  - Setup opens on the chosen run;
  - the run with no exams shows no exam-week line.
