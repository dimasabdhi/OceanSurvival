import {
  buildGerstnerGlsl,
  computeWavePhases,
  MAX_WAVES,
  type WaveSet,
} from "@oceansurvival/shared";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  type PerspectiveCamera,
  ShaderMaterial,
  Sphere,
  Vector3,
} from "three";
import type { DayNightCycle } from "../DayNightCycle";

/**
 * Stylized Gerstner ocean (ART_DIRECTION §8, GAMEPLAY_SYSTEMS §B).
 *
 * Geometry: one camera-centred radial grid whose ring spacing grows geometrically,
 * so vertex density falls off with distance in a single crack-free mesh (no LOD
 * seams). Waves are evaluated in the vertex shader from the SAME wave set used by
 * gameplay (`@oceansurvival/shared` ocean/waves).
 *
 * Known limitation (Phase 1 prototype): because the grid follows the camera, vertex
 * sample positions slide under the surface ("swimming"); acceptable at this density,
 * revisit in Phase 4 if visible.
 */
export interface OceanMeshOptions {
  segments: number;
  innerSpacing: number;
  radius: number;
}

export function createRadialGridGeometry(opts: OceanMeshOptions): BufferGeometry {
  const radii: number[] = [0];
  let spacing = opts.innerSpacing;
  const growth = 1.035;
  while ((radii[radii.length - 1] as number) < opts.radius) {
    radii.push((radii[radii.length - 1] as number) + spacing);
    spacing *= growth;
  }
  const rings = radii.length;
  const seg = opts.segments;
  const positions = new Float32Array((1 + (rings - 1) * seg) * 3);
  // centre vertex at index 0
  let v = 1;
  for (let r = 1; r < rings; r++) {
    const radius = radii[r] as number;
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      positions[v * 3] = Math.cos(a) * radius;
      positions[v * 3 + 1] = 0;
      positions[v * 3 + 2] = Math.sin(a) * radius;
      v++;
    }
  }
  const indices: number[] = [];
  // centre fan
  for (let s = 0; s < seg; s++) indices.push(0, 1 + ((s + 1) % seg), 1 + s);
  for (let r = 1; r < rings - 1; r++) {
    const base0 = 1 + (r - 1) * seg;
    const base1 = 1 + r * seg;
    for (let s = 0; s < seg; s++) {
      const s1 = (s + 1) % seg;
      const a = base0 + s;
      const b = base0 + s1;
      const c = base1 + s;
      const d = base1 + s1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.boundingSphere = new Sphere(new Vector3(), opts.radius + 10);
  return geometry;
}

function buildVertexShader(waves: WaveSet): string {
  return /* glsl */ `
uniform float uWavePhase[${MAX_WAVES}];
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
varying float vHeight;

${buildGerstnerGlsl(waves)}

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  float viewDist = length(world.xz - cameraPosition.xz);
  vec3 n;
  float crest;
  vec3 offset = oceanDisplace(world.xz, viewDist, n, crest);
  world.xyz += offset;
  vWorldPos = world.xyz;
  vNormal = n;
  vCrest = crest;
  vHeight = offset.y;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
}

const fragmentShader = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uSunDir;
uniform vec3 uLightDir;
uniform vec3 uSunColor;
uniform float uSunVisible;
uniform float uLightLevel;
uniform float uFoamLevel;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uUnderwater;
uniform vec3 uUnderwaterColor;
uniform float uUnderwaterDensity;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
varying float vHeight;

void main() {
  vec3 n = normalize(vNormal);
  vec3 toCam = cameraPosition - vWorldPos;
  float dist = length(toCam);
  vec3 v = toCam / dist;

  if (!gl_FrontFacing) {
    // Seen from below: a bright, wavy ceiling fading into the underwater haze.
    float glow = pow(max(dot(-n, v), 0.0), 2.0);
    vec3 under = mix(uUnderwaterColor, uShallow * 1.4, glow) * uLightLevel;
    float uf = 1.0 - exp(-uUnderwaterDensity * dist);
    gl_FragColor = vec4(mix(under, uUnderwaterColor * uLightLevel, clamp(uf, 0.0, 1.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }

  // Body color: deeper in troughs, lighter on crests facing the viewer.
  float lift = clamp(vHeight * 0.8 + 0.5, 0.0, 1.0);
  vec3 body = mix(uDeep, uShallow, lift * 0.55);

  // Stylized fresnel sky reflection.
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, smoothstep(-0.05, 0.4, r.y));
  vec3 col = mix(body, sky, clamp(fres * 0.7, 0.0, 1.0));

  // Soft diffuse response to the main light.
  col *= mix(0.65, 1.0, max(dot(n, uLightDir), 0.0)) * uLightLevel;

  // Sun glint.
  vec3 h = normalize(uSunDir + v);
  float spec = pow(max(dot(n, h), 0.0), 240.0) * 2.5;
  col += uSunColor * spec * uSunVisible;

  // Crest foam.
  float foam = smoothstep(0.15, 0.25, vCrest) * (1.0 - smoothstep(150.0, 400.0, dist));
  col = mix(col, uFoam * uFoamLevel, foam * 0.6);

  // Exponential-squared fog toward the horizon color.
  float fogF = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
  col = mix(col, uFogColor, clamp(fogF, 0.0, 1.0));
  // Camera under water looking at the top side (rare, at the surface boundary).
  col = mix(col, uUnderwaterColor * uLightLevel, uUnderwater * clamp(1.0 - exp(-uUnderwaterDensity * dist), 0.0, 1.0));

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class OceanRenderer {
  readonly mesh: Mesh<BufferGeometry, ShaderMaterial>;
  private readonly phases = new Float32Array(MAX_WAVES);
  /** Typed uniform objects shared with the material (mutate `.value`, never replace). */
  private readonly uniforms = {
    uWavePhase: { value: this.phases },
    uDeep: { value: new Color() },
    uShallow: { value: new Color() },
    uFoam: { value: new Color(0xf4fbf8) },
    uSkyZenith: { value: new Color() },
    uSkyHorizon: { value: new Color() },
    uSunDir: { value: new Vector3(0, 1, 0) },
    uLightDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color() },
    uSunVisible: { value: 1 },
    uLightLevel: { value: 1 },
    uFoamLevel: { value: 1 },
    uFogColor: { value: new Color() },
    uFogDensity: { value: 0.001 },
    uUnderwater: { value: 0 },
    uUnderwaterColor: { value: new Color(0x0f4c5c) },
    uUnderwaterDensity: { value: 0.08 },
  };

  constructor(
    private readonly waves: WaveSet,
    options: OceanMeshOptions,
  ) {
    const material = new ShaderMaterial({
      vertexShader: buildVertexShader(waves),
      fragmentShader,
      uniforms: this.uniforms,
      // Visible from below when the camera dives (underwater surface).
      side: DoubleSide,
    });
    this.mesh = new Mesh(createRadialGridGeometry(options), material);
    this.mesh.name = "Ocean";
    this.mesh.frustumCulled = false;
  }

  /** Rebuilds the grid (quality change). Disposes the old geometry. */
  setMeshOptions(options: OceanMeshOptions): void {
    const old = this.mesh.geometry;
    this.mesh.geometry = createRadialGridGeometry(options);
    old.dispose();
  }

  /**
   * @param originX/originZ world position of the render frame's origin (the drifting raft,
   *   ADR-0014): the mesh lives in raft-frame coordinates, waves are sampled in the world.
   */
  update(
    worldTimeSeconds: number,
    camera: PerspectiveCamera,
    cycle: DayNightCycle,
    originX = 0,
    originZ = 0,
    underwater = false,
  ): void {
    computeWavePhases(this.waves, worldTimeSeconds, this.phases, originX, originZ);
    this.uniforms.uUnderwater.value = underwater ? 1 : 0;
    this.mesh.position.set(camera.position.x, 0, camera.position.z);
    const u = this.uniforms;
    const k = cycle.current;
    u.uDeep.value.copy(k.waterDeep);
    u.uShallow.value.copy(k.waterShallow);
    u.uSkyZenith.value.copy(k.zenith);
    u.uSkyHorizon.value.copy(k.horizon);
    u.uSunDir.value.copy(cycle.sunDirection);
    u.uLightDir.value.copy(cycle.lightDirection);
    u.uSunColor.value.copy(k.light);
    u.uFogColor.value.copy(k.fog);
    u.uFogDensity.value = k.fogDensity;
    u.uSunVisible.value = cycle.sunDirection.y > 0 ? 1 : 0;
    const daylight = Math.min(1, k.lightIntensity / 3);
    u.uLightLevel.value = 0.35 + 0.65 * daylight;
    // Foam must not glow at night: scale it with daylight, keep a faint moonlit trace.
    u.uFoamLevel.value = 0.12 + 0.88 * daylight * daylight;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
