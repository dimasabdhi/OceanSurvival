import { describe, expect, it } from "vitest";
import { createPrng, fnv1aHex } from "./prng";

describe("createPrng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createPrng(1337);
    const b = createPrng(1337);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it("is pinned to known values (guards against accidental algorithm changes)", () => {
    const next = createPrng(1337);
    const first = [next(), next(), next()].map((v) => v.toFixed(10));
    expect(first).toMatchInlineSnapshot(`
      [
        "0.1844118326",
        "0.1899892513",
        "0.8104719922",
      ]
    `);
  });

  it("stays within [0, 1)", () => {
    const next = createPrng(42);
    for (let i = 0; i < 10_000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("fnv1aHex", () => {
  it("hashes known input", () => {
    // FNV-1a 32-bit of "a" is 0xe40c292c
    expect(fnv1aHex(new TextEncoder().encode("a"))).toBe("e40c292c");
  });
});
