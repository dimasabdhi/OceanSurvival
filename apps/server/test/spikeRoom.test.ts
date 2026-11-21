import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { SPIKE_MOVE_SPEED, SPIKE_ROOM_NAME } from "@oceansurvival/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import appConfig from "../src/app.config";
import type { SpikeRoom } from "../src/rooms/SpikeRoom";

/**
 * PHASE 1 SPIKE integration tests: verify Colyseus 0.18 APIs end-to-end
 * (real WebSocket transport via @colyseus/testing + @colyseus/sdk).
 */
describe("SpikeRoom (Colyseus 0.18 spike)", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(appConfig);
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("accepts a valid join and syncs schema-builder state", async () => {
    const room = await colyseus.createRoom<SpikeRoom>(SPIKE_ROOM_NAME, {});
    const client = await colyseus.connectTo(room, { name: "Dimas" });
    await room.waitForNextPatch();
    const serverPlayer = room.state.players.get(client.sessionId);
    expect(serverPlayer?.name).toBe("Dimas");
    expect(client.state.players.get(client.sessionId)?.name).toBe("Dimas");
  });

  it("rejects invalid join options in onAuth (zod)", async () => {
    const room = await colyseus.createRoom<SpikeRoom>(SPIKE_ROOM_NAME, {});
    await expect(colyseus.connectTo(room, { name: "<script>" })).rejects.toThrow();
    await expect(colyseus.connectTo(room, { name: "ok", extra: 1 })).rejects.toThrow();
  });

  it("StateView: private field is visible only to its owner", async () => {
    const room = await colyseus.createRoom<SpikeRoom>(SPIKE_ROOM_NAME, {});
    const alice = await colyseus.connectTo(room, { name: "Alice" });
    const bob = await colyseus.connectTo(room, { name: "Bob" });
    await room.waitForNextPatch();
    await alice.waitForNextPatch();
    await bob.waitForNextPatch();

    const aliceSeenByAlice = alice.state.players.get(alice.sessionId);
    const aliceSeenByBob = bob.state.players.get(alice.sessionId);
    expect(aliceSeenByAlice?.secretNote).toBe(`private-to-${alice.sessionId}`);
    expect(aliceSeenByBob?.name).toBe("Alice");
    expect(aliceSeenByBob?.secretNote).toBeUndefined();
  });

  it("validate(zod): invalid message payload disconnects the client", async () => {
    const room = await colyseus.createRoom<SpikeRoom>(SPIKE_ROOM_NAME, {});
    const client = await colyseus.connectTo(room, { name: "Mallory" });
    const left = new Promise<number>((resolve) => client.onLeave((code: number) => resolve(code)));
    // A modified client bypasses the typed SDK and sends a malformed payload.
    const rawClient = client as unknown as { send(type: string, message: unknown): void };
    rawClient.send("chat", { text: 12345 });
    const code = await left;
    expect(code).toBe(4002);
  });

  it("defineInput + setFixedTimestep: server moves the player from inputs only", async () => {
    const room = await colyseus.createRoom<SpikeRoom>(SPIKE_ROOM_NAME, {});
    const client = await colyseus.connectTo(room, { name: "Runner" });
    await room.waitForNextPatch();

    const input = client.input();
    // 30 fixed steps "forward" (moveZ = -1 with yaw 0 → -Z), plus a speed-hack value (127)
    // that the server sanitize clamps back to 1.
    for (let i = 0; i < 30; i++) {
      input.data.moveX = 0;
      input.data.moveZ = i === 0 ? -127 : -1;
      input.data.yaw = 0;
      input.send();
    }
    // Wait until the server has consumed all 30 inputs.
    for (let i = 0; i < 120; i++) {
      await room.waitForNextTimestep();
      if (Math.abs((room.state.players.get(client.sessionId)?.z ?? 0) + 1.8) < 0.01) break;
    }
    const z = room.state.players.get(client.sessionId)?.z ?? 0;
    // 30 steps × (1/60 s) × 3.6 m/s = 1.8 m, regardless of the hacked first frame.
    expect(z).toBeCloseTo(-(30 / 60) * SPIKE_MOVE_SPEED, 2);
  });
});
