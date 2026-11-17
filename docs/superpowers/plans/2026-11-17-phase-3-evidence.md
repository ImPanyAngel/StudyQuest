# StudyQuest Phase 3 — Evidence and Readings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Silver on lectures, assignments and labs requires picking a vault file no other objective uses; readings become a bumpable counter over one or two named levels with a 30-minute undo per bump; new Progress objectives stop.

**Architecture:** Optional fields on two existing events (`levels`, `evidence`) and two new events (`reading_bumped`, `reading_bump_undone`) extend the log. Replay tracks reading position, a bump stack and an evidence-owner index. Planning adds `completeWithEvidence`, `bumpReading`, `undoBump`. The UI gets an Obsidian `FuzzySuggestModal` file picker, a reading menu, a levels field in Setup, and clickable evidence names.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5 (tests run under `TZ=America/New_York`). Unchanged.

**Spec:** `docs/superpowers/specs/2026-11-17-phase-3-evidence-design.md` (source of truth for behaviour). Phase 1 and 2 specs remain binding where phase 3 doesn't change them.

## Global Constraints

- Nothing under `src/core/` imports from `obsidian`. Vault access (file exists, list files, open file) stays in `src/ui/`.
- Log stays append-only. Phase 1–2 lines must replay exactly as before (silvers without evidence, readings without levels, Progress objectives).
- Evidence kinds: `lecture`, `assignment`, `lab`. Readings and exams never carry evidence.
- Evidence paths are vault paths, stored and compared exactly as given by Obsidian (`TFile.path`).
- Reading levels: 1 or 2 names, trimmed, non-empty; positions start at 0.
- Bump undo window: at most 30 minutes after the bump (reuse `withinUndoWindow`).
- Bulk-add kinds become `lecture`, `lab`. Setup's add form offers `lecture, assignment, lab, reading, exam` (no `progress`).
- Plugin version `0.3.0` in `manifest.json`, `package.json`, `versions.json` (`"0.3.0": "1.7.2"`).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Existing Q2 log after upgrading.** Old silvers, old readings without levels, and any Progress lines must replay to the same state, and old readings must still be finishable. → history fixture test in Task 2.
2. **Two objectives racing for one file** (two pickers open, or a quick second pick). Only one completion may own the path. → concurrent store test in Task 3.
3. **A path with `#`, `^` or `[` in it** (e.g. `Week 3 #notes.md`). Opening the evidence must open that file, not a heading. → open via `vault.getFileByPath` + `workspace.getLeaf().openFile`, never `openLinkText` (Task 5; manual check step).
4. **Bump undo right at the window edge**, and after two quick bumps. → tests at 30 / 31 minutes and two-step walk-back in Task 2.
5. **Levels typed as `Course,Chapter`, ` Chapter `, or `Course, , Chapter`.** Trim, drop empties, then require 1–2. → planning test in Task 3.

---

## File Structure

```
src/core/
  events.ts        + levels?, evidence?, ReadingBumped, ReadingBumpUndone, EVIDENCE_KINDS, ADDABLE_KINDS; BULK_KINDS = lecture, lab
  state.ts         + ObjectiveState.levels/position/bumps/bumped, completed.evidence; State.evidenceOwners
  log-format.ts    + field checks for the new events and fields
  replay.ts        + evidence rule, reading bump/undo, hasProgress includes bumped
  derive.ts        + objectiveLabel, canUndoBump, evidenceOwner; canUndo* use bumped
  actions.ts       + completeWithEvidence, bumpReading, undoBump; selfCheck/addObjective/bulk rules
src/ui/
  evidence-picker.ts   NEW  FuzzySuggestModal over vault files
  complete-menu.ts     evidence item, reading menu
  parts.ts             + renderEvidence
  home.ts, course.ts, run-page.ts, setup.ts, view.ts   labels, evidence, app threading, Setup levels
```

---

### Task 1: Event shapes, state and log format

