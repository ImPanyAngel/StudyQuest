import type { Kind } from "./events";
import { err, ok, type Result } from "./result";

export const TYPE_CODES: Record<Kind, string> = {
  lecture: "LEC",
  assignment: "ASG",
  lab: "LAB",
  reading: "RDG",
  progress: "PRG",
  exam: "EXM",
};

export function runIdFromName(name: string): Result<string> {
  const id = name.trim().replace(/\s+/g, "-").replace(/[^A-Za-z0-9-]/g, "");
  if (!/[A-Za-z0-9]/.test(id)) return err("The run name needs at least one letter or number.");
  return ok(id);
}

export function isCourseCode(code: string): boolean {
  return /^[A-Za-z0-9]+$/.test(code);
}

export function objectiveId(run: string, course: string, kind: Kind, n: number): string {
  return `${run}/${course}-${TYPE_CODES[kind]}${String(n).padStart(2, "0")}`;
}
