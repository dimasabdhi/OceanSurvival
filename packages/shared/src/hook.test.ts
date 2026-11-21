import { describe, expect, it } from "vitest";
import {
  HOOK,
  type HookLaunch,
  hookFlightPosition,
  hookLandingTime,
  hookLaunch,
  hookPower,
} from "./hook";

describe("hook flight", () => {
  it("power ramps over the charge time and is clamped", () => {
    expect(hookPower(0)).toBe(0);
    expect(hookPower(HOOK.chargeSeconds / 2)).toBeCloseTo(0.5);
    expect(hookPower(10)).toBe(1);
  });

  it("analytic flight matches a small-step numeric integration", () => {
    const l = hookLaunch([0, 1.9, 0], 0.3, 0.2, 0.4);
    let x = l.x;
    let y = l.y;
    let z = l.z;
    let vy = l.vy;
    const dt = 1 / 1000;
    for (let i = 0; i < 800; i++) {
      x += l.vx * dt;
      z += l.vz * dt;
      vy -= HOOK.gravity * dt;
      y += vy * dt + 0.5 * HOOK.gravity * dt * dt; // exact per-step for constant gravity
    }
    const [ax, ay, az] = hookFlightPosition(l, 0.8);
    expect(ax).toBeCloseTo(x, 6);
    expect(az).toBeCloseTo(z, 6);
    expect(ay).toBeCloseTo(y, 2);
  });

  it("lands on the water at the computed time", () => {
    const l = hookLaunch([0, 1.87, 0], 0, 0, 1);
    const t = hookLandingTime(l);
    expect(hookFlightPosition(l, t)[1]).toBeCloseTo(0, 6);
  });

  it("the rope caps horizontal reach at 25 m even at full power", () => {
    for (const pitch of [0, 0.3, 0.6, 0.8]) {
      const l = hookLaunch([0, 1.87, 0], 0, pitch, 1);
      const [x, , z] = hookFlightPosition(l, hookLandingTime(l));
      const reach = Math.hypot(x - l.x, z - l.z);
      expect(reach).toBeLessThanOrEqual(HOOK.maxRopeLength + 1e-6);
    }
    // A weak level throw lands well short of the cap.
    const weak: HookLaunch = hookLaunch([0, 1.87, 0], 0, 0, 0);
    const [wx, , wz] = hookFlightPosition(weak, hookLandingTime(weak));
    expect(Math.hypot(wx - weak.x, wz - weak.z)).toBeGreaterThan(5);
    expect(Math.hypot(wx - weak.x, wz - weak.z)).toBeLessThan(15);
  });

  it("throws in the look direction (yaw 0 = −Z)", () => {
    const l = hookLaunch([0, 1.87, 0], 0, 0, 0.5);
    expect(l.vz).toBeLessThan(0);
    expect(Math.abs(l.vx)).toBeLessThan(1e-6);
  });
});
