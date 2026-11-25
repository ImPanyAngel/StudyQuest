import { fits, item, shelf, type Body } from "./catalog";
import { checkLook, type Look } from "./character";
import { localDateOf, type LocalDate } from "./dates";
import { evidenceOwner, examsDueForSat, runEnded, runProgress, runsDueToClose } from "./derive";
import { BULK_KINDS, EVIDENCE_KINDS, KIND_NAMES, type IdFactory, type Kind, type QuestEvent } from "./events";
import { folderError, sameFolder } from "./folders";
import { TYPE_CODES, objectiveId, runIdFromName } from "./ids";
import { tierFor } from "./prestige";
import { runRewards } from "./rewards";
import { applyEvent } from "./replay";
import { err, ok, type Result } from "./result";
import type { State } from "./state";

export type Action =
  | { type: "createRun"; name: string; start: LocalDate; end?: LocalDate }
  | { type: "correctRunDates"; run: string; start: LocalDate; end?: LocalDate }
  | { type: "addCourse"; run: string; code: string; name: string; folder: string }
  | { type: "undoCourse"; run: string; code: string }
  | { type: "addObjective"; run: string; course: string; kind: Kind; title: string; date?: LocalDate; steps?: string[]; levels?: string[] }
  | { type: "bulkAddObjectives"; run: string; course: string; kind: Kind; prefix: string; from: number; to: number }
  | { type: "undoObjective"; obj: string }
  | { type: "selfCheck"; obj: string }
  | { type: "checkStep"; obj: string; step: number }
  | { type: "acknowledgePrestige"; run: string }
  | { type: "completeWithEvidence"; obj: string; path: string }
  | { type: "bumpReading"; obj: string; level: number }
  | { type: "undoBump"; obj: string }
  | { type: "createCharacter"; run: string; body: Body; look: Look }
  | { type: "changeLook"; run: string; look: Look }
  | { type: "buyItem"; run: string; item: string }
  | { type: "undoPurchase"; run: string; item: string };

const MAX_BULK = 50;

type Draft = { [K in QuestEvent["type"]]: Omit<Extract<QuestEvent, { type: K }>, "id" | "t"> }[QuestEvent["type"]];

/**
 * Turns a user action into events. Structural rules are checked by applying
 * the events to a copy of the state with the same `applyEvent` replay uses;
 * rules that depend on "now" (a run having ended) are checked here.
 */
export function planAction(s: State, a: Action, now: Date, newId: IdFactory): Result<QuestEvent[]> {
  const drafts = draftsFor(s, a, now);
  if (!drafts.ok) return drafts;
  const t = now.toISOString();
  const events = drafts.value.map((d) => ({ id: newId(now), t, ...d }) as QuestEvent);
  const copy = structuredClone(s);
  for (const e of events) {
    const reason = applyEvent(copy, e);
    if (reason) return err(reason);
  }
  return ok(events);
}

export function planAutoSat(s: State, now: Date, newId: IdFactory): QuestEvent[] {
  const t = now.toISOString();
  return examsDueForSat(s, localDateOf(now)).map((o) => ({
    id: newId(now),
    t,
    type: "objective_completed",
    obj: o.id,
    tier: "sat",
  }));
}

/**
 * The once-a-day events: passed exams marked sat, then a close for every run
 * past its end date, counted with those sats applied. Ids come from `newId`
 * in that order, so with a shared `t` the sats replay first.
 */
export function planDailyCheck(s: State, now: Date, newId: IdFactory): QuestEvent[] {
  const sats = planAutoSat(s, now, newId);
  const after = structuredClone(s);
  for (const e of sats) applyEvent(after, e);
  const t = now.toISOString();
  const closes: QuestEvent[] = runsDueToClose(after, localDateOf(now)).map((r) => {
    const p = runProgress(after, r.id);
    return { id: newId(now), t, type: "quarter_closed", run: r.id, done: p.done, total: p.total, tier: tierFor(p.pct) };
  });
  return [...sats, ...closes];
}

