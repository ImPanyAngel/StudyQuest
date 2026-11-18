import type { LocalDate } from "../../src/core/dates";
import type { Look } from "../../src/core/character";
import type {
  CharacterChanged,
  CharacterCreated,
  CourseAdded,
  CourseUndone,
  Kind,
  ObjectiveAdded,
  ObjectiveCompleted,
  ObjectiveUndone,
  ItemBought,
  PrestigeSeen,
  PurchaseUndone,
  QuarterClosed,
  ReadingBumpUndone,
  ReadingBumped,
  QuarterCreated,
  QuarterDatesCorrected,
  StepCompleted,
} from "../../src/core/events";
import { objectiveId, runIdFromName } from "../../src/core/ids";

/** 2026-11-16 11:00 local (CET). */
export const T0 = Date.parse("2026-11-16T10:00:00.000Z");
export const at = (min: number): string => new Date(T0 + min * 60_000).toISOString();

let seq = 0;
const id = () => `e_${String(++seq).padStart(26, "0")}`;

export const Q2 = { name: "2026-27 Q2", run: "2026-27-Q2", start: "2026-11-09", end: "2027-01-30" };

/** A plain male look made only of starter items. */
export const LOOK: Look = {
  skin: "light",
  head: "head/heads/human/heads_human_male",
  face: "head/faces/face_neutral",
  worn: {
    clothes: { item: "torso/shirts/shortsleeve/torso_clothes_tshirt", color: "white" },
    legs: { item: "legs/pants/legs_pants", color: "black" },
    shoes: { item: "feet/shoes/feet_shoes_basic", color: "brown" },
  },
};

export const ev = {
  created(name = Q2.name, start: LocalDate = Q2.start, end: LocalDate = Q2.end, t = at(0)): QuarterCreated {
    const r = runIdFromName(name);
    return { id: id(), t, type: "quarter_created", run: r.ok ? r.value : "", name, start, end };
  },
  corrected(run: string, start: LocalDate, end: LocalDate, t: string): QuarterDatesCorrected {
    return { id: id(), t, type: "quarter_dates_corrected", run, start, end };
  },
  course(run: string, code: string, t = at(1)): CourseAdded {
    return { id: id(), t, type: "course_added", run, course: code, name: `${code} course`, folder: `${code}/` };
  },
  courseUndone(run: string, code: string, t: string): CourseUndone {
    return { id: id(), t, type: "course_undone", run, course: code };
  },
  objective(
    run: string,
    course: string,
    kind: Kind,
    n: number,
    t = at(2),
    extra: { date?: LocalDate; steps?: string[]; title?: string; levels?: string[] } = {},
  ): ObjectiveAdded {
    const e: ObjectiveAdded = {
      id: id(),
      t,
      type: "objective_added",
      obj: objectiveId(run, course, kind, n),
      run,
      course,
      kind,
      title: extra.title ?? `${kind} ${n}`,
      source: "manual",
    };
    if (extra.date !== undefined) e.date = extra.date;
    if (extra.steps !== undefined) e.steps = extra.steps;
    if (extra.levels !== undefined) e.levels = extra.levels;
    return e;
  },
  objectiveUndone(obj: string, t: string): ObjectiveUndone {
    return { id: id(), t, type: "objective_undone", obj };
  },
  step(obj: string, step: number, t: string): StepCompleted {
    return { id: id(), t, type: "step_completed", obj, step };
  },
  completed(obj: string, tier: "silver" | "sat", t: string, evidence?: string): ObjectiveCompleted {
    const e: ObjectiveCompleted = { id: id(), t, type: "objective_completed", obj, tier };
    if (evidence !== undefined) e.evidence = evidence;
    return e;
  },
  bump(obj: string, level: number, t: string): ReadingBumped {
    return { id: id(), t, type: "reading_bumped", obj, level };
  },
  bumpUndone(obj: string, t: string): ReadingBumpUndone {
    return { id: id(), t, type: "reading_bump_undone", obj };
  },
  closed(run: string, done: number, total: number, tier: number, t: string): QuarterClosed {
    return { id: id(), t, type: "quarter_closed", run, done, total, tier };
  },
  seen(run: string, t: string): PrestigeSeen {
    return { id: id(), t, type: "prestige_seen", run };
  },
  character(run: string, body: string, look: Look = LOOK, t = at(2)): CharacterCreated {
    return { id: id(), t, type: "character_created", run, body, look };
  },
  changed(run: string, look: Look, t: string): CharacterChanged {
    return { id: id(), t, type: "character_changed", run, look };
  },
  bought(run: string, item: string, price: number, t: string): ItemBought {
    return { id: id(), t, type: "item_bought", run, item, price };
  },
  purchaseUndone(run: string, item: string, t: string): PurchaseUndone {
    return { id: id(), t, type: "purchase_undone", run, item };
  },
};
