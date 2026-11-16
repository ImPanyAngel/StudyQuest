# StudyQuest Phase 2 — Prestige Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Runs close themselves after their end date, freezing score, tier and stains; a Prestige Up screen marks each close once; a Hall tab lists every run as a card that opens its full achievement list; all day logic runs on Amsterdam time.

**Architecture:** Two new events (`quarter_closed`, `prestige_seen`) extend the phase 1 event log. The core gains tier math, close planning and a freeze rule in `applyEvent`; a per-file filter drops lines written below a run's close. The store's daily check writes exam sats and closes in one ordered batch. The UI adds a takeover Prestige Up screen, a Hall tab and a read-only run page, and shows closed runs as closed everywhere else.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5, Node 26. Unchanged from phase 1.

**Spec:** `docs/superpowers/specs/2026-11-16-phase-2-prestige-design.md` (read it alongside this plan; it is the source of truth for behaviour). Phase 1 spec and code remain binding where phase 2 doesn't change them.

## Global Constraints

- Nothing under `src/core/` imports from `obsidian`.
- The log stays append-only. No line is ever rewritten, reordered or deleted.
- "Today" / local date = the calendar date in **Europe/Amsterdam** at the clock's instant, regardless of the system time zone.
- Tests run with `TZ=America/New_York` (set in the npm `test` script) to prove nothing depends on the Mac's zone.
- Tier table: 100 → 5, 95–99 → 4, 90–94 → 3, 85–89 → 2, 75–84 → 1, below 75 or no objectives → 0. Labels: `Tier 5` … `Tier 1`, `Unranked` for 0.
- Percentages stay `Math.floor(100 * done / total)`; `total` 0 → `null`, shown as "—".
- `quarter_closed` fields: `run` (string), `done`, `total`, `tier` (numbers). `prestige_seen` fields: `run`.
- `manifest.json` `minAppVersion: "1.7.2"` (the highest `@since` among APIs used: `workspace.revealLeaf` returning a promise). Plugin version `0.2.0` in `manifest.json`, `package.json`, and `versions.json` (`"0.2.0": "1.7.2"`).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Exam on the run's last day, Obsidian first opened the day after.** The exam must be sat *before* the close, so the frozen score includes it. → store test in Task 5.
2. **Mac set to another time zone, or Obsidian open across a DST night.** Day changes and the midnight timer follow Amsterdam. → whole suite under `TZ=America/New_York` plus DST tests in Task 1.
3. **Restart or log reload after pressing "Set up next run".** The Prestige Up screen must not come back. → store test in Task 5.
4. **A line pasted into a closed run's file with an older timestamp.** It must not change marks or stains. → `dropAfterClose` tests in Task 3, store reload test in Task 5.
5. **Double click on "Set up next run".** Only one `prestige_seen` line is written. → store test in Task 5 (replay rejects the second; the button also uses `singleFlight`).

---

## File Structure

```
src/core/
  dates.ts          + Amsterdam localDateOf, nextLocalMidnight
  events.ts         + QuarterClosed, PrestigeSeen, eventRun
  prestige.ts       NEW  PrestigeTier, tierFor, tierLabel
  state.ts          + RunState.closed, RunState.seenAt
  log-format.ts     + REQUIRED entries, dropAfterClose
  replay.ts         + quarter_closed / prestige_seen rules, freeze
  derive.ts         + isClosed, runScore, stains, runsDueToClose, unseenPrestige, hallRuns
  actions.ts        + acknowledgePrestige action, planDailyCheck; runOf removed
src/store/quest-store.ts   load filters per file; runAutoSat → runDailyCheck
src/ui/
  parts.ts          + Route hall/run, renderSprite, renderMark
  prestige-up.ts    NEW  takeover screen
  hall.ts           NEW  library grid
  run-page.ts       NEW  read-only achievement list
  view.ts           Hall tab, routes, takeover
  home.ts, course.ts, setup.ts, status-bar.ts   closed-run handling
src/main.ts         daily check, Amsterdam midnight, reveal on unseen close
styles.css          prestige, hall, run page, stain mark
```

