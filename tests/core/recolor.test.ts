import { applyColorMap, recolor } from "../../src/core/recolor";

const px = (...rgba: number[][]) => new Uint8ClampedArray(rgba.flat());

test("recolor maps base palette colours to the target palette, within 1 of each channel", () => {
  const p = px([255, 255, 255, 255], [128, 128, 129, 255], [10, 20, 30, 255]);
  recolor(p, ["#ffffff", "#808080"], ["#ff0000", "#00ff00"]);
  expect([...p]).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 10, 20, 30, 255]);
});

test("transparent pixels are left alone", () => {
  const p = px([255, 255, 255, 0]);
  recolor(p, ["#ffffff"], ["#ff0000"]);
  expect([...p]).toEqual([255, 255, 255, 0]);
});

test("palettes of different lengths map only the shared indices, without throwing", () => {
  const p = px([16, 16, 16, 255], [32, 32, 32, 255]);
  expect(() => recolor(p, ["#101010", "#202020"], ["#0000ff"])).not.toThrow();
  expect([...p]).toEqual([0, 0, 255, 255, 32, 32, 32, 255]);
});

test("applyColorMap swaps exact RGBA colours only", () => {
  const p = px([1, 2, 3, 255], [1, 2, 3, 128], [9, 9, 9, 255]);
  applyColorMap(p, [["#010203ff", "#aabbccff"]]);
  expect([...p]).toEqual([170, 187, 204, 255, 1, 2, 3, 128, 9, 9, 9, 255]);
});
