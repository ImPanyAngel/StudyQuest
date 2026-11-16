# StudyQuest Phase 1 — Core Loop: Design

Nov 16, 2026 · spec for phase 1 of [the design doc](../../Design%20Document.md)

## Intent

Phase 1 makes StudyQuest usable for real during 2026-27 Q2 with manually added objectives. On the first day of a quarter you set up the run (dates, courses, objectives). Every day after, you open Obsidian, see the quarter's completion and what's open, and mark things done. Starting study is the hard part; a visible, honest record of what's done is the pull.

The event log format defined here is the foundation for every later phase. Later phases may add new event types but must not change the meaning of the ones defined here.

## Goals

- Create a prestige run with its start and end dates.
- Add courses to the run, including resits of courses from earlier runs.
- Add objectives manually, including a bulk add for numbered series (Lecture 1–14).
- See overall and per-course completion on a Home screen, plus the open objectives.
- Open a course to see all its objectives and their marks.
- Complete objectives by self check (silver). Complete Progress objectives step by step.
- Exams complete themselves with a neutral **sat** mark once their date passes.
- Everything is stored as an append-only event log and recalculated by replaying it.

## Non-goals (later phases)

- Freezing a run at its end date, prestige tiers, stains, the Prestige hall (phase 2).
- Linking notes as evidence, frontmatter tags, course folder suggestions (phase 3).
- AI or rule-based verification, gold marks (phase 4).
- Roadmap or schedule import (phase 5).
- XP, levels, coins, the real character, pixel-art styling (phase 6).
- The Quarter board screen. It has been dropped; Home plus the course view cover it.
- iPhone or any mobile support.
- A settings tab.

## Anti-goals

These would make phase 1 a failure even if everything else works:

- **Any way to remove history** outside the 30-minute undo windows. No delete buttons, no editing of past events, no rewriting of log lines.
- **Tracking time.** Nothing measures minutes studied.
- **Rewriting the log file.** The plugin only ever appends lines. It never rewrites or reorders existing ones.

## Constraints

- Obsidian community plugin, TypeScript, desktop only (`isDesktopOnly: true`). Runs on the user's Mac.
- All state lives in the vault: one log file per run at `StudyQuest/log/<run-id>.md`, as the design doc specifies. `data.json` holds settings only (none in phase 1).
- Dates the user enters are local calendar dates, stored as `YYYY-MM-DD`. Event timestamps are ISO 8601 UTC.

## Concepts and rules

### Prestige run

- Has a **name** (e.g. "2026-27 Q2"), a **start date** and an **end date**, entered manually from the TU Delft calendar. Normally one quarter; the thesis is one run spanning up to three quarters.
- **Run ID** is derived from the name, keeping its case: spaces become `-` and other characters outside `[A-Za-z0-9-]` are dropped (`2026-27 Q2` → `2026-27-Q2`). It must be unique; it names the log file.
- **Validation:** end is after start; the range is at least 7 days; runs may not overlap each other.
- **Exam week** is derived: from `end − 7 days` to `end`, inclusive.
- **Current run** is the run whose dates contain today. If none, the next upcoming run; if none, the most recent past run. Home and the status bar show the current run.
- **Date lock:** a run's dates can be corrected only within **30 minutes** of creating the run. After that they are fixed. A correction is refused if any existing assignment due date or exam date would fall outside the corrected run or exam week.

### Course

- Belongs to one run. Fields: **code** (e.g. `DSAIT4000`), **name**, **vault folder** (stored now, used from phase 3).
- A code is unique within a run, but the same code may appear in several runs. **Resit** is not stored; it is derived: a course is a resit if the same code appears in a run that started earlier. Resits show a `RESIT` tag.
- A course can be undone within **30 minutes** of adding it, which also removes any objectives added to it. It can't be undone once any of its objectives has a completion or a checked step. After that it is permanent. Once undone, the same code can be added to the run again.

### Objective

- Fields: **type**, **title**, **course**, **source** (`manual` in phase 1; `roadmap` arrives in phase 5), optional **date**, and for Progress, a list of **steps**.
- Types: Lecture, Assignment, Lab, Reading, Progress, Exam.
- **Dates:** only Assignments (due date) and Exams (exam date) have one, and for those two it is required. Lectures, labs, readings and progress objectives are "anytime".
  - Assignment due date must fall within the run (`start ≤ due ≤ end`).
  - Exam date must fall within exam week.
- **Progress** objectives hold an ordered list of named steps (e.g. "Ch. 1" … "Ch. 5"), at least two.
- **Objective ID:** `<COURSE>-<TYPE><NN>`, unique within its run, e.g. `DSAIT4000-LEC05`. Type codes: `LEC`, `ASG`, `LAB`, `RDG`, `PRG`, `EXM`. `NN` is the next number for that course and type, zero-padded to two digits, counting every objective ever added (undone ones included, so IDs are never reused). The full ID used in the log is run-qualified: `2026-27-Q2/DSAIT4000-LEC05`.
- **Undo:** a manual objective can be undone within **30 minutes** of adding it. **Any completion ends the undo window early**: once the objective is completed (silver or sat) or any of its Progress steps is checked, it can't be undone. After that it can never be removed or edited.
- **Bulk add:** for Lectures, Labs and Readings, a title prefix and a number range (e.g. "Lecture", 1 to 14) creates one objective per number ("Lecture 1" … "Lecture 14"). Each is a normal objective with its own undo window.

