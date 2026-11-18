# StudyQuest Phase 5b — Character, Shop and Wardrobe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every run gets a freshly made pixel character (LPC, forward-facing breathing idle). It's dressed from a level-gated shop with that run's coins, and shown on Home, Prestige Up and the Hall.

**Architecture:**
- **Art pipeline:** a Python build script (dev-only) turns a local LPC checkout into two committed files.
  - `assets/sprites/items.json` is a small index: items, layers, bodies, palettes and colour maps.
  - `assets/sprites/atlas.json` is one base64 PNG atlas.
- **Core (pure):** `src/core/` gains a catalog (slots, shelves, prices, starter and badge items), the four new events, and planning rules. It also gains the pure pieces of drawing: the recolour function and the layer list.
- **UI:** `src/ui/` decodes the atlas, recolours and composites onto a canvas, and adds the creation and character pages.

**Tech Stack:** TypeScript 7, Obsidian API, esbuild (bundles JSON natively), Vitest 5 (`TZ=America/New_York`). Python 3 + Pillow, for the build script only.

**Spec:** `docs/superpowers/specs/2026-11-18-phase-5b-character-design.md`

## Global Constraints

- Nothing under `src/core/` imports `obsidian`. `src/core/` may import `assets/sprites/items.json`, but never `atlas.json`.
- **Replay trusts recorded history.** Shop rules are enforced in planning only. Replay checks only that events are well formed and that the run is open (spec "The log").
- **Event names and fields:**
  - `character_created {run, body, look}`
  - `character_changed {run, look}`
  - `item_bought {run, item, price}`
  - `purchase_undone {run, item}`
- **Shelves:**

  | Level | Price | Contents |
  | --- | --- | --- |
  | 1 | 30–60 | plain clothes |
  | 4 | 80–150 | nicer clothes, simple hats, glasses, jewellery, gloves |
  | 8 | 200–300 | armour, capes, fancy hats, shields |
  | 11 | 400–500 | wings, tails, sword |

- **Starter set** (free, never sold): T-shirt, Shortsleeve, Longsleeve; Pants, Shorts, Plain skirt; Shoes, Socks.
- **Badge items** (never sold):

  | Badge | Item | Scope |
  | --- | --- | --- |
  | Lecture sweep | Nerd glasses | in-run |
  | Course complete | Star amulet | in-run |
  | First prestige | Scarf | permanent |
  | Tier 3 run | Solid cape | permanent |
  | Tier 5 run | Crown | permanent |

- Bodies are `male` and `female`. The default face is Neutral. Add-on layer types (`*_trim`, `*_overlay`, `sleeves`, `sash_tie`, `dress_sleeves*`) are excluded.
- **Art:** about 1 MB or less in total for both JSON files. `assets/sprites/CREDITS.md` lists every shipped item. Nothing from `.superpowers/` is committed.
- The version is `0.6.0` (`manifest.json`, `package.json`, plus `versions.json` `"0.6.0": "1.7.2"`).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A look saved while an in-run badge has lapsed.** The lapsed item, carried over unchanged, survives. Adding it fresh is refused. → Task 4 test.
2. **Buying, then undoing at exactly 30 and 31 minutes.** Undo also removes the item from the look and refunds the coins. → Task 4 test.
3. **A stored look naming an item or colour that the bundle no longer has.** That part isn't drawn and nothing crashes. → Task 5 test (`drawList` skips unknown ids).
4. **A recolourable item drawn in a colour whose palette has a different length from the base palette.** Only the matching indices are mapped, and no exception is thrown. → Task 5 test.
5. **The plugin's size after bundling.** `main.js` grows by about 1 MB or less. → Task 1 check and Task 7 build step.

---

## File Structure

