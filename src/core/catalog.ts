/** The character art catalog: items from the generated sprite bundle, with slots, shelves and prices. */
import index from "../../assets/sprites/items.json";
import type { BadgeId } from "./rewards";

export type Body = "male" | "female";

export interface SpriteLayer {
  zPos: number;
  /** Per body: frame key ("" base, "@male"/"@female"/"@elderly" head kind, or a variant name) → atlas position. */
  frames: Partial<Record<Body, Record<string, { x: number; y: number }>>>;
}

export interface SpriteItem {
  id: string;
  name: string;
  category: string;
  type: string;
  matchBodyColor: boolean;
  layers: SpriteLayer[];
  /** One entry per colour channel; channel 0 is the main colour. */
  recolor?: { material: string; base?: string }[];
  /** Pre-coloured items: the variant names. */
  variants?: string[];
  /** "<variant><head kind>|<layer index>|<body>" → the reference frame key and its colour swaps. */
  colorMaps?: Record<string, { ref: string; map: [string, string][] }>;
  /** Items whose image depends on the head (faces): the head kinds available. */
  headKinds?: string[];
}

export interface SpriteIndex {
  palettes: Record<string, { base: string[]; colors: Record<string, string[]> }>;
  items: SpriteItem[];
}

export const SPRITES = index as unknown as SpriteIndex;
const BY_ID = new Map(SPRITES.items.map((i) => [i.id, i]));

export function item(id: string): SpriteItem | undefined {
  return BY_ID.get(id);
}

export function slotOf(it: SpriteItem): string {
  return it.type;
}

export function fits(it: SpriteItem, body: Body): boolean {
  return it.layers.some((l) => l.frames[body] !== undefined);
}

/** Free at creation and never sold. */
export const STARTER_IDS: ReadonlySet<string> = new Set([
  "torso/shirts/shortsleeve/torso_clothes_tshirt",
  "torso/shirts/shortsleeve/torso_clothes_shortsleeve",
  "torso/shirts/longsleeve/torso_clothes_longsleeve",
  "legs/pants/legs_pants",
  "legs/shorts/legs_shorts",
  "legs/skirts/legs_skirts_plain",
  "feet/shoes/feet_shoes_basic",
  "feet/socks/feet_socks_ankle",
]);

/** Each badge's item; never sold. */
export const BADGE_ITEMS: Record<BadgeId, string> = {
  "lecture-sweep": "headwear/accessories/glasses/facial_glasses_nerd",
  "course-complete": "headwear/neck/charms/neck_amulet_star",
  "first-prestige": "headwear/neck/neck_scarf",
  "tier-3": "torso/cape/cape_solid",
  "tier-5": "headwear/hats/formal/hat_formal_crown",
};
const BADGE_IDS = new Set(Object.values(BADGE_ITEMS));

/** Pieces that only sit on top of another item: not sold in 5b. */
const ADDON_TYPES = new Set(["visor", "hat_accessory", "hat_buckle", "shoes_toe", "apron", "hairtie_rune", "headcover_rune"]);
/** Chosen under Looks, free: never in the shop. */
const LOOKS_CATEGORIES = new Set(["hair", "head", "body"]);

type Shelf = { level: 1 | 4 | 8 | 11; price: number };
const s = (level: Shelf["level"], price: number): Shelf => ({ level, price });
const has = (it: SpriteItem, ...words: string[]) => words.some((w) => it.name.includes(w) || it.id.includes(w));

/** Shelf and price by category and type (spec: 1 → 30–60, 4 → 80–150, 8 → 200–300, 11 → 400–500). */
function rule(it: SpriteItem): Shelf | null {
  switch (it.category) {
    case "body":
      return it.type === "wings" ? s(11, 450) : it.type === "tail" ? s(11, 400) : null;
    case "weapons":
      return it.type === "weapon" ? s(11, 500) : it.type === "shield" ? s(8, 300) : null;
    case "arms":
      return ["gloves", "wrists", "ring"].includes(it.type) ? s(4, 90) : s(8, 240);
    case "feet":
      if (it.type === "socks") return s(1, 30);
      if (has(it, "Armour", "Hoofs")) return s(8, 220);
      if (has(it, "/boots/")) return s(4, 100);
      return s(1, 40);
    case "legs":
      if (has(it, "Armour")) return s(8, 220);
      if (has(it, "legs_pants", "/shorts/", "/leggings/")) return s(1, 40);
      return s(4, 90);
    case "torso":
      if (it.type === "clothes") return has(it, "Buttoned", "Cardigan", "Polo", "VNeck", "Scoop") ? s(4, 90) : s(1, 50);
      if (["armour", "chainmail"].includes(it.type)) return s(8, 260);
      if (it.type === "cape") return s(8, 280);
      return s(4, 120);
    case "headwear":
      if (it.type === "hat") return has(it, "/helmet", "/magic/", "/formal/") ? s(8, 260) : s(4, 120);
      if (it.type === "accessory") return s(8, 220);
      if (it.type.startsWith("earring")) return s(4, 80);
      if (["charm", "necklace"].includes(it.type)) return s(4, 100);
      if (it.type === "facial_mask") return s(4, 110);
      return s(4, 90);
    default:
      return null;
  }
}

/** Where an item sits in the shop, or null if it's never sold. */
export function shelf(it: SpriteItem): Shelf | null {
  if (STARTER_IDS.has(it.id) || BADGE_IDS.has(it.id) || ADDON_TYPES.has(it.type)) return null;
  // Wings and tails live in the body category but are sold.
  const bodyGear = it.category === "body" && (it.type === "wings" || it.type === "tail");
  if (LOOKS_CATEGORIES.has(it.category) && !bodyGear) return null;
  return rule(it);
}

export type ShopItem = SpriteItem & Shelf;

/** What the shop offers this body, by level, then slot, then name. */
export function shopItems(body: Body): ShopItem[] {
  const out: ShopItem[] = [];
  for (const it of SPRITES.items) {
    const sh = shelf(it);
    if (sh && fits(it, body)) out.push({ ...it, ...sh });
  }
  const key = (i: ShopItem) => `${String(i.level).padStart(2, "0")}|${slotOf(i)}|${i.name}`;
  return out.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
