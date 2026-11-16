# StudyQuest Phase 2 — Prestige: Design

Nov 16, 2026 · spec for phase 2 of [the design doc](../../Design%20Document.md). Builds on [phase 1](2026-11-16-phase-1-core-loop-design.md), which stays binding except where this document changes it.

## Intent

A quarter should end with a moment, and leave a record that can't be argued with afterwards. When a run's end date passes, it freezes: its score and tier are fixed, anything still open becomes a permanent stain, and a **Prestige Up** screen marks the occasion. Past runs collect in a **Prestige hall**, a library of every run like a game library, where each run opens into its full achievement list.

Phase 2 also fixes the time zone: every "what day is it" question is answered in Netherlands time, because that is the calendar the university runs on.

## Goals

- Close a run automatically once its end date has passed, freezing its score, tier and stains.
- Show a Prestige Up screen once per closed run, which stays until the user presses a button.
- A Prestige hall tab: a library of run cards, each opening a run page listing every objective with its mark.
- All calendar-day logic uses the Europe/Amsterdam time zone, whatever the Mac is set to.
- Raise `minAppVersion` to match the APIs the plugin actually uses.

## Non-goals (later phases)

- Character customisation, outfits, outfit snapshots on cards (phase 6). The Prestige Up screen and cards use placeholders.
- XP, coins, achievements beyond the objective list (phase 6).
- Gold marks and evidence (phases 3–4).
- Final tier names or thresholds. Placeholders stay until a theme is chosen.
- Reopening, editing or deleting a closed run.

## Anti-goals

- **A closed run changing.** After close, nothing about that run (score, tier, marks, stains) may change, whether through the UI or a later log line.
- **The Prestige Up screen nagging.** It appears once per run and never again after a button is pressed.
- **Rewriting the log.** Still append only.

## Concepts and rules

### Time zone

- A **local date** now means the calendar date in **Europe/Amsterdam** at a given instant, regardless of the system time zone. This applies everywhere phase 1 used the local date: exams turning sat, overdue and "soon" highlights, run ended, current run, the daily check, undo countdown display is unaffected (it is in minutes).
- The once-a-day check runs just after **Amsterdam midnight** while Obsidian is open, plus on load, window focus and visibility change as in phase 1.
- Dates the user types stay plain `YYYY-MM-DD` calendar dates. Event timestamps stay ISO 8601 UTC.
- No existing log line changes meaning: the user's Mac has always been on Amsterdam time.

### Closing a run

- A run is **due to close** when today (Amsterdam) is after its end date and it has no `quarter_closed` event.
- The daily check (load, midnight, focus, visibility) does, in order:
  1. mark passed exams as sat (phase 1 behaviour), then
  2. close every run that is due, oldest end date first, by appending a `quarter_closed` event to that run's log.
  So an exam on the last day of a run is sat before the run's score is frozen.
- `quarter_closed` records the frozen result: `done` (completed objectives), `total` (objectives), and `tier` (0–5). The percentage is `floor(done / total × 100)`, or "—" when `total` is 0.
- **Tier** is computed from the percentage at close, using the placeholder table from the design doc:

  | Tier | Percentage | Label (placeholder) |
  | --- | --- | --- |
  | 5 | 100 | Tier 5 |
  | 4 | 95–99 | Tier 4 |
  | 3 | 90–94 | Tier 3 |
  | 2 | 85–89 | Tier 2 |
  | 1 | 75–84 | Tier 1 |
  | 0 | below 75, or no objectives | Unranked |

  The tier number is stored in the event, so changing the thresholds later never changes a past run's tier. Labels are looked up from the number at display time, so renaming tiers later does rename them on old cards.
- **Stains** are the objectives of a closed run that are not complete. They aren't stored separately; with the run frozen they are derived from replay and can't change.
- **After close, the run is frozen.** Replay ignores every later event that touches the run (objectives added, completed, steps checked, undos, corrections, courses) except `prestige_seen`. The UI offers no actions on a closed run.
- Phase 1 already stops adds and self checks after the end date; this continues. Between the end date passing and the close event being written (Obsidian not yet opened), nothing can be added either.
- A run created with an end date already in the past closes at the next check with whatever it has (normally Unranked, no objectives). No special handling.
- The thesis run closes like any other run, at its own end date.

### Prestige Up screen

- Shown for every closed run that has no `prestige_seen` event, oldest first, one at a time.
- It takes over the whole StudyQuest view, tabs included, until a button is pressed. If the view isn't open when a run closes (or at startup with an unseen close), the plugin opens it.
- Layout (user chose layout B in the brainstorm, `.superpowers/brainstorm/…/prestige-up.html`):
  - big **PRESTIGE UP** title,
  - the run name with "complete",
  - the character on the left (the same placeholder figure as Home until phase 6),
  - on the right, the frozen **percentage** in large type and the **tier** label.
  - Buttons: **Set up next run →** and **Customise character**, the latter disabled with a note that it arrives in phase 6.
- Pressing **Set up next run** appends `prestige_seen` for that run, then either shows the next unseen run's screen or goes to Setup with "New run…" selected.
- The screen does not show stains or course detail. It stays minimal.

### Prestige hall

- A third tab, **Hall**, after Home and Setup.
- A library grid of run cards (user approved the mockup `prestige-hall.html`):
  - Closed runs: placeholder art, run name, frozen percentage, tier label, stain count ("4 stains" / "no stains").
  - Runs not yet closed (current and upcoming) appear first as dashed cards: run name, live percentage, and "ends <date>" (or "starts <date>" for upcoming ones). No tier.
  - Then closed runs, newest end date first.
