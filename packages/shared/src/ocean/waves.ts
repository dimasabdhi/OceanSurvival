/**
 * Ocean surface model: sum of Gerstner waves.
 *
 * The SAME wave set drives the client shader (via {@link buildGerstnerGlsl}) and
 * gameplay (buoyancy, swim detection, floating debris) via {@link sampleWaveHeight}.
 * Gameplay only depends on these values within tolerances (centimetres); nothing
 * requires bit-exact results, because Math.sin/cos are not guaranteed bit-identical
 * across platforms. See docs/GAMEPLAY_SYSTEMS.md §B.
 *
 * Time handling: the travelling term `k·c·t` grows without bound, which loses
 * float32 precision on the GPU. We compute it per wave on the CPU in float64 and wrap
 * it to [0, 2π) ({@link computeWavePhases}); the shader receives the wrapped phases.
 */

const TWO_PI = Math.PI * 2;
const G = 9.81;

export interface WaveDef {
  /** Horizontal travel direction (x, z). Normalized at build time. */
  readonly direction: readonly [number, number];
  /** Wavelength in meters. */
  readonly wavelength: number;
  /** Gerstner steepness (0..1). The sum over all waves must stay < 1 to avoid loops. */
  readonly steepness: number;
}

export interface WaveSet {
  readonly waves: readonly WaveDef[];
}

interface PreparedWave {
  dx: number;
  dz: number;
  k: number;
  speed: number;
  amplitude: number;
}

/** Calm weather. Total amplitude ≈ 0.61 m (GDD: ≤ 0.6 m calm target, tuned later). */
export const CALM_WAVES: WaveSet = {
  waves: [
    { direction: [1, 0.2], wavelength: 36, steepness: 0.05 },
    { direction: [0.6, 0.8], wavelength: 19, steepness: 0.06 },
    { direction: [-0.3, 1], wavelength: 9, steepness: 0.07 },
    { direction: [0.9, -0.5], wavelength: 4.5, steepness: 0.06 },
  ],
};

export const MAX_WAVES = 4;

function prepare(set: WaveSet): PreparedWave[] {
  if (set.waves.length > MAX_WAVES) {
    throw new Error(`WaveSet supports at most ${MAX_WAVES} waves`);
  }
  let steepnessSum = 0;
  return set.waves.map((w) => {
    steepnessSum += w.steepness;
    if (steepnessSum >= 1) throw new Error("Sum of wave steepness must be < 1");
    const len = Math.hypot(w.direction[0], w.direction[1]);
    const k = TWO_PI / w.wavelength;
    return {
      dx: w.direction[0] / len,
      dz: w.direction[1] / len,
      k,
      speed: Math.sqrt(G / k),
      amplitude: w.steepness / k,
    };
  });
}

const cache = new WeakMap<WaveSet, PreparedWave[]>();
function prepared(set: WaveSet): PreparedWave[] {
  let p = cache.get(set);
  if (!p) {
    p = prepare(set);
    cache.set(set, p);
  }
  return p;
}

/** Per-wave travelling phase `k·c·t` wrapped to [0, 2π), computed in float64. */
export function computeWavePhases(
  set: WaveSet,
  timeSeconds: number,
  out?: Float32Array,
): Float32Array {
  const waves = prepared(set);
  const result = out ?? new Float32Array(MAX_WAVES);
  result.fill(0);
  waves.forEach((w, i) => {
    const phase = (w.k * w.speed * timeSeconds) % TWO_PI;
    result[i] = phase < 0 ? phase + TWO_PI : phase;
  });
  return result;
}

/** Waves fade out between FADE_START and FADE_END wavelengths from the viewer. */
export const WAVE_FADE_START_WAVELENGTHS = 8;
export const WAVE_FADE_END_WAVELENGTHS = 16;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * VISUAL ONLY: amplitude multiplier of a wave seen from `viewDistance` meters.
 * Short waves fade with distance so the mesh never under-samples them (aliasing).
 * Gameplay (server) never passes a view distance, i.e. always uses full waves.
 */
export function waveFade(wavelength: number, viewDistance: number): number {
  return (
    1 -
    smoothstep(
      wavelength * WAVE_FADE_START_WAVELENGTHS,
      wavelength * WAVE_FADE_END_WAVELENGTHS,
      viewDistance,
    )
  );
}

/**
 * Displacement of the undisplaced surface point (x, z) at time t.
 * Returns [dx, dy, dz] where the displaced point is (x + dx, dy, z + dz).
 * `viewDistance` (visual only) applies the same per-wave fade as the shader.
 */