```
scripts/sprites/build_bundle.py   NEW  LPC checkout → assets/sprites/{items.json, atlas.json, CREDITS.md}
assets/sprites/items.json         NEW  (generated, committed) catalog index
assets/sprites/atlas.json         NEW  (generated, committed) {"png": "<base64>"}
assets/sprites/CREDITS.md         NEW  (generated, committed)
assets/sprites/README.md          NEW  licences note, how to regenerate
src/core/catalog.ts               NEW  item lookup, slots, shelves, prices, starter/badge, fit
src/core/character.ts             NEW  Look type, look checks, coins left, owned items, unlocked badge items
src/core/recolor.ts               NEW  pure pixel recolour
src/core/draw-list.ts             NEW  look → ordered list of atlas rects + colour mapping
src/core/events.ts, log-format.ts, state.ts, replay.ts, actions.ts, rewards.ts   new events and rules
src/ui/sprite.ts                  NEW  atlas decode, canvas render, 2-frame loop
src/ui/creation.ts, character.ts, credits-modal.ts   NEW pages
src/ui/home.ts, prestige-up.ts, hall.ts, view.ts, parts.ts, styles.css   wiring
tests/core/catalog.test.ts, character.test.ts, recolor.test.ts, draw-list.test.ts, replay-character.test.ts   NEW
```

---

### Task 1: Sprite bundle (build script and generated assets)

**Files:**
- Create `scripts/sprites/build_bundle.py`, `assets/sprites/README.md`.
- Generate `assets/sprites/items.json`, `atlas.json` and `CREDITS.md`.

**Interfaces (produced):** `items.json` has this shape (TypeScript view):

```ts
interface SpriteIndex {
  palettes: Record<string, { base: string[]; colors: Record<string, string[]> }>; // material → base palette + named palettes (ulpc)
  items: SpriteItem[];
}
interface SpriteItem {
  id: string;            // LPC definition path without .json, e.g. "torso/shirts/shortsleeve/torso_clothes_tshirt"
  name: string; category: string; type: string;
  recolor?: { material: string }[];      // one per colour channel (channel 0 is the main colour)
  variants?: string[];                   // pre-coloured items: variant names
  matchBodyColor: boolean;
  layers: { zPos: number; frames: Partial<Record<"male" | "female", Record<string, { x: number; y: number }>>> }[];
  //   frames key: "" for the base image, "@male"/"@female"/"@elderly" for head-dependent images,
  //   variant name for pre-coloured references; each rect is 128×64 (2 frames) at x,y in the atlas
  colorMaps?: Record<string, [string, string][]>; // variant → [reference RGBA hex, variant RGBA hex]
}
```

The script reads `sheet_definitions/`, `spritesheets/` and `palette_definitions/` from a checkout given as its first argument, with the same selection as the trimmed set:
- body (skin, wings, tails);
- human heads, faces, eyes, eyebrows and noses;
- hair, headwear, torso, legs, feet and arms;
- the arming sword and shields.

For each item and body, it crops row 2 (facing down) of `idle.png` (`0,128,128,192`). It resolves `${head}` paths through `replace_in_path`. Recolourable items keep only the base image. Pre-coloured items keep one reference plus colour maps, or their own image where the swap isn't exact. Everything is packed into one atlas PNG.

**Excluded:**
- add-on types;
- any item or body without frames;
- tools;
- weapons other than "Arming Sword".

**Checks the script makes:** total JSON size ≤ 1,100,000 bytes, and every item in `items.json` has a `CREDITS.md` entry.

- [ ] **Step 1:** Write the script.
  - Run it as `python3 -I scripts/sprites/build_bundle.py .superpowers/sprites/lpc assets/sprites`.
  - It treats the checkout as data only.
  - It prints the item count, the size, and "credits: complete".
- [ ] **Step 2:** Run it and confirm it prints a size of 1.1 MB or less and "credits: complete". Then open `CREDITS.md` and check it lists authors, licences and links.
- [ ] **Step 3:** Write `assets/sprites/README.md`. It explains that the art is LPC, keeps its original licences (listed in `CREDITS.md`), and how to regenerate it.
- [ ] **Step 4:** Commit with the message `feat(art): LPC sprite bundle and credits`.

### Task 2: Catalog

**Files:**
- Create `src/core/catalog.ts`.
- Test with `tests/core/catalog.test.ts`.
- `tsconfig.json` gets `resolveJsonModule` if it's missing.

