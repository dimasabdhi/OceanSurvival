/**
 * Shared, deterministic player movement (ADR-0005, ADR-0013).
 *
 * `stepCharacter` is THE step function: the server runs it for every consumed input,
 * and the client's Colyseus `predict.reconciler` runs the very same function for
 * prediction and rollback replay. Rules (Colyseus "Determinism & The Contract"):
 * - read only `state` + `cmd` + `dt` (+ the static collision world);
 * - no Math.random / Date.now / external mutable state;
 * - results are rounded to float32 (Math.fround) because the state is replicated as
 *   float32 — so server memory and the client's adopted values are bit-identical.
 *
 * Collision uses Rapier's KinematicCharacterController as a pure query against STATIC
 * geometry only. Characters never collide with each other (co-op; avoids predicting
 * other players' positions), enforced with interaction groups.
 */
import RAPIER from "@dimforge/rapier3d-compat";
import type { BoxDef } from "../world/testLevel";
import {
  Buttons,
  CHARACTER,
  KILL_PLANE_Y,
  MoveMode,
  SWIM_CENTER_DEPTH,
  WATER_LEVEL,
} from "./constants";

export interface CharacterState {
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  mode: number;
}

export interface CharacterCommand {
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  buttons: number;
}

/** Fields mirrored by the client reconciler (everything the step reads or writes). */
export const CHARACTER_STATE_FIELDS = ["x", "y", "z", "vy", "yaw", "pitch", "mode"] as const;

// Interaction groups: high 16 bits = membership, low 16 bits = filter.
const GROUP_STATIC = 0x0001;
const GROUP_CHARACTER = 0x0002;
const STATIC_GROUPS = (GROUP_STATIC << 16) | 0xffff;
const CHARACTER_GROUPS = (GROUP_CHARACTER << 16) | GROUP_STATIC;

let rapierReady: Promise<void> | null = null;
/** Initialise the Rapier WASM module once (both client and server). */
export function initPhysics(): Promise<void> {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

/** A collision body for one character inside a {@link MovementWorld}. */
export interface CharacterBody {
  readonly collider: RAPIER.Collider;
}

/**
 * Static collision world + one shared Rapier character controller.
 * Call {@link initPhysics} before constructing.
 */
export class MovementWorld {
  readonly world: RAPIER.World;
  private readonly controller: RAPIER.KinematicCharacterController;
  private readonly characters = new Set<RAPIER.Collider>();

  constructor(boxes: readonly BoxDef[]) {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    for (const b of boxes) {
      const desc = RAPIER.ColliderDesc.cuboid(b.halfExtents[0], b.halfExtents[1], b.halfExtents[2])
        .setTranslation(b.center[0], b.center[1], b.center[2])
        .setCollisionGroups(STATIC_GROUPS);
      this.world.createCollider(desc);
    }
    const c = this.world.createCharacterController(CHARACTER.skinOffset);
    c.setUp({ x: 0, y: 1, z: 0 });
    c.setMaxSlopeClimbAngle((CHARACTER.maxSlopeDeg * Math.PI) / 180);
    c.enableAutostep(CHARACTER.autostepHeight, CHARACTER.autostepMinWidth, false);
    c.enableSnapToGround(CHARACTER.snapToGround);
    c.setSlideEnabled(true);
    this.controller = c;
    // Build the broad-phase/query structures for the static colliders.
    this.world.step();
  }

  createCharacter(): CharacterBody {
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(CHARACTER.halfHeight, CHARACTER.radius).setCollisionGroups(
        CHARACTER_GROUPS,
      ),
    );
    this.characters.add(collider);
    return { collider };
  }

  removeCharacter(body: CharacterBody): void {
    this.characters.delete(body.collider);
    this.world.removeCollider(body.collider, false);
  }

  /**
   * Moves `body` (placed at `from`) by `desired`, sliding along static geometry.
   * Writes the actual translation into `out` and returns whether it ended grounded.
   */
  move(
    body: CharacterBody,
    from: { x: number; y: number; z: number },
    desired: { x: number; y: number; z: number },
    out: { x: number; y: number; z: number },
  ): boolean {
    body.collider.setTranslation(from);
    this.controller.computeColliderMovement(
      body.collider,
      desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      CHARACTER_GROUPS,
      (other) => !this.characters.has(other),
    );
    const m = this.controller.computedMovement();
    out.x = m.x;
    out.y = m.y;
    out.z = m.z;
    return this.controller.computedGrounded();
  }

  dispose(): void {
    this.controller.free();
    this.world.free();
  }
}

