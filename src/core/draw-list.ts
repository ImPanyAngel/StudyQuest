/** Turns a look into the ordered list of atlas pieces to draw, with how to colour each. */
import { SPRITES, item, type Body, type SpriteItem } from "./catalog";
import type { Look, Worn } from "./character";

export interface DrawOp {
  /** Top-left of the 128×64 frame pair in the atlas. */
  x: number;
  y: number;
  zPos: number;
  /** Palette swaps to apply, one per recolourable channel that has a colour. */
  recolor?: { from: string[]; to: string[] }[];
  /** Exact colour swaps for a pre-coloured variant drawn from its reference image. */
  colorMap?: [string, string][];
}

/** Faces are drawn per head kind: elderly, female or male. */
function headKind(headId: string): string {
  return headId.includes("elderly") ? "elderly" : headId.includes("female") ? "female" : "male";
}

function opsFor(it: SpriteItem, body: Body, w: Partial<Worn>, look: Look): DrawOp[] {
  const ops: DrawOp[] = [];
  const kind = it.headKinds ? "@" + headKind(look.head) : "";
  it.layers.forEach((layer, index) => {
    const frames = layer.frames[body];
    if (!frames) return;
    if (it.recolor || !it.variants) {
      const at = frames[kind];
      if (!at) return;
      const swaps: { from: string[]; to: string[] }[] = [];
      it.recolor?.forEach((ch, i) => {
        const p = SPRITES.palettes[ch.material];
        const name = ch.material === "body" ? look.skin : ch.material === "eye" ? look.eyes : i === 0 ? w.color : w.color2;
        const to = name !== undefined ? p?.colors[name] : undefined;
        if (p && to) swaps.push({ from: p.base, to });
      });
      ops.push({ ...at, zPos: layer.zPos, ...(swaps.length ? { recolor: swaps } : {}) });
      return;
    }
    // Pre-coloured: the variant's own image, or the reference image plus its colour map.
    const variant = w.color ?? it.variants[0];
    const own = frames[variant + kind];
    if (own) {
      ops.push({ ...own, zPos: layer.zPos });
      return;
    }
    const cm = it.colorMaps?.[`${variant}${kind}|${index}|${body}`];
    const ref = cm ? frames[cm.ref] : Object.values(frames)[0];
    if (ref) ops.push({ ...ref, zPos: layer.zPos, ...(cm ? { colorMap: cm.map } : {}) });
  });
  return ops;
}

/**
 * The pieces to draw for a look, back to front. Unknown items or colours are skipped (a later art
 * bundle may not have them), as are items `visible` rejects (a lapsed in-run badge item).
 */
export function drawList(look: Look, body: Body, visible: (itemId: string) => boolean): DrawOp[] {
  const ops: DrawOp[] = [];
  const add = (id: string, w: Partial<Worn> = {}) => {
    const it = item(id);
    if (it && visible(id)) ops.push(...opsFor(it, body, w, look));
  };
  add("body/body");
  add(look.head);
  add(look.face);
  for (const w of Object.values(look.worn)) add(w.item, w);
  return ops.map((o, i) => ({ o, i })).sort((a, b) => a.o.zPos - b.o.zPos || a.i - b.i).map(({ o }) => o);
}
