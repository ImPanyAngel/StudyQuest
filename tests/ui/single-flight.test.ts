import { singleFlight } from "../../src/ui/single-flight";

test("singleFlight ignores calls while the previous one is pending", async () => {
  let runs = 0;
  let release!: () => void;
  const f = singleFlight(() => {
    runs++;
    return new Promise<void>((r) => (release = r));
  });
  const a = f();
  void f();
  expect(runs).toBe(1);
  release();
  await a;
  void f();
  expect(runs).toBe(2);
});
