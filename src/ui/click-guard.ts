/**
 * True once `ms` have passed since creation. Used on buttons that appear in
 * the same spot right after a click, so the second click of a double click
 * doesn't land on them.
 */
export function armedAfter(ms: number, now: () => number = Date.now): () => boolean {
  const ready = now() + ms;
  return () => now() >= ready;
}