**Interfaces (produced):**
- `type Body = "male" | "female"`
- `item(id: string): SpriteItem | undefined`
- `slotOf(it: SpriteItem): string`, which returns `it.type`.
- `fits(it: SpriteItem, body: Body): boolean`
- `STARTER_IDS: ReadonlySet<string>`
- `BADGE_ITEMS: Record<BadgeId, string>`, mapping each badge to an item id.
- `shelf(it: SpriteItem): { level: 1 | 4 | 8 | 11; price: number } | null`. It returns null for items that aren't sold: starter, badge, add-on, looks-only items (body, head, face, eyes, eyebrows, nose, hair, beard), and excluded items.
- `shopItems(body: Body): (SpriteItem & { level: number; price: number })[]`, sorted by level, then slot, then name.

- [ ] **Step 1:** Write failing tests.
  - Every badge and starter id resolves.
  - T-shirt is a starter item and `shelf` returns null for it.
  - The Crown is a badge item and `shelf` returns null for it.
  - A boots item is on shelf 4, with a price from 80 to 150.
  - Chainmail is on shelf 8.
  - Lizard Wings and the Arming Sword are on shelf 11, with prices from 400 to 500.
  - Every price falls in its shelf's range.
  - No add-on type is sold.
  - `fits` is false for a female-only skirt on the male body.
  - Every `shopItems("male")` entry fits the male body.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement the type→shelf table. For category and type pairs the table doesn't list, follow the spec's shelf contents.
- [ ] **Step 4:** Confirm the tests pass.
- [ ] **Step 5:** Run `npm test`, which should be green, and `npm run build`, which should be clean.
- [ ] **Step 6:** Commit with the message `feat(core): sprite catalog, shelves and prices`.

### Task 3: Events, log format and replay

**Files:**
- Modify `src/core/events.ts`, `log-format.ts`, `state.ts` and `replay.ts`.
- Create `src/core/character.ts`, for the `Look` type only.
- Test with `tests/core/replay-character.test.ts`, plus cases in `log-format.test.ts`.

**Interfaces (produced):**
- **`Look`:**

  ```ts
  { skin: string; head: string; face: string; eyes?: string;
    worn: Record<string, { item: string; color?: string; color2?: string }> }
  ```

  Hair, beard, eyebrows, nose and every clothing slot are entries in `worn`, keyed by slot.
- **New event types** in `QuestEvent` and `EVENT_TYPES`. `eventRun()` returns their `run`.
- **log-format** gains the field type `"object"`. `look` must be a plain object whose `worn` is an object, and `price` must be a number of 0 or more.
- **`RunState`** gains:
  - `character?: { body: Body; look: Look; createdAt: string }`
  - `purchases: Map<string, { price: number; at: string }>`, for live purchases only.
- **Replay rules:**
  - `character_created`: the run exists and isn't closed; it has no character yet; the body is `male` or `female`.
  - `character_changed`: the character exists and the run isn't closed.
  - `item_bought`: the character exists, the run isn't closed, and the item isn't already in `purchases`.
  - `purchase_undone`: the item is in `purchases`, and the undo falls within `withinUndoWindow(at, e.t)`. It deletes the purchase and removes the item from `look.worn`.
  - Replay doesn't check level, coins or shelf.

- [ ] **Step 1:** Write failing tests.
  - log-format: a `look` that is a string, and a `price` of `"40"` or `-1`, are both skipped.
  - Replay:
    - A second `character_created` is rejected.
    - A `character_created` on a closed run is rejected.
    - The body `"teen"` is rejected.
    - Buying the same item twice is rejected the second time.
    - Undo at 30 minutes refunds the item and takes it off the look. Undo at 31 minutes is rejected.
    - Every event for a closed run is rejected, and its look stays as it was.
    - A purchase whose price has no matching shelf (`price: 7`) still replays, because history is trusted.
    - Overlapping runs keep separate characters.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, which should be green, and `npm run build`, which should be clean.
- [ ] **Step 5:** Commit with the message `feat(core): character events and replay`.

### Task 4: Planning rules, coins left, unlocked items

**Files:**
- Modify `src/core/character.ts`, `actions.ts` and `rewards.ts`.
- Test with `tests/core/character.test.ts`.

