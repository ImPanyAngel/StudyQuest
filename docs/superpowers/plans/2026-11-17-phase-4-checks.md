# StudyQuest Phase 4 — File Checks and One DONE Mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completions show one **DONE** mark (exams keep SAT). The evidence picker refuses a notebook with unfinished template code and a note shorter than 5,000 characters. Every mention of AI checks and gold disappears from the UI and the design doc.

**Architecture:** A new pure module `src/core/file-checks.ts` turns a file's extension and text into a refusal message, or `null`. The evidence picker reads the chosen file through the vault API, runs the check before it lets the selection through, and stays open on a refusal. DONE only changes the display: `markOf` maps the stored tier `silver` to `done`. Events, replay and the log format are unchanged.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5 (tests run under `TZ=America/New_York`). Unchanged.

**Spec:** `docs/superpowers/specs/2026-11-17-phase-4-checks-design.md` (source of truth). The phase 1–3 specs stay binding where phase 4 doesn't change them.

## Global Constraints

- Nothing under `src/core/` imports from `obsidian`.
- No event, field or replay rule changes. New completions still write `tier: "silver"`, and phase 1–3 logs replay exactly as before. Every existing test stays green unchanged, except the `markOf` expectation in `tests/ui/parts.test.ts`.
- Checks run only when a file is picked. Replay never re-checks.
- Checked extensions: `ipynb` and `md`, compared lowercase. Every other file passes.
- Minimum note length: **5,000** characters, spaces included, counted after removing the leading frontmatter block and trimming.
- Notebook placeholders after a TODO marker: `pass`, `...`, `None`, `raise NotImplementedError` (with or without `(…)`).
- Marks: DONE for `silver`, SAT for `sat`, OPEN when open, and STAIN when open on a closed run.
- Gold colour (`--sq-gold`) stays only for prestige decoration: `.sq-prestige-title`, `.sq-prestige-tier`, `.sq-card:hover` and `.sq-card-tier`.
- Set the plugin version to `0.4.0` in `manifest.json` and `package.json`, and add `"0.4.0": "1.7.2"` to `versions.json`.
- The user's real notes in `.superpowers/spike-notes/` are never committed or copied into `tests/`. Fixtures are hand-written imitations.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A file picked twice quickly, or the picker closed (Esc) while the check is still reading the file.** At most one completion may be written, and none after the picker has closed. → Task 3: a `checking` flag plus a `closed` flag set in `onClose`.
2. **A placeholder with a trailing comment** (`pass  # replace this`) after a TODO. A person expects a refusal. → Task 1 test. Strip a trailing `#…` comment before comparing with the placeholder list. This can only refuse more stubs; it never refuses real code.
3. **A notebook whose `source` is a string instead of a list, or a cell with no `source`.** Both are valid nbformat, so neither may crash or be misread. → Task 1 tests: a string source is checked like a list, and a missing source counts as empty.
4. **A note with Windows line endings, or frontmatter that never closes.** CRLF frontmatter is still removed. An unclosed `---` block is counted as body text, not dropped. → Task 1 tests.
5. **An empty notebook (`"cells": []`, or markdown cells only).** It proves nothing, so a person expects a refusal. → Task 1 test, with the message "This notebook has no code."

---

## File Structure

```
src/core/file-checks.ts      NEW  checkEvidence, checkNotebook, checkNote, CHECKED_EXTENSIONS, MIN_NOTE_CHARS
src/core/events.ts           Tier comment
src/core/replay.ts           evidence rejection wording
src/ui/parts.ts              markOf: silver → DONE
src/ui/complete-menu.ts      wording, AI line removed
src/ui/evidence-picker.ts    reads the file and runs the check before selecting
styles.css                   .is-done; silver/gold mark styles and --sq-silver removed
docs/Design Document.md      gold/silver/AI rewritten
tests/core/file-checks.test.ts  NEW
tests/ui/parts.test.ts       DONE expectation
```

---

### Task 1: File-check rules

**Files:**
- Create: `src/core/file-checks.ts`
- Test: `tests/core/file-checks.test.ts`

