/** Rules an evidence file must pass when it's picked. Each returns a refusal message, or null when the file is fine. */

export const MIN_NOTE_CHARS = 5000;
/** Lowercase extensions that have a rule; every other file passes. */
export const CHECKED_EXTENSIONS: readonly string[] = ["ipynb", "md"];

const MARKER = /\bTODO\b|YOUR CODE HERE/i;
const PLACEHOLDER = /^(pass|\.\.\.|None|raise NotImplementedError(\(.*\))?)$/;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(\r?\n|$)/;

export function checkEvidence(extension: string, text: string): string | null {
  switch (extension.toLowerCase()) {
    case "ipynb":
      return checkNotebook(text);
    case "md":
      return checkNote(text);
    default:
      return null;
  }
}

/** Refuses empty code cells and TODO / YOUR CODE HERE markers still followed by a placeholder. */
export function checkNotebook(text: string): string | null {
  let cells: unknown;
  try {
    cells = (JSON.parse(text) as { cells?: unknown } | null)?.cells;
  } catch {
    cells = undefined;
  }
  if (!Array.isArray(cells)) return "Couldn't read this notebook.";

  // Code cells' text by position; other cell types are null. Numbered across every cell type, as Jupyter shows them.
  const sources = cells.map((cell: { cell_type?: unknown; source?: unknown } | null) =>
    cell?.cell_type !== "code" ? null : Array.isArray(cell.source) ? cell.source.join("") : typeof cell.source === "string" ? cell.source : "",
  );
  // Empty code cells after the last filled one are ignored: Jupyter adds one on Shift+Enter at the end.
  const lastFilled = sources.findLastIndex((src) => src !== null && src.trim() !== "");
  if (lastFilled === -1) return "This notebook has no code.";

  const problems: string[] = [];
  sources.slice(0, lastFilled + 1).forEach((source, i) => {
    if (source === null) return;
    const n = i + 1;
    if (source.trim() === "") {
      problems.push(`Cell ${n} is empty`);
      return;
    }
    const ls = source.split(/\r?\n/);
    const isComment = (l: string) => l.trim().startsWith("#");
    const seen = new Set<number>();
    ls.forEach((line, at) => {
      if (!isComment(line) || !MARKER.test(line)) return;
      const next = ls.findIndex((l, j) => j > at && l.trim() !== "" && !isComment(l));
      if (seen.has(next)) return; // several markers above one line count once
      seen.add(next);
      if (next === -1) {
        problems.push(`Cell ${n}: the TODO has no code under it`);
        return;
      }
      const code = ls[next].replace(/\s+#.*$/, "").trim();
      if (PLACEHOLDER.test(code)) problems.push(`Cell ${n}: the TODO is still \`${code}\``);
    });
  });

  if (problems.length === 0) return null;
  return problems.length === 1 ? `${problems[0]}.` : `${problems[0]} (and ${problems.length - 1} more).`;
}

/** Refuses a note shorter than MIN_NOTE_CHARS, not counting frontmatter or surrounding whitespace. */
export function checkNote(text: string): string | null {
  const body = text.replace(FRONTMATTER, "").trim();
  const n = Array.from(body).length;
  if (n >= MIN_NOTE_CHARS) return null;
  return `This note has ${n.toLocaleString("en-US")} characters; a note needs at least ${MIN_NOTE_CHARS.toLocaleString("en-US")}.`;
}
