# StudyQuest Phase 5b: Character, Shop and Wardrobe (Design)

Nov 18, 2026. This is the spec for the second half of phase 5 in [the design doc](../../Design%20Document.md). It builds on phase 5a (`2026-11-18-phase-5a-xp-design.md`) and on every earlier spec in this folder, which all stay binding unless this document changes them.

## Intent

Each run gets a pixel character made fresh for that run, like a roguelike. The user said: "it's nice making a new character every time." The run's coins buy clothes and gear for it, and levels open new shelves in the shop. Nothing carries over between runs except the items unlocked by the three permanent badges. A closed run's final character is frozen, so the Hall becomes a gallery of every character made.

## Goals

- **Creating a run's character:** body type, skin, head, face, hair and a free starter outfit.
- **A shop with level-gated shelves**, paid for with the run's coins from 5a. Buying an item unlocks all of its colours.
- **A wardrobe:** wear what you own and change colours for free.
- **Looks:** skin, head, face and hair can be changed for free at any time.
- **Badge items:**
  - The in-run badges unlock their item for that run.
  - The permanent badges unlock an item that is free in every run.
- **Display:**
  - The character appears on Home, Prestige Up and the Hall cards.
  - The art ships inside the plugin and is kept as small as needed.
  - Each artist is credited, as the licences require.

## Non-goals

- Animations other than the breathing idle, and any facing direction other than forward.
- Body types other than one male and one female.
- Tools, which have no idle frames.
- Weapons other than the arming sword.
- Non-human heads.
- Selling items back. A purchase can be undone within 30 minutes, and that's all.
- Downloading art at runtime. The art is built into the plugin.

## Anti-goals

- **History that can change.** A closed run's character, purchases and coins are frozen. The Hall snapshot must never change after the close.
- **Art without credit.** No sprite ships unless its authors and licence appear in the credits.
- **A bloated plugin.** The shipped art should be about 1 MB or less.

## Decided by the user

- **Pure roguelike.** Every run makes a new character, and nothing bought carries over.
- **The level-gated shop:**

  | Shelf opens at | Price | Contents |
  | --- | --- | --- |
  | Level 1 | 30–60 | plain tops, trousers, shoes and socks |
  | Level 4 | 80–150 | nicer clothes (formal shirts, vests, boots, dresses), simple hats, glasses, jewellery, gloves |
  | Level 8 | 200–300 | armour, capes, fancy hats, shields |
  | Level 11 | 400–500 | wings, tails, the arming sword |

  A quarter earns about 1,200 coins.
- **Colours come with the item.** Changing colour is free.
- **Free at creation:**
  - body (male or female);
  - skin (22 tones);
  - head;
  - face (15 expressions, default **Neutral**);
  - hair style and colour, with an optional beard or moustache;
  - a starter top, trousers and shoes, in any colour.
- **The body type is fixed** once the character is created. Skin, head, face and hair stay free to change.
- **Badge items are never sold:**

  | Badge | Item | Scope |
  | --- | --- | --- |
  | Lecture sweep | Nerd glasses | that run only |
  | Course complete | Star amulet | that run only |
  | First prestige | Scarf | free in every run |
  | Tier 3 run | Solid cape | free in every run |
  | Tier 5 run | Crown | free in every run |

- **Undoing a purchase:** possible within 30 minutes, for a full refund.
- **Art:** the LPC set (Universal LPC Spritesheet Character Generator), using the forward-facing **idle** pose: a 2-frame breathing loop.
  - Categories: body (skin, 5 wings, 5 tails), human heads, faces, eyes, eyebrows, noses, hair, headwear, tops, trousers, shoes, arm pieces, the arming sword and shields.
  - Licences: CC0, CC-BY, OGA-BY, CC-BY-SA and GPL.
- **The art is built into the plugin**, kept as small as needed.
- **Where the character lives:** clicking Home's character card opens the character page. There is no new tab and no hint text; the card itself is the link.
  - Before the run has a character, the card shows the grey placeholder figure, and clicking it opens creation.
- **Prestige Up** drops its "Customise character" button and keeps only "Set up next run →".

## Approaches

- **Store the character in the log (chosen).** A run's look and purchases are events. Replay freezes them at the close, which keeps the Hall snapshot permanent and matches how everything else is stored.
- Store it in plugin settings (`data.json`). Rejected: closed runs could still be edited, the outfit history would be lost, and it would split the record across two places.
- **Build the art into the plugin (chosen, by the user).** It's about 0.75 MB and works offline.
- An install link that downloads an art pack. Rejected by the user. It's unnecessary at this size, and it would need hosting and an internet connection.

## The art pipeline

