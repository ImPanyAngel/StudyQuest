# StudyQuest — Remove Roadmap and Schedule Import: Short Design

Nov 18, 2026 · small change; replaces phase 5 of [the design doc](../../Design%20Document.md).

## Intent

Phase 5 was meant to draft a course's objectives from its roadmap or schedule. Without AI (dropped in phase 4), StudyQuest could only read roadmaps with a predictable shape, and every lecturer lays theirs out differently. The user decided to remove roadmap and schedule import entirely. Honesty doesn't suffer: every objective already becomes permanent 30 minutes after it's added.

## Approaches

- **Remove it (chosen by the user).** Objectives are added by hand, singly or with bulk-add, as today.
- Paste a table in one fixed format. Rejected: it adds little over bulk-add, and the user would have to reshape every roadmap by hand.
- Per-lecturer parsers. Rejected: too many shapes.

## Changes

- **Plugin:** remove the disabled "Import roadmap / schedule — phase 5" button from Setup's objectives section. Nothing else changes. `objective_added.source` stays `"manual"` in the log, and nothing reads it.
- **Design doc:** remove every roadmap and schedule mention.
  - The principle "Locked roadmaps, no deleting" becomes "No deleting".
  - Courses no longer "may have a roadmap", and objectives lose "source (roadmap or manual)".
  - Remove the import rule. Manual adding is the only way in.
  - Remove the `roadmaps/` folder in the vault layout.
  - Remove "roadmap lock state" from the Course screen and delete the Roadmap import screen.
  - The data-model sample uses `"source":"manual"`. The `roadmap_locked` event row is removed.
  - Remove the open question about deadlines on locked roadmaps.
- **Build plan:** the roadmap phase is removed, and Character and rewards becomes phase 5, the last.
- **Linking notes section (Claude's call, approved with this design):** rewrite it to describe what phase 3 built. Evidence is picked from a searchable list of vault files, one file proves one objective, and phase 4's file checks apply. Drop the frontmatter tag, the "Link current note" command and folder suggestions, which were never built. The course folder entered in Setup stays as it is: it's stored and shown, but not otherwise used.

## Non-goals

- Changing the log format or the `source` field.
- Using the course folder for anything new.

## Testing

`npm test` and `npm run build` stay green. The user checks that Setup no longer shows the import button.