---

### Task 1: Amsterdam dates and version bump

**Files:**
- Modify: `src/core/dates.ts`, `src/main.ts` (`scheduleMidnightCheck`), `package.json`, `manifest.json`, `versions.json`
- Test: `tests/core/dates.test.ts`

**Interfaces:**
- Produces: `localDateOf(d: Date): LocalDate` (now Amsterdam), `nextLocalMidnight(now: Date): Date` (first instant strictly after `now` at which the Amsterdam date changes).

- [ ] **Step 1: Switch the test script to New York and write the failing tests**

In `package.json`: `"test": "TZ=America/New_York vitest run"`. Replace the `localDateOf uses local time` test and add:

```ts
test("localDateOf is the Amsterdam date", () => {
  expect(localDateOf(new Date("2027-01-27T23:30:00Z"))).toBe("2027-01-28"); // 00:30 CET
  expect(localDateOf(new Date("2027-01-27T22:30:00Z"))).toBe("2027-01-27"); // 23:30 CET
  expect(localDateOf(new Date("2027-03-28T22:30:00Z"))).toBe("2027-03-29"); // 00:30 CEST
  expect(localDateOf(new Date("2027-03-28T21:30:00Z"))).toBe("2027-03-28"); // 23:30 CEST
});

test("nextLocalMidnight follows Amsterdam across DST", () => {
  expect(nextLocalMidnight(new Date("2027-01-27T12:00:00Z")).toISOString()).toBe("2027-01-27T23:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-01-27T23:00:00Z")).toISOString()).toBe("2027-01-28T23:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-03-28T12:00:00Z")).toISOString()).toBe("2027-03-28T22:00:00.000Z");
  expect(nextLocalMidnight(new Date("2027-10-31T12:00:00Z")).toISOString()).toBe("2027-10-31T23:00:00.000Z");
});
```

- [ ] **Step 2: Run `npm test` and confirm these fail** (and note any other test that now fails under New York; it relied on the system zone and must be fixed in Step 3, not by changing its expected Amsterdam values).

- [ ] **Step 3: Implement**

`localDateOf`: `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" })`, created once at module level; `en-CA` formats as `YYYY-MM-DD`. `nextLocalMidnight`: take `addDays(localDateOf(now), 1)`, and of the two candidates `UTC midnight of that date − 1h` and `− 2h`, return the one whose `localDateOf` is that date while `localDateOf(candidate − 1 ms)` is the day before.

In `main.ts`, `scheduleMidnightCheck` uses `nextLocalMidnight(new Date())` plus 5 seconds instead of local `Date` getters.

Bump versions per Global Constraints.

- [ ] **Step 4: `npm test` all green, `npm run build` clean.**

- [ ] **Step 5: Commit** `feat(core): Amsterdam calendar dates; minAppVersion 1.7.2`

---

### Task 2: Prestige events, tiers and state

**Files:**
- Create: `src/core/prestige.ts`, `tests/core/prestige.test.ts`
- Modify: `src/core/events.ts`, `src/core/state.ts`, `src/core/log-format.ts`, `tests/core/fixtures.ts`, `tests/core/log-format.test.ts`, `tests/core/events.test.ts`

**Interfaces:**
- Produces:
  - `events.ts`: `QuarterClosed { type: "quarter_closed"; run: string; done: number; total: number; tier: number }`, `PrestigeSeen { type: "prestige_seen"; run: string }`, both in `QuestEvent` and `EVENT_TYPES`; `eventRun(e: QuestEvent): string` = `e.run` if present, else the part of `e.obj` before `/`.
  - `prestige.ts`: `type PrestigeTier = 0 | 1 | 2 | 3 | 4 | 5`; `tierFor(pct: number | null): PrestigeTier`; `tierLabel(t: PrestigeTier): string`.
  - `state.ts`: `RunState.closed?: { done: number; total: number; tier: PrestigeTier; at: string }`, `RunState.seenAt?: string`.
  - `fixtures.ts`: `ev.closed(run, done, total, tier, t)`, `ev.seen(run, t)`.

