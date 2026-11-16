/** Wraps an async handler so repeat calls are ignored while one is still running. */
export function singleFlight(fn: () => unknown): () => Promise<void> {
  let busy = false;
  return async () => {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
    }
  };
}
