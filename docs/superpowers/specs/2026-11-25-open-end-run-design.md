# Runs without an end date

## Why

Sometimes a run starts before its end date is known. You should be able to create it with only a start date and add the end later.

## What changes

A run's end date becomes optional. While a run has no end:

- **No locking.** Start and End stay editable in Setup. Once an end date is saved, the usual 30-minute window runs from that save, then the dates lock as today.
- **No exam week.** Home and Setup don't show the exam week line. Exams can't be added yet: the exam form says "Set an end date to add exams."
- **Assignments can be due on any date.**
- **The run never ends or closes.** No ended state, no auto-close, no prestige. All of these work as today once an end is set.
- **Display.** Where a run shows "start → end", it shows "start → no end date". The Hall card says "no end date" instead of "ends …". Sorting by end puts runs with no end last.

## Approaches

1. **Optional end (picked).** `end` becomes optional on `quarter_created`, `quarter_dates_corrected`, the matching actions and `RunState`. Each reader of the end date handles "no end" explicitly. Old logs load unchanged, since they always carry an end.
2. A far-future stand-in date (e.g. 9999-12-31): fewer code changes, but the fake date leaks into displays and sorting. Rejected.
3. A separate "set end date" event: a clearer log, but it duplicates the date validation. Rejected.

## Details

- **Log format.** `end` is omitted from the event when there's none. If present, it must be a string, the same as `objective_added.date`.
- **Validation.** With no end, only the start is checked (it must be a valid date). The 7-day minimum applies once an end is given. Blanking the end while the dates are still editable is refused if the run has exams. Setting an end is refused if an existing assignment or exam would fall outside it (today's check).
- **Lock clock.** `RunState` gets a `datesSetAt` timestamp. It starts at `createdAt` and moves to the event time when a correction takes the end from none to a date. `canCorrectRun` is true when there's no end, or when `datesSetAt` is within the undo window. Replay applies the same rule.
- **Picking the current run.** With no end, a run counts as containing every day from its start onward. Among runs containing today, the soonest-ending one is picked first, and runs with no end come last.

## Left to the builder

- Exact hint wording in Setup (e.g. "Leave End blank if you don't know it yet.").
- Where the no-end handling lives: a small helper such as `hasEnd(run)`, or inline checks.
