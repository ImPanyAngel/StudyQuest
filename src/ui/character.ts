import { Notice, type App } from "obsidian";
import { item, shopItems, slotOf, type ShopItem } from "../core/catalog";
import { drawnFilter, wearable, type Look } from "../core/character";
import { localDateOf } from "../core/dates";
import { runEnded } from "../core/derive";
import { runRewards } from "../core/rewards";
import type { Action } from "../core/actions";
import type { QuestStore } from "../store/quest-store";
import { confirm } from "./confirm-modal";
import { CreditsModal } from "./credits-modal";
import type { CharacterUi } from "./creation";
import { colourControls, cycler, draftFor, looksRows, row, sameLook, slotName, type Draft } from "./look-editor";
import { renderLevel, type Navigate, type Route } from "./parts";
import { renderCharacter, renderStill } from "./sprite";

const SHELVES: { level: number; label: string }[] = [
  { level: 1, label: "basics" },
  { level: 4, label: "nicer clothes, hats, glasses, jewellery" },
  { level: 8, label: "armour, capes, fancy hats, shields" },
  { level: 11, label: "wings, tails, sword" },
];
const LOOKS_SLOTS = new Set(["hair", "beard", "mustache", "eyebrows", "nose"]);

/** The run's character page: Wardrobe, Shop and Looks, opened from Home's character card. */
export function renderCharacterPage(
  el: HTMLElement,
  store: QuestStore,
  route: Extract<Route, { tab: "character" }>,
  nav: Navigate,
  ui: CharacterUi,
  rerender: () => void,
  app: App,
): void {
  el.createDiv({ cls: "sq-back", text: "← Home" }).onClickEvent(() => nav({ tab: "home" }));
  const s = store.state;
  const run = s.runs.get(route.run);
  if (!run) {
    el.createDiv({ cls: "sq-muted", text: "This run no longer exists." });
    return;
  }
  const c = run.character;
  if (!c) {
    nav({ tab: "creation", run: run.id });
    return;
  }
  // Closed or past its end date: the character is final, so everything is read-only.
  const frozen = !!run.closed || runEnded(run, localDateOf(store.clock()));
  // Edits stay a draft until Save; a fresh copy whenever the saved look changes underneath
  // (an undone purchase, a log reloaded from another device).
  const draft = (ui.draft = draftFor(ui.draft, run.id, c.body, c.look));
  const dirty = !sameLook(draft.look, c.look);
  const rewards = runRewards(s, run.id);
  const act = async (a: Action) => {
    const r = await store.dispatch(a);
    if (!r.ok) new Notice(r.error);
    return r.ok;
  };

  const page = el.createDiv({ cls: "sq-char-page" });
  const stage = page.createDiv({ cls: "sq-char-stage" });
  renderCharacter(stage, frozen ? c : draft, drawnFilter(s, run.id), 3);
  renderLevel(stage, rewards);
  stage.createEl("a", { cls: "sq-credits-link", text: "Art credits" }).onClickEvent(() => new CreditsModal(app).open());

  const main = page.createDiv({ cls: "sq-char-form" });
  const subs = main.createDiv({ cls: "sq-subtabs" });
  const sub = ui.sub ?? "wardrobe";
  for (const [id, label] of [["wardrobe", "Wardrobe"], ["shop", "Shop"], ["looks", "Customisation"]] as const) {
    subs.createSpan({ cls: id === sub ? "sq-subtab is-on" : "sq-subtab", text: label }).onClickEvent(() => ((ui.sub = id), rerender()));
  }
  if (frozen) main.createDiv({ cls: "sq-hint", text: `This run has ${run.closed ? "closed" : "ended"}. Its character is final.` });
  // Read-only controls on a finished run: shown, but not clickable.
  const controls = frozen ? main.createDiv({ cls: "sq-readonly" }) : main;

  const saveBar = () => {
    if (frozen) return;
    const bar = main.createDiv({ cls: "sq-save-bar" });
    const save = bar.createEl("button", { cls: "mod-cta", text: "Save" });
    save.disabled = !dirty;
    save.onClickEvent(async () => {
      if (await act({ type: "changeLook", run: run.id, look: draft.look })) ui.draft = undefined;
    });
    const reset = bar.createEl("button", { text: "Reset" });
    reset.disabled = !dirty;
    reset.onClickEvent(() => ((ui.draft = undefined), rerender()));
  };

  const shown = frozen ? { run: run.id, body: c.body, look: structuredClone(c.look) } : draft;
  if (sub === "looks") {
    looksRows(controls, shown, rerender);
    saveBar();
  } else if (sub === "wardrobe") {
    renderWardrobe(controls, shown, wearable(s, run.id, c.body), c.look, rerender);
    saveBar();
  } else {
    renderShop(controls, store, run.id, c.body, rewards.level.level, rewards.coins, frozen, act, app);
  }
}

