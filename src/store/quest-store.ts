import { planAction, planAutoSat, type Action } from "../core/actions";
import { localDateOf, type Clock } from "../core/dates";
import { createIdFactory, eventRun, type IdFactory, type QuestEvent } from "../core/events";
import { formatEvent, parseLog } from "../core/log-format";
import { replay } from "../core/replay";
import { err, ok, type Result } from "../core/result";
import { emptyState, type State } from "../core/state";

/** Where the event log lives. One file per run; the store only ever appends. */
export interface LogPort {
  /** Contents of every log file. */
  readAll(): Promise<string[]>;
  append(runId: string, lines: string[]): Promise<void>;
}

/** The text to append to a file currently holding `existing`. */
export function joinForAppend(existing: string, lines: string[]): string {
  const body = lines.join("\n") + "\n";
  return existing.length > 0 && !existing.endsWith("\n") ? "\n" + body : body;
}

export class QuestStore {
  private events: QuestEvent[] = [];
  private current: State = emptyState();
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private log: LogPort,
    readonly clock: Clock,
    private newId: IdFactory = createIdFactory(),
  ) {}

  get state(): State {
    return this.current;
  }

  load(): Promise<void> {
    return this.serial(async () => {
      const texts = await this.log.readAll();
      this.events = texts.flatMap(parseLog);
      this.current = replay(this.events);
      this.notify();
    });
  }

  dispatch(a: Action): Promise<Result<void>> {
    return this.serial(async () => {
      const planned = planAction(this.current, a, this.clock(), this.newId);
      if (!planned.ok) return planned;
      return this.write(planned.value);
    });
  }

  /** Marks passed exams as sat. Resolves to the number of events written. */
  runAutoSat(): Promise<number> {
    return this.serial(async () => {
      const events = planAutoSat(this.current, this.clock(), this.newId);
      if (events.length === 0) return 0;
      const r = await this.write(events);
      return r.ok ? events.length : 0;
    });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async write(events: QuestEvent[]): Promise<Result<void>> {
    const byRun = new Map<string, string[]>();
    for (const e of events) {
      const run = eventRun(e);
      byRun.set(run, [...(byRun.get(run) ?? []), formatEvent(e)]);
    }
    try {
      for (const [run, lines] of byRun) await this.log.append(run, lines);
    } catch (e) {
      return err(`Couldn't write to the log: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.events.push(...events);
    this.current = replay(this.events);
    this.notify();
    return ok(undefined);
  }

  private notify() {
    for (const fn of this.listeners) fn();
  }

  /** Runs tasks one at a time, so each plans against the state the previous one left. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }
}

/** Calls `onNewDay` the first time `check()` runs on a new local day. */
export class DayTicker {
  private last: string;

  constructor(
    private clock: Clock,
    private onNewDay: () => void,
  ) {
    this.last = localDateOf(clock());
  }

  check(): void {
    const today = localDateOf(this.clock());
    if (today === this.last) return;
    this.last = today;
    this.onNewDay();
  }
}
