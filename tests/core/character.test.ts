import { createIdFactory, type QuestEvent } from "../../src/core/events";
import { planAction, type Action } from "../../src/core/actions";
import { BADGE_ITEMS } from "../../src/core/catalog";
import { checkLook, defaultLook, unlockedBadgeItems, wearable } from "../../src/core/character";
import { replay } from "../../src/core/replay";
import { runRewards } from "../../src/core/rewards";
import { LOOK, Q2, T0, at, ev } from "./fixtures";

const R = Q2.run;
const ids = createIdFactory();
const now = (m: number) => new Date(T0 + m * 60_000);
const plan = (h: QuestEvent[], a: Action, m = 60) => planAction(replay(h), a, now(m), ids);
const apply = (h: QuestEvent[], a: Action, m = 60): QuestEvent[] => {
  const r = plan(h, a, m);
  if (!r.ok) throw new Error(r.error);
  return [...h, ...r.value];
};

/** A run with n completed lectures in course C1 (10 XP and coins each), and a male character. */
function run(n: number, withCharacter = true): QuestEvent[] {
  const h: QuestEvent[] = [ev.created(), ev.course(R, "C1")];
  for (let i = 1; i <= n; i++) {
    const l = ev.objective(R, "C1", "lecture", i);
    h.push(l, ev.completed(l.obj, "silver", at(3), `L${i}.md`));
  }
  if (withCharacter) h.push(ev.character(R, "male", LOOK, at(4)));
  return h;
}

const SOCKS = "feet/socks/feet_socks_high"; // level 1, 30
const BOOTS = "feet/boots/feet_boots_basic"; // level 4, 100
const GLASSES = BADGE_ITEMS["lecture-sweep"];
const SCARF = BADGE_ITEMS["first-prestige"];

describe("buying", () => {
  test("refused below the shelf's level, with too few coins, twice, or for starter and badge items", () => {
    expect(plan(run(10), { type: "buyItem", run: R, item: BOOTS })).toMatchObject({ ok: false });
    expect(plan(run(2), { type: "buyItem", run: R, item: SOCKS })).toMatchObject({ ok: false });
    const bought = apply(run(5), { type: "buyItem", run: R, item: SOCKS });
    expect(plan(bought, { type: "buyItem", run: R, item: SOCKS })).toMatchObject({ ok: false });
    expect(plan(run(30), { type: "buyItem", run: R, item: "torso/shirts/shortsleeve/torso_clothes_tshirt" })).toMatchObject({ ok: false });
    expect(plan(run(30), { type: "buyItem", run: R, item: GLASSES })).toMatchObject({ ok: false });
    expect(plan(run(5, false), { type: "buyItem", run: R, item: SOCKS })).toMatchObject({ ok: false });
  });

  test("buying writes the price; coins drop, and come back on undo", () => {
    const h = apply(run(5), { type: "buyItem", run: R, item: SOCKS });
    expect(h.at(-1)).toMatchObject({ type: "item_bought", item: SOCKS, price: 30 });
    expect(runRewards(replay(h), R)).toMatchObject({ earned: 50, coins: 20 });
    const undone = apply(h, { type: "undoPurchase", run: R, item: SOCKS }, 70);
    expect(runRewards(replay(undone), R).coins).toBe(50);
  });
});

