# StudyQuest Phase 4 — File Checks, One Done Mark: Design

Nov 17, 2026 · spec for phase 4 of [the design doc](../../Design%20Document.md). Builds on phases 1–3 (specs in this folder), which stay binding except where this document changes them.

## Intent

Phase 4 was planned as AI verification for a gold mark. An on-device experiment on the user's real notes (below) showed it isn't worth it on this laptop: Apple's built-in model accepted every wrong title, and a 9B local model took 20–30 s per check, heated the machine, used a lot of memory, and still confused neighbouring lectures. The user decided:

- **No AI.** Checks are plain rules that run instantly and work everywhere. A remote API or a homelab may come later.
- **One completion mark: DONE.** Silver and gold go away. Completing something is a single, honest mark.
- **The rules guard the file you pick.** A notebook with unfinished template code or a note that is barely started is refused, so DONE means the work is actually there.

## Experiment summary (Nov 17, 2026)

Seven real lecture notes, each judged against its own title, a same-course wrong title and an other-course wrong title (21 cases); two real assignment notebooks.

| Approach | Own title accepted | Wrong title rejected | Time per check |
| --- | --- | --- | --- |
| Apple on-device, yes/no | 7/7 | 0/14 | 1–2 s |
| Apple on-device, topic first | 5/7 | 6/7 tested | 1–2 s |
| Qwen3.5 9B (Ollama), fair prompt | 7/7 | 11/14 (same-course 4/7) | 20–30 s |

Notebook findings: the user's finished Assignment 1 has no saved outputs, so "cells have outputs" is not a usable rule; its only marker-like text is comments ending in `...`. The unfinished Assignment 2 keeps template banners `TODO: Implement this function` followed by `pass`. A finished notebook usually keeps the banner and replaces `pass` with code.

## Goals

- Replace silver with a single **DONE** mark everywhere it's shown. Exams keep **SAT**.
- Check the evidence file when it's picked, and refuse it with a clear reason if the check fails.
- Remove every mention of AI checks and gold from the UI.

## Non-goals

- Any AI, local or remote. (Possible later phase: API or homelab.)
- Checking PDFs, images, slides or other file types.
- Re-checking a file after it was accepted, or when it later changes.
- An override for a refused file.

## Anti-goals

- **A false refusal of finished work.** The rules must accept the user's finished Assignment 1 and every real lecture note in the experiment set.
- **Rewriting history.** Old log lines stay as they are.

## The DONE mark

- Every completed lecture, assignment, lab and reading shows **DONE** (course view, run page, Setup list, Hall run page). Exams show **SAT**. Open objectives show **OPEN**, and **STAIN** on a closed run, as before.
- In the log, completions keep `"tier":"silver"`; the plugin keeps writing `silver` for new completions. "silver" is now just the stored name for done. No event changes, so phases 1–3 replay unchanged.
- Menu wording:
  - Lectures, assignments, labs: **Pick the file that proves it → done…** (no separate "Complete?" label line needed beyond the title, no AI line).
  - Readings: **Finished → done**.
  - Old Progress objectives (if any remain): steps check as before; the last step marks it done.
- Colours: DONE uses the accent colour; the silver and gold colour tokens are removed except where gold is used for prestige decoration (Prestige Up, tier labels, card hover), which stays.

## File checks

Run in the evidence picker when a file is chosen, before anything is written. A refused file keeps the picker open and shows the reason in a Notice; the user fixes the file and picks again.

### Notebooks (`.ipynb`)

The file is parsed as JSON. Refused if:

1. it can't be parsed, or has no `cells` list ("Couldn't read this notebook.");
2. any code cell's source is empty or only whitespace ("Cell N is empty.");
3. any code cell has a comment line containing `TODO` (whole word, any case) or `YOUR CODE HERE`, and the first following line that is neither blank nor a comment is a placeholder (`pass`, `...`, `None`, `raise NotImplementedError…`, compared after trimming indentation) or there is no such line ("Cell N: the TODO is still `pass`.").