- Clicking any card opens the **run page**:
  - back link to the Hall,
  - header: run name, percentage, tier (closed runs only), dates, "done of total", stain count,
  - every objective grouped by course (courses in the order added, each with its course %), objectives in the order added, each with type tag, title, step count for Progress, and its mark: SILVER, SAT, (GOLD later), **STAIN** for open objectives of a closed run, or OPEN for an unclosed run.
  - Read only. No completion menu on this page.

### Elsewhere

- **Home**, when the current run (phase 1 rules) is closed: instead of the run's contents, show "<run name> is closed" with its percentage and tier, and buttons to Setup and the Hall.
- **Course view** of a closed run shows open objectives as STAIN, and nothing is clickable.
- **Setup** for a closed run shows it as closed; no forms.
- **Status bar** keeps showing the current run's short name and percentage (for a closed run, the frozen percentage).

## Event log changes

New event types, appended to the run's own log file. Existing event types keep their meaning.

| Type | Fields | Meaning |
| --- | --- | --- |
| `quarter_closed` | `run`, `done`, `total`, `tier` | The run froze. Counts and tier as computed at close. |
| `prestige_seen` | `run` | The user dismissed the Prestige Up screen for this run. |

Replay validity (an invalid event is ignored, as in phase 1):

- `quarter_closed`: the run exists and isn't already closed; the Amsterdam date of `t` is after the run's end date; `done` and `total` are whole numbers with `0 ≤ done ≤ total`; `tier` is an integer 0–5.
- `prestige_seen`: the run is closed and not already seen.

**The close is the record.** The first valid `quarter_closed` for a run is final. Its stored `done`, `total` and `tier` are what every screen shows for that run's score and tier from then on. Replay does not recount them or recheck the tier against the threshold table, because either check could later invalidate a close and reopen the run, which breaks the first anti-goal.

**What counts as after the close.** An event touching a closed run, other than `prestige_seen`, is ignored if either:
- it sorts after the close in replay order (`t`, then `id`), or
- it appears *below* the close line in the run's own log file, whatever its `t`.

The second rule catches lines added later with an earlier timestamp, for example by hand editing or restoring an old copy. Those lines must not change marks or stains on a frozen run. The plugin only ever appends, so for everything it writes, position in the file and time order agree.

Replay's checks guard against accidents: duplicated lines, malformed lines, stale copies. They are not a defence against someone deliberately editing the log; the user is the only player.

Example:

```
{"id":"e_01JK…","t":"2027-01-31T08:12:00Z","type":"objective_completed","obj":"2026-27-Q2/DSAIT4000-EXM01","tier":"sat"}
{"id":"e_01JK…","t":"2027-01-31T08:12:00Z","type":"quarter_closed","run":"2026-27-Q2","done":46,"total":50,"tier":3}
{"id":"e_01JM…","t":"2027-01-31T08:13:40Z","type":"prestige_seen","run":"2026-27-Q2"}
```

## Other changes

- **`minAppVersion`:** set to the lowest Obsidian version that has every API the plugin uses (check the `@since` tags in `obsidian.d.ts`; `await workspace.revealLeaf` needs 1.7.2, for example). The user has updated Obsidian, so this won't exclude them.

## Testing

- Unit tests: tier boundaries (74/75, 84/85, 89/90, 94/95, 99/100, empty run); close planning (due/not due on the end date itself and the day after, sat-before-close ordering in the same check, several runs due at once); replay freeze (events after close ignored; a backdated line below the close in the file ignored; close dated on or before the end date ignored; close with done > total ignored; second close ignored); `prestige_seen` rules; hall ordering; Amsterdam date at instants around midnight and both DST switches.
- The whole suite must pass with the system time zone set to something other than Amsterdam (e.g. `TZ=America/New_York`), proving nothing depends on the Mac's zone.
- Manual check in Obsidian: a short test run that ended yesterday closes on reload, shows Prestige Up (layout B) with the right percentage and tier, "Set up next run" lands on Setup with New run selected, the screen doesn't come back after a restart, the Hall shows the card and its run page with stains, and the closed run offers no actions anywhere.

## Left to the builder

- How the Amsterdam date is computed (e.g. `Intl.DateTimeFormat` with `timeZone: "Europe/Amsterdam"`), and how the next Amsterdam midnight is scheduled.
- Where tier and close logic live in the core, and how the hall and run page are split into files.
- Exact styling of the Prestige Up screen and cards, within the approved mockups.
- How the plugin opens the view for an unseen close.

## Decisions made on the user's behalf

- `quarter_closed` stores counts and the tier number; the tier label is looked up at display time.
- The first valid close is final. Its stored counts and tier are the record, and replay doesn't recount or recheck them. This came out of the reviewer's check: a recount could reopen a frozen run.
- After close, events touching the run are ignored if they come later in time order *or* sit below the close line in the run's file. So a line pasted in later with an older timestamp can't change a frozen run.
- Replay guards against accidents, not deliberate log editing.
- The plugin opens the StudyQuest view by itself when there is an unseen Prestige Up screen.
- Several unseen closes are shown one after another, oldest first.
- Hall: unclosed runs first as dashed cards (including upcoming ones), then closed runs newest first; the run page is read only.
- Home, the course view and Setup show a closed run as closed, with stains marked and no actions.
- Status bar unchanged in format; shows the frozen percentage for a closed run.
- A run whose end date is already in the past when created simply closes at the next check.

Decided by the user: Prestige Up appears the first time Obsidian is open after the end date, stays until a button is pressed, uses layout B (character beside percentage and tier), and leads to Setup; the Hall is a simple game-library grid where each run opens its achievement list; exams on the last day are sat before the close; Netherlands time for all day logic.