export function gerstnerDisplacement(
  set: WaveSet,
  x: number,
  z: number,
  timeSeconds: number,
  viewDistance?: number,
): [number, number, number] {
  const waves = prepared(set);
  let ox = 0;
  let oy = 0;
  let oz = 0;
  for (const w of waves) {
    const fade = viewDistance === undefined ? 1 : waveFade(TWO_PI / w.k, viewDistance);
    if (fade <= 0) continue;
    const a = w.amplitude * fade;
    const f = w.k * (w.dx * x + w.dz * z) - ((w.k * w.speed * timeSeconds) % TWO_PI);
    const c = Math.cos(f);
    ox += w.dx * a * c;
    oy += a * Math.sin(f);
    oz += w.dz * a * c;
  }
  return [ox, oy, oz];
}

/**
 * Water surface height at world position (x, z) and time t.
 * Gerstner waves move points horizontally, so we iteratively find the undisplaced
 * point whose displaced position lands on (x, z), then return its height.
 * `viewDistance` is for client visuals only (see {@link waveFade}).
 */
export function sampleWaveHeight(
  set: WaveSet,
  x: number,
  z: number,
  timeSeconds: number,
  viewDistance?: number,
): number {
  let px = x;
  let pz = z;
  for (let i = 0; i < 4; i++) {
    const [dx, , dz] = gerstnerDisplacement(set, px, pz, timeSeconds, viewDistance);
    px = x - dx;
    pz = z - dz;
  }
  return gerstnerDisplacement(set, px, pz, timeSeconds, viewDistance)[1];
}

/** Sum of wave amplitudes: upper bound of |height|. */
export function maxWaveAmplitude(set: WaveSet): number {
  return prepared(set).reduce((sum, w) => sum + w.amplitude, 0);
}

function glslFloat(v: number): string {
  const s = v.toPrecision(9);
  return s.includes(".") || s.includes("e") ? s : `${s}.0`;
}

/**
 * GLSL source for the same wave set. Expects `uniform float uWavePhase[4];`
 * (from {@link computeWavePhases}) to be declared by the including shader.
 * Provides: `vec3 oceanDisplace(vec2 p, float viewDist, out vec3 normal, out float crest)`.
 * `viewDist` applies the same per-wave fade as {@link waveFade}.
 */
export function buildGerstnerGlsl(set: WaveSet): string {
  const waves = prepared(set);
  const lines: string[] = [];
  lines.push("vec3 oceanDisplace(vec2 p, float viewDist, out vec3 normal, out float crest) {");
  lines.push("  vec3 offset = vec3(0.0);");
  lines.push("  vec3 tangent = vec3(1.0, 0.0, 0.0);");
  lines.push("  vec3 binormal = vec3(0.0, 0.0, 1.0);");
  lines.push("  crest = 0.0;");
  waves.forEach((w, i) => {
    const wavelength = TWO_PI / w.k;
    const d = `vec2(${glslFloat(w.dx)}, ${glslFloat(w.dz)})`;
    const k = glslFloat(w.k);
    const fadeStart = glslFloat(wavelength * WAVE_FADE_START_WAVELENGTHS);
    const fadeEnd = glslFloat(wavelength * WAVE_FADE_END_WAVELENGTHS);
    lines.push("  {");
    lines.push(`    float fade = 1.0 - smoothstep(${fadeStart}, ${fadeEnd}, viewDist);`);
    lines.push(`    float a = ${glslFloat(w.amplitude)} * fade;`);
    lines.push(`    float s = ${glslFloat(w.amplitude * w.k)} * fade;`);
    lines.push(`    vec2 d = ${d};`);
    lines.push(`    float f = ${k} * dot(d, p) - uWavePhase[${i}];`);
    lines.push("    float c = cos(f);");
    lines.push("    float sn = sin(f);");
    lines.push("    offset += vec3(d.x * a * c, a * sn, d.y * a * c);");
    lines.push("    tangent += vec3(-d.x * d.x * s * sn, d.x * s * c, -d.x * d.y * s * sn);");
    lines.push("    binormal += vec3(-d.x * d.y * s * sn, d.y * s * c, -d.y * d.y * s * sn);");
    lines.push("    crest += s * sn;");
    lines.push("  }");
  });
  lines.push("  normal = normalize(cross(binormal, tangent));");
  lines.push("  return offset;");
  lines.push("}");
  return lines.join("\n");
}
