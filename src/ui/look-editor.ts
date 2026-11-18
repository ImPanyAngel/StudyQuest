import { SPRITES, STARTER_IDS, fits, item, slotOf, type Body, type SpriteItem } from "../core/catalog";
import type { Look, Worn } from "../core/character";

/** A look being edited, not yet saved. */
export interface Draft {
  run: string;
  body: Body;
  look: Look;
  /** The saved look this draft started from (as JSON); a different one means the draft is stale. */
  base?: string;
}

/** Same look, whatever order its slots were added in. */
export function sameLook(a: Look, b: Look): boolean {
  const canon = (l: Look) => JSON.stringify({ ...l, worn: Object.fromEntries(Object.entries(l.worn).sort(([x], [y]) => x.localeCompare(y))) });
  return canon(a) === canon(b);
}

/** The draft to edit: the current one while it's still based on this saved look, run and body, else a fresh copy. */
export function draftFor(current: Draft | undefined, run: string, body: Body, saved: Look): Draft {
  const base = JSON.stringify(saved);
  if (current && current.run === run && current.body === body && current.base === base) return current;
  return { run, body, look: structuredClone(saved), base };
}

type Option = { id: string | null; name: string };

const SLOT_NAMES: Record<string, string> = {
  hair: "Hair", beard: "Beard", mustache: "Moustache", eyebrows: "Eyebrows", nose: "Nose",
  clothes: "Top", legs: "Trousers", shoes: "Shoes", socks: "Socks",
};
export const slotName = (slot: string): string => SLOT_NAMES[slot] ?? slot.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Items of one slot that fit the body, by name. */
export function itemsOfSlot(slot: string, body: Body, filter: (it: SpriteItem) => boolean = () => true): SpriteItem[] {
  return SPRITES.items.filter((it) => slotOf(it) === slot && fits(it, body) && filter(it)).sort((a, b) => a.name.localeCompare(b.name));
}

/** A labelled row. */
export function row(parent: HTMLElement, label: string): HTMLElement {
  const r = parent.createDiv({ cls: "sq-look-row" });
  r.createSpan({ cls: "sq-look-label", text: label });
  return r;
}

/** ‹ name › stepping through options. */
export function cycler(parent: HTMLElement, options: Option[], current: string | null, onPick: (id: string | null) => void): void {
  const i = Math.max(0, options.findIndex((o) => o.id === current));
  const step = (d: number) => onPick(options[(i + d + options.length) % options.length].id);
  const box = parent.createSpan({ cls: "sq-cycler" });
  box.createEl("button", { cls: "sq-step", text: "‹" }).onClickEvent(() => step(-1));
  box.createSpan({ cls: "sq-cycler-name", text: options[i]?.name ?? "—" });
  box.createEl("button", { cls: "sq-step", text: "›" }).onClickEvent(() => step(1));
}

/** One swatch per palette colour, showing a mid tone. */
export function swatches(parent: HTMLElement, material: string, current: string | undefined, onPick: (name: string) => void): void {
  const colors = SPRITES.palettes[material]?.colors ?? {};
  const box = parent.createSpan({ cls: "sq-swatches" });
  for (const [name, tones] of Object.entries(colors)) {
    const sw = box.createSpan({ cls: name === current ? "sq-swatch is-on" : "sq-swatch" });
    sw.style.background = tones[Math.floor(tones.length / 2)];
    sw.setAttr("aria-label", name.replace(/_/g, " "));
    sw.onClickEvent(() => onPick(name));
  }
}

/** Colour controls for a worn item: palette swatches (one or two channels) or its pre-coloured variants. */
export function colourControls(parent: HTMLElement, w: Worn, onChange: (w: Worn) => void): void {
  const it = item(w.item);
  if (!it) return;
  if (it.recolor) {
    const [c1, c2] = it.recolor;
    if (c1 && c1.material !== "body") swatches(parent, c1.material, w.color, (color) => onChange({ ...w, color }));
    if (c2 && c2.material !== "body" && c2.material !== "eye") swatches(parent, c2.material, w.color2, (color2) => onChange({ ...w, color2 }));
  } else if (it.variants) {
    const box = parent.createSpan({ cls: "sq-variants" });
    for (const v of it.variants) {
      const chip = box.createSpan({ cls: v === (w.color ?? it.variants[0]) ? "sq-chip is-on" : "sq-chip", text: v.replace(/_/g, " ") });
      chip.onClickEvent(() => onChange({ ...w, color: v }));
    }
  }
}