**Interfaces:**
- Produces:
  - `MIN_NOTE_CHARS = 5000`
  - `CHECKED_EXTENSIONS: readonly string[] = ["ipynb", "md"]`
  - `checkNotebook(text: string): string | null`
  - `checkNote(text: string): string | null`
  - `checkEvidence(extension: string, text: string): string | null`. This dispatches on `extension.toLowerCase()` and returns `null` for any extension that isn't checked.

**Notebook algorithm** (the spec plus the Review Focus items):

1. Run `JSON.parse`. A parse failure, or a value whose `cells` isn't an array, returns `"Couldn't read this notebook."`
2. Number cells from 1 across every cell type, and look only at `cell_type === "code"`. A source is `string[]` (joined with `""`) or a `string`; a missing source is `""`. If there are no code cells, return `"This notebook has no code."`
3. Problems are collected in cell order.
   - **Empty cell.** A source that is blank after `trim()` adds `Cell N is empty`.
   - **Unfinished TODO.** Split the source on `/\r?\n/`. A *comment line* is one whose trimmed text starts with `#`. A *marker* is a comment line matching `/\bTODO\b|YOUR CODE HERE/i`. For each marker, take the first later line that is neither blank nor a comment. Strip any trailing `\s+#.*$` from that line, trim it, and test it against `/^(pass|\.\.\.|None|raise NotImplementedError(\(.*\))?)$/`.
     - If it matches, add `` Cell N: the TODO is still `<that line>` ``.
     - If no such line exists, add `Cell N: the TODO has no code under it`.
     - Several markers that reach the same target line (the same cell, the same index) count once.
4. Return `null` for no problems. One problem returns `` `${first}.` ``. Several return `` `${first} (and ${n} more).` ``.

**Note algorithm:**

1. Remove a leading frontmatter block matching `/^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/`. If the block never closes, leave the text as it is.
2. Trim, then count with `Array.from(body).length`.
3. If the count is under `MIN_NOTE_CHARS`, return `` `This note has ${n.toLocaleString("en-US")} characters; a note needs at least 5,000.` ``

