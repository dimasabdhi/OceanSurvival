import { CALM_WAVES, CELL_SIZE, sampleWaveHeight } from "@oceansurvival/shared";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";

/**
 * VISUAL ONLY raft motion from the waves (ADR-0014 §6): heave, pitch and roll computed
 * from wave heights under the raft. Gameplay always uses the mean water level, so this
 * never affects collisions or prediction. Applied to the raft, the players standing on
 * it, and the local camera. Can be disabled (settings: "Goyangan rakit").
 */
const SAMPLE = CELL_SIZE; // sample the waves at ±1.5 m around the raft center
/** A raft damps the waves: it rides them only partially. */
const DAMPING = 0.6;

export class RaftSway {
  /** Transform from the raft frame to the swaying render frame. */
  readonly matrix = new Matrix4();
  readonly quaternion = new Quaternion();
  private readonly euler = new Euler();
  private readonly position = new Vector3();
  private readonly scale = new Vector3(1, 1, 1);
  enabled = true;

  update(worldTime: number, raftWorldX: number, raftWorldZ: number): void {
    if (!this.enabled) {
      this.matrix.identity();
      this.quaternion.identity();
      return;
    }
    const h = (dx: number, dz: number) =>
      sampleWaveHeight(CALM_WAVES, raftWorldX + dx, raftWorldZ + dz, worldTime, 0);
    const c = h(0, 0);
    const pitch = Math.atan2(h(0, -SAMPLE) - h(0, SAMPLE), SAMPLE * 2) * DAMPING;
    const roll = Math.atan2(h(SAMPLE, 0) - h(-SAMPLE, 0), SAMPLE * 2) * DAMPING;
    this.euler.set(pitch, 0, roll);
    this.quaternion.setFromEuler(this.euler);
    this.position.set(0, c * DAMPING, 0);
    this.matrix.compose(this.position, this.quaternion, this.scale);
  }

  /** Raft-frame point → swaying render position (in place). */
  apply(point: Vector3): Vector3 {
    return point.applyMatrix4(this.matrix);
  }
}
