/** Pixel recolouring on raw RGBA data (as from canvas getImageData). Pure, so it's testable without a canvas. */

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

/** In place: every visible pixel within 1 of `from[i]` on each channel becomes `to[i]`. Only shared indices map. */
export function recolor(px: Uint8ClampedArray, from: string[], to: string[]): void {
  const n = Math.min(from.length, to.length);
  const src = from.slice(0, n).map(rgb);
  const dst = to.slice(0, n).map(rgb);
  for (let p = 0; p < px.length; p += 4) {
    if (px[p + 3] === 0) continue;
    for (let i = 0; i < n; i++) {
      const c = src[i];
      if (Math.abs(px[p] - c[0]) <= 1 && Math.abs(px[p + 1] - c[1]) <= 1 && Math.abs(px[p + 2] - c[2]) <= 1) {
        [px[p], px[p + 1], px[p + 2]] = dst[i];
        break;
      }
    }
  }
}

/** In place: exact RGBA swaps from a pre-coloured item's colour map ("#rrggbbaa" pairs). */
export function applyColorMap(px: Uint8ClampedArray, map: [string, string][]): void {
  const swaps = new Map(map.map(([a, b]) => [parseInt(a.slice(1), 16) >>> 0, b]));
  for (let p = 0; p < px.length; p += 4) {
    const key = ((px[p] << 24) | (px[p + 1] << 16) | (px[p + 2] << 8) | px[p + 3]) >>> 0;
    const to = swaps.get(key);
    if (to === undefined) continue;
    px[p] = parseInt(to.slice(1, 3), 16);
    px[p + 1] = parseInt(to.slice(3, 5), 16);
    px[p + 2] = parseInt(to.slice(5, 7), 16);
    px[p + 3] = parseInt(to.slice(7, 9), 16);
  }
}
