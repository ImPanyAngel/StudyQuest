import atlasData from "../../assets/sprites/atlas.json";
import type { Body } from "../core/catalog";
import type { Look } from "../core/character";
import { drawList } from "../core/draw-list";
import { applyColorMap, recolor } from "../core/recolor";
import { renderSprite } from "./parts";

const FRAME = 64;
const TICK_MS = 500;

let atlas: Promise<HTMLImageElement> | null = null;

function loadAtlas(): Promise<HTMLImageElement> {
  atlas ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("StudyQuest couldn't load its sprite atlas."));
    img.src = `data:image/png;base64,${(atlasData as { png: string }).png}`;
  });
  return atlas;
}

/** Composited 128×64 frame pairs, by look: big enough for every shop thumbnail plus the characters on screen. */
const cache = new Map<string, Promise<HTMLCanvasElement>>();
const CACHE_MAX = 512;

/** Draws a look's two breathing frames onto one 128×64 canvas: atlas pieces, recoloured, back to front. */
export function compose(look: Look, body: Body, visible: (itemId: string) => boolean): Promise<HTMLCanvasElement> {
  const ops = drawList(look, body, visible);
  const key = JSON.stringify([body, ops]);
  let hit = cache.get(key);
  if (!hit) {
    hit = loadAtlas().then((img) => {
      const out = document.createElement("canvas");
      out.width = 2 * FRAME;
      out.height = FRAME;
      const ctx = out.getContext("2d")!;
      const piece = document.createElement("canvas");
      piece.width = 2 * FRAME;
      piece.height = FRAME;
      const pctx = piece.getContext("2d", { willReadFrequently: true })!;
      for (const op of ops) {
        pctx.clearRect(0, 0, piece.width, piece.height);
        pctx.drawImage(img, op.x, op.y, 2 * FRAME, FRAME, 0, 0, 2 * FRAME, FRAME);
        if (op.recolor || op.colorMap) {
          const data = pctx.getImageData(0, 0, piece.width, piece.height);
          for (const r of op.recolor ?? []) recolor(data.data, r.from, r.to);
          if (op.colorMap) applyColorMap(data.data, op.colorMap);
          pctx.putImageData(data, 0, 0);
        }
        ctx.drawImage(piece, 0, 0);
      }
      return out;
    });
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, hit);
  }
  return hit;
}

/** One still frame, drawn once: shop thumbnails, where ~190 breathing loops would be wasted. */
export function renderStill(parent: HTMLElement, shown: Shown, visible: (itemId: string) => boolean, scale: number): void {
  const canvas = parent.createEl("canvas", { cls: "sq-character" });
  canvas.width = FRAME * scale;
  canvas.height = FRAME * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  void compose(shown.look, shown.body, visible).then(
    (frames) => ctx.drawImage(frames, 0, 0, FRAME, FRAME, 0, 0, canvas.width, canvas.height),
    () => canvas.remove(),
  );
}

export interface Shown {
  body: Body;
  look: Look;
}

/**
 * The character in its breathing idle: a pixel-crisp canvas flipping between two frames.
 * Without a character, the grey placeholder figure. The loop stops by itself once the canvas
 * leaves the page (every view refresh replaces it).
 */
export function renderCharacter(parent: HTMLElement, shown: Shown | null, visible: (itemId: string) => boolean, scale: number): void {
  if (!shown) {
    renderSprite(parent);
    return;
  }
  const canvas = parent.createEl("canvas", { cls: "sq-character" });
  canvas.width = FRAME * scale;
  canvas.height = FRAME * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  void compose(shown.look, shown.body, visible).then(
    (frames) => {
      let frame = 0;
      const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frames, frame * FRAME, 0, FRAME, FRAME, 0, 0, canvas.width, canvas.height);
      };
      draw();
      const id = window.setInterval(() => {
        if (!canvas.isConnected) {
          window.clearInterval(id);
          return;
        }
        frame = 1 - frame;
        draw();
      }, TICK_MS);
    },
    () => {
      canvas.remove();
      renderSprite(parent);
    },
  );
}
