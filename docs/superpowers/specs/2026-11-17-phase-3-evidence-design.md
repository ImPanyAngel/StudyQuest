# StudyQuest Phase 3 — Evidence and Readings: Design

Nov 17, 2026 · spec for phase 3 of [the design doc](../../Design%20Document.md). Builds on [phase 1](2026-11-16-phase-1-core-loop-design.md) and [phase 2](2026-11-16-phase-2-prestige-design.md), which stay binding except where this document changes them.

## Intent

A silver mark should point at something real. From phase 3, completing a lecture, assignment or lab means picking the file in the vault that proves it, and no file can prove two things. Readings stop being a single check and become what reading actually is: a position you move forward, chapter by chapter, until you finish. Progress objectives, which never found a use, are retired.

The user chose the simplest version of "linking": a file picker at the moment of completion. The design doc's richer ideas (frontmatter tags, a link command, course-folder suggestions) are dropped.

## Goals

- Silver on a lecture, assignment or lab requires picking one evidence file from the vault.
- A file used as evidence for one objective can never be used for another.
- Readings track a position over one or two named levels ("Chapter", or "Course" and "Chapter"), bumped by clicking, with a 30-minute undo per bump, and are finished with a plain "Finished → silver".
- New Progress objectives can no longer be added.

## Non-goals

- Checking what's inside the file, and gold (phase 4).
- Frontmatter `objective:` tags, a "link current note" command, course-folder suggestions, a separate Objective screen. Dropped, not deferred.
- Following a file after it is renamed or moved in the vault.
- Chapter totals or progress bars for readings.

## Anti-goals

- **Silver without proof** on a lecture, assignment or lab completed from phase 3 on.
- **One file proving two objectives.**
- **Breaking history.** Phase 1 and 2 log lines (silvers without files, Progress objectives, readings without levels) must replay exactly as before.

## Concepts and rules

### Evidence

