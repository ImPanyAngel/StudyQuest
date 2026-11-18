import { defaultLook } from "../../src/core/character";
import { draftFor } from "../../src/ui/look-editor";

const saved = defaultLook("male");

test("a draft is kept while it's based on the saved look, run and body", () => {
  const d = draftFor(undefined, "R", "male", saved);
  d.look.worn.clothes = { item: "torso/shirts/longsleeve/torso_clothes_longsleeve", color: "red" };
  expect(draftFor(d, "R", "male", saved)).toBe(d);
});

test("a draft is rebuilt when the saved look changed underneath (e.g. an undone purchase), the run or the body", () => {
  const d = draftFor(undefined, "R", "male", saved);
  const changed = { ...saved, worn: { ...saved.worn, hat: { item: "headwear/hats/caps/hat_cap_leather" } } };
  expect(draftFor(d, "R", "male", changed).look).toEqual(changed);
  expect(draftFor(d, "Other", "male", saved)).not.toBe(d);
  expect(draftFor(d, "R", "female", defaultLook("female")).body).toBe("female");
});

test("the draft is a copy: editing it never touches the saved look", () => {
  const d = draftFor(undefined, "R", "male", saved);
  d.look.worn.legs = { item: "legs/shorts/legs_shorts", color: "red" };
  expect(saved.worn.legs.item).toBe("legs/pants/legs_pants");
});