const desired = { x: 0, y: 0, z: 0 };
const moved = { x: 0, y: 0, z: 0 };
const swimCenterY = WATER_LEVEL - SWIM_CENTER_DEPTH;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : Number.isNaN(v) ? lo : v;
}

/** Advances one character by one fixed step. Mutates `s`. */
export function stepCharacter(
  world: MovementWorld,
  body: CharacterBody,
  s: CharacterState,
  cmd: CharacterCommand,
  dt: number,
): void {
  s.yaw = Math.fround(cmd.yaw);
  s.pitch = Math.fround(clamp(cmd.pitch, -CHARACTER.maxPitch, CHARACTER.maxPitch));

  // Horizontal intent in local space: +moveX = right, +moveZ = forward.
  let mx = clamp(cmd.moveX, -1, 1);
  let mz = clamp(cmd.moveZ, -1, 1);
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const sin = Math.sin(s.yaw);
  const cos = Math.cos(s.yaw);
  // Camera looks along -Z at yaw 0. forward = (-sin, 0, -cos), right = (cos, 0, -sin).
  const wx = cos * mx - sin * mz;
  const wz = -sin * mx - cos * mz;

  const swimming = s.mode === MoveMode.Swimming;
  const jump = (cmd.buttons & Buttons.Jump) !== 0;
  const sprint = (cmd.buttons & Buttons.Sprint) !== 0;
  const speed = swimming
    ? CHARACTER.swimSpeed
    : sprint && s.mode === MoveMode.Grounded
      ? CHARACTER.sprintSpeed
      : CHARACTER.walkSpeed;

  let vy = s.vy;
  let dy: number;
  if (swimming) {
    if (jump) {
      vy = CHARACTER.swimLeapSpeed;
      dy = vy * dt;
    } else {
      vy = 0;
      // Buoyancy: ease the capsule center toward the swim depth (max 2 m/s).
      dy = clamp(swimCenterY - s.y, -2 * dt, 2 * dt);
    }
  } else {
    if (jump && s.mode === MoveMode.Grounded) vy = CHARACTER.jumpSpeed;
    vy = Math.max(vy - CHARACTER.gravity * dt, -CHARACTER.maxFallSpeed);
    dy = vy * dt;
  }

  desired.x = wx * speed * dt;
  desired.y = dy;
  desired.z = wz * speed * dt;
  const grounded = world.move(body, s, desired, moved);

  s.x = Math.fround(s.x + moved.x);
  s.y = Math.fround(s.y + moved.y);
  s.z = Math.fround(s.z + moved.z);

  // Head bump / landing: stop vertical velocity when the move was blocked.
  if ((vy > 0 && moved.y < desired.y - 1e-4) || (grounded && vy < 0)) vy = 0;

  const leaping = swimming && jump;
  if (!leaping && !grounded && vy <= 0 && s.y <= swimCenterY + 0.05) {
    s.mode = MoveMode.Swimming;
    vy = 0;
  } else if (!leaping && swimming && !grounded && vy === 0) {
    s.mode = MoveMode.Swimming;
  } else {
    s.mode = grounded ? MoveMode.Grounded : MoveMode.Airborne;
  }
  s.vy = Math.fround(vy);
}

/** True if the character fell out of the world and must be respawned (server decides). */
export function isBelowKillPlane(s: CharacterState): boolean {
  return s.y < KILL_PLANE_Y;
}