- [ ] **Step 1: Write failing tests.** Build notebooks with a helper `nb(...cells: { type?: "code" | "markdown"; source: string | string[] }[])` that returns `JSON.stringify({ cells, nbformat: 4 })`.
  - The banner stub refuses: the Assignment 2 shape below, where the cell is cell 2 after one markdown cell, gives `` "Cell 2: the TODO is still `pass`." ``

    ```
            ##########################
            #   TODO: Implement this function   #
            ##########################

            pass

            ##########################
            #        END OF YOUR CODE        #
            ##########################
    ```
  - The same banner with `pass` replaced by `self.weight = torch.zeros(n)` gives `null`.
  - `# TODO` followed by `...`, then `None`, then `    pass  # replace this` each refuse. The last message shows `` `pass` ``.
  - A cell ending on `# TODO: finish` gives `` "Cell 1: the TODO has no code under it." ``
  - `# YOUR CODE HERE` followed by `    raise NotImplementedError()` refuses.
  - A lone `raise NotImplementedError` in an abstract method, with no marker, gives `null`.
  - `# todo: tidy later` followed by `x = 1` gives `null` (any case, and real code after it).
  - `# TODOS` followed by `pass` gives `null` (whole word only).
  - The Assignment 1 shape gives `null`: `#... and then visualize it` / `pr.scatterd(b)` / `# ... and more!`.
  - An empty code cell (`"   \n"`) at cell 3 gives `"Cell 3 is empty."`
  - A cell with no `source` key counts as empty.
  - A string `source` is checked the same way as a list.
  - Two TODO markers in one banner above one `pass` count as 1 problem.
  - Three stub cells give `` "Cell 1: the TODO is still `pass` (and 2 more)." ``
  - `"not json"` and `'{"cells": 3}'` give `"Couldn't read this notebook."`
  - `nb()` and a notebook of markdown cells only give `"This notebook has no code."`
  - Notes:
    - `"a".repeat(4999)` refuses with `"This note has 4,999 characters; a note needs at least 5,000."`
    - `"a".repeat(5000)` gives `null`.
    - `""` refuses with 0 characters.
    - `"---\ntitle: x\n---\n" + "a".repeat(4999)` refuses (the frontmatter isn't counted). The same note with `\r\n` line endings also refuses.
    - `"---\n" + "a".repeat(5000)`, an unclosed block, gives `null`.
    - Leading and trailing whitespace isn't counted.
  - `checkEvidence`:
    - `("IPYNB", stub)` refuses.
    - `("md", short)` refuses.
    - `("pdf", "")` gives `null`.
- [ ] **Step 2: Run `npm test -- file-checks`** and confirm it fails because the module is missing.
- [ ] **Step 3: Implement `src/core/file-checks.ts`** following the algorithms above.
- [ ] **Step 4: Run `npm test`** (all green) and `npm run build` (clean).
- [ ] **Step 5: Commit** with the message `feat(core): notebook and note checks for evidence files`.

---

### Task 2: One DONE mark

**Files:**
- Modify:
  - `src/ui/parts.ts` (`markOf` and its comment)
  - `src/ui/complete-menu.ts`
  - `src/ui/evidence-picker.ts:6` (class comment)
  - `src/core/events.ts` (the `Tier` comment)
  - `src/core/replay.ts:275` (message)
  - `styles.css`
  - `manifest.json`, `package.json`, `versions.json`
- Test: `tests/ui/parts.test.ts`

**Interfaces:**
- Produces: `markOf(o, closed)` returns `{ kind: "done", text: "DONE" }` for tier `silver`. Every other result stays the same.

- [ ] **Step 1: Change the test.** In `tests/ui/parts.test.ts`, the silver expectation becomes `{ kind: "done", text: "DONE" }`. The SAT, STAIN and OPEN cases stay as they are. Rename the test to `"markOf: DONE or SAT when complete, else STAIN on a closed run and OPEN on a running one"`.
- [ ] **Step 2: Run `npm test -- parts`** and confirm it fails.
- [ ] **Step 3: Implement.**
  - `markOf`: when the tier is `"silver"`, use the kind `"done"`. Comment: `DONE (stored as "silver") or SAT when complete; otherwise STAIN on a closed run, OPEN on a running one.`
  - `Tier` comment: `"silver" is the stored name for DONE; "sat" is exams only.`
  - Replay message: `"Only lectures, assignments and labs take evidence."`
  - Picker comment: `...completes the objective (DONE) with that file as evidence, after the file checks pass.`
  - Menu:
    - The reading item becomes `Finished → done`.
    - Remove the `Complete?` label and the AI line.
    - The evidence item becomes `Pick the file that proves it → done…`
    - Progress steps stay as they are. With the `Complete?` label gone, Progress keeps only its step items. That's fine.
  - CSS:
    - Add `.studyquest .sq-mark.is-done { border-color: var(--sq-accent); color: var(--sq-accent); }`
    - Delete `.is-silver`, `.is-gold` and `--sq-silver`.
    - Keep `--sq-gold`.
    - Run `grep -n "silver\|is-gold" styles.css src -r`. Its only output should be the tier logic in `actions.ts`, `replay.ts` and `events.ts`.
  - Versions: `0.4.0`.
- [ ] **Step 4: Run `npm test`** (green) and `npm run build` (clean).
- [ ] **Step 5: Commit** with the message `feat(ui): one DONE mark, AI menu line removed`.

---

### Task 3: The picker runs the checks

**Files:**
- Modify: `src/ui/evidence-picker.ts`

**Interfaces:**
- Consumes: `checkEvidence(extension, text)` and `CHECKED_EXTENSIONS` from Task 1.

The modal can't be unit-tested, because `obsidian` doesn't resolve under Vitest. The logic it relies on is the Task 1 module. This task is verified by the build and then by Task 5.

- [ ] **Step 1: Restructure `selectSuggestion`.**
  1. Keep the existing used-file check first.
  2. If `this.checking` is true, return. This ignores a second pick while a file is being read.
  3. If `CHECKED_EXTENSIONS` doesn't include `match.item.extension.toLowerCase()`, call `super.selectSuggestion(match, evt)` as today.
  4. Otherwise, set `checking = true` and read the file with `this.app.vault.cachedRead(file)`. Look the file up again with `getFileByPath` first. If it has gone, show the existing "no longer in the vault" Notice. If the read throws, show a `Couldn't read "<path>".` Notice.
  5. Once the read finishes, clear `checking`. Then:
     - If the picker was closed meanwhile (a `closed` flag set in an `onClose` override that calls `super.onClose()`), do nothing.
     - If the check refuses, show `new Notice(message)` and leave the picker open.
     - Otherwise, call `super.selectSuggestion(match, evt)`.

  `onChooseItem` stays as it is.
- [ ] **Step 2: Run `npm run build`** (clean) and `npm test` (green).
- [ ] **Step 3: Commit** with the message `feat(ui): evidence picker refuses unfinished notebooks and short notes`.

---

### Task 4: Design doc

**Files:**
- Modify: `docs/Design Document.md`

- [ ] **Step 1: Rewrite every gold, silver and AI passage.** Change the header line to `updated Nov 17, 2026`.
  - **Principles:** "Honest by design" becomes `Locked roadmaps, no deleting, and evidence files that are checked before they count.`
  - **Completing an objective:**
    - Replace the Gold and Silver bullets with **Done**: lectures, assignments and labs need an evidence file that passes the file checks; readings are marked finished.
    - Keep **Sat**, and change its last sentence to "A neutral mark."
    - "All three count" becomes "Both count as complete."
    - Redraw the flowchart: Objective open → pick a file → checks pass? Yes → Done. No → refused, fix and pick again. Run ends → stays a stain.
    - Replace the sentence about overriding to silver with "A refused file can be fixed and picked again; there's no override."
  - **`## AI verification`** becomes `## File checks`. Write the spec's notebook and note rules in brief, "Everything else passes", and "Checks run when the file is picked, never again."
    - Remove the Two stages list, Setup, the Ollama model table and its notes, and Sources.
    - End with a short **Later** paragraph: AI checks were tested on real notes (the results are in the phase 4 spec) and left out as unreliable or too heavy for this laptop. A remote API or a homelab could bring them back.
  - **Rewards:**
    - Change the XP line to "…weighted by type (an assignment is worth more than a lecture)."
    - Change the achievement to "every lecture in a course done".
  - **Screens table:** the Objective row becomes `Linked evidence, DONE / SAT / OPEN / STAIN mark`.
  - **Data model:** in the sample line, use `"tier":"silver","evidence":"DSAIT4010/Lecture 5.md"`, with no `reason` field.
    - Add one sentence under the sample: `"silver" is the stored name for DONE.`
    - Delete the `verification_run` table row.
    - Change `objective_completed` to `DONE (stored as silver) or sat`.
  - **Build plan item 4:** `**File checks and one DONE mark.** Notebook and note rules on the picked file; silver and gold replaced by DONE. Spec: docs/superpowers/specs/2026-11-17-phase-4-checks-design.md.`
  - Add a line after the build plan: `Later, maybe: AI checks through a remote API or a homelab.`
  - **Open questions:**
    - Tick "What does complete mean for each objective type?" with the answer: `Done = evidence file that passes the file checks (lectures, assignments, labs) or marked finished (readings); exams are sat.`
    - In "Should silver count fully", change "silver" to "done".
- [ ] **Step 2: Check.** `grep -n -i "gold\|silver\|ollama\|apple intelligence\|verif" "docs/Design Document.md"` should return only the data-model sentence that names "silver" as stored, the silver-to-done mention in the build plan, and the AI history in the Later paragraph.
- [ ] **Step 3: Commit** with the message `docs: design doc for file checks and one DONE mark`.

---

### Task 5: Manual check in Obsidian (the user)

- [ ] **Step 1:** Run `npm run build`. Ask the user to reload StudyQuest in the test vault (`~/Downloads/StudyQuest`) and check each of the following:
  1. Every completed lecture, assignment, lab and reading shows **DONE** in the course view, on the run page, in Setup and on the Hall run page. Exams show SAT. Prestige Up and the Hall cards keep their gold.
  2. No menu has an AI line. The reading menu says "Finished → done", and the evidence item says "Pick the file that proves it → done…"
  3. Picking **Assignment 2.ipynb** is refused with a cell number and "(and N more)", and the picker stays open.
  4. Picking **Assignment 1.ipynb** completes the assignment.
  5. A note under 5,000 characters is refused with its count. A full lecture note is accepted. A PDF is accepted.
  6. Picking a file that's already used is still refused, as before.
- [ ] **Step 2:** Record the user's result in the ledger. Any failure goes back to the task that owns it.
