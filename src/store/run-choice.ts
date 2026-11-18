/** The run the switch has picked, saved so it survives a restart. Listeners hear about changes. */
export class RunChoice {
  private listeners = new Set<() => void>();

  constructor(
    private id: string | undefined,
    private save: (id: string) => void,
  ) {}

  get(): string | undefined {
    return this.id;
  }

  set(id: string): void {
    if (id === this.id) return;
    this.id = id;
    this.save(id);
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
