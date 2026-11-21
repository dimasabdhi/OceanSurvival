import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";
import type { DayNightCycle } from "./DayNightCycle";

/**
 * Stylized gradient sky (ART_DIRECTION: color/fog carry the mood, not detail).
 * Follows the camera; drawn first with depth writes disabled.
 */
const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uBelow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunVisible;
varying vec3 vDir;

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.6, h), 0.7));
  sky = mix(uBelow, sky, smoothstep(-0.08, 0.02, h));
  float d = max(dot(dir, normalize(uSunDir)), 0.0);
  float glow = pow(d, 8.0) * 0.35 + pow(d, 64.0) * 0.6;
  float disc = smoothstep(0.9993, 0.9996, d);
  sky += uSunColor * (glow + disc * 4.0) * uSunVisible;
  gl_FragColor = vec4(sky, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class SkyDome {
  readonly mesh: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly uniforms = {
    uZenith: { value: new Color() },
    uHorizon: { value: new Color() },
    uBelow: { value: new Color() },
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunColor: { value: new Color() },
    uSunVisible: { value: 1 },
  };

  constructor(radius = 3000) {
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      uniforms: this.uniforms,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 32, 16), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.name = "SkyDome";
  }

  update(cameraPosition: Vector3, cycle: DayNightCycle): void {
    this.mesh.position.copy(cameraPosition);
    const u = this.uniforms;
    const k = cycle.current;
    u.uZenith.value.copy(k.zenith);
    u.uHorizon.value.copy(k.horizon);
    u.uBelow.value.copy(k.waterDeep);
    u.uSunDir.value.copy(cycle.sunDirection);
    u.uSunColor.value.copy(k.light);
    u.uSunVisible.value = cycle.sunDirection.y > -0.05 ? 1 : 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
