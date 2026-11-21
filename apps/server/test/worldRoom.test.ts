import type { ColyseusTestServer } from "@colyseus/testing";
import {
  CHARACTER_CENTER_HEIGHT,
  CloseCodes,
  DEFAULT_WORLD_ID,
  LANTERN_ID,
  MoveMode as Modes,
  MoveMode,
  RAFT_DECK_Y,
  WORLD_ROOM_NAME,
} from "@oceansurvival/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WorldRepository } from "../src/persistence/WorldRepository";
import { bootTestServer, createWorld, joinOptions, newPlayer, sleep, waitFor } from "./helpers";

describe("WorldRoom", () => {
  let colyseus: ColyseusTestServer;
  let repository: WorldRepository;

  beforeAll(async () => {
    ({ colyseus, repository } = await bootTestServer({ RECONNECT_GRACE_SECONDS: "1" }, 2571));
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("spawns a joining player on the deck and replicates it", async () => {
    const room = await createWorld(colyseus);
    const p = newPlayer("Dimas");
    const client = await colyseus.connectTo(room, joinOptions(p));
    await room.waitForNextPatch();
    const server = room.state.players.get(client.sessionId);
    expect(server?.name).toBe("Dimas");
    expect(server?.playerId).toBe(p.playerId);
    expect(server?.y).toBeGreaterThan(RAFT_DECK_Y);
    expect(room.state.raft.velZ).toBeLessThan(0); // drifting (ADR-0014)
    await client.waitForNextPatch();
    expect(client.state.players.get(client.sessionId)?.name).toBe("Dimas");
  });

  it("rejects malformed join options and wrong tokens; accepts the right token", async () => {
    const room = await createWorld(colyseus);
    // Keep the room alive: an empty room is disposed when a join attempt fails.
    await colyseus.connectTo(room, joinOptions(newPlayer("Anchor")));
    const p = newPlayer();
    await expect(
      colyseus.connectTo(room, { ...joinOptions(p), name: "<b>x</b>" }),
    ).rejects.toThrow();
    await expect(colyseus.connectTo(room, { ...joinOptions(p), extra: true })).rejects.toThrow();
    await expect(
      colyseus.connectTo(room, { ...joinOptions(p), worldId: "other" }),
    ).rejects.toThrow();

    const first = await colyseus.connectTo(room, joinOptions(p)); // registers the identity
    await first.leave();
    const impostor = { ...p, token: "f".repeat(64) };
    await expect(colyseus.connectTo(room, joinOptions(impostor))).rejects.toThrow();
    const again = await colyseus.connectTo(room, joinOptions(p));
    expect(again.sessionId).toBeTruthy();
  });

  it("a second session of the same player replaces the first (close 4100)", async () => {
    const room = await createWorld(colyseus);
    const p = newPlayer();
    const tab1 = await colyseus.connectTo(room, joinOptions(p));
    const closed = new Promise<number>((r) => tab1.onLeave((code: number) => r(code)));
    const tab2 = await colyseus.connectTo(room, joinOptions(p));
    expect(await closed).toBe(CloseCodes.DuplicateSession);
    await room.waitForNextPatch();
    expect(room.state.players.size).toBe(1);
    expect(room.state.players.get(tab2.sessionId)?.playerId).toBe(p.playerId);
  });

  it("moves players only through inputs, at most one input per tick on average", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    // Let the player land on the deck first.
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === MoveMode.Grounded);
    const before = room.state.players.get(client.sessionId)?.z ?? 0;

    // Speed hack: dump 200 "forward" inputs at once (3.3 s of movement).
    const input = client.input();
    for (let i = 0; i < 200; i++) {
      input.data.moveZ = 1;
      input.data.moveX = 0;
      input.data.yaw = 0;
      input.data.pitch = 0;
      input.data.buttons = 0;
      input.send();
    }
    const t0 = performance.now();
    await sleep(500);
    const elapsedTicks = ((performance.now() - t0) / 1000) * 60;
    const moved = before - (room.state.players.get(client.sessionId)?.z ?? 0);
    // Max consumed = elapsed ticks + burst credit (4) (+2 slack for timer jitter).
    const maxDistance = ((elapsedTicks + 6) / 60) * 3.6;
    expect(moved).toBeGreaterThan(0.5);
    expect(moved).toBeLessThanOrEqual(maxDistance);
  });

  it("a full world rejects the 5th player instead of opening a second room", async () => {
    const room = await createWorld(colyseus);
    for (let i = 0; i < 4; i++) await colyseus.connectTo(room, joinOptions(newPlayer()));
    await expect(
      colyseus.sdk.joinOrCreate(WORLD_ROOM_NAME, joinOptions(newPlayer())),
    ).rejects.toThrow(/WORLD_FULL/);
    await expect(createWorld(colyseus)).rejects.toThrow(/WORLD_FULL/);
    expect(room.clients.length).toBe(4);
  });

  it("interact.use toggles the lantern within range and line of sight", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === Modes.Grounded);
    expect(room.state.raft.lanternOn).toBe(false);
    client.send("interact.use", { targetId: LANTERN_ID });
    await waitFor(() => room.state.raft.lanternOn === true);
    client.send("interact.use", { targetId: LANTERN_ID });
    await waitFor(() => room.state.raft.lanternOn === false);
  });

  it("interact.use is rejected when the SERVER position is out of range", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === Modes.Grounded);
    const rejects: unknown[] = [];
    client.onMessage("interact.reject", (m: unknown) => rejects.push(m));
    // Teleport the player (server-side) 10 m away into the water.
    const p = room.state.players.get(client.sessionId);
    if (p) {
      p.x = -10;
      p.y = -0.55;
      p.mode = Modes.Swimming;
    }
    client.send("interact.use", { targetId: LANTERN_ID });
    await waitFor(() => rejects.length > 0);
    expect(rejects[0]).toEqual({ targetId: LANTERN_ID, reason: "too-far" });
    expect(room.state.raft.lanternOn).toBe(false);
  });

  it("debris: prefilled on create, sent to nearby players only (StateView AOI)", async () => {
    const room = await createWorld(colyseus);
    expect(room.state.debris.size).toBeGreaterThan(20);
    const near = await colyseus.connectTo(room, joinOptions(newPlayer("Near")));
    const far = await colyseus.connectTo(room, joinOptions(newPlayer("Far")));
    await waitFor(() => near.state.debris?.size > 20);
    // Move "Far" 190 m sideways (server-side), beyond the 120 m AOI of every piece.
    const p = room.state.players.get(far.sessionId);
    if (p) {
      p.x = 190;
      p.y = -0.55;
      p.mode = Modes.Swimming;
    }
    await waitFor(() => far.state.debris?.size === 0, 5000);
    expect(near.state.debris.size).toBeGreaterThan(20);
    // A replicated piece carries world position + spawn time (+ hook owner); no per-tick movement.
    const sample = [...near.state.debris.values()][0];
    expect(Object.keys(sample?.toJSON() ?? {}).sort()).toEqual(
      ["hookId", "kind", "spawnTime", "worldX", "worldZ", "yaw"].sort(),
    );
  });

  it("invalid message payload disconnects the client (4002)", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    const left = new Promise<number>((r) => client.onLeave((code: number) => r(code)));
    (client as unknown as { send(t: string, m: unknown): void }).send("chat.send", { text: 42 });
    expect(await left).toBe(4002);
  });

  it("chat is rate limited and flooding gets the client kicked (4101)", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    const chats: unknown[] = [];
    const notices: unknown[] = [];
    client.onMessage("chat", (m: unknown) => chats.push(m));
    client.onMessage("server.notice", (m: unknown) => notices.push(m));
    const left = new Promise<number>((r) => client.onLeave((code: number) => r(code)));
    for (let i = 0; i < 80; i++) client.send("chat.send", { text: `spam ${i}` });
    expect(await left).toBe(CloseCodes.ProtocolAbuse);
    expect(chats.length).toBeLessThanOrEqual(4); // burst capacity 3 (+1 refill)
    expect(notices).toContainEqual({ kind: "rate-limited" });
  });

  it("an unexpected drop reconnects automatically with identity and position intact", async () => {
    const room = await createWorld(colyseus);
    const client = await colyseus.connectTo(room, joinOptions(newPlayer()));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === MoveMode.Grounded);
    const before = { ...room.state.players.get(client.sessionId)?.toJSON() };
    // SDK default: no auto-reconnect within 5 s of joining (minUptime). Tests join fresh.
    client.reconnection.minUptime = 0;
    const reconnected = new Promise<void>((r) => client.onReconnect(() => r()));
    client.leave(false); // simulate an unexpected network drop
    await waitFor(() => room.state.players.get(client.sessionId)?.connected === false);
    await reconnected;
    await waitFor(() => room.state.players.get(client.sessionId)?.connected === true);
    const after = room.state.players.get(client.sessionId);
    expect(after?.playerId).toBe(before.playerId);
    expect(after?.x).toBe(before.x);
    expect(after?.z).toBe(before.z);
  });

  it("a player who stays away past the grace period is removed and saved", async () => {
    const room = await createWorld(colyseus);
    const p = newPlayer();
    const client = await colyseus.connectTo(room, joinOptions(p));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === MoveMode.Grounded);
    client.reconnection.enabled = false;
    client.leave(false);
    await waitFor(() => room.state.players.size === 0, 5000);
    const saved = await repository.loadWorld(DEFAULT_WORLD_ID);
    expect(saved?.players[p.playerId]?.position?.y).toBeCloseTo(
      RAFT_DECK_Y + CHARACTER_CENTER_HEIGHT,
      1,
    );
  });

  it("onBeforeShutdown saves the world; a new room restores the player's position", async () => {
    const room = await createWorld(colyseus);
    const p = newPlayer();
    const client = await colyseus.connectTo(room, joinOptions(p));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === MoveMode.Grounded);
    const input = client.input();
    for (let i = 0; i < 8; i++) {
      input.data.moveX = 1;
      input.data.moveZ = 0;
      input.data.yaw = 0;
      input.data.pitch = 0;
      input.data.buttons = 0;
      input.send();
    }
    const x0 = room.state.players.get(client.sessionId)?.x ?? 0;
    await waitFor(() => (room.state.players.get(client.sessionId)?.x ?? 0) > x0 + 0.4);
    await sleep(100);
    const x = room.state.players.get(client.sessionId)?.x ?? 0;
    await room.onBeforeShutdown();
    await waitFor(() => colyseus.getRoomById(room.roomId) === undefined, 5000).catch(
      () => undefined,
    );

    const saved = await repository.loadWorld(DEFAULT_WORLD_ID);
    expect(saved?.players[p.playerId]?.position?.x).toBeCloseTo(x, 3);

    const room2 = await createWorld(colyseus);
    const client2 = await colyseus.connectTo(room2, joinOptions(p));
    await room2.waitForNextPatch();
    expect(room2.state.players.get(client2.sessionId)?.x).toBeCloseTo(x, 3);
  });
});