- [ ] **Step 1: Failing tests**

```ts
test("tierFor boundaries", () => {
  expect([null, 0, 74, 75, 84, 85, 89, 90, 94, 95, 99, 100].map(tierFor)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});
test("tierLabel", () => {
  expect(tierLabel(0)).toBe("Unranked");
  expect(tierLabel(3)).toBe("Tier 3");
});
test("eventRun", () => {
  expect(eventRun(ev.closed("2026-27-Q2", 1, 2, 0, at(0)))).toBe("2026-27-Q2");
  expect(eventRun(ev.completed("2026-27-Q2/C1-LEC01", "silver", at(0)))).toBe("2026-27-Q2");
});
```

In `log-format.test.ts`: a `quarter_closed` line with numeric `done/total/tier` and a `prestige_seen` line parse; a `quarter_closed` with `"done":"3"` (string) is skipped.

- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.** `REQUIRED` gains `quarter_closed: { run: S, done: N, total: N, tier: N }`, `prestige_seen: { run: S }`. `applyEvent`'s `default` branch keeps them rejected for now (Task 3 adds the rules).
- [ ] **Step 4: Run, all green.**
- [ ] **Step 5: Commit** `feat(core): prestige events, tiers, closed run state`

---

### Task 3: Replay rules: close, seen, freeze

**Files:**
- Modify: `src/core/replay.ts`, `src/core/log-format.ts`, `src/core/actions.ts` (remove `runOf`), `src/store/quest-store.ts` (use `eventRun` in `write`), `tests/core/actions.test.ts` (drop the `runOf` test)
- Test: `tests/core/replay-prestige.test.ts` (new), `tests/core/log-format.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `localDateOf`.
- Produces: `applyEvent` handles `quarter_closed`, `prestige_seen` and returns `"This run is closed."` for any other event whose `eventRun` is a closed run. `dropAfterClose(events: QuestEvent[]): QuestEvent[]` in `log-format.ts`.

Rules (from the spec):
- `quarter_closed`: run exists; not already closed; `localDateOf(new Date(e.t)) > run.end`; `done`, `total` integers with `0 ≤ done ≤ total`; `tier` integer 0–5. On success set `run.closed = { done, total, tier, at: e.t }`. No recount.
- `prestige_seen`: run exists, closed, `seenAt` unset → set `seenAt = e.t`.
- Freeze: checked first in `applyEvent` for every type except `quarter_created`, `quarter_closed`, `prestige_seen`.
- `dropAfterClose`: walks one file's events in file order; after the first `quarter_closed` for run R, drops every later event with `eventRun(e) === R` except `prestige_seen`. Events for other runs pass through.

- [ ] **Step 1: Failing tests** (`R = Q2.run`, end `2027-01-30`; `day31 = "2027-01-31T08:00:00.000Z"`):
  - close dated `2027-01-30T22:59:00Z` (still 30 Jan in Amsterdam) is ignored; `2027-01-30T23:00:00Z` is applied.
  - close with `done: 3, total: 2` ignored; `tier: 6` ignored; `tier: 2.5` ignored.
  - second close for the same run ignored; the first close's `done/total/tier` kept even when they don't match the objectives (no recount).
  - after close: `objective_completed`, `step_completed`, `objective_added`, `course_added`, `objective_undone` for that run are ignored; an event for another run still applies.
  - `prestige_seen` before any close ignored; after close sets `seenAt`; a second one ignored.
  - `dropAfterClose([added, closed, completedBackdated, seen])` → `[added, closed, seen]`, where `completedBackdated.t` is earlier than `closed.t`; an event for another run below the close is kept.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.** Replace `runOf(e, s)` usages with `eventRun(e)`.
- [ ] **Step 4: `npm test` green, build clean.**
- [ ] **Step 5: Commit** `feat(core): close and prestige_seen rules, freeze closed runs`

---

### Task 4: Derived values and daily-check planning

**Files:**
- Modify: `src/core/derive.ts`, `src/core/actions.ts`
- Test: `tests/core/derive.test.ts`, `tests/core/actions.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3.
- Produces (`derive.ts`):
  - `isClosed(run: RunState): boolean`
  - `interface Score { done: number; total: number; pct: number | null; tier: PrestigeTier | null }`; `runScore(s: State, run: string): Score`: closed → stored counts, `pct` from them, stored tier; otherwise live `runProgress` with `tier: null`.
  - `stains(s: State, run: string): ObjectiveState[]`: open objectives of a closed run in add order; `[]` for an unclosed run.
  - `runsDueToClose(s: State, today: LocalDate): RunState[]`: unclosed runs with `today > end`, oldest `end` first.
  - `unseenPrestige(s: State): RunState[]`: closed runs without `seenAt`, oldest `end` first.
  - `hallRuns(s: State): { open: RunState[]; closed: RunState[] }`: open = unclosed, `start` ascending; closed = `end` descending.