A `raise NotImplementedError` on its own, not right after a TODO or `YOUR CODE HERE`, is **not** refused: finished code legitimately uses it in abstract base classes, and refusing it would block finished work with no fix (the first anti-goal). Template stubs are caught by rule 3, since they come with a TODO or `YOUR CODE HERE` marker.

Cell numbers in messages count code and markdown cells from 1, as Jupyter shows them. When several problems exist, the message names the first and says how many more ("Cell 15: the TODO is still `pass` (and 14 more)."). Saved outputs are not required. Markdown cells are not checked.

### Notes (`.md`)

Frontmatter (a leading `---` … `---` block) is removed, and the rest is trimmed. Refused if fewer than **5,000 characters** remain (characters including spaces): "This note has 1,234 characters; a note needs at least 5,000."

### Everything else

Passes without a check.

### Where the checks live

- The rules are pure functions in `src/core/` (no Obsidian imports), fully unit-tested, with fixtures modelled on the experiment's notebooks.
- The picker reads the file with Obsidian's vault API and calls them.
- Replay never re-runs checks: an accepted file stays accepted even if it's later edited or deleted.

## Removed

- "AI check — arrives in phase 4" menu line.
- "Gold arrives in phase 4" comments and any gold mark styling for objectives.
- The design doc is updated throughout to match, not just its AI section: phase 4 becomes "File checks and one DONE mark", AI moves to a possible later phase (remote API or homelab), and every gold/silver mention becomes DONE. That includes the principles, the completion section and its flowchart, the screens table, the data model sample and event table, and in Rewards: XP is weighted by type with no gold bonus, and the "every lecture in a course gold" achievement becomes "every lecture in a course done". Phase 6 will revisit those when it's designed.

## Testing

- Unit tests, notebooks: empty code cell; `YOUR CODE HERE` then `raise NotImplementedError()` (indented) refused; a lone `raise NotImplementedError` in an abstract method accepted; TODO followed by `pass`, `...`, `None`, nothing; TODO followed by real code passes; `YOUR CODE HERE` variant; a comment ending in `...` passes (Assignment 1 case); banner-style TODO blocks with `END OF YOUR CODE` (Assignment 2 case) refused, and the same with `pass` replaced by code accepted; invalid JSON; cell numbering and the "and N more" message.
- Unit tests, notes: frontmatter stripped before counting; 4,999 refused, 5,000 accepted; empty note refused.
- Mark tests: `markOf` shows DONE for silver, SAT for sat.
- Manual check in Obsidian: Assignment 1 accepted, Assignment 2 refused with a cell number; a short note refused with its character count; a long note and a PDF accepted; marks show DONE; no AI line in any menu.

## Left to the builder

- Exact Notice wording within the examples above.
- Whether the picker reads via `vault.cachedRead` or `vault.read`.

## Decisions made on the user's behalf

- The log keeps writing `tier: "silver"`; DONE is display only, so no event format change.
- Exams keep SAT.
- Character count includes spaces and is measured after removing frontmatter.
- Cell numbers count every cell, as Jupyter does.
- `None` counts as a placeholder after a TODO.
- A lone `raise NotImplementedError` (no TODO before it) is accepted, so abstract base classes in finished work don't block DONE. (Came out of the reviewer's check.)
- The design doc is updated everywhere gold or silver appears; phase 6's XP gold bonus is dropped and the "every lecture gold" achievement becomes "every lecture done", pending phase 6's own design.
- Gold styling stays for prestige decoration only.
- The design doc is updated to drop AI from the build plan.

Decided by the user: remove AI entirely; replace silver and gold with one DONE mark; rules refuse unfinished work (Assignment 2 must be refused; Assignment 1 is finished); notes need at least 5,000 characters; checks apply where they make sense.