function renderWardrobe(el: HTMLElement, draft: Draft, owned: Set<string>, saved: Look, rerender: () => void): void {
  // Slots with something wearable, plus any slot already worn (e.g. a lapsed badge item).
  const bySlot = new Map<string, string[]>();
  for (const id of owned) {
    const it = item(id);
    if (it && !LOOKS_SLOTS.has(slotOf(it))) bySlot.set(slotOf(it), [...(bySlot.get(slotOf(it)) ?? []), id]);
  }
  for (const [slot, w] of Object.entries(saved.worn)) {
    if (LOOKS_SLOTS.has(slot)) continue;
    const ids = bySlot.get(slot) ?? [];
    if (!ids.includes(w.item)) bySlot.set(slot, [...ids, w.item]);
  }
  if (bySlot.size === 0) el.createDiv({ cls: "sq-muted", text: "Nothing to wear yet." });
  for (const slot of [...bySlot.keys()].sort((a, b) => slotName(a).localeCompare(slotName(b)))) {
    const r = row(el, slotName(slot));
    const options = [{ id: null, name: "None" }, ...bySlot.get(slot)!.map((id) => ({ id, name: item(id)?.name ?? id }))];
    const worn = draft.look.worn[slot];
    cycler(r, options, worn?.item ?? null, (id) => {
      if (id === null) delete draft.look.worn[slot];
      else {
        const it = item(id)!;
        const keep = saved.worn[slot]?.item === id ? saved.worn[slot] : undefined;
        draft.look.worn[slot] = keep ?? { item: id, ...(it.variants && !it.recolor ? { color: it.variants[0] } : {}) };
      }
      rerender();
    });
    if (worn) colourControls(r, worn, (w) => ((draft.look.worn[slot] = w), rerender()));
  }
}

function renderShop(
  el: HTMLElement,
  store: QuestStore,
  run: string,
  body: Draft["body"],
  level: number,
  coins: number,
  frozen: boolean,
  act: (a: Action) => Promise<boolean>,
  app: App,
): void {
  const owned = store.state.runs.get(run)!.purchases;
  const all = shopItems(body);
  for (const shelf of SHELVES) {
    const locked = level < shelf.level;
    const box = el.createDiv({ cls: locked ? "sq-shelf is-locked" : "sq-shelf" });
    box.createEl("h4", { cls: "sq-section", text: `Level ${shelf.level} · ${shelf.label}${locked ? " 🔒" : ""}` });
    const grid = box.createDiv({ cls: "sq-shop-grid" });
    for (const it of all.filter((i) => i.level === shelf.level)) renderShopItem(grid, it, owned.has(it.id), locked || frozen, coins, run, body, act, app);
  }
}

function renderShopItem(
  grid: HTMLElement,
  it: ShopItem,
  owned: boolean,
  locked: boolean,
  coins: number,
  run: string,
  body: Draft["body"],
  act: (a: Action) => Promise<boolean>,
  app: App,
): void {
  const card = grid.createDiv({ cls: "sq-shop-item" });
  // The item on its own (body, head and face filtered out), default colour, as a still picture.
  const look: Look = { skin: "light", head: "", face: "", worn: { [slotOf(it)]: { item: it.id, ...(it.variants && !it.recolor ? { color: it.variants[0] } : {}) } } };
  renderStill(card.createDiv({ cls: "sq-shop-thumb" }), { body, look }, (id) => id === it.id, 1);
  card.createDiv({ cls: "sq-shop-name", text: it.name });
  if (owned) {
    card.createDiv({ cls: "sq-owned", text: "owned" });
    return;
  }
  const buy = card.createEl("button", { cls: "sq-price", text: `${it.price}` });
  buy.disabled = locked || coins < it.price;
  buy.onClickEvent(async () => {
    // Purchases are final, so ask first.
    if (await confirm(app, "Buy item", `Buy ${it.name} for ${it.price} coins? Purchases can't be undone.`, "Buy")) {
      await act({ type: "buyItem", run, item: it.id });
    }
  });
}