describe("looks", () => {
  test("changing into something not owned is refused; owned is fine", () => {
    const socks = { ...LOOK, worn: { ...LOOK.worn, socks: { item: SOCKS, color: "red" } } };
    expect(plan(run(5), { type: "changeLook", run: R, look: socks })).toMatchObject({ ok: false });
    const h = apply(run(5), { type: "buyItem", run: R, item: SOCKS });
    expect(plan(h, { type: "changeLook", run: R, look: socks })).toMatchObject({ ok: true });
  });

  test("checkLook refuses the wrong body, an unknown colour, and an item in the wrong slot", () => {
    const s = replay(run(0));
    const skirt = { ...LOOK, worn: { ...LOOK.worn, legs: { item: "legs/skirts/legs_skirt_belle", color: "red" } } };
    expect(checkLook(s, R, "male", skirt)).toEqual(expect.any(String));
    const plain = { ...LOOK, head: "head/heads/human/heads_human_female", worn: { ...LOOK.worn, legs: { item: "legs/skirts/legs_skirts_plain", color: "red" } } };
    expect(checkLook(s, R, "female", plain)).toBeNull();
    expect(checkLook(s, R, "male", { ...LOOK, worn: { ...LOOK.worn, legs: { item: "legs/pants/legs_pants", color: "glitter" } } })).toEqual(expect.any(String));
    expect(checkLook(s, R, "male", { ...LOOK, worn: { hat: { item: "legs/pants/legs_pants", color: "red" } } })).toEqual(expect.any(String));
    expect(checkLook(s, R, "male", { ...LOOK, skin: "plaid" })).toEqual(expect.any(String));
    expect(checkLook(s, R, "male", { ...LOOK, face: "head/heads/human/heads_human_male" })).toEqual(expect.any(String));
  });

  test("the default looks are valid for both bodies", () => {
    const s = replay([ev.created()]);
    expect(checkLook(s, R, "male", defaultLook("male"))).toBeNull();
    expect(checkLook(s, R, "female", defaultLook("female"))).toBeNull();
    expect(defaultLook("male").face).toBe("head/faces/face_neutral");
  });
});

describe("badge items", () => {
  const glasses = (color = "black") => ({ ...LOOK, worn: { ...LOOK.worn, facial_eyes: { item: GLASSES, color } } });

  test("Lecture sweep makes the nerd glasses wearable in that run", () => {
    expect(wearable(replay(run(0)), R, "male").has(GLASSES)).toBe(false);
    expect(wearable(replay(run(1)), R, "male").has(GLASSES)).toBe(true);
  });

  test("a lapsed badge item carried over unchanged survives a save; adding it fresh during the lapse is refused", () => {
    const worn = apply(run(1), { type: "changeLook", run: R, look: glasses() });
    const lapsed = [...worn, ev.objective(R, "C1", "lecture", 2, at(61))];
    expect(unlockedBadgeItems(replay(lapsed), R).has(GLASSES)).toBe(false);
    const newShirt = { ...glasses(), worn: { ...glasses().worn, clothes: { item: "torso/shirts/longsleeve/torso_clothes_longsleeve", color: "blue" } } };
    expect(plan(lapsed, { type: "changeLook", run: R, look: newShirt }, 62)).toMatchObject({ ok: true });
    expect(plan(lapsed, { type: "changeLook", run: R, look: glasses("blue") }, 62)).toMatchObject({ ok: false });
    const bare = [...run(1), ev.objective(R, "C1", "lecture", 2, at(61))];
    expect(plan(bare, { type: "changeLook", run: R, look: glasses() }, 62)).toMatchObject({ ok: false });
  });

  test("a permanent badge item earned by one run is wearable in a later one", () => {
    const old = [ev.created("Old", "2026-10-01", "2026-10-15", at(-100)), ev.closed("Old", 0, 0, 0, at(1))];
    const s = replay([...old, ...run(0)]);
    expect(wearable(s, R, "male").has(SCARF)).toBe(true);
    expect(wearable(replay(run(0)), R, "male").has(SCARF)).toBe(false);
  });
});

test("creating a character: once, with a valid starter look; refused on an ended run", () => {
  const h = run(0, false);
  expect(plan(h, { type: "createCharacter", run: R, body: "female", look: defaultLook("female") })).toMatchObject({ ok: true });
  expect(plan(run(0), { type: "createCharacter", run: R, body: "male", look: defaultLook("male") })).toMatchObject({ ok: false });
  expect(plan(h, { type: "createCharacter", run: R, body: "male", look: { ...LOOK, worn: { hat: { item: BADGE_ITEMS["tier-5"] } } } })).toMatchObject({ ok: false });
  const ended = planAction(replay(h), { type: "createCharacter", run: R, body: "male", look: defaultLook("male") }, new Date("2027-02-05T12:00:00Z"), ids);
  expect(ended).toMatchObject({ ok: false });
});
