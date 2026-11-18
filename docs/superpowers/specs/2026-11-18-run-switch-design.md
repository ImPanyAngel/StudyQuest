# StudyQuest — Overlapping Runs and a Run Switch: Short Design

Nov 18, 2026 · small change.

## Intent

Besides the university quarters, the user sets themselves other goals that run on their own schedule, such as a year-one career roadmap that prepares for the thesis. Each of these should be a run of its own that overlaps the quarters, with a simple way to switch between them.

## Decided by the user

- Runs may overlap.
- A run switch sits at the far right of the tab bar, and switching between runs is all it does.
- When StudyQuest opens, it shows the run that was last chosen.

## Approaches

- **One chosen run, switched from the tab bar (chosen).** Home, the badge and Setup show one run at a time, as they do today.
- Stack every live run on Home. Rejected: the user asked for a simple switch.
- A separate "side run" kind with no exam week or tier. Rejected: an ordinary run already fits (dates, courses, objectives, close, tier, Hall card).

## Behaviour

- **The switch:** a dropdown at the far right of the tab bar lists every run that isn't closed, ordered by start date and then by name. It appears only when there are at least two such runs.
- **What it controls:** Home and the status-bar badge show the chosen run, and Setup opens on it. Picking an open run in Setup's own picker, or creating a run there, moves the switch as well. Picking a closed run in Setup only views it.
- **Remembered:** the chosen run is saved in the plugin's settings (`data.json`, `{ "run": "<id>" }`), so it survives a restart.
- **Fallback:** used the first time, or when the remembered run is gone or closed. Of the runs containing today, it picks the one that ends soonest, which is normally the quarter. With none containing today, it picks the next upcoming run, then the latest past one, as today.
- **Overlap:** the rule that refused overlapping run dates is removed. Run ids must still be unique, so names still clash as before.

## Claude's calls (approved with this design)

- Every run still closes on its own end date and gets its own Prestige Up screen and Hall card. Several closes queue one after another, as now.
- Every run keeps its last 7 days as exam week, because exam dates need it. Home hides the exam-week line for a run with no exam objectives.
- The switch hides when there's only one open run.

## Non-goals

- Showing several runs on Home at once.
- A different kind of run.

## Testing

- Unit tests cover:
  - overlapping runs are accepted;
  - the fallback picks the containing run that ends soonest;
  - the open-run list and its order;
  - the chosen run, remembered or falling back;
  - whether a run has exams;
  - the run-choice holder: it saves, notifies, and does nothing when given the same id again.
- Manual check:
  - create an overlapping run; the switch appears;
  - switching changes Home and the badge;
  - reloading Obsidian keeps the choice;
  - Setup follows the switch;
  - a run with no exams shows no exam-week line.
