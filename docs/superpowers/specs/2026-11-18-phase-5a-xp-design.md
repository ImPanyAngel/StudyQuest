# StudyQuest Phase 5a: XP, Levels, Coins and Badges (Design)

Nov 18, 2026. This is the spec for the first half of phase 5 in [the design doc](../../Design%20Document.md). The specs for phases 1–4, the course folders and the run switch (all in this folder) stay binding except where this document changes them.

## Intent

Phase 5 adds a small reward layer, and the user wants it to work **like a roguelike**: each run starts from nothing, and when it ends a new one begins. Even the character is made fresh every run ("it's nice making a new character every time"). This half, 5a, covers the numbers: XP, levels, coins, and the achievements that will later unlock items.

The second half, 5b, covers the character, shop and wardrobe. It waits until the user has picked a pixel-art sprite sheet. The user expects an LPC-style sheet under CC-BY, OGA-BY, CC-BY-SA, GPL or CC0, so a credits file will be needed. Nothing in 5a depends on the art.

## Goals

- Every run has its own XP, level and coins, starting from zero. This includes overlapping runs.
- Completing work in a run earns XP and coins for that run.
- Home shows the chosen run's level, XP bar and coins.
- Prestige Up and the Hall show each run's final level.
- Badges are earned in two ways. Some are won within a run. A few permanent ones are won when a run closes.
- The existing Q2 run gets its earned XP as soon as 5a ships.

## Non-goals

- Sprites, the shop, the wardrobe, character creation, and outfit snapshots (all in 5b).
- Spending coins. Until 5b, coins are just a number.
- Changing the status-bar badge, which keeps its "Q2 41%" form.

## Anti-goals

- **A second record of the truth.** XP, coins and badges are worked out by replaying the log, the same way completion % is. No new events are written.
- **Rewarding time.** XP comes only from finished things, which follows the design doc's "Objectives, not time" rule.

## Approaches

- **Derive from replay (chosen).** It's consistent with completion % and tiers. Earlier work counts immediately, and a weight can be retuned later without old entries disagreeing.
- Write `xp_earned` events. Rejected: it duplicates what the log already says, and retuning would leave the old entries wrong.

## Earning

Each run's XP is the sum below, over that run's objectives. Coins earned equal XP earned. Coins differ from XP only because 5b will spend them.