- The full LPC library and the trimmed working set stay out of git (`.superpowers/sprites/`).
- A **build-time script** (committed under `scripts/`) reads a local LPC checkout and writes a compact **sprite bundle**, which is committed under `assets/`. For each kept item and each body, it keeps the forward-facing idle row: 2 frames of 64×64.
- **Recolourable items** (those with `recolors` in their definition) keep one base image. The plugin recolours them at runtime from the LPC palette definitions (`palette_definitions/`): 24 cloth colours, 26 hair colours and 22 skin tones, plus metal and eye palettes where an item uses them.
- **Items that come pre-coloured** keep one reference image plus a colour map per variant. Each map lists `reference RGBA → variant RGBA`. An experiment showed 5,112 of 5,268 variants are exact colour swaps. The 156 that aren't (8 items) keep their own image.
- **Head-dependent paths:** some faces and similar items have a `${head}` placeholder in their path, resolved through `replace_in_path`. These store one image per head kind (male, female, elderly).
- **Layer order:** each layer keeps its `zPos`, and drawing goes in `zPos` order.
- **Measured size:** about 0.41 MB of base images plus 0.34 MB of pre-coloured data, roughly 0.75 MB raw. Target: **about 1 MB or less** in `main.js`. Any packing that meets the target is fine, such as one atlas PNG plus a JSON index.
- **Credits:**
  - The script writes `assets/CREDITS.md`, listing every shipped file's authors, licences and links, taken from the definitions' `credits`.
  - The art keeps its own licences. The repo states this next to the bundle.
  - Inside the plugin, an **"Art credits"** link on the character page opens a modal with the same list.
- **Excluded from the shop and from wearing:**
  - add-on layers that only make sense on top of another item, such as trims, overlays, sleeve overlays, sash knots and kimono sleeves;
  - items with no image for the run's body.

  The single item that has no idle file at all (found during trimming) is dropped.

## Items, slots and prices

- **Slots:** an item fills the slot named by its `type_name`, and a character wears at most one item per slot. Examples are `hat`, `clothes`, `legs`, `shoes`, `neck`, `facial_eyes`, `wings`, `tail`, `shield` and `weapon`. Wearing a new item in a slot replaces the old one.
- **Shelf and price** come from a rule keyed on category and type, following the shelf table above. The exact type-to-shelf table is left to the builder. Within a shelf's range, a price may vary by type (for example, socks at 30 and a full top at 60).
- **The free starter set** works like the badge items: never sold, always wearable in the run. It holds the plain tops (T-shirt, Shortsleeve, Longsleeve), trousers (Pants, Shorts, Plain skirt) and shoes (Shoes, Socks).
- **Badge items** can't be bought. "Unlock" means the item appears in the Wardrobe, ready to wear. It is never put on automatically.
  - In-run badge items are wearable while their badge holds.
  - Permanent badge items are wearable in every run once their badge exists.
- **Body fit:** an item is offered only if it has art for the character's body.

## The log

New events:

| Event | Fields | Rule |
| --- | --- | --- |
| `character_created` | `run`, `body` (`male` / `female`), `look` | once per run, on a run that isn't closed |
| `character_changed` | `run`, `look` | the run has a character and isn't closed; the body never changes |
| `item_bought` | `run`, `item`, `price` | see the rules below; `price` is what was paid |
| `purchase_undone` | `run`, `item` | within 30 minutes of the purchase; refunds it and removes the item from the look |

- **A `look`** is a full description of everything worn: skin tone, head, face, eye colour, hair (item and colour), beard (item and colour, optional), eyebrows and nose (optional), and one entry per slot (item and colour or variant). The exact shape is left to the builder.
- **`item_bought` rules:**
  - the run has a character and isn't closed;
  - the item is sold (not a starter or badge item) and fits the body;
  - the run's level is at least the item's shelf level;
  - the item isn't already owned in this run;
  - the run's coins cover the price.
- **Coins left** = coins earned (from 5a) − the stored `price` of purchases that weren't undone.
- **Recorded history is trusted on replay.** The shop rules (shelf level, price, enough coins) are enforced when an action is planned, not again on replay. Replay checks only that each event is well formed: the run exists and isn't closed at that point, the item isn't already owned, the price isn't negative, and a look's slots are well formed. As a result, retuning a price or shelf later, or a new art bundle, never rejects or changes a past purchase or look. This follows the design doc's "History is permanent" principle, and it's why `item_bought` stores what was paid.
  - Retuned XP weights still recompute a closed run's XP and level (5a). The closed run's coins left can then differ from what it was at the close, but nothing can be bought on a closed run, so the only effect is the number shown.
  - If a stored look names an item or colour that a later bundle no longer has, that part simply isn't drawn. The rest of the character still draws.
