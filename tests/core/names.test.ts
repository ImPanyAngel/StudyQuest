import { SPRITES, item } from "../../src/core/catalog";

const name = (id: string) => item(id)!.name;

test("glued words, numbers and shorthand become readable", () => {
  expect(name("hair/short/hair_bangsshort")).toBe("Short Bangs");
  expect(name("torso/shirts/shortsleeve/torso_clothes_tshirt")).toBe("T-Shirt");
  expect(name("torso/shirts/shortsleeve/torso_clothes_tshirt_vneck")).toBe("T-Shirt V-Neck");
  expect(name("torso/shirts/longsleeve/torso_clothes_longsleeve")).toBe("Long Sleeve");
});

test("lone words get the kind of item they are", () => {
  expect(name("torso/cape/cape_solid")).toBe("Cape");
  expect(name("torso/cape/cape_tattered")).toBe("Tattered Cape");
  expect(name("torso/armour/torso_armour_leather")).toBe("Leather Armour");
});

test("every shown name is tidy: title case, no glued digits, no shorthand or build words", () => {
  for (const it of SPRITES.items) {
    const n = it.name;
    expect(n, it.id).not.toMatch(/[a-z][0-9]|w\/|XLong|Xlong|\bBase\b|\bRevised\b|\bAlt\b|\bforeaft\b|Shoulder[lr]\b|sshort|slong/);
    for (const word of n.split(/[\s-]+/)) {
      if (["and", "with", "of"].includes(word) || /^[0-9(]/.test(word)) continue;
      expect(word[0], `${it.id}: "${n}"`).toBe(word[0].toUpperCase());
    }
  }
});

test("names are unique within each slot, so the shop and wardrobe never show two of the same", () => {
  const seen = new Map<string, string>();
  for (const it of SPRITES.items) {
    const key = `${it.type}|${it.name}`;
    expect(seen.get(key), `${it.id} vs ${seen.get(key)}`).toBeUndefined();
    seen.set(key, it.id);
  }
});