| Source | XP |
| --- | --- |
| Lecture done | 10 |
| Lab done | 15 |
| Assignment done | 40 |
| Exam sat | 50 |
| Reading: each live bump (one that isn't undone), at any level | 5 |
| Reading finished | 20 |
| Old Progress objective finished (no XP for its steps) | 15 |

- "Done" means any completion, including a DONE without evidence from an older log line. Open objectives and stains earn nothing.
- An undone reading bump takes its 5 XP back, because it's no longer live. After a reading is finished, its bumps can't be undone, so its total is fixed.
- A legacy reading with no levels earns just the 20 for finishing.
- A closed run's XP is frozen, because nothing can be added to it after the close.
- The weights are design values. If they're changed later, every run is recomputed from the log, including closed runs. This follows the design doc's principle that replay lets new rules apply to past work.

## Levels

Every run starts at level 1. Going from level *L* to *L + 1* costs `50 + 10 × (L − 1)` XP: 50 to reach level 2, 60 more to reach level 3, and so on. There's no level cap.

A pure function returns `{ level, xpIntoLevel, xpForNextLevel }` for a given XP total. For example, 0 XP gives `{1, 0, 50}`, 50 XP gives `{2, 0, 60}`, and 109 XP gives `{2, 59, 60}`.

## Badges

| Badge | Kind | Earned when |
| --- | --- | --- |
| Course complete | in-run, once per course | every objective of a course in this run is done (course at 100%, with at least one objective) |
| Lecture sweep | in-run, once per course | every lecture of a course in this run is done (the course has at least one lecture) |
| First prestige | permanent | the first run to close, at any tier |
| Tier 3 run | permanent | the first run to close at Tier 3 or better |
| Tier 5 run | permanent | the first run to close at Tier 5 |

- **In-run badges** are live. One appears as soon as its condition holds, and it belongs to that run only.
  - Undoing a completion is already impossible, so a badge is never lost through undo.
  - A new objective added later to a completed course can take its Course complete badge away until that objective is done. That's honest, so it's accepted.
  - On a closed run, the badges are whatever held at the close, and they stay frozen.
- **Permanent badges** belong to you, not to a run. Each is credited to the closed run that first earned it.
  - Runs are ordered by close time (`closed.at`), then by run id.
  - The tier comes from the stored close (`quarter_closed.tier`).
  - In 5b each permanent badge becomes a free item that every later run's character can wear.

## Screens

- **Home:**
  - Show the chosen run's level, an XP bar (`xpIntoLevel / xpForNextLevel`) and coins next to the character.
  - Show the run's in-run badges, compactly, near them.
  - The layout is left to the builder, within the existing top row. The top row must not jump height between runs, the same rule as the exam-week line.
- **Prestige Up:**
  - Show the run's final level next to its percentage and tier.
  - Show "Unlocked: First prestige" (and any other new ones) for each permanent badge that this run was the first to earn.
  - Remove the hint "Character customisation arrives in phase 6." In its place, the disabled "Customise character" button says it arrives with the character update.
- **Hall cards:** show the run's level. Open runs show their live level.
- **Hall run page:** list the badges earned in that run, both in-run and any permanent ones credited to it.
- **Home's "is closed" box:** shown when Home falls back to a closed run. It shows that run's final level next to its % and tier.
- **No pop-ups:** levelling up and earning a badge show no Notice. The numbers on screen are enough.

## Design doc

Update `docs/Design Document.md` to match:
- **Rewards:** XP, levels and coins are per run and start over (roguelike), and the outfit is rebuilt each run. Give the earning table and the level curve in brief. Replace the achievement examples with the in-run and permanent badges above.
- **Prestige snapshot:** keep it. It now records each run's freshly made character.
- **Build plan:** phase 5 becomes "5a XP, levels, coins and badges" and "5b Character, shop and wardrobe (waits for the sprite sheet)".
- **Prestige Up wording:** remove the leftover "phase 6" mention from its hint. The code and the doc stay consistent.

## Where the logic lives

- All rules live in `src/core/` as pure, unit-tested functions:
  - XP per objective;
  - XP, coins and level per run;
  - in-run badges per run;
  - permanent badges with the run that earned each.
- The UI only reads them.

## Testing

- **Unit tests:**
  - every XP row of the table;
  - an undone bump takes its XP back;
  - a legacy reading earns 20;
  - stains earn nothing;
  - the level boundaries at 0, 49, 50, 109 and 110 XP;
  - Course complete and Lecture sweep, including a course with no lectures and a course reopened by a new objective;
  - permanent badges: earned by the first qualifying close, credited to that run, ordered by close time with ties broken by run id, and never earned twice;
  - overlapping runs keep separate XP.
- **Manual check in Obsidian:**
  - Q2 shows its level and coins on Home;
  - completing a lecture adds 10;
  - bumping a reading adds 5, and undoing the bump removes it;
  - the Hall shows levels;
  - the run page lists badges.

## Left to the builder

- The exact layout and styling of the level, XP bar, coins and badges on each screen.
- How badges are named in code.

## Decided by the user

- Roguelike: level, XP and coins are per run and start over.
- Pure reset: nothing bought carries over (that applies to 5b).
- The XP weights and level curve above.
- The split between in-run badges and the three permanent badges (first prestige, Tier 3, Tier 5).
- Images wait until the user has picked a sprite sheet. A later install link for the art is possible.

## Decided on the user's behalf

- Coins earned equal XP earned.
- A reading earns 5 XP per live bump at any level, plus 20 on finishing.
- Old Progress objectives earn 15 XP when finished, and nothing per step.
- Badges are named badges until 5b ties each one to an item.
- The status-bar badge is unchanged.
- In-run badges are live and can lapse when a new objective reopens a course.
- "First prestige" counts any close, including Unranked and runs without exams. (The reviewer's call.)
- Home's closed-run box shows the final level, and nothing pops up on a level-up or badge. (The reviewer's calls.)
- The design doc is updated as listed above.