/** A blank end (a cleared date field) means no end: the event omits the key. */
function endOf(end: LocalDate | undefined): { end?: LocalDate } {
  return end ? { end } : {};
}

function draftsFor(s: State, a: Action, now: Date): Result<Draft[]> {
  const today = localDateOf(now);
  // A closed run is reported as closed; one past its end date but not yet closed, as ended.
  const blocked = (run: string): string | null => {
    const r = s.runs.get(run);
    if (r?.closed) return "This run is closed.";
    return r && runEnded(r, today) ? "This run has ended." : null;
  };

  switch (a.type) {
    case "createRun": {
      const name = a.name.trim();
      const id = runIdFromName(name);
      if (!id.ok) return id;
      return ok([{ type: "quarter_created", run: id.value, name, start: a.start, ...endOf(a.end) }]);
    }
    case "correctRunDates":
      return ok([{ type: "quarter_dates_corrected", run: a.run, start: a.start, ...endOf(a.end) }]);
    case "addCourse": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      const bad = folderError(a.folder);
      if (bad) return err(bad);
      // One folder per course; a resit (same code in another run) shares its old folder.
      for (const r of s.runs.values()) {
        for (const c of r.courses.values()) {
          if (c.code !== a.code.trim() && sameFolder(c.folder, a.folder)) return err(`That folder is already used by ${c.code} · ${c.name}.`);
        }
      }
      return ok([{ type: "course_added", run: a.run, course: a.code.trim(), name: a.name.trim(), folder: a.folder.trim() }]);
    }
    case "undoCourse":
      return ok([{ type: "course_undone", run: a.run, course: a.code }]);
    case "addObjective": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      if (a.kind === "progress") return err("Progress objectives are no longer available.");
      let levels: string[] | undefined;
      if (a.kind === "reading") {
        levels = (a.levels ?? []).map((l) => l.trim()).filter(Boolean);
        if (levels.length < 1 || levels.length > 2) return err('A reading needs one or two levels, like "Chapter" or "Course, Chapter".');
      }
      const d: Draft = {
        type: "objective_added",
        obj: objectiveId(a.run, a.course, a.kind, nextNumber(s, a.run, a.course, a.kind)),
        run: a.run,
        course: a.course,
        kind: a.kind,
        title: a.title.trim(),
        source: "manual",
      };
      if (a.date !== undefined) d.date = a.date;
      if (a.steps !== undefined) d.steps = a.steps.map((x) => x.trim());
      if (levels) d.levels = levels;
      return ok([d]);
    }
    case "bulkAddObjectives": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      if (!BULK_KINDS.includes(a.kind)) return err("Bulk add works for lectures and labs.");
      if (!Number.isInteger(a.from) || !Number.isInteger(a.to) || a.from < 1 || a.from > a.to) {
        return err("Pick a range like 1 to 14.");
      }
      if (a.to - a.from + 1 > MAX_BULK) return err(`Bulk add is limited to ${MAX_BULK} at a time.`);
      const prefix = a.prefix.trim() || KIND_NAMES[a.kind];
      const first = nextNumber(s, a.run, a.course, a.kind);
      const drafts: Draft[] = [];
      for (let n = a.from, i = 0; n <= a.to; n++, i++) {
        drafts.push({
          type: "objective_added",
          obj: objectiveId(a.run, a.course, a.kind, first + i),
          run: a.run,
          course: a.course,
          kind: a.kind,
          title: `${prefix} ${n}`.trim(),
          source: "manual",
        });
      }
      return ok(drafts);
    }
    case "undoObjective":
      return ok([{ type: "objective_undone", obj: a.obj }]);
    case "selfCheck": {
      const o = s.objectives.get(a.obj);
      if (!o) return err("Unknown objective.");
      if (blocked(o.run)) return err(blocked(o.run)!);
      if (o.kind === "exam") return err("Exams complete automatically once their date passes.");
      if (o.kind === "progress") return err("Check the steps one by one.");
      if (EVIDENCE_KINDS.includes(o.kind)) return err("Pick the file that proves it.");
      return ok([{ type: "objective_completed", obj: a.obj, tier: "silver" }]);
    }
    case "completeWithEvidence": {
      const o = s.objectives.get(a.obj);
      if (!o) return err("Unknown objective.");
      if (blocked(o.run)) return err(blocked(o.run)!);
      if (!EVIDENCE_KINDS.includes(o.kind)) return err("Only lectures, assignments and labs take an evidence file.");
      // Stored exactly as Obsidian gives it: paths are compared character for character.
      if (!a.path.trim()) return err("Pick a file.");
      if (s.evidenceOwners.has(a.path)) {
        const owner = evidenceOwner(s, a.path);
        return err(owner ? `That file already proves ${owner.course} · ${owner.title}.` : "That file already proves another objective.");
      }
      return ok([{ type: "objective_completed", obj: a.obj, tier: "silver", evidence: a.path }]);
    }
    case "bumpReading":
    case "undoBump": {
      const o = s.objectives.get(a.obj);
      if (!o) return err("Unknown objective.");
      if (blocked(o.run)) return err(blocked(o.run)!);
      return ok([a.type === "bumpReading" ? { type: "reading_bumped", obj: a.obj, level: a.level } : { type: "reading_bump_undone", obj: a.obj }]);
    }
    case "createCharacter": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      if (s.runs.get(a.run)?.character) return err("This run already has a character.");
      const bad = checkLook(s, a.run, a.body, a.look);
      return bad ? err(bad) : ok([{ type: "character_created", run: a.run, body: a.body, look: structuredClone(a.look) }]);
    }
    case "changeLook": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      const c = s.runs.get(a.run)?.character;
      if (!c) return err("Make this run's character first.");
      const bad = checkLook(s, a.run, c.body, a.look, c.look);
      return bad ? err(bad) : ok([{ type: "character_changed", run: a.run, look: structuredClone(a.look) }]);
    }
    case "buyItem": {
      if (blocked(a.run)) return err(blocked(a.run)!);
      const r = s.runs.get(a.run);
      if (!r?.character) return err("Make this run's character first.");
      const it = item(a.item);
      const sh = it && shelf(it);
      if (!it || !sh) return err("That isn't for sale.");
      if (!fits(it, r.character.body)) return err(`${it.name} isn't made for this body.`);
      if (r.purchases.has(it.id)) return err(`You already own ${it.name}.`);
      const rewards = runRewards(s, a.run);
      if (rewards.level.level < sh.level) return err(`${it.name} opens at level ${sh.level}.`);
      if (rewards.coins < sh.price) return err(`${it.name} costs ${sh.price} coins; you have ${rewards.coins}.`);
      return ok([{ type: "item_bought", run: a.run, item: it.id, price: sh.price }]);
    }
    case "undoPurchase":
      if (blocked(a.run)) return err(blocked(a.run)!);
      return ok([{ type: "purchase_undone", run: a.run, item: a.item }]);
    case "acknowledgePrestige":
      return ok([{ type: "prestige_seen", run: a.run }]);
    case "checkStep": {
      const o = s.objectives.get(a.obj);
      if (!o) return err("Unknown objective.");
      if (blocked(o.run)) return err(blocked(o.run)!);
      const drafts: Draft[] = [{ type: "step_completed", obj: a.obj, step: a.step }];
      const othersDone = o.stepsDone.every((done, i) => done || i === a.step);
      if (othersDone && !o.stepsDone[a.step]) drafts.push({ type: "objective_completed", obj: a.obj, tier: "silver" });
      return ok(drafts);
    }
  }
}

function nextNumber(s: State, run: string, course: string, kind: Kind): number {
  const prefix = `${run}/${course}-${TYPE_CODES[kind]}`;
  let count = 0;
  for (const id of s.everObjectiveIds) if (id.startsWith(prefix)) count++;
  return count + 1;
}
