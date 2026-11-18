/** The drawn area of a 2-frame strip, as one box in frame coordinates (both frames combined, so breathing doesn't shift it). */
export function frameBox(px: Uint8ClampedArray, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 2 * w; x++) {
      if (px[(y * 2 * w + x) * 4 + 3] === 0) continue;
      const fx = x % w;
      if (fx < x0) x0 = fx;
      if (fx > x1) x1 = fx;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