/** A slot's row: step through its items (or none), then colours for the one worn. */
export function slotRow(parent: HTMLElement, draft: Draft, slot: string, items: SpriteItem[], allowNone: boolean, rerender: () => void, label = slotName(slot)): void {
  const r = row(parent, label);
  const options: Option[] = [...(allowNone ? [{ id: null, name: "None" }] : []), ...items.map((it) => ({ id: it.id, name: it.name }))];
  const worn = draft.look.worn[slot];
  cycler(r, options, worn?.item ?? null, (id) => {
    if (id === null) delete draft.look.worn[slot];
    else {
      const it = item(id)!;
      draft.look.worn[slot] = { item: id, ...(it.recolor ? { color: worn?.color ?? defaultColour(it) } : it.variants ? { color: it.variants[0] } : {}) };
    }
    rerender();
  });
  if (worn) colourControls(r, worn, (w) => ((draft.look.worn[slot] = w), rerender()));
}

function defaultColour(it: SpriteItem): string | undefined {
  const m = it.recolor?.[0]?.material;
  if (!m || m === "body") return undefined;
  return Object.keys(SPRITES.palettes[m]?.colors ?? {})[0];
}

/** Free looks: skin, head, face, eyes, hair, beard, moustache, eyebrows, nose. */
export function looksRows(parent: HTMLElement, draft: Draft, rerender: () => void): void {
  const { body, look } = draft;
  swatches(row(parent, "Skin"), "body", look.skin, (skin) => ((look.skin = skin), rerender()));
  const heads = itemsOfSlot("head", body).map((it) => ({ id: it.id, name: it.name.replace(/^Human /, "") }));
  cycler(row(parent, "Head"), heads, look.head, (id) => ((look.head = id!), rerender()));
  const faces = itemsOfSlot("expression", body).map((it) => ({ id: it.id, name: it.name }));
  cycler(row(parent, "Face"), faces, look.face, (id) => ((look.face = id!), rerender()));
  swatches(row(parent, "Eyes"), "eye", look.eyes, (eyes) => ((look.eyes = eyes), rerender()));
  slotRow(parent, draft, "hair", itemsOfSlot("hair", body), true, rerender);
  for (const slot of ["beard", "mustache", "eyebrows", "nose"]) slotRow(parent, draft, slot, itemsOfSlot(slot, body), true, rerender);
}

/** The free starter outfit: top, trousers, and shoes or socks. */
export function starterRows(parent: HTMLElement, draft: Draft, rerender: () => void): void {
  const starter = (it: SpriteItem) => STARTER_IDS.has(it.id);
  slotRow(parent, draft, "clothes", itemsOfSlot("clothes", draft.body, starter), false, rerender);
  slotRow(parent, draft, "legs", itemsOfSlot("legs", draft.body, starter), false, rerender);
  // Shoes and socks are different slots; the starter row offers one or the other.
  const r = row(parent, "Shoes");
  const feet = [...itemsOfSlot("shoes", draft.body, starter), ...itemsOfSlot("socks", draft.body, starter)];
  const worn = draft.look.worn.shoes ?? draft.look.worn.socks;
  cycler(r, feet.map((it) => ({ id: it.id, name: it.name })), worn?.item ?? null, (id) => {
    const it = item(id!)!;
    delete draft.look.worn.shoes;
    delete draft.look.worn.socks;
    draft.look.worn[slotOf(it)] = { item: it.id, color: worn?.color ?? defaultColour(it) };
    rerender();
  });
  if (worn) colourControls(r, worn, (w) => ((draft.look.worn[slotOf(item(w.item)!)] = w), rerender()));
}