- Produces (`actions.ts`):
  - `Action` gains `{ type: "acknowledgePrestige"; run: string }` → one `prestige_seen` draft (validated by `applyEvent` like the rest).
  - `planDailyCheck(s: State, now: Date, newId: IdFactory): QuestEvent[]`: the `planAutoSat` events, then, against a `structuredClone` with those applied, one `quarter_closed` per `runsDueToClose` with `runProgress` counts and `tierFor(pct)`. All share `t = now.toISOString()`; ids come from `newId` in that order, so sats sort before closes.

- [ ] **Step 1: Failing tests**
  - `planDailyCheck` with an exam dated `2027-01-30`, now `2027-01-31T08:00Z`, 1 of 2 other objectives silver: returns `[sat, close]`; close has `done: 2, total: 3, tier: 0`; `replay([...log, ...events])` gives `runScore` `{ done: 2, total: 3, pct: 66, tier: 0 }`.
  - Same now `2027-01-30T22:00Z` (still 30 Jan): returns `[]`.
  - Two runs both past end: closes ordered by end date.
  - Already-closed run: nothing planned.
  - `stains` lists the open objective of a closed run; `[]` before close.
  - `unseenPrestige` / `hallRuns` ordering per the signatures above.
  - `planAction(acknowledgePrestige)` on an unclosed run → error; on a closed one → one `prestige_seen` event.
  - `planAction(selfCheck)` on a closed run's objective → error `"This run is closed."`.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, green.**
- [ ] **Step 5: Commit** `feat(core): run score, stains, hall order, daily check planning`

---

### Task 5: Store daily check and file-order load

**Files:**
- Modify: `src/store/quest-store.ts`, `src/main.ts`
- Test: `tests/store/quest-store.test.ts`

**Interfaces:**
- Consumes: `planDailyCheck`, `dropAfterClose`, `eventRun`, `unseenPrestige`.
- Produces: `QuestStore.runDailyCheck(): Promise<number>` (replaces `runAutoSat`; events written, 0 on failure). `load()` parses each file as `dropAfterClose(parseLog(text))`.

- [ ] **Step 1: Failing tests** (update the existing `runAutoSat` test to `runDailyCheck`):
  - **Review Focus 1:** exam on `2027-01-30`, clock `2027-01-31T08:00Z`: one `runDailyCheck()` writes a sat line then a `quarter_closed` line, in that order, to `2026-27-Q2`; the stored close counts the exam as done; a second call returns 0.
  - **Review Focus 3:** after `dispatch({ type: "acknowledgePrestige", run })` and a fresh `load()`, `unseenPrestige(store.state)` is empty.
  - **Review Focus 4:** append a line by hand to the run's file below the close: an `objective_completed` for an open objective with `t` one minute *before* the close. After `load()`, that objective is still open and `stains` still lists it.
  - **Review Focus 5:** two concurrent `dispatch(acknowledgePrestige)` calls: one returns ok, one returns an error; exactly one `prestige_seen` line in the file.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.** In `main.ts`, call `runDailyCheck` wherever `runAutoSat` was called.
