import { createPrng, sampleWaveHeight, type WaveSet } from "@oceansurvival/shared";
import {
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3 as V3,
  type Vector3,
} from "three";

/**
 * PLACEHOLDER (debug only, Phase 1): floating crates positioned on the CPU with the
 * shared `sampleWaveHeight`. If they visibly sit on the shader-displaced water, the
 * CPU and GPU wave models agree. Not game content; removed when real debris exists.
 */
export class DebugFloaters {
  readonly mesh: InstancedMesh;
  private readonly positions: { x: number; z: number; size: number }[] = [];
  private readonly matrix = new Matrix4();
  private readonly quat = new Quaternion();
  private readonly pos = new V3();
  private readonly scale = new V3();
  private readonly up = new V3(0, 1, 0);
  private readonly tilt = new V3();

  constructor(
    private readonly waves: WaveSet,
    count = 16,
  ) {
    const rand = createPrng(2026);
    const material = new MeshStandardMaterial({ color: new Color(0xa27b5c), roughness: 0.9 });
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, count);
    this.mesh.name = "DebugFloaters(PLACEHOLDER)";
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 6 + rand() * 30;
      this.positions.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        size: 0.5 + rand() * 0.6,
      });
    }
    this.mesh.frustumCulled = false;
  }

  update(worldTimeSeconds: number, cameraPosition: Vector3): void {
    const e = 0.6; // sample spacing for tilt
    this.positions.forEach((p, i) => {
      const viewDist = Math.hypot(p.x - cameraPosition.x, p.z - cameraPosition.z);
      const h = sampleWaveHeight(this.waves, p.x, p.z, worldTimeSeconds, viewDist);
      const hx = sampleWaveHeight(this.waves, p.x + e, p.z, worldTimeSeconds, viewDist);
      const hz = sampleWaveHeight(this.waves, p.x, p.z + e, worldTimeSeconds, viewDist);
      this.tilt.set(-(hx - h) / e, 1, -(hz - h) / e).normalize();
      this.quat.setFromUnitVectors(this.up, this.tilt);
      // Float with ~35% of the crate below the surface.
      this.pos.set(p.x, h + p.size * 0.15, p.z);
      this.scale.setScalar(p.size);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.mesh.setMatrixAt(i, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
    this.mesh.dispose();
  }
}
