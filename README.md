# StudyQuest

An [Obsidian](https://obsidian.md) plugin that turns each university quarter into a game run.

Courses are games, objectives are achievements, and every quarter ends in a permanent prestige record. Progress only comes from finished work, never from time spent, and the record can't be edited after the fact.

## Features

- **Runs.** Each quarter (or any other stretch of work, like a year-long side project) is a run with its own dates, courses and objectives. Runs can overlap; a switch in the tab bar picks which one you see.
- **Objectives.** Lectures, assignments, labs, readings and exams. Objectives can be added at any time but never deleted, apart from a 30-minute undo for typos.
- **Evidence.** Lectures, assignments and labs are completed by picking the vault file that proves them. Notebooks with unfinished `TODO` stubs and notes under 5,000 characters are refused. One file proves one objective.
- **Readings.** Tracked chapter by chapter, with an optional second level such as course and chapter.
- **Exams.** Marked as sat automatically once their date passes.
- **Prestige.** When a run ends it closes into a tier based on how much got done, and joins the Hall: a gallery of every run you've finished.
- **XP, levels and coins.** Earned from finished work, per run. Every run starts from zero, like a roguelike.
- **Badges.** In-run badges for finishing every lecture or every objective in a course, and permanent ones for your first prestige and your first Tier 3 and Tier 5 runs.
- **Character.** Each run gets a freshly made pixel character. Coins buy clothes and gear from a shop whose shelves open as you level up, and badges unlock special items.

## Installation

StudyQuest runs on Obsidian for desktop (1.7.2 or later).

**From Obsidian:** once it's listed, open **Settings → Community plugins → Browse**, search for StudyQuest, install it and turn it on.

**By hand:**

1. Download `main.js`, `manifest.json` and `styles.css` from the latest [release](https://github.com/ImPanyAngel/StudyQuest/releases).
2. Put them in `<your vault>/.obsidian/plugins/studyquest/`.
3. Reload Obsidian and turn on StudyQuest under **Settings → Community plugins**.

Open it from the trophy icon in the ribbon or the **StudyQuest: Open home** command.

## Your data

Everything StudyQuest knows is an append-only event log kept in its plugin folder, `.obsidian/plugins/studyquest/log/`, one file per run. It stays out of your file explorer, search and graph. Course folders it creates go under `Courses/` in your vault.

- **Syncing.** With Obsidian Sync, turn on syncing for installed community plugins so the log travels with the plugin.
- **Uninstalling.** Removing the plugin deletes its folder, log included. Copy the `log/` folder somewhere safe first if you want to keep your history.

## Development

```sh
npm install
npm run dev     # build and watch
npm test        # unit tests
npm run build   # type-check and production build
```

The character art lives in `assets/sprites/` as a generated bundle. To rebuild it from a local copy of the LPC generator's art, see [assets/sprites/README.md](assets/sprites/README.md).

The design and the decisions behind each part are in [docs/Design Document.md](docs/Design%20Document.md).

## Credits

Character art comes from the [Liberated Pixel Cup](https://lpc.opengameart.org) collection via the [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator). Each piece keeps its own licence (CC0, CC-BY, OGA-BY, CC-BY-SA or GPL); every artist is listed in [assets/sprites/CREDITS.md](assets/sprites/CREDITS.md) and in the plugin under **Art credits**.

## License

The code is released under the [MIT License](LICENSE). The art in `assets/sprites/` keeps its original licences, listed in its credits.
