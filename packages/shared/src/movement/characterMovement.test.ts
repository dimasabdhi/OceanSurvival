import { beforeAll, describe, expect, it } from "vitest";
import { FIXED_DT } from "../constants";
import { createPrng } from "../math/prng";
import { CELL_SIZE, RAFT_COLLIDERS, RAFT_DECK_Y, WATER_FLOW } from "../world/raft";
import {
  type CharacterCommand,
  type CharacterState,
  initPhysics,
  MovementWorld,
  stepCharacter,
} from "./characterMovement";
import {
  Buttons,
  CHARACTER,
  CHARACTER_CENTER_HEIGHT,
  MoveMode,
  SWIM_CENTER_DEPTH,
} from "./constants";

const STAND_Y = RAFT_DECK_Y + CHARACTER_CENTER_HEIGHT;
const RAFT_HALF = CELL_SIZE; // 2×2 cells centered on the origin → half width 1.5 m

const onDeck = (x = 0, z = 0): CharacterState => ({
  x,
  y: STAND_Y + 0.05,
  z,
  vy: 0,
  yaw: 0,
  pitch: 0,
  mode: MoveMode.Airborne,
});
const idle: CharacterCommand = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 };
const repeat = (cmd: CharacterCommand, n: number) => Array<CharacterCommand>(n).fill(cmd);

function run(world: MovementWorld, s: CharacterState, cmds: CharacterCommand[]): CharacterState {
  const body = world.createCharacter();
  for (const c of cmds) stepCharacter(world, body, s, c, FIXED_DT);
  world.removeCharacter(body);
  return s;
}

function randomCommands(n: number, seed: number): CharacterCommand[] {
  const rand = createPrng(seed);
  const out: CharacterCommand[] = [];
  let cmd = { ...idle };
  for (let i = 0; i < n; i++) {
    if (i % 20 === 0) {
      cmd = {
        moveX: Math.round(rand() * 2 - 1),
        moveZ: Math.round(rand() * 2 - 1),
        yaw: Math.fround((rand() * 2 - 1) * Math.PI),
        pitch: Math.fround((rand() - 0.5) * 2),
        buttons:
          (rand() < 0.15 ? Buttons.Jump : 0) |
          (rand() < 0.5 ? Buttons.Sprint : 0) |
          (rand() < 0.2 ? Buttons.Dive : 0),
      };
    }
    out.push(cmd);
  }
  return out;
}

