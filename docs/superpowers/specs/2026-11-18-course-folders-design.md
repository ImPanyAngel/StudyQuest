# StudyQuest — Create Course Folders: Short Design

Nov 18, 2026 · small change.

## Intent

When a course is added in Setup, its folder should actually exist in the vault so notes can go there straight away. Today the folder is only stored and shown.

## Decided by the user

- Adding a course creates its folder. The default is **`Courses/<CODE>/`**. The vault already has `Courses/`.
- If the folder already exists, it's used as it is.
- Undoing the course within its 30-minute window removes the folder, but only if it's still empty. Nothing written there is ever deleted.
- Courses added before this change are left alone.

## Approaches

- **Create the folder in the UI after the course is logged (chosen).** The log stays the record, and folder creation is a side effect of the Setup action, just as the evidence picker reads files. If creation fails, the course still exists and a Notice says why.
- Create the folder inside the store's dispatch. Rejected: it mixes vault side effects into the log store, which is otherwise only about events.
- Create folders on load for every course. Rejected: the user said existing courses are left alone.

## Claude's calls

- A folder typed in Setup is a full vault path, as today; only the default changed. Missing parent folders are created too.
- Undo removes the folder only if StudyQuest created it during this Obsidian session and it's still empty, so a folder you made yourself is never removed. Removal goes through Obsidian's trash setting (`fileManager.trashFile`).
- Planning refuses a folder path that is empty, has a `.` or `..` part, or contains `\ : * ? " < > |`, with a clear message. Replay doesn't check folders, so old logs replay unchanged.
- The folder is stored as typed (trimmed), the same as today.

## Non-goals

- Moving or renaming folders when a course changes.
- Using the course folder anywhere else, such as the evidence picker.

## Testing

- Unit tests cover the pure path helpers (the default folder, normalising into a chain of parent paths, the rejection messages) and the planning rule.
- Manual check: adding a course creates `Courses/<CODE>/`; an existing folder is reused without an error; undo removes an empty folder StudyQuest made and keeps one with a note in it.
