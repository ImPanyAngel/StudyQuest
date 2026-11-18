/** Vault folder paths for courses. Pure: the vault side lives in src/store/course-folders.ts. */

const FORBIDDEN = ["\\", ":", "*", "?", '"', "<", ">", "|"];

export function defaultCourseFolder(code: string): string {
  return `Courses/${code}/`;
}

/** The normalised path and each of its parents, outermost first: "Courses/X/" → ["Courses", "Courses/X"]. */
export function folderChain(path: string): string[] {
  const parts = path
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p !== "");
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

export function folderError(path: string): string | null {
  const full = folderChain(path).at(-1);
  if (!full) return "A course folder needs a name.";
  const parts = full.split("/");
  if (parts.some((p) => p === "." || p === "..")) return "A folder path can't contain . or .. parts.";
  const ch = FORBIDDEN.find((c) => path.includes(c));
  return ch ? `A folder name can't contain ${ch}.` : null;
}
