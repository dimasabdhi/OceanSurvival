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
const WRAP = 60;
/** Wraps a coordinate into [-WRAP, WRAP). */
function wrap(v: number): number {
  return ((((v + WRAP) % (2 * WRAP)) + 2 * WRAP) % (2 * WRAP)) - WRAP;
}

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
      // World positions (static in the water); kept away from the raft at the origin.
      const angle = rand() * Math.PI * 2;
      const dist = 8 + rand() * 40;
      this.positions.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        size: 0.5 + rand() * 0.6,
      });
    }
    this.mesh.frustumCulled = false;
  }

  /**
   * Crates float still in the water while the raft drifts (ADR-0014): render position =
   * world position − raft world position, wrapped into a ±WRAP box so they keep coming.
   */
  update(worldTimeSeconds: number, cameraPosition: Vector3, raftX = 0, raftZ = 0): void {
    const e = 0.6; // sample spacing for tilt
    this.positions.forEach((p, i) => {
      const lx = wrap(p.x - raftX);
      const lz = wrap(p.z - raftZ);
      const wx = raftX + lx;
      const wz = raftZ + lz;
      const viewDist = Math.hypot(lx - cameraPosition.x, lz - cameraPosition.z);
      const h = sampleWaveHeight(this.waves, wx, wz, worldTimeSeconds, viewDist);
      const hx = sampleWaveHeight(this.waves, wx + e, wz, worldTimeSeconds, viewDist);
      const hz = sampleWaveHeight(this.waves, wx, wz + e, worldTimeSeconds, viewDist);
      this.tilt.set(-(hx - h) / e, 1, -(hz - h) / e).normalize();
      this.quat.setFromUnitVectors(this.up, this.tilt);
      // Float with ~35% of the crate below the surface.
      this.pos.set(lx, h + p.size * 0.15, lz);
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