- **Checking a `look`** (when it's planned): every worn item must be free (starter or looks), owned in this run, or badge-unlocked at that moment. It must also fit the body and be a valid colour or variant. An invalid look is refused whole, with a message.
  - **Exception:** an in-run badge item that has lapsed may stay in the look when it's carried over unchanged from the previous look, so saving a new shirt doesn't throw the glasses away.
- **When an in-run badge lapses** (for example, a new objective reopens a course), the item stays in the stored look but isn't drawn while the badge doesn't hold. It returns if the badge does. This needs no event.
- **Closed runs:** every new event is rejected for a closed run, the same as all other events after a close. The character drawn for a closed run is its look at the close.
- The existing 30-minute undo window helper is reused for `purchase_undone`.

## Screens

- **Home's character card:**
  - It shows the chosen run's character as a looping 2-frame breathing animation. The canvas is scaled up with crisp pixels, and the timing is the builder's call, about 0.5 s per frame.
  - With no character yet, it shows the existing grey placeholder.
  - Clicking the card opens creation or the character page. There's no hint text.
  - The level, XP bar and coins from 5a stay under the card. "Coins" now means coins left.
- **Creation page** (an in-view route with "← Home", like a course page):
  - A large live preview, plus rows for body, skin, head, face, hair (with colour), beard, and the starter top, trousers and shoes (each with colour).
  - The default face is Neutral.
  - "Done" writes `character_created`. The body row says it's fixed after Done.
- **Character page** (an in-view route with "← Home"): the character with its level, coins and XP bar on the left, and three sub-tabs on the right.
  - **Wardrobe:** owned, starter and badge items, grouped by slot. Equip, unequip and colour changes are free, and saving writes `character_changed`.
  - **Shop:**
    - Shelves by level. Locked shelves are shown greyed with their level.
    - Each item shows a thumbnail, its name and its price.
    - Buying asks no confirmation. A purchase made in the last 30 minutes shows an "Undo" button with minutes left.
  - **Looks:** skin, head, face, eyes, hair, beard, eyebrows and nose, all free. Saving writes `character_changed`.
  - **"Art credits"** opens the credits modal.
- **Prestige Up:** shows the run's character in place of the placeholder. The "Customise character" button and its tooltip are removed.
- **Hall cards and the Hall run page:** a card's art area shows the run's character, frozen for closed runs and live for open ones. Runs without a character keep the placeholder.
- **Overlapping runs:** each run has its own character. The run switch picks which one Home shows.

## Where the logic lives

- **Pure code in `src/core/`:**
  - the catalog (items, slots, shelves, prices, badge and starter flags, body fit);
  - checking a look;
  - purchase rules and coins left;
  - replay of the new events.

  All of it is unit-tested.
- **Rendering** (decoding the bundle, recolouring with palettes or colour maps, compositing by `zPos`, animating) lives in `src/ui/`, using a canvas.
- **The build script** lives in `scripts/` and runs only when the art set changes.

## Design doc

Update `docs/Design Document.md`:
- the Character bullet and the Prestige snapshot in Rewards;
- the Wardrobe and shop row in the screens table (it becomes the character page opened from Home);
- the event table (the four new events);
- build plan 5b (mark it as built, with a link to this spec).

## Testing

- **Unit tests:**
  - the catalog rule: each shelf boundary and price range; starter and badge items aren't sold; body fit;
  - `character_created` happens once per run and never on a closed run;
  - body changes are rejected;
  - looks with unowned, wrong-body or invalid-colour items are rejected;
  - purchases:
    - refused below the shelf level;
    - refused when coins are short;
    - refused for an item already owned;
    - refused for a starter or badge item;
  - coins left after buying and after undo;
  - undo at 30 minutes works and at 31 minutes is refused;
  - an undone item is removed from the look;
  - an in-run badge item isn't drawn after its badge lapses and returns when the badge does;
  - a lapsed badge item carried over unchanged survives a save, while adding it new during the lapse is refused;
  - replay keeps a past purchase whose shelf or price has since changed;
  - a permanent badge item is wearable in a later run;
  - closed runs reject every new event, and their look stays frozen;
  - overlapping runs keep separate characters and coins.
- **Build script check:** the bundle's size is within target, and every shipped item appears in `CREDITS.md`.
- **Manual check in Obsidian:**
  - create a male and a female character;
  - buy an item, change its colour, and undo the purchase;
  - check a locked shelf;
  - Lecture sweep glasses appear in the Wardrobe when a course's lectures are all done;
  - the Hall card shows the character;
  - the Art credits modal opens;
  - Q2 starts with the placeholder until a character is made.

## Left to the builder

- The exact type-to-shelf table and prices, within the ranges above.
- The shape of `look`.
- The bundle format and packing.
- The frame timing.
- The layout and styling of the creation and character pages, within the mockups.
- How the build script is invoked.

## Decided on the user's behalf

- Shop items are sorted by slot within each shelf.
- Add-on layers (trims, overlays, knots) are left out of 5b.
- The starter set is listed above.
- The Solid cape is the Tier 3 item.
- An in-run badge item lapses with its badge, but stays in the stored look.
- Purchases ask no confirmation, since a 30-minute undo exists.
- "Coins" on Home now shows coins left.
- The credits are both a file in the repo and a modal in the plugin.
- **The reviewer's questions, answered:**
  - Recorded purchases and looks are trusted on replay, and `item_bought` stores its price ("History is permanent").
  - Badge items are made available, never put on automatically.
  - A lapsed in-run badge item survives a save when it's carried over unchanged.
