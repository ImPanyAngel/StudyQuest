# Create Course Folders: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adding a course in Setup creates its vault folder (default `Courses/<CODE>/`), and undoing the course removes the folder if StudyQuest made it and it's still empty.

**Architecture:** Pure path helpers live in `src/core/folders.ts`, and planning uses them to refuse bad paths. A small vault helper, `src/store/course-folders.ts`, creates folders and remembers which ones it created this session. Setup calls it after `addCourse` or `undoCourse` succeeds. The plugin owns a single instance and passes it through the view.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5. Unchanged.

**Spec:** `docs/superpowers/specs/2026-11-18-course-folders-design.md`

## Global Constraints

- Nothing under `src/core/` imports `obsidian`.
- No event or replay change. `course_added.folder` is stored as typed (trimmed), and old logs replay unchanged.
- The default folder is `Courses/<CODE>/`.
- Rejected folder paths: empty after normalising, any `.` or `..` part, or any of `\ : * ? " < > |`.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The folder already exists, or one of its parents exists as a file.** If the folder exists, it's reused with no error. If a parent is a file, creation fails: the course stays, and a Notice names the path. → Task 2 handles it; covered by the manual check.
2. **Undo after the user has put a note in the folder, or undo of a folder they made themselves.** The folder stays. → Task 2 checks the session's created set and that the folder has no children.
3. **A path typed as `/Courses//X/ `** (leading slash, double slash, trailing space). It normalises to `Courses/X`. → Task 1 test.

---

### Task 1: Path helpers and the planning rule

**Files:**
- Create: `src/core/folders.ts`.
- Modify: `src/core/actions.ts`, case `addCourse`.
- Test: `tests/core/folders.test.ts`, plus one test in `tests/core/actions.test.ts`.

**Interfaces:**
- `courseFolder(typed: string, code: string): string` returns `Courses/<typed or CODE>/` (amended after the user's check: typed folders go inside `Courses/`).
- `folderChain(path: string): string[]` returns the normalised path and its parents, outermost first. For example, `"Courses/DSAIT4010/"` gives `["Courses", "Courses/DSAIT4010"]`. To normalise: split on `/`, trim each part, and drop empty parts.
- `folderError(path: string): string | null` returns:
  - `"A course folder needs a name."` when the path is empty after normalising;
  - `"A folder path can't contain . or .. parts."`;
  - `` `A folder name can't contain ${ch}.` `` for the first forbidden character found.

- [ ] **Step 1: Write failing tests.**
  - `courseFolder("", "DSAIT4010")` returns `"Courses/DSAIT4010/"`; `courseFolder("DSAIT4005", "TEST")` returns `"Courses/DSAIT4005/"`.
  - `folderChain` returns `["Courses", "Courses/X"]` for each of `"Courses/X/"`, `"/Courses//X/ "` and `" Courses / X "`. For `"A"` it returns `["A"]`.
  - `folderError` returns null for `"Courses/X/"`. It returns the messages above for `"/"`, `"Courses/../X"`, `"Courses/./X"` and `"Courses/X:Y"`.
  - In `actions.test.ts`: `addCourse` with folder `"Courses/a?b/"` is refused with ``"A folder name can't contain ?."``.
- [ ] **Step 2: Run `npm test`** and confirm the new tests fail.
- [ ] **Step 3: Implement** `folders.ts`, and make `addCourse` return `folderError` when it's set.
- [ ] **Step 4: Confirm `npm test` is green** and `npm run build` exits 0.
- [ ] **Step 5: Commit** with `feat(core): course folder paths and checks`.

### Task 2: Create and remove the folder

**Files:**
- Create: `src/store/course-folders.ts`.
- Modify: `src/main.ts`, `src/ui/view.ts`, `src/ui/setup.ts`.

**Interfaces:**
- Consumes `folderChain` and `courseFolder` from Task 1.
- `class CourseFolders { constructor(app: App) }` provides:
  - `ensure(path: string): Promise<void>`. For each path in `folderChain(path)`: if nothing exists there, call `vault.createFolder` and record the path in a private `created: Set<string>`. If a file exists there instead, throw `` `"${p}" is a file, not a folder.` ``. An existing folder is used as it is.
  - `removeIfEmpty(path: string): Promise<void>`. Take the last entry of `folderChain(path)`. If it's in `created`, is a `TFolder` with `children.length === 0`, then call `app.fileManager.trashFile(folder)` and remove it from `created`. Otherwise do nothing.

The `obsidian` import means this can't be unit-tested. The build and the manual check verify it.

- [ ] **Step 1: Implement `CourseFolders`.** Then wire it in:
  - `main.ts` creates one instance and passes it to `new StudyQuestView(leaf, store, folders)`.
  - The view passes it to `renderSetup(..., folders)`.
  - Setup:
    - The fallback folder becomes `defaultCourseFolder(c)`.
    - The placeholder becomes `Vault folder (default: Courses/CODE/)`.
    - After `addCourse` succeeds, call `folders.ensure(folder)`. If it throws, show `` new Notice(`Course added, but its folder couldn't be created: ${message}`) ``.
    - After `undoCourse` succeeds, call `folders.removeIfEmpty(c.folder)`, catching any error into a Notice.
- [ ] **Step 2: Confirm `npm run build` exits 0** and `npm test` is green.
- [ ] **Step 3: Commit** the code with the spec and this plan as `feat(ui): adding a course creates its folder`.

### Task 3: User check

- [ ] Ask the user to check four things in the test vault:
  - adding a course creates `Courses/<CODE>/`;
  - adding a course whose folder already exists gives no error;
  - undoing a fresh course removes its empty folder;
  - undoing after putting a note in the folder keeps it.
