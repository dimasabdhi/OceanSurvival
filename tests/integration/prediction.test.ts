/**
 * Phase 2 acceptance test (ACCEPTANCE_CRITERIA Phase 2, ADR-0005/0013):
 * the REAL client networking stack (WorldConnection: Colyseus Predict + shared
 * stepCharacter) against the REAL WorldRoom over WebSocket, with 150 ms simulated
 * round-trip latency. Measures reconcile corrections.
 */
import type { ColyseusTestServer } from "@colyseus/testing";
import {
  Buttons,
  DEFAULT_WORLD_ID,
  initPhysics,
  MoveMode,
  MovementWorld,
  type PlayerState,
  WATER_FLOW,
} from "@oceansurvival/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Pose, WorldConnection } from "../../apps/client/src/net/WorldConnection";
import { bootTestServer, newPlayer, sleep, waitFor } from "../../apps/server/test/helpers";

type InputData = { moveX: number; moveZ: number; yaw: number; pitch: number; buttons: number };

/** Drives `conn.frame` at ~60 FPS for `ms`, using `script(tMs)` as the player's input. */
async function drive(
  conn: WorldConnection,
  ms: number,
  script: (tMs: number, out: InputData) => void,
): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) {
    const t = performance.now() - start;
    conn.frame(performance.now(), (out) => script(t, out));
    await sleep(16);
  }
}

const pose = (): Pose => ({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 0 });