- [ ] **Step 4: `npm test` green, build clean.**
- [ ] **Step 5: Commit** `feat(store): daily check closes runs; ignore lines below a close`

---

### Task 6: Prestige Up screen

**Files:**
- Create: `src/ui/prestige-up.ts`
- Modify: `src/ui/parts.ts`, `src/ui/home.ts` (use `renderSprite`), `src/ui/view.ts`, `src/main.ts`, `styles.css`

**Interfaces:**
- Consumes: `unseenPrestige`, `runScore`, `tierLabel`, `singleFlight`.
- Produces:
  - `parts.ts`: `renderSprite(parent: HTMLElement): void`, the phase 1 placeholder figure moved out of `home.ts`.
  - `prestige-up.ts`: `renderPrestigeUp(el: HTMLElement, run: RunState, score: Score, onContinue: () => Promise<void>): void`.
  - `view.ts`: `StudyQuestView.openSetupForNewRun(): void` sets `setupUi.run = "new"` and navigates to Setup.

Behaviour:
- `refresh()`: if `unseenPrestige(state)[0]` exists, render only the Prestige Up screen (no tabs) for it and return.
- Layout B: `PRESTIGE UP`, `<run name> · complete`, then a row with the sprite (scaled up) on the left and, on the right, the percentage ("—" when null) large and the tier label. Buttons: **Set up next run →** (single-flight; dispatches `acknowledgePrestige`, shows a `Notice` on error, and when no unseen runs remain calls `openSetupForNewRun`); **Customise character**, disabled, `title="Arrives in phase 6"`.
- `main.ts`: after `load` + `runDailyCheck` on layout ready, and in `onNewDay`, if `unseenPrestige` isn't empty, open the view (reuse `openHome`).
- Styles: scoped under `.studyquest .sq-prestige`; no Obsidian theme dependency beyond readability.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm test` green, `npm run build` clean.**
- [ ] **Step 3: Commit** `feat(ui): Prestige Up screen`

---

### Task 7: Hall tab and run page

**Files:**
- Create: `src/ui/hall.ts`, `src/ui/run-page.ts`
- Modify: `src/ui/parts.ts`, `src/ui/view.ts`, `src/ui/course.ts` (use `renderMark`), `styles.css`

**Interfaces:**
- Consumes: `hallRuns`, `runScore`, `stains`, `courseObjectives`, `courseProgress`, `tierLabel`.
- Produces:
  - `Route` gains `{ tab: "hall" }` and `{ tab: "run"; run: string }`.
  - `renderMark(parent: HTMLElement, o: ObjectiveState, closed: boolean): void`: SILVER / SAT from `o.completed.tier`; otherwise `STAIN` when `closed`, else `open`. Classes `sq-mark is-silver|is-sat|is-stain|is-open`.
  - `renderHall(el, store, nav, clock)`, `renderRunPage(el, store, route, nav)`.

Behaviour (spec, Prestige hall):
- Tabs: Home, Setup, Hall; Hall is active for `hall` and `run` routes.
- Hall grid: `open` runs first as dashed cards (name, live %, `ends <formatShort(end)>`, or `starts <formatShort(start)>` if `start > today`), then `closed` cards (placeholder art, name, frozen %, tier label, `N stains` / `no stains`). Empty state: "No runs yet." Click → run page.
- Run page: `← Hall`; header `name · pct · tier label` (tier only if closed), `start → end`, `done of total`, stain count if closed; courses in add order with course %, objectives in add order with type tag, title, `renderObjectiveMeta`, `renderMark`. No click handlers.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm test` green, `npm run build` clean.**
- [ ] **Step 3: Commit** `feat(ui): Prestige hall and run page`

