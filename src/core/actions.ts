import { localDateOf, type LocalDate } from "./dates";
import { examsDueForSat, runEnded } from "./derive";
import { BULK_KINDS, type IdFactory, type Kind, type QuestEvent } from "./events";
import { TYPE_CODES, objectiveId, runIdFromName } from "./ids";
import { applyEvent } from "./replay";
import { err, ok, type Result } from "./result";
import type { State } from "./state";

export type Action =
  | { type: "createRun"; name: string; start: LocalDate; end: LocalDate }
  | { type: "correctRunDates"; run: string; start: LocalDate; end: LocalDate }
  | { type: "addCourse"; run: string; code: string; name: string; folder: string }
  | { type: "undoCourse"; run: string; code: string }
  | { type: "addObjective"; run: string; course: string; kind: Kind; title: string; date?: LocalDate; steps?: string[] }
  | { type: "bulkAddObjectives"; run: string; course: string; kind: Kind; prefix: string; from: number; to: number }
  | { type: "undoObjective"; obj: string }
  | { type: "selfCheck"; obj: string }
  | { type: "checkStep"; obj: string; step: number };

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

/** The run whose log file an event belongs in. */
export function runOf(e: QuestEvent, s: State): string {
  if ("run" in e) return e.run;
  return s.objectives.get(e.obj)?.run ?? e.obj.split("/")[0];
}

function draftsFor(s: State, a: Action, now: Date): Result<Draft[]> {
  const today = localDateOf(now);
  const ended = (run: string): boolean => {
    const r = s.runs.get(run);
    return !!r && runEnded(r, today);
  };
  const ENDED = "This run has ended.";

  switch (a.type) {
    case "createRun": {
      const name = a.name.trim();
      const id = runIdFromName(name);
      if (!id.ok) return id;
      return ok([{ type: "quarter_created", run: id.value, name, start: a.start, end: a.end }]);
    }
    case "correctRunDates":
      return ok([{ type: "quarter_dates_corrected", run: a.run, start: a.start, end: a.end }]);
    case "addCourse":
      if (ended(a.run)) return err(ENDED);
      return ok([{ type: "course_added", run: a.run, course: a.code.trim(), name: a.name.trim(), folder: a.folder.trim() }]);
    case "undoCourse":
      return ok([{ type: "course_undone", run: a.run, course: a.code }]);
    case "addObjective": {
      if (ended(a.run)) return err(ENDED);
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
      return ok([d]);
    }
    case "bulkAddObjectives": {
      if (ended(a.run)) return err(ENDED);
      if (!BULK_KINDS.includes(a.kind)) return err("Bulk add works for lectures, labs and readings.");
      if (!Number.isInteger(a.from) || !Number.isInteger(a.to) || a.from < 1 || a.from > a.to) {
        return err("Pick a range like 1 to 14.");
      }
      if (a.to - a.from + 1 > MAX_BULK) return err(`Bulk add is limited to ${MAX_BULK} at a time.`);
      const prefix = a.prefix.trim();
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
      if (ended(o.run)) return err(ENDED);
      if (o.kind === "exam") return err("Exams complete automatically once their date passes.");
      if (o.kind === "progress") return err("Check the steps one by one.");
      return ok([{ type: "objective_completed", obj: a.obj, tier: "silver" }]);
    }
    case "checkStep": {
      const o = s.objectives.get(a.obj);
      if (!o) return err("Unknown objective.");
      if (ended(o.run)) return err(ENDED);
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
