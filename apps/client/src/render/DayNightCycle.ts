import { DAY_LENGTH_SECONDS, DAYLIGHT_FRACTION } from "@oceansurvival/shared";
import { Color, MathUtils, Vector3 } from "three";

/**
 * Time-of-day model: sun/moon direction, light and sky colors, fog.
 * Palette from docs/ART_DIRECTION.md §3–4. Phase 0 = sunrise; the sun is above the
 * horizon for DAYLIGHT_FRACTION of the cycle (16 of 24 minutes).
 */
interface Keyframe {
  zenith: Color;
  horizon: Color;
  light: Color;
  lightIntensity: number;
  ambientSky: Color;
  ambientGround: Color;
  ambientIntensity: number;
  fog: Color;
  fogDensity: number;
  waterDeep: Color;
  waterShallow: Color;
}

const c = (hex: number) => new Color(hex);

const NIGHT: Keyframe = {
  zenith: c(0x0c1530),
  horizon: c(0x24345a),
  light: c(0xdde7f2),
  lightIntensity: 0.35,
  ambientSky: c(0x1d2b4d),
  ambientGround: c(0x0b2540),
  ambientIntensity: 0.35,
  fog: c(0x16243f),
  fogDensity: 0.0016,
  waterDeep: c(0x061a30),
  waterShallow: c(0x0f3b52),
};

const DUSK: Keyframe = {
  zenith: c(0x6a4c93),
  horizon: c(0xf28c5b),
  light: c(0xf2a35b),
  lightIntensity: 1.6,
  ambientSky: c(0x8f6ca8),
  ambientGround: c(0x1b4f72),
  ambientIntensity: 0.6,
  fog: c(0xd99a7a),
  fogDensity: 0.0011,
  waterDeep: c(0x1b3f66),
  waterShallow: c(0x3b8fa0),
};

const DAY: Keyframe = {
  zenith: c(0x5fb4e6),
  horizon: c(0xfbeac8),
  light: c(0xfff4e0),
  lightIntensity: 3.0,
  ambientSky: c(0x8fd3f4),
  ambientGround: c(0x1b4f72),
  ambientIntensity: 0.9,
  fog: c(0xcfe6ee),
  fogDensity: 0.0007,
  waterDeep: c(0x1b4f72),
  waterShallow: c(0x3fc1c9),
};

export class DayNightCycle {
  /** Direction TOWARDS the sun (unit). Below the horizon at night. */
  readonly sunDirection = new Vector3();
  /** Direction towards the main light (sun by day, moon by night). */
  readonly lightDirection = new Vector3();
  readonly current: Keyframe = {
    zenith: new Color(),
    horizon: new Color(),
    light: new Color(),
    lightIntensity: 0,
    ambientSky: new Color(),
    ambientGround: new Color(),
    ambientIntensity: 0,
    fog: new Color(),
    fogDensity: 0,
    waterDeep: new Color(),
    waterShallow: new Color(),
  };
  /** 0..1 cycle phase (0 = sunrise). */
  phase = 0;

  /** Updates all values for a world time in seconds. */
  update(worldTimeSeconds: number): void {
    const phase = (((worldTimeSeconds / DAY_LENGTH_SECONDS) % 1) + 1) % 1;
    this.phase = phase;
    const isDay = phase < DAYLIGHT_FRACTION;
    // Angle along the arc: 0..π during the day, π..2π during the night.
    const arc = isDay
      ? Math.PI * (phase / DAYLIGHT_FRACTION)
      : Math.PI + Math.PI * ((phase - DAYLIGHT_FRACTION) / (1 - DAYLIGHT_FRACTION));
    const maxElevation = MathUtils.degToRad(68);
    const tilt = 0.35; // path tilted towards +Z (south)
    const height = Math.sin(arc);
    this.sunDirection
      .set(Math.cos(arc), height * Math.sin(maxElevation), height * tilt)
      .normalize();

    const elevation = this.sunDirection.y;
    if (elevation > -0.05) {
      this.lightDirection.copy(this.sunDirection);
      if (this.lightDirection.y < 0.05) this.lightDirection.y = 0.05;
    } else {
      this.lightDirection.copy(this.sunDirection).negate(); // moon opposite the sun
    }
    this.lightDirection.normalize();

    // Blend keyframes by sun elevation.
    const dayT = MathUtils.smoothstep(elevation, 0.02, 0.35);
    const nightT = MathUtils.smoothstep(-elevation, 0.0, 0.18);
    const out = this.current;
    lerpKeyframe(out, DUSK, DAY, dayT);
    if (nightT > 0) lerpKeyframe(out, out, NIGHT, nightT);
  }
}

function lerpKeyframe(out: Keyframe, a: Keyframe, b: Keyframe, t: number): void {
  out.zenith.copy(a.zenith).lerp(b.zenith, t);
  out.horizon.copy(a.horizon).lerp(b.horizon, t);
  out.light.copy(a.light).lerp(b.light, t);
  out.lightIntensity = MathUtils.lerp(a.lightIntensity, b.lightIntensity, t);
  out.ambientSky.copy(a.ambientSky).lerp(b.ambientSky, t);
  out.ambientGround.copy(a.ambientGround).lerp(b.ambientGround, t);
  out.ambientIntensity = MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t);
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.fogDensity = MathUtils.lerp(a.fogDensity, b.fogDensity, t);
  out.waterDeep.copy(a.waterDeep).lerp(b.waterDeep, t);
  out.waterShallow.copy(a.waterShallow).lerp(b.waterShallow, t);
}

/** Formats the cycle phase as an in-game clock (sunrise = 06:00, sunset = 22:00). */
export function phaseToClock(phase: number): string {
  // Map the 16/8 split onto a 06:00 → 22:00 day and 22:00 → 06:00 night.
  const hours =
    phase < DAYLIGHT_FRACTION
      ? 6 + (phase / DAYLIGHT_FRACTION) * 16
      : 22 + ((phase - DAYLIGHT_FRACTION) / (1 - DAYLIGHT_FRACTION)) * 8;
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