---

### Task 8: Closed runs on Home, course view, Setup and status bar

**Files:**
- Modify: `src/ui/home.ts`, `src/ui/course.ts`, `src/ui/setup.ts`, `src/ui/status-bar.ts`, `styles.css`

**Interfaces:**
- Consumes: `isClosed`, `runScore`, `tierLabel`, `renderMark`.

Behaviour (spec, Elsewhere):
- **Home**, current run closed: only `<run name> is closed`, `<pct> · <tier label>`, and buttons **Go to Setup** and **Open Hall**.
- **Course view**, closed run: marks via `renderMark(…, true)`; no row is clickable.
- **Setup**, closed run selected: section 1 shows `start → end · closed · <pct> · <tier label>`; course and objective lists render without Undo buttons; no add, bulk or course forms.
- **Status bar:** `shortName` plus `runScore(...).pct` (frozen for a closed run).

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm test` green, `npm run build` clean.**
- [ ] **Step 3: Commit** `feat(ui): show closed runs as closed`

---

### Task 9: Manual check in Obsidian

Done by the user in `~/Downloads/StudyQuest` (the sandbox can't list that folder). Reload the plugin after `npm run build`.

- [ ] 1. Settings → Community plugins shows StudyQuest 0.2.0 and it loads.
- [ ] 2. An already-ended run can't be filled through Setup (adds stop after the end date), so create `StudyQuest/log/Test-P2.md` in the vault with exactly these lines (1–15 Oct 2026, so it doesn't overlap Q2):

```
{"id":"e_P2000000000000000000000001","t":"2026-10-01T09:00:00.000Z","type":"quarter_created","run":"Test-P2","name":"Test P2","start":"2026-10-01","end":"2026-10-15"}
{"id":"e_P2000000000000000000000002","t":"2026-10-01T09:01:00.000Z","type":"course_added","run":"Test-P2","course":"TST1","name":"Test course","folder":"TST1/"}
{"id":"e_P2000000000000000000000003","t":"2026-10-01T09:02:00.000Z","type":"objective_added","obj":"Test-P2/TST1-LEC01","run":"Test-P2","course":"TST1","kind":"lecture","title":"Lecture 1","source":"manual"}
{"id":"e_P2000000000000000000000004","t":"2026-10-01T09:02:00.000Z","type":"objective_added","obj":"Test-P2/TST1-LEC02","run":"Test-P2","course":"TST1","kind":"lecture","title":"Lecture 2","source":"manual"}
{"id":"e_P2000000000000000000000005","t":"2026-10-02T09:00:00.000Z","type":"objective_completed","obj":"Test-P2/TST1-LEC01","tier":"silver"}
```

Reload the plugin: Prestige Up appears (layout B) for **Test P2** with **50% · Unranked**, and a `quarter_closed` line has been appended to the file.
- [ ] 3. **Set up next run** lands on Setup with "New run…" selected. Reload Obsidian: the screen does not return.
- [ ] 4. Hall: the Q2 run is a dashed card first with its live %; Test P2 card shows 50%, Unranked, 1 stain. Its run page shows SILVER and STAIN.
- [ ] 5. Selecting Test P2 in Setup shows it as closed with no forms; its course view has no clickable rows.
- [ ] 6. Paste this backdated line at the bottom of `Test-P2.md` and reload: Lecture 2 stays a STAIN and the card stays 50%.
  `{"id":"e_P2000000000000000000000009","t":"2026-10-03T09:00:00.000Z","type":"objective_completed","obj":"Test-P2/TST1-LEC02","tier":"silver"}`
- [ ] 7. Delete `StudyQuest/log/Test-P2.md`, reload; Q2 unchanged.
- [ ] 8. Commit nothing; record the result in the ledger.