**Files:**
- Modify: `src/core/events.ts`, `src/core/state.ts`, `src/core/log-format.ts`, `tests/core/fixtures.ts`, `package.json`, `manifest.json`, `versions.json`
- Test: `tests/core/log-format.test.ts`

**Interfaces:**
- Produces (`events.ts`):
  - `ObjectiveAdded.levels?: string[]`; `ObjectiveCompleted.evidence?: string`
  - `ReadingBumped { type: "reading_bumped"; obj: string; level: number }`, `ReadingBumpUndone { type: "reading_bump_undone"; obj: string }`, both in `QuestEvent` and `EVENT_TYPES`
  - `EVIDENCE_KINDS: Kind[] = ["lecture", "assignment", "lab"]`, `ADDABLE_KINDS: Kind[] = ["lecture", "assignment", "lab", "reading", "exam"]`, `BULK_KINDS = ["lecture", "lab"]`
- Produces (`state.ts`): `ObjectiveState.levels?: string[]`, `position: number[]` (zeros, length = levels, `[]` without levels), `bumps: { at: string; before: number[] }[]` (live bumps, newest last), `bumped: boolean`, `completed?: { tier; at; evidence?: string }`; `State.evidenceOwners: Map<string, string>` (path → objective id); `emptyState()` initialises it.
- Produces (`fixtures.ts`): `ev.objective(..., extra.levels)`, `ev.completed(obj, tier, t, evidence?)`, `ev.bump(obj, level, t)`, `ev.bumpUndone(obj, t)`.

- [ ] **Step 1: Failing tests** in `log-format.test.ts`: lines with `"levels":["Course","Chapter"]`, `"evidence":"A/B.md"`, a `reading_bumped` with numeric `level`, and a `reading_bump_undone` parse; lines with `"levels":"Chapter"`, `"levels":[1]`, `"evidence":3`, `"level":"1"` are skipped.
- [ ] **Step 2: Run `npm test`, confirm those fail.**
- [ ] **Step 3: Implement.** `applyEvent`'s `default` keeps the two new types rejected until Task 2. Bump versions.
- [ ] **Step 4: `npm test` green, `npm run build` clean.**
- [ ] **Step 5: Commit** `feat(core): evidence and reading event shapes`

---

### Task 2: Replay rules

**Files:**
- Modify: `src/core/replay.ts`
- Test: `tests/core/replay-evidence.test.ts` (new)

**Interfaces:**
- Consumes: Task 1.
- Produces: replay of the new fields and events per the spec's "Replay validity"; `hasProgress(o)` = completed, any step done, or `bumped`.

Rules:
- `objective_added` with `levels`: kind must be `reading`; array of 1–2 strings, each non-empty after trim (store trimmed). Sets `position` to zeros. Without `levels` a reading is a legacy reading (`position: []`).
- `objective_completed` with `evidence`: kind in `EVIDENCE_KINDS`, tier `silver`, non-empty string, else reject. If `evidenceOwners` already has the path: apply the silver **without** evidence. Otherwise apply with evidence and record the owner.
- `reading_bumped`: objective exists, kind `reading`, has `levels`, not completed, `level` integer in range. Push `{ at: e.t, before: [...position] }`, add 1 at `level`, zero every index after it, set `bumped = true`.
- `reading_bump_undone`: not completed; the last entry in `bumps` exists and `withinUndoWindow(last.at, e.t)`; pop it and restore `position = before`. `bumped` stays true.

