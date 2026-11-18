# Remove Roadmap and Schedule Import: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove roadmap and schedule import from the plugin (the disabled Setup button) and from the design doc, make Character and rewards phase 5, and describe linking as it was actually built.

**Architecture:** One UI deletion and a documentation rewrite. There are no core, event or log changes.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild, Vitest 5. Unchanged.

**Spec:** `docs/superpowers/specs/2026-11-18-remove-roadmap-design.md`

## Global Constraints

- Leave the log format alone: `objective_added.source` stays `"manual"`, and `Course.folder` stays as it is.
- No version bump. This removes a disabled button and nothing more.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

None found. The change removes a disabled button and rewrites text, so it adds no new inputs or states. The suite stays as the regression check.

---

### Task 1: Remove the import button

**Files:** Modify `src/ui/setup.ts:168-169`.

`setup.ts` imports `obsidian`, so it can't be unit-tested. The build and the user's look in Obsidian verify this task.

- [ ] **Step 1:** Delete the `importBtn` element and its `disabled` line.
- [ ] **Step 2:** Confirm `grep -rn -i "roadmap\|schedule" src | grep -v scheduleMidnight` prints nothing, `npm run build` exits 0, and `npm test` is green.
- [ ] **Step 3:** Commit with `feat(ui): remove the roadmap import placeholder`.

### Task 2: Design doc

**Files:** Modify `docs/Design Document.md`.

- [ ] **Step 1:** Make every edit listed under the spec's "Changes" (design doc, build plan, linking section). Change the header to `updated Nov 18, 2026`. In the rules, renumber the list after removing the import rule. Remove "including courses with a locked roadmap" from the manual-adding rule. The sentence "objectives can be added but never removed, and roadmap objectives are locked" loses its last clause.
- [ ] **Step 2:** Confirm `grep -n -i "roadmap\|schedule\|frontmatter tag\|link current note" "docs/Design Document.md"` prints nothing, apart from any "schedule" that means something other than an import (for example the exam-week timing).
- [ ] **Step 3:** Commit the doc together with the spec and this plan as `docs: drop roadmap import; character becomes phase 5`.

### Task 3: User check

- [ ] Ask the user to reload the plugin and confirm that Setup no longer shows the import button.