**Interfaces (produced):**
- `coinsLeft(s: State, run: string): number`. It's earned coins (from 5a) minus the prices of live purchases. `RunRewards.coins` becomes coins left, and `RunRewards.earned` keeps the earned total.
- `unlockedBadgeItems(s: State, run: string): Set<string>`. It holds the items for the run's current `runBadges`, plus every item for `permanentBadges(s)`.
- `wearable(s: State, run: string, body: Body): Set<string>`. It holds the starter items, owned purchases, and the unlocked badge items that fit the body.
- `checkLook(s, run, body, look, previous?: Look): string | null`. It checks:
  - every worn item exists and fits the body;
  - each item is either wearable, or a lapsed badge item carried over unchanged from `previous`;
  - each item sits in its own slot;
  - colours are valid for the item's palette or variants;
  - the head is a human head and the face is an expression.

  It returns a message when something is wrong.
- `defaultLook(body: Body): Look`. It gives the first skin tone, the body's human head, the Neutral face, a short hair style, a white T-shirt, Pants and Shoes.
- **Actions:**
  - `createCharacter {run, body, look}`
  - `changeLook {run, look}`
  - `buyItem {run, item}`. It checks the item is sold, fits, isn't owned, the level is at least the shelf level, and the coins cover the price. It writes the price.
  - `undoPurchase {run, item}`

  All of them refuse a closed or ended run, using the existing `blocked`.

- [ ] **Step 1:** Write failing tests. Make the run's XP with completed objectives from fixtures.
  - Buying is refused below the shelf level, refused with too few coins, and refused when the item is already owned.
  - Buying a starter item or a badge item is refused.
  - Coins left falls after a purchase and is restored after an undo.
  - `changeLook` refuses an item the run doesn't own.
  - Nerd glasses become wearable once a course's lectures are all done.
  - **Lapsed badge item:** the glasses are worn, then a new lecture is added (the badge lapses).
    - A `changeLook` that changes only the shirt while keeping the glasses is accepted.
    - A `changeLook` that adds the glasses when they weren't worn before is refused.
  - A Scarf earned by run A's close is wearable in run B.
  - `checkLook` refuses a female-only item on the male body.
  - `checkLook` refuses an unknown colour name.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, which should be green, and `npm run build`, which should be clean.
- [ ] **Step 5:** Commit with the message `feat(core): shop and look rules, coins left`.

### Task 5: Pure drawing pieces

**Files:**
- Create `src/core/recolor.ts` and `src/core/draw-list.ts`.
- Tests: `tests/core/recolor.test.ts` and `draw-list.test.ts`.

**Interfaces (produced):**
- `recolor(px: Uint8ClampedArray, from: string[], to: string[]): void`. It works in place. Each pixel with alpha above 0 whose RGB is within 1 of `from[i]` becomes `to[i]`. Only indices below `min(from.length, to.length)` are mapped.
- `applyColorMap(px: Uint8ClampedArray, map: [string, string][]): void`. It works in place, with exact RGBA matches.
- `drawList(look: Look, body: Body, visible: (itemId: string) => boolean): DrawOp[]`.
  - `DrawOp` is `{ x, y, zPos, recolor?: { from, to }[], colorMap? }`. It covers the body (skin palette), the head and face (skin, plus eye colour on channel 2), and each worn item. Items set to `matchBodyColor` use the skin colours.
  - Ops are sorted by `zPos`.
  - Unknown items or colours are skipped, as are items where `visible` is false (a lapsed badge).

- [ ] **Step 1:** Write failing tests.
  - `recolor` maps base colours to a target palette, leaves transparent pixels alone, and handles palettes of different lengths without throwing.
  - `applyColorMap` swaps exact colours.
  - `drawList` for `defaultLook("male")`:
    - returns ops ordered by zPos;
    - includes the body and head with skin recolouring;
    - skips an unknown item id;
    - skips an item where `visible` is false.
- [ ] **Step 2:** Run the tests and confirm they fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests and confirm they pass.
- [ ] **Step 5:** Commit with the message `feat(core): recolour and draw list`.