- [ ] **Step 1: Failing tests:**
  - evidence: two lectures in Q2 completed with the same path → first has evidence, second is silver with `evidence` undefined; same across two runs and where the first run is closed; owners map holds the first.
  - evidence on a reading, an exam, or with tier `sat` → completion rejected; empty string → rejected.
  - **Review Focus 1:** a phase 1-style history (lecture silver without evidence, a reading without levels completed silver, a Progress objective with both steps and its silver) replays: all three complete, tiers silver, `evidence` undefined.
  - levels: `["Course","Chapter"]` → position `[0,0]`; levels on a lecture rejected; `[]`, three names, `[" "]` rejected.
  - bumps on `[Course, Chapter]`: bump 1, bump 1, bump 0 → `[1,0]`; undo → `[0,2]` (exact prior position).
  - **Review Focus 4:** undo at +30 min applies, at +31 min rejected; two bumps then two undos (each within 30 min of its bump) → `[0,0]`; a third undo rejected.
  - bump on a legacy reading, a lecture, or a completed reading rejected; level `2` on two levels rejected.
  - after one bump and its undo, `objective_undone` within the reading's 30 minutes is rejected, and so is `course_undone`.
  - bump on a closed run's reading is ignored (freeze).
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: `npm test` green.**
- [ ] **Step 5: Commit** `feat(core): replay evidence ownership and reading bumps`

---

### Task 3: Derived values and planning

**Files:**
- Modify: `src/core/derive.ts`, `src/core/actions.ts`
- Test: `tests/core/actions-evidence.test.ts` (new), `tests/store/quest-store.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (`derive.ts`):
  - `objectiveLabel(o: ObjectiveState): string`: title, plus ` [Course: 1; Chapter: 4]` (levels outermost first, `Name: n` joined by `; `) for readings with levels.
  - `canUndoBump(o: ObjectiveState, now: Date): boolean`; `bumpDeadline(o): Date | null` (for the "N min left" label).
  - `evidenceOwner(s: State, path: string): ObjectiveState | undefined`.
  - `canUndoObjective` and `canUndoCourse` treat `bumped` as progress.
- Produces (`actions.ts`), new `Action` members:
  - `{ type: "completeWithEvidence"; obj: string; path: string }` → one silver `objective_completed` with `evidence`. Refused: run blocked; kind not in `EVIDENCE_KINDS`; blank path; path owned → `That file already proves <course> · <title>.`
  - `{ type: "bumpReading"; obj: string; level: number }`, `{ type: "undoBump"; obj: string }` → one event each; refused when the run is blocked.
  - `addObjective` gains `levels?: string[]`; for `reading`: trim, drop empties, require 1–2 (`A reading needs one or two levels, like "Chapter" or "Course, Chapter".`). Kind `progress` refused: `Progress objectives are no longer available.`
  - `selfCheck` on an `EVIDENCE_KINDS` objective refused: `Pick the file that proves it.` Readings (legacy or not) and Progress keep `selfCheck`.
  - `bulkAddObjectives` error text becomes `Bulk add works for lectures and labs.`

- [ ] **Step 1: Failing tests:**
  - `objectiveLabel`: `Boot.dev [Course: 1; Chapter: 4]`, `Thinking in Systems [Chapter: 0]`, plain title for a lecture and for a legacy reading.
  - `completeWithEvidence` happy path and each refusal (owned path message includes the owner's course and title).
  - `selfCheck` on a lecture refused; on a reading allowed.
  - **Review Focus 5:** `addObjective` reading with levels `["Course", "", " Chapter "]` → event `levels: ["Course","Chapter"]`; `["a","b","c"]` and `[" "]` refused; progress refused; bulk reading refused.
  - `canUndoBump` true at +30 min, false at +31; `canUndoObjective` false after a bump even once undone.
  - **Review Focus 2 (store):** two concurrent `completeWithEvidence` for different lectures with the same path → one ok, one error; one line carries `evidence`.
- [ ] **Step 2: Run, confirm fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: `npm test` green, build clean.**
- [ ] **Step 5: Commit** `feat(core): plan evidence completions and reading bumps`

---

### Task 4: Evidence picker and completion menus

**Files:**
- Create: `src/ui/evidence-picker.ts`
- Modify: `src/ui/complete-menu.ts`, `src/ui/home.ts`, `src/ui/course.ts`, `src/ui/view.ts`

**Interfaces:**
- Consumes: Task 3 actions and `evidenceOwner`, `canUndoBump`, `bumpDeadline`.
- Produces:
  - `class EvidencePicker extends FuzzySuggestModal<TFile>`, constructed `(app: App, store: QuestStore, obj: ObjectiveState)`. `getItems()`: `app.vault.getFiles()` minus paths starting `StudyQuest/`. `getItemText(f)`: `f.path`. `renderSuggestion`: path, and for an owned file `used · <course> · <title>` with class `is-used` (muted). `onChooseItem`: owned → `Notice` and stay; else dispatch `completeWithEvidence`, `Notice` on error. Placeholder: `Pick the file that proves "<title>"`.
  - `openCompleteMenu(evt, obj, store, app)`: `app` added. Evidence kinds: label, disabled AI item, then **Pick evidence file → silver…** (opens the picker). Readings with levels: `Next <level lowercased> → <Level> <n+1>` per level innermost first, with ` (<Inner> back to 0)` on outer levels; **Undo last bump · N min left** when `canUndoBump`; **Finished → silver** (`selfCheck`). Legacy readings: **Finished → silver** only. Progress: unchanged.
  - `renderHome(el, store, nav, clock, app)` and `renderCourse(el, store, route, nav, clock, app)` gain `app`; the view passes `this.app`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm test` green, `npm run build` clean.**
