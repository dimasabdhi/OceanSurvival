import { DAY_LENGTH_SECONDS, DAYLIGHT_FRACTION } from "@oceansurvival/shared";
import { describe, expect, it } from "vitest";
import { DayNightCycle, phaseToClock } from "./DayNightCycle";

/**
 * ACCEPTANCE_CRITERIA Phase 4: "a full 24-minute day/night cycle without artifacts".
 * Artifacts = sudden jumps in sky/light/fog values between consecutive moments.
 */
function snapshot(c: DayNightCycle): number[] {
  const k = c.current;
  return [
    ...k.zenith.toArray(),
    ...k.horizon.toArray(),
    ...k.light.toArray(),
    ...k.fog.toArray(),
    ...k.waterDeep.toArray(),
    k.lightIntensity / 3,
    k.ambientIntensity,
    k.fogDensity * 500,
    // What is visible is the effective light vector (direction × intensity).
    ...c.lightDirection
      .clone()
      .multiplyScalar(k.lightIntensity / 3)
      .toArray(),
  ];
}

describe("DayNightCycle", () => {
  it("changes smoothly over a full cycle, including midnight → morning wrap", () => {
    const cycle = new DayNightCycle();
    const steps = 4000; // one sample every 0.36 s of real time
    cycle.update(0);
    let prev = snapshot(cycle);
    let worst = 0;
    for (let i = 1; i <= steps + 10; i++) {
      cycle.update((i / steps) * DAY_LENGTH_SECONDS);
      const cur = snapshot(cycle);
      const jump = Math.max(...cur.map((v, j) => Math.abs(v - (prev[j] ?? 0))));
      worst = Math.max(worst, jump);
      prev = cur;
    }
    // 0.36 s steps: anything above ~3% per step would be a visible pop.
    expect(worst).toBeLessThan(0.03);
  });

  it("sun is up for 16 of 24 minutes and the clock maps sunrise/sunset", () => {
    const cycle = new DayNightCycle();
    let up = 0;
    const n = 2400;
    for (let i = 0; i < n; i++) {
      cycle.update((i / n) * DAY_LENGTH_SECONDS);
      if (cycle.sunDirection.y > 0) up++;
    }
    expect(up / n).toBeCloseTo(DAYLIGHT_FRACTION, 2);
    expect(phaseToClock(0)).toBe("06:00");
    expect(phaseToClock(DAYLIGHT_FRACTION)).toBe("22:00");
  });

  it("the main light never points below the horizon (no lighting from under the sea)", () => {
    const cycle = new DayNightCycle();
    for (let i = 0; i < 1000; i++) {
      cycle.update((i / 1000) * DAY_LENGTH_SECONDS);
      expect(cycle.lightDirection.y).toBeGreaterThan(0);
    }
  });
});
