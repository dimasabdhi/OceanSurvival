import { beforeAll, describe, expect, it } from "vitest";
import { FIXED_DT } from "../constants";
import { createPrng } from "../math/prng";
import { TEST_LEVEL, TEST_PLATFORM_TOP_Y } from "../world/testLevel";
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

const onDeck = (): CharacterState => ({
  x: 0,
  y: TEST_PLATFORM_TOP_Y + CHARACTER_CENTER_HEIGHT + 0.05,
  z: 0,
  vy: 0,
  yaw: 0,
  pitch: 0,
  mode: MoveMode.Airborne,
});
const idle: CharacterCommand = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 };

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
        buttons: (rand() < 0.15 ? Buttons.Jump : 0) | (rand() < 0.5 ? Buttons.Sprint : 0),
      };
    }
    out.push(cmd);
  }
  return out;
}

describe("stepCharacter", () => {
  let world: MovementWorld;
  beforeAll(async () => {
    await initPhysics();
    world = new MovementWorld(TEST_LEVEL.boxes);
  });

  it("settles on the deck and becomes grounded", () => {
    const s = run(world, onDeck(), Array(30).fill(idle));
    expect(s.mode).toBe(MoveMode.Grounded);
    expect(s.y).toBeCloseTo(TEST_PLATFORM_TOP_Y + CHARACTER_CENTER_HEIGHT, 1);
  });

  it("walks forward (-Z at yaw 0) at walk speed", () => {
    const s = run(world, onDeck(), Array(60).fill({ ...idle, moveZ: 1 }));
    // 1 s at 3.6 m/s, minus settling; the deck is 4 m half-width so no edge reached.
    expect(s.z).toBeLessThan(-3.3);
    expect(s.z).toBeGreaterThan(-3.7);
    expect(Math.abs(s.x)).toBeLessThan(1e-3);
  });

  it("sprint is faster than walk", () => {
    const walk = run(world, onDeck(), Array(40).fill({ ...idle, moveZ: 1 }));
    const sprint = run(
      world,
      onDeck(),
      Array(40).fill({ ...idle, moveZ: 1, buttons: Buttons.Sprint }),
    );
    expect(-sprint.z).toBeGreaterThan(-walk.z * 1.3);
  });

  it("jump reaches about 1.1 m", () => {
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

  it("walking off the deck ends up swimming at the surface", () => {
    const s = run(world, onDeck(), Array(240).fill({ ...idle, moveZ: 1 }));
    expect(s.mode).toBe(MoveMode.Swimming);
    expect(s.y).toBeCloseTo(-SWIM_CENTER_DEPTH, 1);
    expect(s.z).toBeLessThan(-4.5);
  });

  it("can leap from the water back onto the deck", () => {
    // Swim 0.6 m off the deck edge (deck spans z ∈ [-4, 4]), facing it.
    const s: CharacterState = {
      x: 0,
      y: -SWIM_CENTER_DEPTH,
      z: -4.0 - CHARACTER.radius - 0.3,
      vy: 0,
      yaw: Math.PI,
      pitch: 0,
      mode: MoveMode.Swimming,
    };
    const cmds: CharacterCommand[] = [
      { ...idle, yaw: Math.fround(Math.PI), moveZ: 1, buttons: Buttons.Jump },
    ];
    for (let i = 0; i < 90; i++) cmds.push({ ...idle, yaw: Math.fround(Math.PI), moveZ: 1 });
    run(world, s, cmds);
    expect(s.mode).toBe(MoveMode.Grounded);
    expect(s.y).toBeGreaterThan(TEST_PLATFORM_TOP_Y);
  });

  it("is deterministic: identical results across worlds with other characters present", () => {
    const cmds = randomCommands(3000, 99);
    const a = run(world, onDeck(), cmds);
    // A second world that also contains 3 other characters standing in the way.
    const crowded = new MovementWorld(TEST_LEVEL.boxes);
    const others = [
      crowded.createCharacter(),
      crowded.createCharacter(),
      crowded.createCharacter(),
    ];
    for (const [i, o] of others.entries()) {
      o.collider.setTranslation({ x: i * 0.5, y: 1.5, z: -1 });
    }
    crowded.world.step();
    const b = run(crowded, onDeck(), cmds);
    crowded.dispose();
    expect(b).toEqual(a);
  });
});