- [ ] **Step 3: Commit** `feat(ui): evidence picker and reading menu`

---

### Task 5: Labels, evidence links and Setup

**Files:**
- Modify: `src/ui/parts.ts`, `src/ui/home.ts`, `src/ui/course.ts`, `src/ui/run-page.ts`, `src/ui/setup.ts`, `src/ui/view.ts`, `styles.css`

**Interfaces:**
- Consumes: `objectiveLabel`, `ADDABLE_KINDS`, `BULK_KINDS`.
- Produces: `renderEvidence(parent: HTMLElement, o: ObjectiveState, app: App): void`: nothing without evidence; else the file's base name, `title` = full path; if `app.vault.getFileByPath(path)` exists it is a link that opens via `app.workspace.getLeaf(false).openFile(file)` (**never** `openLinkText`, Review Focus 3); else plain muted text. `renderRunPage` and `renderSetup` gain `app`.

Behaviour:
- Every objective title shown (Home rows, course view, run page, Setup list) uses `objectiveLabel`.
- `renderEvidence` after the mark in the course view, run page and Setup list.
- Setup: kind select uses `ADDABLE_KINDS`; for `reading`, a `Levels` field (placeholder `Chapter, or Course, Chapter`, draft key `obj.levels`, default value `Chapter`) split on commas into `levels`; the Progress steps textarea is removed; bulk select uses `BULK_KINDS` with placeholder prefix `Lecture`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: `npm test` green, `npm run build` clean.**
- [ ] **Step 3: Commit** `feat(ui): reading labels, evidence links, Setup levels`

---

### Task 6: Manual check in Obsidian

Done by the user in `~/Downloads/StudyQuest` after reloading the plugin.

- [ ] 1. StudyQuest shows version 0.3.0.
- [ ] 2. Click an open lecture → **Pick evidence file → silver…** → pick a note: it turns SILVER; the course view shows the file name, and clicking it opens that note.
- [ ] 3. Open the picker for a second lecture: the first note is greyed out with "used · …" and can't be chosen.
- [ ] 4. Rename a test note to include `#` (e.g. `Week 3 #notes.md`), use it as evidence, and click its name: the note itself opens.
- [ ] 5. Setup: Progress is gone from the type list; bulk add offers Lecture and Lab only. Add a reading "Boot.dev" with levels `Course, Chapter`: Home shows `Boot.dev [Course: 0; Chapter: 0]`.
- [ ] 6. Next chapter twice → `[Course: 0; Chapter: 2]`; Next course → `[Course: 1; Chapter: 0]`; Undo last bump → `[Course: 0; Chapter: 2]`; Finished → silver, no file asked.
- [ ] 7. Restart Obsidian: everything above is unchanged; older Q2 objectives look as before.
