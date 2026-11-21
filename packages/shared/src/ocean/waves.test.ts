import { describe, expect, it } from "vitest";
import { createPrng } from "../math/prng";
import {
  buildGerstnerGlsl,
  CALM_WAVES,
  computeWavePhases,
  gerstnerDisplacement,
  maxWaveAmplitude,
  sampleWaveHeight,
} from "./waves";

describe("ocean waves", () => {
  it("calm amplitude stays near the GDD target (~0.6 m)", () => {
    const amp = maxWaveAmplitude(CALM_WAVES);
    expect(amp).toBeGreaterThan(0.5);
    expect(amp).toBeLessThan(0.7);
  });

  it("sampleWaveHeight matches the displaced surface within 1 mm", () => {
    const rand = createPrng(7);
    for (let i = 0; i < 500; i++) {
      const x0 = (rand() - 0.5) * 2000;
      const z0 = (rand() - 0.5) * 2000;
      const t = rand() * 5000;
      const [dx, dy, dz] = gerstnerDisplacement(CALM_WAVES, x0, z0, t);
      const h = sampleWaveHeight(CALM_WAVES, x0 + dx, z0 + dz, t);
      expect(Math.abs(h - dy)).toBeLessThan(0.001);
    }
  });

  it("visual fade: near the viewer equals gameplay height, far away waves flatten", () => {
    const near = sampleWaveHeight(CALM_WAVES, 3, 4, 100, 5);
    expect(near).toBeCloseTo(sampleWaveHeight(CALM_WAVES, 3, 4, 100), 6);
    expect(Math.abs(sampleWaveHeight(CALM_WAVES, 3, 4, 100, 10_000))).toBe(0);
  });

  it("wrapped phases stay in [0, 2π) even for very large times", () => {
    const phases = computeWavePhases(CALM_WAVES, 1e7);
    for (const p of phases) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(Math.PI * 2);
    }
  });

  it("generates GLSL with one block per wave", () => {
    const glsl = buildGerstnerGlsl(CALM_WAVES);
    expect(glsl).toContain("vec3 oceanDisplace(");
    expect(glsl.match(/uWavePhase\[/g)?.length).toBe(CALM_WAVES.waves.length);
  });

  it("rejects wave sets that would self-intersect", () => {
    expect(() =>
      maxWaveAmplitude({
        waves: [
          { direction: [1, 0], wavelength: 10, steepness: 0.6 },
          { direction: [0, 1], wavelength: 10, steepness: 0.5 },
        ],
      }),
    ).toThrow(/steepness/);
  });
});