describe("stepCharacter on the starting raft (raft frame, ADR-0014)", () => {
  let world: MovementWorld;
  beforeAll(async () => {
    await initPhysics();
    world = new MovementWorld(RAFT_COLLIDERS);
  });

  it("settles on the deck, grounded, and does not slide when idle", () => {
    const s = run(world, onDeck(0.3, -0.4), repeat(idle, 600));
    expect(s.mode).toBe(MoveMode.Grounded);
    expect(s.y).toBeCloseTo(STAND_Y, 1);
    expect(s.x).toBeCloseTo(0.3, 4);
    expect(s.z).toBeCloseTo(-0.4, 4);
  });

  it("does not creep when idle on the seam where four foundations meet", () => {
    for (const [x, z] of [
      [0, 0],
      [0.2, 0.2],
      [0, -0.6],
    ] as const) {
      const s = run(world, onDeck(x, z), repeat(idle, 3600)); // 60 s
      expect(s.mode).toBe(MoveMode.Grounded);
      expect(s.x).toBe(Math.fround(x));
      expect(s.z).toBe(Math.fround(z));
    }
  });

  it("walks at walk speed and sprints faster", () => {
    const walk = run(world, onDeck(0, 1), repeat({ ...idle, moveZ: 1 }, 20));
    expect(1 - walk.z).toBeCloseTo((20 / 60) * CHARACTER.walkSpeed, 1);
    const sprint = run(
      world,
      onDeck(0, 1),
      repeat({ ...idle, moveZ: 1, buttons: Buttons.Sprint }, 20),
    );
    expect(1 - sprint.z).toBeGreaterThan((1 - walk.z) * 1.3);
  });

  it("crosses the seams between foundations without bumps", () => {
    // Walk along +x from x = -1.2 to ~1.0 at z = -0.5 (crosses the x = 0 seam).
    const s = onDeck(-1.2, -0.5);
    const body = world.createCharacter();
    for (let i = 0; i < 20; i++) stepCharacter(world, body, s, idle, FIXED_DT);
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < 36; i++) {
      stepCharacter(world, body, s, { ...idle, moveX: 1 }, FIXED_DT);
      minY = Math.min(minY, s.y);
      maxY = Math.max(maxY, s.y);
      expect(s.mode).toBe(MoveMode.Grounded);
    }
    world.removeCharacter(body);
    expect(s.x).toBeGreaterThan(0.8);
    expect(maxY - minY).toBeLessThan(0.01);
  });

  it("jump reaches about 1.1 m and lands on the deck", () => {
    const s = onDeck();
    const body = world.createCharacter();
    for (let i = 0; i < 20; i++) stepCharacter(world, body, s, idle, FIXED_DT);
    const baseY = s.y;
    let maxY = s.y;
    stepCharacter(world, body, s, { ...idle, buttons: Buttons.Jump }, FIXED_DT);
    for (let i = 0; i < 60; i++) {
      stepCharacter(world, body, s, idle, FIXED_DT);
      maxY = Math.max(maxY, s.y);
    }
    world.removeCharacter(body);
    expect(maxY - baseY).toBeGreaterThan(1.0);
    expect(maxY - baseY).toBeLessThan(1.2);
    expect(s.mode).toBe(MoveMode.Grounded);
  });

  it("walking off the raft ends up swimming, then the current carries the swimmer", () => {
    const s = run(world, onDeck(), repeat({ ...idle, moveZ: 1 }, 90)); // forward = -Z
    expect(s.mode).toBe(MoveMode.Swimming);
    expect(s.y).toBeCloseTo(-SWIM_CENTER_DEPTH, 1);
    const zBefore = s.z;
    const xBefore = s.x;
    run(world, s, repeat(idle, 60)); // 1 s idle in the water
    expect(s.z - zBefore).toBeCloseTo(WATER_FLOW[1], 2);
    expect(s.x - xBefore).toBeCloseTo(WATER_FLOW[0], 2);
  });

  it("can leap from the water back onto the raft", () => {
    const yawToRaft = Math.fround(Math.PI); // facing +Z
    const s: CharacterState = {
      x: 0,
      y: -SWIM_CENTER_DEPTH,
      z: -RAFT_HALF - CHARACTER.radius - 0.3,
      vy: 0,
      yaw: yawToRaft,
      pitch: 0,
      mode: MoveMode.Swimming,
    };
    const cmds: CharacterCommand[] = [{ ...idle, yaw: yawToRaft, moveZ: 1, buttons: Buttons.Jump }];
    // Push toward the raft while rising, then wait for the landing (~1 s of air time).
    cmds.push(...repeat({ ...idle, yaw: yawToRaft, moveZ: 1 }, 30));
    cmds.push(...repeat({ ...idle, yaw: yawToRaft }, 60));
    run(world, s, cmds);
    expect(s.mode).toBe(MoveMode.Grounded);
    expect(s.y).toBeCloseTo(STAND_Y, 1);
  });

  it("dives while holding Dive and floats back up when released", () => {
    const s: CharacterState = {
      x: 6,
      y: -SWIM_CENTER_DEPTH,
      z: 0,
      vy: 0,
      yaw: 0,
      pitch: 0,
      mode: MoveMode.Swimming,
    };
    run(world, s, repeat({ ...idle, buttons: Buttons.Dive }, 60));
    expect(s.mode).toBe(MoveMode.Diving);
    expect(s.y).toBeCloseTo(-SWIM_CENTER_DEPTH - CHARACTER.swimVerticalSpeed, 1);
    run(world, s, repeat(idle, 60 * 5));
    expect(s.mode).toBe(MoveMode.Swimming);
    expect(s.y).toBeCloseTo(-SWIM_CENTER_DEPTH, 1);
  });

  it("is deterministic: identical results across worlds with other characters present", () => {
    const cmds = randomCommands(3000, 99);
    const a = run(world, onDeck(), cmds);
    const crowded = new MovementWorld(RAFT_COLLIDERS);
    const others = [
      crowded.createCharacter(),
      crowded.createCharacter(),
      crowded.createCharacter(),
    ];
    for (const [i, o] of others.entries()) {
      o.collider.setTranslation({ x: i * 0.5 - 0.5, y: STAND_Y, z: 0.4 });
    }
    crowded.world.step();
    const b = run(crowded, onDeck(), cmds);
    crowded.dispose();
    expect(b).toEqual(a);
  });
});
