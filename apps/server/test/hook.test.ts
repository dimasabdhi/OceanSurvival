import type { ColyseusTestServer } from "@colyseus/testing";
import {
  Debris,
  DebrisKind,
  eyePosition,
  HOOK,
  HookPhase,
  hookFlightPosition,
  hookLandingTime,
  hookLaunch,
  MoveMode,
  raftWorldPosition,
} from "@oceansurvival/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { WorldRoom } from "../src/rooms/WorldRoom";
import { bootTestServer, createWorld, joinOptions, newPlayer, sleep, waitFor } from "./helpers";

/** Puts a debris piece exactly where `sessionId`'s next full-power throw will land. */
function placeDebrisAtLanding(room: WorldRoom, sessionId: string, id: string, power = 0.3): void {
  const p = room.state.players.get(sessionId);
  if (!p) throw new Error("no player");
  const l = hookLaunch(eyePosition(p), p.yaw, p.pitch, power);
  const t = hookLandingTime(l);
  const [lx, , lz] = hookFlightPosition(l, t);
  // Debris is static in the world; the hook lands at (lx, lz) in the raft frame at now + t.
  const [rx, rz] = raftWorldPosition(room.state.raft, room.worldTime() + t);
  const d = new Debris();
  d.kind = DebrisKind.Driftwood;
  d.worldX = rx + lx;
  d.worldZ = rz + lz;
  d.spawnTime = room.worldTime();
  room.state.debris.set(id, d);
}

describe("Hook (Grapple Line)", () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    ({ colyseus } = await bootTestServer({}, 2573));
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  async function grounded(room: WorldRoom, name: string) {
    const client = await colyseus.connectTo(room, joinOptions(newPlayer(name)));
    await waitFor(() => room.state.players.get(client.sessionId)?.mode === MoveMode.Grounded);
    // Remove prefilled debris so tests control exactly what can be caught.
    room.state.debris.clear();
    return client;
  }

  it("throw → flies → lands in the water ahead → floats with the current", async () => {
    const room = await createWorld(colyseus);
    const client = await grounded(room, "Thrower");
    client.send("hook.throw", { power: 0.5 });
    await waitFor(() => room.state.hooks.get(client.sessionId)?.phase === HookPhase.Floating);
    const hook = room.state.hooks.get(client.sessionId);
    expect(hook?.z).toBeLessThan(-5); // thrown forward (−Z)
    expect(hook?.y).toBe(0);
    await client.waitForNextPatch();
    expect(client.state.hooks.get(client.sessionId)?.launchTime).toBeGreaterThan(0);
    const z0 = hook?.z ?? 0;
    await sleep(500);
    expect((room.state.hooks.get(client.sessionId)?.z ?? 0) - z0).toBeGreaterThan(0.15); // drift
  });

  it("reel catches debris and brings it into the owner's private bag", async () => {
    const room = await createWorld(colyseus);
    const owner = await grounded(room, "Owner");
    const other = await grounded(room, "Other");
    placeDebrisAtLanding(room, owner.sessionId, "dtest", 0.3);
    const retrieved = new Promise<{ items: string[] }>((r) =>
      owner.onMessage("hook.retrieved", (m: { items: string[] }) => r(m)),
    );
    owner.send("hook.throw", { power: 0.3 });
    await waitFor(() => (room.state.hooks.get(owner.sessionId)?.caught.length ?? 0) === 1);
    expect(room.state.debris.get("dtest")?.hookId).toBe(owner.sessionId);
    owner.send("hook.reel", { active: true });
    expect((await retrieved).items).toEqual(["driftwood"]);
    expect(room.state.hooks.has(owner.sessionId)).toBe(false);
    expect(room.state.debris.has("dtest")).toBe(false);
    expect(room.state.players.get(owner.sessionId)?.carried.get("driftwood")).toBe(1);
    // Private: the owner sees their bag, the other player does not.
    await owner.waitForNextPatch();
    await other.waitForNextPatch();
    expect(owner.state.players.get(owner.sessionId)?.carried.get("driftwood")).toBe(1);
    expect(other.state.players.get(owner.sessionId)?.carried?.size ?? 0).toBe(0);
  });

  it("a debris piece can only be on one hook", async () => {
    const room = await createWorld(colyseus);
    const a = await grounded(room, "Alfa");
    const b = await grounded(room, "Bravo");
    // Same spot, same look: both hooks land on the same piece.
    const pa = room.state.players.get(a.sessionId);
    const pb = room.state.players.get(b.sessionId);
    if (pa && pb) {
      pb.x = pa.x;
      pb.z = pa.z;
    }
    placeDebrisAtLanding(room, a.sessionId, "contested", 0.3);
    a.send("hook.throw", { power: 0.3 });
    b.send("hook.throw", { power: 0.3 });
    await waitFor(
      () =>
        room.state.hooks.get(a.sessionId)?.phase === HookPhase.Floating &&
        room.state.hooks.get(b.sessionId)?.phase === HookPhase.Floating,
    );
    await sleep(100);
    const caughtA = room.state.hooks.get(a.sessionId)?.caught.length ?? 0;
    const caughtB = room.state.hooks.get(b.sessionId)?.caught.length ?? 0;
    expect(caughtA + caughtB).toBe(1);
  });

  it("rejects a second throw while a hook is out; cancel releases caught debris", async () => {
    const room = await createWorld(colyseus);
    const client = await grounded(room, "Busy");
    const rejects: unknown[] = [];
    client.onMessage("hook.reject", (m: unknown) => rejects.push(m));
    placeDebrisAtLanding(room, client.sessionId, "release-me", 0.3);
    client.send("hook.throw", { power: 0.3 });
    await waitFor(() => (room.state.hooks.get(client.sessionId)?.caught.length ?? 0) === 1);
    client.send("hook.throw", { power: 1 });
    await waitFor(() => rejects.length > 0);
    expect(rejects[0]).toEqual({ reason: "busy" });
    client.send("hook.cancel", {});
    await waitFor(() => !room.state.hooks.has(client.sessionId));
    expect(room.state.debris.get("release-me")?.hookId).toBe("");
  });

  it("cannot throw while diving", async () => {
    const room = await createWorld(colyseus);
    const client = await grounded(room, "Diver");
    const p = room.state.players.get(client.sessionId);
    if (p) {
      p.x = 8;
      p.y = -3;
      p.mode = MoveMode.Diving;
    }
    client.send("hook.throw", { power: 1 });
    await sleep(200);
    expect(room.state.hooks.has(client.sessionId)).toBe(false);
  });

  it("a hook farther than 30 m from its owner is released", async () => {
    const room = await createWorld(colyseus);
    const client = await grounded(room, "Walker");
    client.send("hook.throw", { power: 1 });
    await waitFor(() => room.state.hooks.get(client.sessionId)?.phase === HookPhase.Floating);
    // Teleport the owner away (server-side).
    const p = room.state.players.get(client.sessionId);
    if (p) {
      p.z = 20;
      p.y = -0.55;
      p.mode = MoveMode.Swimming;
    }
    await waitFor(() => !room.state.hooks.has(client.sessionId));
    expect(HOOK.cancelDistance).toBe(30);
  });
});