### Completion and marks

| Mark | How | Phase |
| --- | --- | --- |
| open | not yet complete | 1 |
| silver | self check | 1 |
| sat | exam date passed (automatic) | 1 |
| gold | evidence passes verification | 4 |

- **Self check:** clicking an open, non-exam objective on Home or in a course view opens a small menu: "Complete?" with **AI check** (shown disabled, labelled as coming later) and **Self check → silver**. Choosing Self check completes it immediately. The menu is the confirmation; there is no second prompt. Completion is permanent.
- **Progress objectives:** the menu lists the steps; each open step can be self-checked on its own. There is no whole-objective self check. When the last step is checked, the plugin writes that `step_completed` event followed by an explicit `objective_completed` event with tier `silver`. Step checks are permanent.
- **Exams** never offer self check. An exam completes as **sat** once its date has passed, meaning the local day after the exam date has started. The plugin checks on load and once a day, just after local midnight while Obsidian stays open, and appends one completion event per exam that has passed and isn't complete yet.
- After a run's end date, the UI stops offering adds and self checks for that run. (The full freeze, tiers and stains are phase 2.) Exam auto-sat still runs for that run's exams.

### Completion percentage

- **Course %** = completed objectives ÷ all objectives in the course (undone ones excluded). Silver, sat and gold all count fully. A Progress objective counts as one objective; its steps only drive its own progress bar. A course with no objectives shows "—".
- **Run %** = completed objectives ÷ all objectives across the run (not an average of course percentages).
- Percentages are rounded down to whole numbers, so 100% only shows when everything is done.

## Screens

One Obsidian view, opened as a tab in the main workspace. It has its own tab switcher with two tabs, **Home** and **Setup**, plus a course view reached from Home. Plain wireframe styling in phase 1; the visual theme is undecided and comes later. Styling must not depend on the Obsidian theme beyond basic readability.

Mockups from the brainstorm are in `.superpowers/brainstorm/` (gitignored, local only): `home-v2.html`, `setup-v1.html`, `course-v1.html`. The user's own drawing is `docs/Home Prototype Design.png`.

### Home

- **Top row**, left to right:
  - A **completion ring** with the run %, labelled with the run name.
  - Above the course list, a low-key line: **"Exam week: Sat 23 Jan → Sat 30 Jan 2027"**.
  - The **course list**: code, name, a small bar and the course %. Resits carry a `RESIT` tag. Clicking a course opens its course view.
  - A **character box** to the right of the course list: a static grey placeholder figure until phase 6.
- **Objectives list** below: open objectives of the current run only.
  - First the dated ones (assignments and exams), soonest first. Overdue assignments stay at the top, marked as overdue. Due dates within 2 days are highlighted.
  - Then an "anytime" divider, then the undated ones grouped by course (in the order courses were added), each group in the order objectives were added.
  - Each row: type tag, `CODE · title`, date if any, and step count (`2/5`) for Progress.
  - Clicking a row opens the completion menu described above. Exam rows aren't clickable.
- If no run exists, Home shows a prompt that links to Setup.

### Course view

- Header: code, name, bar and course %, `RESIT` tag if applicable, a back link to Home.
- Every objective in the course in the order added, with type tag, title, date if any, step count for Progress, and its mark (open, silver, sat; gold later).
- Open rows are clickable and open the same completion menu.

### Setup

Three stacked sections:

1. **Run dates.** Create a run (name, start, end) with validation. Shows the derived exam week. Within 30 minutes of creation the dates are editable, with a visible countdown; after that they're shown read-only. A selector lets you switch which run you are setting up (e.g. preparing next quarter in advance).
2. **Courses.** List of the selected run's courses. Form to add one: code, name, vault folder. Within 30 minutes of adding, a course shows an **Undo** button with a countdown.
3. **Objectives.** Pick a course; see its objectives; add one (type, title, date field only for Assignment and Exam, step names for Progress). A bulk-add form for numbered series. Recently added objectives show **Undo** with a countdown. A disabled "Import roadmap / schedule" button marks where phase 5 will go.

### Elsewhere in Obsidian

- **Ribbon icon** that opens the StudyQuest view on Home.
- **Status-bar badge** showing the current run's short name and % (e.g. "Q2 41%"); clicking it opens Home. The short name is the last space-separated word of the run name.
- **Command:** "Open StudyQuest".

## Event log

### File

- One file per run: `StudyQuest/log/<run-id>.md`. Folder and file are created when the run is created.
- One JSON object per line. Lines that don't parse as JSON (blank lines, anything else) are ignored when reading.
- The plugin only appends. It never rewrites, reorders or deletes lines.
- On startup the plugin reads every file in `StudyQuest/log/` and replays them. When a log file changes on disk, the view refreshes.

### Envelope

Every event has:

- `id`: `e_` followed by a ULID (time-sortable, unique).
- `t`: ISO 8601 UTC timestamp of when the event was written.
- `type`: the event type.

Replay de-duplicates by `id` and orders by `t`, then `id`.

### Phase 1 events

| Type | Fields | Meaning |
| --- | --- | --- |
| `quarter_created` | `run`, `name`, `start`, `end` | A run is created. |
| `quarter_dates_corrected` | `run`, `start`, `end` | Dates fixed within 30 min of `quarter_created`. |
| `course_added` | `run`, `course`, `name`, `folder` | A course joins a run. |
| `course_undone` | `run`, `course` | Course (and its objectives) removed within 30 min. |
| `objective_added` | `obj`, `run`, `course`, `kind`, `title`, `source`, `date?`, `steps?` | Manual objective. `kind` is the lowercase type name. `steps` is an array of step names (Progress only). |
| `objective_undone` | `obj` | Objective removed within 30 min. |
| `step_completed` | `obj`, `step` | Progress step at index `step` checked. |
| `objective_completed` | `obj`, `tier` | `tier` is `silver` or `sat` in phase 1 (`gold` from phase 4). |

The `quarter_*` names are kept from the design doc even though the concept is now called a run.

Example:

```
{"id":"e_01JD3X…","t":"2026-11-16T10:00:00Z","type":"quarter_created","run":"2026-27-Q2","name":"2026-27 Q2","start":"2026-11-09","end":"2027-01-30"}
{"id":"e_01JD3Y…","t":"2026-11-16T10:02:00Z","type":"course_added","run":"2026-27-Q2","course":"DSAIT4000","name":"Machine Learning","folder":"DSAIT4000/"}
{"id":"e_01JD3Z…","t":"2026-11-16T10:05:00Z","type":"objective_added","obj":"2026-27-Q2/DSAIT4000-LEC01","run":"2026-27-Q2","course":"DSAIT4000","kind":"lecture","title":"Lecture 1","source":"manual"}
{"id":"e_01JD40…","t":"2026-11-17T09:12:00Z","type":"objective_completed","obj":"2026-27-Q2/DSAIT4000-LEC01","tier":"silver"}
```

### Replay validity

The plugin checks rules before writing an event. Replay also enforces them, so a hand-edited or duplicated line can't break the rules. An event that breaks a rule is ignored on replay:

- Undo or correction events whose `t` is more than 30 minutes after the event they undo or correct.
- `objective_undone` for an objective that has a completion or a checked step; `course_undone` for a course where any objective has one.
- `quarter_dates_corrected` that would leave an existing assignment or exam date out of range.
- Completions of objectives that don't exist, are already complete, or were undone.
- `objective_completed` for a Progress objective whose steps aren't all checked.
- `objective_completed` with tier `sat` for a non-exam, or with tier `silver` for an exam.
- `step_completed` for an index out of range or already checked.
- Any event referencing an unknown run, course or objective.

## Code structure (builder's call, suggested)

- **Core** (no Obsidian imports): event types, replay into a state model, validation rules, ID generation, derived values (percentages, resit, exam week, current run, Home ordering, which exams are due for auto-sat). Fully unit-tested.
- **Storage**: reading the log folder, appending lines, watching for changes.
- **UI**: the view, its tabs, Home, course view, Setup, menu, status bar, ribbon.
- Clock injected into the core so time-based rules (undo windows, auto-sat) are testable.

## Testing

- Unit tests for the core: replay, de-duplication, every validity rule above, undo windows at 29 and 31 minutes, ID numbering (including after undo), percentages, resit detection, exam week, current-run choice, Home ordering, auto-sat timing.
- Manual check in Obsidian: create a run, add courses and objectives, self check, undo within the window, watch an exam with yesterday's date turn sat, restart Obsidian and see the same state.

## Left to the builder

- Build tooling (the official Obsidian sample-plugin template with esbuild is the expected starting point), test runner, and file layout.
- UI framework: plain DOM/CSS is the expected choice; no framework is required.
- Exact wireframe styling, the ribbon icon, and countdown display.
- How the dev build gets into a vault for manual testing.

## Decisions made on the user's behalf

These came from me during the brainstorm, not from the user, and are worth a glance:

- Run IDs derived from the run name; runs may not overlap.
- Courses also get a 30-minute undo window (the user set this for run dates and objectives).
- Objective ID format with three-letter type codes, and numbering that never reuses numbers.
- Bulk add for numbered series.
- No second confirmation after choosing Self check.
- Exams turn sat once the day after the exam date begins; checked on load and once a day just after midnight (the user changed this from hourly).
- Adds and self checks stop being offered after a run's end date, ahead of the phase 2 freeze.
- Percentages rounded down.
- Due dates within 2 days are highlighted on Home; overdue assignments are marked overdue.
- Progress objectives get an explicit silver `objective_completed` event after their last step, rather than completion being inferred from steps.
- Bulk add covers Lectures, Labs and Readings only.
- A course code can be re-added after its course was undone.
- A run date correction is refused if it would push an existing assignment or exam out of range.

Decided by the user during review: any completion (silver, sat, or a checked Progress step) ends an objective's undo window, and blocks undoing its course.
