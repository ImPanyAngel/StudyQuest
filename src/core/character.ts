/** A run's character: what it looks like and wears, and the rules for changing it. */
import { BADGE_ITEMS, SPRITES, STARTER_IDS, fits, item, slotOf, type Body, type SpriteItem } from "./catalog";
import { permanentBadges, runBadges } from "./rewards";
import type { State } from "./state";

/** One worn item: its colour (palette name or variant), and a second colour for items with two channels. */
export interface Worn {
  item: string;
  color?: string;
  color2?: string;
}

/** Everything drawn: skin tone, head, face, eye colour, and one item per slot (hair, beard, clothes, hat…). */
export interface Look {
  skin: string;
  head: string;
  face: string;
  eyes?: string;
  worn: Record<string, Worn>;
}

const BADGE_IDS = new Set(Object.values(BADGE_ITEMS));
/** Free under Looks: hair, beards and moustaches, eyebrows, noses. */
const isLooksItem = (it: SpriteItem) => it.category === "hair" || (it.category === "head" && (it.type === "eyebrows" || it.type === "nose"));

/** Badge items this run may wear now: its live in-run badges plus every permanent badge. */
export function unlockedBadgeItems(s: State, run: string): Set<string> {
  const out = new Set<string>();
  for (const b of runBadges(s, run)) out.add(BADGE_ITEMS[b.id]);
  for (const b of permanentBadges(s)) out.add(BADGE_ITEMS[b.id]);
  return out;
}

/** Items this run's character may wear: starter items, purchases and unlocked badge items that fit the body. */
export function wearable(s: State, run: string, body: Body): Set<string> {
  const ids = new Set<string>([...STARTER_IDS, ...(s.runs.get(run)?.purchases.keys() ?? []), ...unlockedBadgeItems(s, run)]);
  return new Set([...ids].filter((id) => {
    const it = item(id);
    return it !== undefined && fits(it, body);
  }));
}

const palette = (material: string) => SPRITES.palettes[material]?.colors ?? {};

/** Is `color` (and `color2`) a valid colour for this item: a palette name, a variant, or nothing for fixed items? */
function colourError(it: SpriteItem, w: Worn): string | null {
  if (it.recolor) {
    const channels: [string | undefined, { material: string } | undefined][] = [
      [w.color, it.recolor[0]],
      [w.color2, it.recolor[1]],
    ];
    for (const [c, ch] of channels) if (c !== undefined && (!ch || !(c in palette(ch.material)))) return `"${c}" isn't a colour for ${it.name}.`;
    return null;
  }
  if (w.color2 !== undefined) return `${it.name} has only one colour.`;
  if (it.variants) return w.color === undefined || it.variants.includes(w.color) ? null : `"${w.color}" isn't a colour for ${it.name}.`;
  return w.color === undefined ? null : `${it.name} comes in one colour.`;
}

const same = (a: Worn | undefined, b: Worn) => a !== undefined && a.item === b.item && a.color === b.color && a.color2 === b.color2;

/**
 * Why a look can't be worn by this run's character, or null if it can. A lapsed in-run badge item
 * may stay when it's carried over unchanged from `previous`.
 */
export function checkLook(s: State, run: string, body: Body, look: Look, previous?: Look): string | null {
  if (!(look.skin in palette("body"))) return `"${look.skin}" isn't a skin tone.`;
  if (look.eyes !== undefined && !(look.eyes in palette("eye"))) return `"${look.eyes}" isn't an eye colour.`;
  const head = item(look.head);
  if (!head || head.type !== "head" || !fits(head, body)) return "Pick a head for this body.";
  const face = item(look.face);
  if (!face || face.type !== "expression" || !fits(face, body)) return "Pick a face.";
  const allowed = wearable(s, run, body);
  for (const [slot, w] of Object.entries(look.worn)) {
    const it = item(w.item);
    if (!it) return "Unknown item.";
    if (slotOf(it) !== slot) return `${it.name} doesn't go in the ${slot} slot.`;
    if (!fits(it, body)) return `${it.name} isn't made for this body.`;
    const lapsedCarryOver = BADGE_IDS.has(it.id) && same(previous?.worn[slot], w);
    if (!isLooksItem(it) && !allowed.has(it.id) && !lapsedCarryOver) return `${it.name} isn't yours to wear in this run.`;
    const bad = colourError(it, w);
    if (bad) return bad;
  }
  return null;
}

/** The look a new character starts from: plain clothes, Neutral face. */
export function defaultLook(body: Body): Look {
  return {
    skin: "light",
    head: body === "male" ? "head/heads/human/heads_human_male" : "head/heads/human/heads_human_female",
    face: "head/faces/face_neutral",
    eyes: "blue",
    worn: {
      hair: { item: body === "male" ? "hair/short/hair_bangsshort" : "hair/bob/hair_relm_short", color: "dark_brown" },
      clothes: { item: "torso/shirts/shortsleeve/torso_clothes_tshirt", color: "white" },
      legs: { item: "legs/pants/legs_pants", color: "navy" },
      shoes: { item: "feet/shoes/feet_shoes_basic", color: "brown" },
    },
  };
}
