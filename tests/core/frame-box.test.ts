import { frameBox } from "../../src/core/frame-box";

/** A 2-frame strip (each frame w×h) with opaque pixels at the given [frame, x, y] spots. */
function strip(w: number, h: number, dots: [number, number, number][]): Uint8ClampedArray {
  const px = new Uint8ClampedArray(2 * w * h * 4);
  for (const [f, x, y] of dots) px[(y * 2 * w + f * w + x) * 4 + 3] = 255;
  return px;
}

test("the box covers what's drawn in either frame, in frame coordinates", () => {
  const px = strip(8, 8, [[0, 2, 3], [0, 4, 6], [1, 1, 5]]);
  expect(frameBox(px, 8, 8)).toEqual({ x: 1, y: 3, w: 4, h: 4 });
});

test("an empty strip has no box", () => {
  expect(frameBox(strip(8, 8, []), 8, 8)).toBeNull();
});