describe("client prediction vs authoritative server (RTT 150 ms)", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    ({ colyseus } = await bootTestServer({}, 2572));
    colyseus.server.simulateLatency(150);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });

  it("predicts the local player with small corrections and converges exactly", async () => {
    const events: string[] = [];
    const conn = await WorldConnection.connect(
      colyseus.sdk as never,
      DEFAULT_WORLD_ID,
      newPlayer("Predictor"),
      "Predictor",
      (e) => events.push(e.type),
    );
    const watcher = await WorldConnection.connect(
      colyseus.sdk as never,
      DEFAULT_WORLD_ID,
      newPlayer("Watcher"),
      "Watcher",
      () => undefined,
    );
    const p = pose();
    await waitFor(() => conn.localPose(p) !== null, 5000);

    // Settle on the deck (stall-idle steps run server-side until inputs arrive).
    await drive(conn, 800, (_t, o) =>
      Object.assign(o, { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 }),
    );
    conn.takeCorrectionStats();

    // 1) Straight walk: the AC "no snap > 25 cm while moving straight".
    await drive(conn, 1500, (_t, o) =>
      Object.assign(o, { moveX: 0, moveZ: 1, yaw: Math.fround(Math.PI / 2), pitch: 0, buttons: 0 }),
    );
    const straight = conn.takeCorrectionStats();

    // 2) Mixed: strafes, sprint, jumps, turning, walking off the deck into the water.
    await drive(conn, 2500, (t, o) => {
      const phase = Math.floor(t / 400) % 4;
      o.moveX = phase === 1 ? 1 : phase === 3 ? -1 : 0;
      o.moveZ = phase === 0 || phase === 2 ? 1 : 0;
      o.yaw = Math.fround(Math.sin(t / 900) * 2.5);
      o.pitch = 0;
      o.buttons =
        (Math.floor(t / 600) % 2 === 0 ? Buttons.Sprint : 0) | (t % 700 < 40 ? Buttons.Jump : 0);
    });
    const mixed = conn.takeCorrectionStats();

    // Stop and let all inputs be acknowledged.
    await drive(conn, 1200, (_t, o) => Object.assign(o, { moveX: 0, moveZ: 0, buttons: 0 }));

    const local = conn.localPose(pose());
    const authoritative = conn.room.state.players.get(conn.sessionId) as PlayerState;

    console.info("[prediction] straight", straight, "mixed", mixed);
    expect(straight.count).toBeGreaterThan(10);
    expect(straight.avg).toBeLessThan(0.05);
    expect(straight.max).toBeLessThan(0.25);
    expect(mixed.avg).toBeLessThan(0.05);
    // Converged: once idle, the predicted pose equals the authoritative state — exactly
    // on the raft; a swimmer keeps drifting with the current (ADR-0014), so the latest
    // received server state lags by about one round trip of drift.
    const drifting = authoritative.mode === MoveMode.Swimming;
    const tolerance = drifting ? Math.hypot(...WATER_FLOW) * 0.4 : 0.005;
    expect(Math.abs((local?.x ?? 0) - authoritative.x)).toBeLessThan(tolerance);
    expect(Math.abs((local?.y ?? 0) - authoritative.y)).toBeLessThan(0.005);
    expect(Math.abs((local?.z ?? 0) - authoritative.z)).toBeLessThan(tolerance);

    // The other client sees this player (interpolated, 100 ms behind) near the same place.
    const remote = watcher.room.state.players.get(conn.sessionId) as PlayerState;
    const seen = watcher.readPose(remote, pose());
    expect(Math.hypot(seen.x - authoritative.x, seen.z - authoritative.z)).toBeLessThan(
      drifting ? tolerance : 0.1,
    );
    expect([MoveMode.Grounded, MoveMode.Swimming]).toContain(authoritative.mode);
    expect(events).toContain("status");

    await conn.leave();
    await watcher.leave();
    conn.dispose();
    watcher.dispose();
  }, 30_000);

  it("raft round trip: walk off, dive, swim back, leap onto the raft — zero corrections", async () => {
    const conn = await WorldConnection.connect(
      colyseus.sdk as never,
      DEFAULT_WORLD_ID,
      newPlayer("RoundTrip"),
      "RoundTrip",
      () => undefined,
    );
    const p = pose();
    await waitFor(() => conn.localPose(p) !== null, 5000);
    const idleCmd = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 };
    await drive(conn, 600, (_t, o) => Object.assign(o, idleCmd));
    conn.takeCorrectionStats();

    // 1) Walk forward (-Z) off the raft into the water.
    await drive(conn, 1200, (_t, o) => Object.assign(o, { ...idleCmd, moveZ: 1 }));
    // 2) Dive for 0.6 s, then float up.
    await drive(conn, 600, (_t, o) => Object.assign(o, { ...idleCmd, buttons: Buttons.Dive }));
    await drive(conn, 1500, (_t, o) => Object.assign(o, idleCmd));
    // 3) Turn around (+Z), swim back and leap when close to the raft edge.
    const back = Math.fround(Math.PI);
    await drive(conn, 4000, (_t, o) => {
      const now = conn.localPose(pose());
      const nearEdge = (now?.z ?? -99) > -2.3 && now?.mode === MoveMode.Swimming;
      const onRaft = now?.mode === MoveMode.Grounded;
      Object.assign(o, {
        ...idleCmd,
        yaw: back,
        moveZ: onRaft ? 0 : 1,
        buttons: nearEdge ? Buttons.Jump : 0,
      });
    });
    const stats = conn.takeCorrectionStats();
    const final = conn.localPose(pose());
    console.info("[prediction] raft round trip", stats, final);
    expect(stats.count).toBeGreaterThan(20);
    expect(stats.max).toBeLessThan(0.01);
    expect(final?.mode).toBe(MoveMode.Grounded);
    await conn.leave();
    conn.dispose();
  }, 30_000);

  it("control: a client simulating different geometry IS corrected (the metric works)", async () => {
    const conn = await WorldConnection.connect(
      colyseus.sdk as never,
      DEFAULT_WORLD_ID,
      newPlayer("Diverger"),
      "Diverger",
      () => undefined,
    );
    // Deliberately break determinism: the client's collision world has no deck.
    await initPhysics();
    (conn as unknown as { movement: MovementWorld }).movement = new MovementWorld([]);
    const p = pose();
    await waitFor(() => conn.localPose(p) !== null, 5000);
    await drive(conn, 1500, (_t, o) =>
      Object.assign(o, { moveX: 0, moveZ: 1, yaw: 0, pitch: 0, buttons: 0 }),
    );
    const stats = conn.takeCorrectionStats();
    console.info("[prediction] control (diverging)", stats);
    expect(stats.max).toBeGreaterThan(0.25);
    await conn.leave();
  }, 30_000);
});
