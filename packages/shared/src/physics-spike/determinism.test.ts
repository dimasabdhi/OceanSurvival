import { describe, expect, it } from "vitest";
import { GOLDEN_RAPIER_HASH_600, runDeterminismScenario } from "./determinism";

describe("Rapier determinism (Node.js)", () => {
  it("runs 600 steps and is repeatable within the same process", async () => {
    const a = await runDeterminismScenario(600);
    const b = await runDeterminismScenario(600);
    expect(a.rapierVersion).toBe("0.21.0");
    expect(a.bodies).toBe(25);
    expect(a.hash).toBe(b.hash);
  });

  it("matches the golden hash (the browser E2E test checks the same value)", async () => {
    const r = await runDeterminismScenario(600);
    expect(r.hash).toBe(GOLDEN_RAPIER_HASH_600);
  });
});
