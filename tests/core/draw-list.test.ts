import { BADGE_ITEMS } from "../../src/core/catalog";
import { defaultLook } from "../../src/core/character";
import { drawList } from "../../src/core/draw-list";

const all = () => true;

test("the default look draws in zPos order, with skin recolouring on body, head and face", () => {
  const ops = drawList(defaultLook("male"), "male", all);
  expect(ops.map((o) => o.zPos)).toEqual([...ops.map((o) => o.zPos)].sort((a, b) => a - b));
  expect(ops.length).toBeGreaterThanOrEqual(7); // body, head, face, hair, shirt, trousers, shoes
  const skinned = ops.filter((o) => o.recolor?.some((r) => r.to[0] !== r.from[0]));
  expect(skinned.length).toBeGreaterThan(0);
});

test("the face uses the image drawn for the chosen head", () => {
  const male = drawList(defaultLook("male"), "male", all);
  const elderly = drawList({ ...defaultLook("male"), head: "head/heads/human/heads_human_male_elderly" }, "male", all);
  expect(male).not.toEqual(elderly);
});

test("unknown items and unknown colours are skipped, not thrown", () => {
  const look = defaultLook("male");
  const base = drawList(look, "male", all).length;
  const odd = { ...look, worn: { ...look.worn, hat: { item: "headwear/no_such_hat" }, legs: { item: "legs/pants/legs_pants", color: "glitter" } } };
  expect(() => drawList(odd, "male", all)).not.toThrow();
  const ops = drawList(odd, "male", all);
  expect(ops.length).toBe(base); // the hat is skipped; the trousers still draw, uncoloured
});

test("items that aren't visible (a lapsed badge) are skipped; pre-coloured items use their colour map", () => {
  const look = { ...defaultLook("male"), worn: { ...defaultLook("male").worn, facial_eyes: { item: BADGE_ITEMS["lecture-sweep"], color: "blue" } } };
  const shown = drawList(look, "male", all);
  const hidden = drawList(look, "male", (id) => id !== BADGE_ITEMS["lecture-sweep"]);
  expect(shown.length).toBe(hidden.length + 1);
  expect(shown.some((o) => o.colorMap && o.colorMap.length > 0)).toBe(true);
});