- Applies to **lecture, assignment, lab**. Readings and exams never take evidence.
- Evidence is one vault file, stored as its vault path (e.g. `DSAIT4010/Lecture 5.md`) at the moment it was picked. Any file type counts (notes, notebooks, PDFs, images).
- The **Complete?** menu replaces "Self check → silver" with **Pick evidence file → silver…**, which opens a searchable file picker (Obsidian's fuzzy-search modal) over every file in the vault, except the plugin's own `StudyQuest/` folder.
- Files already used as evidence by any objective, in any run, open or closed, are listed greyed out with the objective they prove ("used · DSAIT4000 · Lecture 5") and can't be chosen.
- Choosing a file completes the objective as silver at once, with the path recorded on the completion. The menu is the confirmation, as in phase 1.
- Completion stays permanent; evidence can't be changed afterwards.
- **Uniqueness rule:** an evidence path may appear on at most one completion across the whole log. Paths are compared exactly as stored.
- **Renames aren't followed.** The stored path is a record of what was picked. If the file is later renamed, the old path stays on the objective and the renamed file is, by path, a new file.
- **Old silvers** (phase 1–2 lines without evidence) stay valid silvers. The "file required" rule applies to completions made from phase 3 on; it's enforced when the plugin plans the completion, not when replaying old lines.
- Where a completed objective is listed (course view, run page, Setup list), its evidence shows as the file name, clickable to open the file in Obsidian. If the file no longer exists, the name shows without a link.

### Readings

- A reading has **levels**: one or two names, entered when the reading is added (e.g. `Chapter`, or `Course, Chapter`). Each level's number starts at **0**.
- Shown everywhere as `<title> [Course: 1; Chapter: 4]` (levels in the order entered, outermost first).
- Clicking an open reading (Home or course view) opens its menu:
  - **Next <level> → <name> <n+1>** for each level, innermost first ("Next chapter → Chapter 5", then "Next course → Course 2 (Chapter back to 0)").
  - **Undo last bump · N min left**, when the most recent bump is within 30 minutes.
  - **Finished → silver**.
- **Bumping** a level adds 1 to it and resets every level below it to 0.
- **Undo** reverts the most recent bump that hasn't been undone, restoring the position exactly as it was before that bump, if the undo is at most 30 minutes after that bump. Several undos in a row walk back one bump at a time, each with its own 30 minutes.
- **Finished** completes the reading as silver. No file. A reading can be finished at any position, including all zeros.
- A bump counts as progress, like a checked Progress step in phase 1: it ends the reading's own 30-minute undo window and blocks undoing its course, **for good**. Undoing the bump restores the position but not those undo windows (replay keeps a "has been bumped" flag).
- Bumps, undos and finishing are refused once the run has ended, and ignored on replay once it's closed (phase 2 freeze).
- **Old readings** (added before phase 3, no levels): no counter, menu shows only **Finished → silver**.
- **Bulk add** no longer offers readings (each needs its own levels); it keeps lectures and labs.

### Progress objectives

- Setup no longer offers Progress, and adding one is refused.
- Existing Progress objectives in the log keep working exactly as in phase 1 (steps checked one by one, then silver). Their steps need no file.

### Unchanged

- Exams: still sat automatically.
- Percentages: a reading counts as done only once finished.
- Phase 2 close, tiers, stains and the Hall: unchanged. An unfinished reading in a closed run is a stain, shown with its last position.

## Event log changes

Existing event meanings are unchanged; fields are added.

| Type | Change |
| --- | --- |
| `objective_added` | Optional `levels: string[]` (reading only, 1–2 non-empty names). From phase 3 the plugin always writes it for new readings. |
| `objective_completed` | Optional `evidence: string` (vault path). Written for lecture, assignment and lab silvers from phase 3. |
| `reading_bumped` | New. `obj`, `level` (index into `levels`). |
| `reading_bump_undone` | New. `obj`. Reverts the most recent not-yet-undone bump. |

Replay validity (invalid events are ignored, as before):

- `objective_added` with `levels`: only for readings; 1 or 2 strings, each non-empty after trimming. Kind `progress` is still accepted on replay (history).
- `objective_completed` with `evidence`: only for lecture, assignment, lab with tier silver; a non-empty string. If the path is already the evidence of an earlier completion (replay order), the completion **still applies as a silver**, but without evidence: only the claim on the file is dropped. So a duplicate claim (hand edit, restored copy, offline sync) never turns an awarded silver back into OPEN or a STAIN, and never makes a closed run contradict its frozen score. The plugin's own planning prevents duplicates, so in normal use this never happens.
- `reading_bumped`: objective exists, is a reading with levels, isn't complete; `level` is an integer index into `levels`.
- `reading_bump_undone`: there is a not-yet-undone bump on that objective, and the undo's `t` is at most 30 minutes after that bump's `t`; the objective isn't complete.
- Both new events count as "touching the run" for the phase 2 freeze and for `dropAfterClose`.

Example:

```
{"id":"e_…","t":"2026-11-18T09:00:00Z","type":"objective_added","obj":"2026-27-Q2/BOOT-RDG01","run":"2026-27-Q2","course":"BOOT","kind":"reading","title":"Boot.dev","source":"manual","levels":["Course","Chapter"]}
{"id":"e_…","t":"2026-11-18T21:10:00Z","type":"reading_bumped","obj":"2026-27-Q2/BOOT-RDG01","level":1}
{"id":"e_…","t":"2026-11-19T10:02:00Z","type":"objective_completed","obj":"2026-27-Q2/DSAIT4010-LEC05","tier":"silver","evidence":"DSAIT4010/Lecture 5.md"}
```

## Planning rules (what the plugin refuses before writing)

- `selfCheck` on a lecture, assignment or lab: refused ("Pick the file that proves it."). Replaced by a `completeWithEvidence` action carrying the path; refused if the path is already used or the file doesn't exist.
- `selfCheck` stays for readings (Finished) and old Progress objectives' final silver as today.
- `addObjective` with kind `progress`: refused. With kind `reading`: needs 1–2 level names.
- `bulkAddObjectives` with kind `reading`: refused.

## Testing

- Unit tests: evidence uniqueness (same path twice, across runs, across a closed run; the later claim stays silver without evidence); evidence on a reading or exam rejected; old silver without evidence still replays; reading bump and reset of lower levels; undo restores the exact prior position (including a reset lower level); undo at 30 and 31 minutes; two undos walk back two bumps; bump/undo after completion rejected; bump ends the reading's undo window and blocks course undo, and undoing the bump doesn't reopen them; bump on a closed run ignored; old reading without levels can only finish; progress add refused at planning but replays from history; bulk readings refused.
- Manual check in Obsidian: complete a lecture by picking a file; the same file shows greyed out for another lecture; the evidence name opens the file from the course view; add a two-level reading, bump chapter, bump course (chapter resets), undo, finish; Progress missing from Setup; an existing Progress objective from the Q2 log still works.

## Left to the builder

- The picker's exact look, sorting (e.g. recently modified first) and how many results it shows.
- How Setup collects levels (one text field split on commas is fine).
- Where the reading counter and evidence link sit in each row.

## Decisions made on the user's behalf

- Any file type counts as evidence; the plugin's own `StudyQuest/` folder is excluded from the picker.
- Used files are shown greyed out with their objective rather than hidden.
- Uniqueness spans every run, including closed ones.
- Renamed files aren't followed; the stored path is a record.
- "File required" is enforced when completing, not on replay, so old silvers stay valid.
- Evidence file names are clickable in the course view, run page and Setup.
- Two levels at most per reading; levels start at 0; a reading can be finished at any position.
- The undo for bumps lives in the reading's own click menu.
- A bump ends the reading's 30-minute undo window and blocks undoing its course, for good, even if the bump is undone.
- A completion naming a file that an earlier completion already claimed stays a silver, without evidence, rather than being rejected (came out of the reviewer's check: rejecting it could turn an awarded silver into a stain in a closed run).
- Old readings without levels just get "Finished → silver".
- Bulk add drops readings.
- Existing Progress objectives keep working; only adding new ones stops.

Decided by the user: evidence is a manual file pick at completion, checked only for reuse; required for every silver except readings and exams; readings become a counter over manually named levels, bumped by clicking, with the lower level resetting to 0 when a higher one goes up; a completed mark when finished; 30-minute undo on bumps; Progress objectives removed; tags, link command and folder suggestions dropped.