### Task 6: Screens

**Files:**
- Create `src/ui/sprite.ts`, `creation.ts`, `character.ts` and `credits-modal.ts`.
- Modify `home.ts`, `prestige-up.ts`, `hall.ts`, `view.ts`, `parts.ts` (Route) and `styles.css`.

**Interfaces:**
- **Routes:** `{ tab: "creation"; run }` and `{ tab: "character"; run; sub?: "wardrobe" | "shop" | "looks" }`.
- **`renderCharacter(parent, look, body, visible, scale): () => void`**, in `sprite.ts`.
  - It decodes `atlas.json` once into an `ImageBitmap` or `HTMLImageElement`.
  - For each op it draws the rect onto an offscreen 128×64 canvas, applies `recolor`/`applyColorMap` with `getImageData`/`putImageData`, and composites the result.
  - It caches the composited frames per look and body.
  - It shows the result in a canvas scaled with `image-rendering: pixelated`, flips between the two frames every 500 ms with `window.setInterval`, and returns a dispose function.
  - Callers register that dispose on refresh. Before refreshing, the view clears every interval it started.
- **Home's character card:** shows the character, or the placeholder when there is none. Clicking it navigates to `creation` (no character yet) or `character`. It has no hint text. The level and coins lines stay, with coins showing coins left.
- **Creation page:** "← Home", a large preview, and these rows:
  - body (male or female, with the note "fixed after Done");
  - skin (22 swatches);
  - head (‹ ›, filtered by body);
  - face (‹ ›, default Neutral);
  - hair style plus colour;
  - beard (none or ‹ ›);
  - starter top, trousers and shoes, each with ‹ › and a colour.

  "Done" dispatches `createCharacter`, then navigates to `character`.
- **Character page:** "← Home". The left side shows the character, level, coins and XP bar. The right side has sub-tabs:
  - **Wardrobe:** wearable items grouped by slot, plus a "none" option per slot; colour swatches for the worn item; "Save" dispatches `changeLook`.
  - **Shop:** `shopItems(body)` grouped by shelf. Locked shelves are greyed with their level, and owned items say "owned". Buying needs no confirmation. Undo shows "Undo · N min left" while the window is open.
  - **Looks:** skin, head, face, eyes, hair (plus colour), beard, eyebrows and nose. "Save" dispatches `changeLook`.
  - **"Art credits":** opens `CreditsModal`, which lists the `CREDITS.md` content imported as text. The esbuild loader `".md": "text"` is added for it.
- **Prestige Up:** renders the run's character, or the placeholder. The "Customise character" button is removed.
- **Hall:** the `.sq-card-art` area renders the run's character. The run page header gets a small character too.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `npm run build` (exit 0) and `npm test` (green). Confirm `main.js` grows by about 1 MB or less with `ls -l main.js` before and after.
- [ ] **Step 3:** Commit with the message `feat(ui): character creation, wardrobe, shop and display`.

### Task 7: Design doc and version

**Files:**
- Modify `docs/Design Document.md`, `manifest.json`, `package.json` and `versions.json`.

- [ ] **Step 1:** Edit the design doc and bump the version.
  - In the Rewards section, the Character bullet describes what was built and links to the spec.
  - The "Wardrobe and shop" row of the Screens table becomes `Character page (from Home's character card): Wardrobe, Shop by level, Looks, art credits`.
  - Add the four events to the Event table.
  - Build plan 5b gets a spec link.
  - Bump the version to 0.6.0.
- [ ] **Step 2:** Run `npm run build` and `npm test`.
- [ ] **Step 3:** Commit with the message `docs: design doc for phase 5b; version 0.6.0`.

### Task 8: User check

- [ ] Ask the user to reload the plugin and check:
  - Q2 shows the placeholder, and clicking it opens creation.
  - Creating a male character and a female one works; the female one goes in a test run.
  - Buying from shelf 1 works, a locked shelf is greyed, and colours can be changed and saved.
  - Undoing a purchase works.
  - The Lecture sweep glasses appear in the Wardrobe.
  - The Hall card shows the character.
  - The Art credits modal opens.
  - The breathing animation runs.
