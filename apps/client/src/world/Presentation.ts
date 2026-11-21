import {
  CALM_WAVES,
  CELL_SIZE,
  CHARACTER,
  MoveMode,
  RAFT_DECK_Y,
  sampleWaveHeight,
  WATER_LEVEL,
} from "@oceansurvival/shared";
import { type Quaternion, Vector3 } from "three";
import type { Pose } from "../net/WorldConnection";
import type { RaftSway } from "./RaftSway";

/**
 * Maps simulated (raft-frame, flat-water) poses to what is drawn: players on the raft
 * sway with it, swimmers ride the visual waves, the camera gets an optional head bob.
 * VISUAL ONLY — never feeds back into gameplay (ADR-0014).
 */
const RAFT_FOOTPRINT = CELL_SIZE + 0.6; // half-size of the 2×2 raft + margin

export class Presentation {
  headBobEnabled = true;
  private bobPhase = 0;
  private bobAmount = 0;
  private readonly lastLocal = new Vector3(Number.NaN, 0, 0);
  private readonly tmp = new Vector3();

  constructor(private readonly sway: RaftSway) {}

  /** True if a pose should ride the raft's sway. */
  onRaft(p: Pose): boolean {
    return (
      (p.mode === MoveMode.Grounded || p.mode === MoveMode.Airborne) &&
      Math.abs(p.x) < RAFT_FOOTPRINT &&
      Math.abs(p.z) < RAFT_FOOTPRINT &&
      p.y > RAFT_DECK_Y - 0.5
    );
  }

  /** Visual wave height (relative to mean sea level) at a raft-frame position. */
  waveHeight(x: number, z: number, worldTime: number, raftX: number, raftZ: number): number {
    return sampleWaveHeight(CALM_WAVES, raftX + x, raftZ + z, worldTime, 0) - WATER_LEVEL;
  }

  /** Render position of a capsule center `p` (raft frame) into `out`. */
  bodyPosition(p: Pose, worldTime: number, raftX: number, raftZ: number, out: Vector3): Vector3 {
    out.set(p.x, p.y, p.z);
    if (this.onRaft(p)) return this.sway.apply(out);
    if (p.mode === MoveMode.Swimming) out.y += this.waveHeight(p.x, p.z, worldTime, raftX, raftZ);
    return out;
  }

  /**
   * Camera eye position + orientation for the local player. `look` is the player's own
   * yaw/pitch quaternion; when on the raft the raft's sway rotation is applied on top.
   */
  camera(
    p: Pose,
    look: Quaternion,
    dt: number,
    worldTime: number,
    raftX: number,
    raftZ: number,
    outPos: Vector3,
    outQuat: Quaternion,
  ): void {
    // Head bob from horizontal speed while grounded.
    let speed = 0;
    if (!Number.isNaN(this.lastLocal.x) && dt > 0) {
      speed = Math.hypot(p.x - this.lastLocal.x, p.z - this.lastLocal.z) / dt;
    }
    this.lastLocal.set(p.x, p.y, p.z);
    const walking = p.mode === MoveMode.Grounded && speed > 0.5 && speed < 10;
    const target = walking && this.headBobEnabled ? Math.min(speed / CHARACTER.walkSpeed, 1.4) : 0;
    this.bobAmount += (target - this.bobAmount) * Math.min(1, dt * 8);
    this.bobPhase += speed * dt * 0.9;
    const bobY = Math.sin(this.bobPhase * Math.PI * 2) * 0.035 * this.bobAmount;

    outPos.set(p.x, p.y + CHARACTER.eyeOffset + bobY, p.z);
    outQuat.copy(look);
    if (this.onRaft(p)) {
      this.sway.apply(outPos);
      outQuat.premultiply(this.sway.quaternion);
    } else if (p.mode === MoveMode.Swimming) {
      outPos.y += this.waveHeight(p.x, p.z, worldTime, raftX, raftZ);
    }
  }

  /** True when the camera is below the visual water surface. */
  isUnderwater(cameraPos: Vector3, worldTime: number, raftX: number, raftZ: number): boolean {
    this.tmp.copy(cameraPos);
    return cameraPos.y < this.waveHeight(cameraPos.x, cameraPos.z, worldTime, raftX, raftZ) - 0.05;
  }
}
