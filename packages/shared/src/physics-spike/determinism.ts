/**
 * PHASE 1 SPIKE — Rapier determinism check (ADR-0003, RISK R2).
 *
 * Builds the same small scene (ground, dynamic boxes, a kinematic character
 * controller driven by seeded inputs), steps it N times at the fixed timestep,
 * and hashes every body transform. The hash must be identical in Node.js (server)
 * and in the browser (client). No Math.sin/cos in scene setup (Rapier docs: those
 * are not cross-platform deterministic).
 */
import RAPIER from "@dimforge/rapier3d-compat";
import { FIXED_DT } from "../constants";
import { createPrng, fnv1aHex } from "../math/prng";

/**
 * Golden hash of {@link runDeterminismScenario}(600, 1337), first recorded in Node.js 24
 * with Rapier 0.21.0. Node (vitest) and the browser (Playwright) must both produce it.
 * If a Rapier upgrade changes it, client/server prediction compatibility must be
 * re-verified before updating this value (ADR-0003).
 */
export const GOLDEN_RAPIER_HASH_600 = "8941d541";

export interface DeterminismResult {
  hash: string;
  steps: number;
  bodies: number;
  rapierVersion: string;
  /** Wall-clock time of the stepping loop only (ms). Informational. */
  stepMs: number;
}

let initPromise: Promise<void> | null = null;
export function initRapier(): Promise<void> {
  initPromise ??= RAPIER.init();
  return initPromise;
}

export async function runDeterminismScenario(steps = 600, seed = 1337): Promise<DeterminismResult> {
  await initRapier();
  const rand = createPrng(seed);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED_DT;

  // Ground
  world.createCollider(RAPIER.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0));

  // Dynamic boxes stacked at seeded positions
  const bodies: RAPIER.RigidBody[] = [];
  for (let i = 0; i < 24; i++) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(
        (rand() - 0.5) * 8,
        1 + i * 0.9,
        (rand() - 0.5) * 8,
      ),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 0.4, 0.4), body);
    bodies.push(body);
  }

  // Kinematic character (capsule) with Rapier's character controller
  const character = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.2, -6),
  );
  const characterCollider = world.createCollider(
    RAPIER.ColliderDesc.capsule(0.55, 0.35),
    character,
  );
  bodies.push(character);
  const controller = world.createCharacterController(0.02);
  controller.enableAutostep(0.3, 0.2, true);
  controller.enableSnapToGround(0.3);
  controller.setApplyImpulsesToDynamicBodies(true);

  const started = performance.now();
  let verticalVelocity = 0;
  for (let s = 0; s < steps; s++) {
    // Seeded "input": change direction every 30 steps
    const dir = Math.floor(s / 30) % 4;
    const speed = 3.6 * FIXED_DT;
    const mx = dir === 0 ? speed : dir === 2 ? -speed : 0;
    const mz = dir === 1 ? speed : dir === 3 ? -speed : 0;
    verticalVelocity = controller.computedGrounded() ? 0 : verticalVelocity - 9.81 * FIXED_DT;
    controller.computeColliderMovement(characterCollider, {
      x: mx,
      y: verticalVelocity * FIXED_DT,
      z: mz,
    });
    const move = controller.computedMovement();
    const p = character.translation();
    character.setNextKinematicTranslation({ x: p.x + move.x, y: p.y + move.y, z: p.z + move.z });
    world.step();
  }
  const stepMs = performance.now() - started;

  const data = new Float32Array(bodies.length * 7);
  bodies.forEach((b, i) => {
    const t = b.translation();
    const r = b.rotation();
    data.set([t.x, t.y, t.z, r.x, r.y, r.z, r.w], i * 7);
  });
  const result: DeterminismResult = {
    hash: fnv1aHex(new Uint8Array(data.buffer)),
    steps,
    bodies: bodies.length,
    rapierVersion: RAPIER.version(),
    stepMs,
  };
  controller.free();
  world.free();
  return result;
}
