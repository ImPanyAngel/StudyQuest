import { BADGE_ITEMS, STARTER_IDS, fits, item, shelf, shopItems, slotOf } from "../../src/core/catalog";

const RANGES: Record<number, [number, number]> = { 1: [30, 60], 4: [80, 150], 8: [200, 300], 11: [400, 500] };
const byName = (name: string) => shopItems("male").find((i) => i.name === name) ?? shopItems("female").find((i) => i.name === name);

test("every badge and starter id resolves to an item", () => {
  for (const id of [...Object.values(BADGE_ITEMS), ...STARTER_IDS]) expect(item(id), id).toBeDefined();
});

test("starter and badge items are never sold", () => {
  expect(shelf(item("torso/shirts/shortsleeve/torso_clothes_tshirt")!)).toBeNull();
  expect(shelf(item(BADGE_ITEMS["tier-5"])!)).toBeNull();
  for (const id of [...Object.values(BADGE_ITEMS), ...STARTER_IDS]) expect(shelf(item(id)!), id).toBeNull();
});

test("looks (hair, heads, faces, skin) and add-on layers are never sold", () => {
  for (const id of ["hair/afro/hair_afro", "head/heads/human/heads_human_male", "head/faces/face_neutral", "body/body"]) {
    expect(shelf(item(id)!), id).toBeNull();
  }
  const sold = new Set([...shopItems("male"), ...shopItems("female")].map((i) => i.type));
  for (const t of ["visor", "hat_accessory", "hat_buckle", "shoes_toe", "apron", "hairtie_rune", "headcover_rune"]) expect(sold.has(t), t).toBe(false);
});

test("items land on the shelves the user agreed", () => {
  expect(byName("Basic Boots")!.level).toBe(4);
  expect(byName("Chainmail")!.level).toBe(8);
  expect(byName("Lizard Wings")!.level).toBe(11);
  expect(byName("Arming Sword")!.level).toBe(11);
  expect(byName("Tattered Cape")!.level).toBe(8);
  expect(byName("Sandals")!.level).toBe(1);
});

test("every price sits in its shelf's range", () => {
  for (const it of [...shopItems("male"), ...shopItems("female")]) {
    const [lo, hi] = RANGES[it.level];
    expect(it.price, it.id).toBeGreaterThanOrEqual(lo);
    expect(it.price, it.id).toBeLessThanOrEqual(hi);
  }
});

test("body fit: a female-only skirt doesn't fit the male body; the shop only offers what fits", () => {
  expect(fits(item("legs/skirts/legs_skirt_belle")!, "male")).toBe(false);
  expect(fits(item("legs/skirts/legs_skirt_belle")!, "female")).toBe(true);
  for (const it of shopItems("male")) expect(fits(it, "male"), it.id).toBe(true);
});

test("the shop is sorted by level, then slot, then name; slot is the item type", () => {
  const s = shopItems("male");
  const key = (i: (typeof s)[number]) => `${String(i.level).padStart(2, "0")}|${slotOf(i)}|${i.name}`;
  expect(s.map(key)).toEqual([...s.map(key)].sort());
  expect(slotOf(item("feet/boots/feet_boots_basic")!)).toBe("shoes");
});
