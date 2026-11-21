/**
 * WorldRoom — one instance per active world (docs/MULTIPLAYER_DESIGN.md §2–§5).
 *
 * Server-authoritative movement (ADR-0005) on Colyseus 0.18 built-in netcode
 * (ADR-0013): clients only send `PlayerInput`; this room consumes them in a fixed
 * 60 Hz step with the SAME `stepCharacter` the client predicts with.
 */

import { StateView } from "@colyseus/schema";
import {
  CHARACTER,
  CHARACTER_CENTER_HEIGHT,
  type CharacterBody,
  ChatSend,
  CloseCodes,
  DAY_LENGTH_SECONDS,
  distance3,
  eyePosition,
  findInteractable,
  HookCancel,
  HookReel,
  HookThrow,
  INTERACT_SERVER_RANGE,
  InteractUse,
  initPhysics,
  isBelowKillPlane,
  MoveMode,
  MovementWorld,
  PlayerInput,
  PlayerState,
  RAFT_COLLIDERS,
  RAFT_DECK_Y,
  RAFT_SPAWN_POINTS,
  RAFT_VELOCITY,
  raftWorldPosition,
  SIM_TICK_RATE,
  stepCharacter,
  WorldJoinOptions,
  WorldState,
} from "@oceansurvival/shared";
import { type AuthContext, type Client, type CloseCode, logger, Room, validate } from "colyseus";
import {
  type ByteCounter,
  countOutgoingBytes,
  metricsRegistry,
  TickStats,
} from "../metrics/ServerMetrics";
import { SessionRateLimiter } from "../net/RateLimiter";
import {
  type PlayerRecord,
  SAVE_FORMAT_VERSION,
  type WorldSnapshot,
} from "../persistence/WorldRepository";
import { services } from "../services";
import { type AoiViewer, DebrisSystem } from "../sim/DebrisSystem";
import { HookSystem } from "../sim/HookSystem";

/** Inputs a player may "bank" after a gap (burst catch-up); sustained rate stays 1/tick. */
const MAX_INPUT_CREDIT = 4;
/**
 * If a client sends no input for this many ticks (~250 ms: tab in background, stalled
 * connection, or just joined), the server keeps simulating it with an idle command so
 * gravity/swimming still apply. Shorter gaps (normal network jitter) are NOT filled,
 * so the server applies exactly the client's input sequence and prediction stays exact.
 */
const STALL_TICKS = 15;
/** Rate-limit violations tolerated before the client is kicked. */
const MAX_VIOLATIONS = 50;

const RATE_LIMITS = {
  "chat.send": { capacity: 3, perSecond: 1 },
  "interact.use": { capacity: 5, perSecond: 10 },
  "hook.throw": { capacity: 2, perSecond: 2 },
  "hook.reel": { capacity: 10, perSecond: 10 },
  "hook.cancel": { capacity: 5, perSecond: 5 },
};

/**
 * A swimmer this far from the raft (the current carries them away at 0.6 m/s) is
 * brought back to the raft. Safety net until oxygen/death exist (Phase 9).
 */
const MAX_DISTANCE_FROM_RAFT = 200;
/** Debris AOI refresh: every 4 ticks (15 Hz) — MULTIPLAYER_DESIGN §8.2. */
const AOI_EVERY_N_TICKS = 4;

/**
 * Worlds that currently have a room in this process. A world must never run in two
 * rooms at once (players would be split and both rooms would overwrite the same save).
 * When a world room is full, Colyseus joinOrCreate would otherwise create a second
 * room; onCreate refuses instead. Multi-process safety comes in Phase 8 (DB lock).
 */
const activeWorlds = new Set<string>();
/** Error message the client maps to "world is full". */
export const WORLD_FULL_ERROR = "WORLD_FULL";

const idleCommand = { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, buttons: 0 };

interface AuthData {
  playerId: string;
  name: string;
}

interface Session {
  playerId: string;
  body: CharacterBody;
  credit: number;
  /** Ticks since the last consumed input (see STALL_TICKS). */
  ticksWithoutInput: number;
  limiter: SessionRateLimiter;
  bytes: ByteCounter | null;
  /** Per-client filtered view (debris AOI). */
  view: StateView;
}

export class WorldRoom extends Room<{ state: WorldState; input: PlayerInput }> {
  override state = new WorldState();
  override maxClients = services().config.MAX_PLAYERS_PER_WORLD;

  override inputs = this.defineInput(PlayerInput, {
    bufferMaxSize: 64,
    sanitize: {
      moveX: [-1, 1],
      moveZ: [-1, 1],
      yaw: [-Math.PI - 0.01, Math.PI + 0.01],
      pitch: [-CHARACTER.maxPitch, CHARACTER.maxPitch],
      buttons: [0, 7],
    },
  });

  override messages = {
    "chat.send": validate(ChatSend, (client, message) => {
      if (!this.rateLimit(client, "chat.send")) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.broadcast("chat", { from: player.name, text: message.text });
    }),
    "interact.use": validate(InteractUse, (client, message) => {
      if (!this.rateLimit(client, "interact.use")) return;
      const player = this.state.players.get(client.sessionId);
      const target = findInteractable(message.targetId);
      if (!player || !target) return;
      // Validate against the SERVER position (GAMEPLAY_SYSTEMS §A): range + line of sight.
      const eye = eyePosition(player);
      if (distance3(eye, target.point) > INTERACT_SERVER_RANGE) {
        client.send("interact.reject", { targetId: target.id, reason: "too-far" });
        return;
      }
      if (!this.movement.hasLineOfSight(eye, target.point, target.radius + 0.1)) {
        client.send("interact.reject", { targetId: target.id, reason: "blocked" });
        return;
      }
      if (target.kind === "lantern") this.state.raft.lanternOn = !this.state.raft.lanternOn;
    }),
    "hook.throw": validate(HookThrow, (client, message) => {
      if (!this.rateLimit(client, "hook.throw")) return;
      const player = this.state.players.get(client.sessionId);
      // Phase 5: every player holds the Grapple Line (hotbar/equipment arrive in Phase 6).
      if (!player?.connected || player.mode === MoveMode.Diving) return;
      const result = this.hooks.throw(client.sessionId, player, message.power, this.worldTime());
      if (result !== "ok") client.send("hook.reject", { reason: result });
    }),
    "hook.reel": validate(HookReel, (client, message) => {
      if (!this.rateLimit(client, "hook.reel")) return;
      this.hooks.setReel(client.sessionId, message.active);
    }),
    "hook.cancel": validate(HookCancel, (client) => {
      if (!this.rateLimit(client, "hook.cancel")) return;
      this.hooks.cancel(client.sessionId, this.worldTime());
    }),
  };

  private movement!: MovementWorld;
  private debris!: DebrisSystem;
  private hooks!: HookSystem;
  private tick = 0;
  private readonly viewers: AoiViewer[] = [];
  private readonly sessions = new Map<string, Session>();
  private readonly clientByPlayer = new Map<string, Client>();
  private records: Record<string, PlayerRecord> = {};
  private readonly tickStats = new TickStats();
  private spawnIndex = 0;
  private metricsKey = "";
  private claimedWorldId: string | null = null;

  override async onCreate(options: { worldId?: string }): Promise<void> {
    const worldId = WorldJoinOptions.shape.worldId.parse(options.worldId);
    // Synchronous check-and-claim (no await before it), so concurrent creates cannot race.
    if (activeWorlds.has(worldId)) throw new Error(WORLD_FULL_ERROR);
    activeWorlds.add(worldId);
    this.claimedWorldId = worldId;
    const { repository, config } = services();
    await initPhysics();
    this.movement = new MovementWorld(RAFT_COLLIDERS);

    const snapshot = await repository.loadWorld(worldId);
    this.records = snapshot?.players ?? {};
    this.state.worldId = worldId;
    // New worlds start mid-morning (25% of the day cycle).
    this.state.timeOrigin = snapshot?.worldTime ?? DAY_LENGTH_SECONDS * 0.25;
    // The raft drifts from where it was saved (ADR-0014).
    const raft = this.state.raft;
    raft.originX = snapshot?.raft.worldX ?? 0;
    raft.originZ = snapshot?.raft.worldZ ?? 0;
    raft.originTime = this.state.timeOrigin;
    raft.velX = RAFT_VELOCITY[0];
    raft.velZ = RAFT_VELOCITY[1];
    raft.lanternOn = snapshot?.raft.lanternOn ?? false;
    // Debris is not saved (DATABASE_DESIGN §2): regenerate an already-populated ocean.
    this.debris = new DebrisSystem(this.state, worldId);
    this.debris.prefill(this.worldTime());
    this.hooks = new HookSystem(this.state);
    this.setMetadata({ worldId });

    this.setFixedTimestep((ctx) => this.step(ctx.dt), SIM_TICK_RATE);
    this.clock.setInterval(
      () => void this.save("autosave"),
      config.AUTOSAVE_INTERVAL_SECONDS * 1000,
    );

    this.metricsKey = `room:${this.roomId}`;
    metricsRegistry.set(this.metricsKey, () => this.metrics());
    logger.info(
      `[world ${worldId}] room ${this.roomId} created (${snapshot ? "loaded save" : "new world"})`,
    );
  }

  override async onAuth(_client: Client, options: unknown, _ctx: AuthContext): Promise<AuthData> {
    const parsed = WorldJoinOptions.safeParse(options);
    if (!parsed.success) throw new Error("Invalid join options");
    if (parsed.data.worldId !== this.state.worldId) throw new Error("Wrong world");
    const ok = await services().auth.verify(parsed.data.playerId, parsed.data.token);
    if (!ok) throw new Error("Authentication failed");
    return { playerId: parsed.data.playerId, name: parsed.data.name };
  }

  override onJoin(client: Client, _options: unknown, auth: AuthData): void {
    // One live session per player: a new tab/device replaces the old one.
    const previous = this.clientByPlayer.get(auth.playerId);
    if (previous) {
      previous.leave(CloseCodes.DuplicateSession);
      this.removeSession(previous.sessionId);
    }

    const player = new PlayerState();
    player.playerId = auth.playerId;
    player.name = auth.name;
    const saved = this.records[auth.playerId]?.position;
    if (saved) {
      player.x = Math.fround(saved.x);
      player.y = Math.fround(saved.y);
      player.z = Math.fround(saved.z);
      player.yaw = Math.fround(saved.yaw);
      player.mode = MoveMode.Airborne;
    } else {
      this.placeAtSpawn(player);
    }
    for (const [item, count] of Object.entries(this.records[auth.playerId]?.carried ?? {})) {
      if (count > 0) player.carried.set(item, count);
    }

    this.state.players.set(client.sessionId, player);
    this.clientByPlayer.set(auth.playerId, client);
    const view = new StateView();
    // The owner sees their own private fields (e.g. the bag).
    view.add(player);
    client.view = view;
    this.sessions.set(client.sessionId, {
      view,
      playerId: auth.playerId,
      body: this.movement.createCharacter(),
      credit: 0,
      // Treat a fresh join as stalled so the player settles before its first input.
      ticksWithoutInput: STALL_TICKS,
      limiter: new SessionRateLimiter(RATE_LIMITS),
      bytes: services().config.DEBUG_ROUTES ? countOutgoingBytes(client) : null,
    });
    this.records[auth.playerId] = this.toRecord(player);
    // Show nearby debris right away (not only at the next AOI refresh).
    this.debris.updateViews(this.worldTime(), [{ view, x: player.x, z: player.z }]);
    logger.info(
      `[world ${this.state.worldId}] ${auth.name} joined (${this.clients.length} online)`,
    );
  }

  override async onDrop(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    await this.allowReconnection(client, services().config.RECONNECT_GRACE_SECONDS);
  }

  override onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
    const session = this.sessions.get(client.sessionId);
    if (session) {
      client.view = session.view;
      session.credit = 0;
      if (services().config.DEBUG_ROUTES) session.bytes = countOutgoingBytes(client);
    }
  }

  override async onLeave(client: Client, _code?: CloseCode): Promise<void> {
    this.removeSession(client.sessionId);
    await this.save("leave");
  }

  override async onBeforeShutdown(): Promise<void> {
    this.broadcast("server.notice", { kind: "shutdown" });
    await this.save("shutdown");
    this.disconnect();
  }

  override async onDispose(): Promise<void> {
    if (this.state.worldId) await this.save("dispose");
    if (this.claimedWorldId) activeWorlds.delete(this.claimedWorldId);
    metricsRegistry.delete(this.metricsKey);
    this.movement?.dispose();
  }

  // ---------------------------------------------------------------------------

  private step(dt: number): void {
    const started = performance.now();
    for (const [sessionId, player] of this.state.players) {
      const session = this.sessions.get(sessionId);
      if (!session || !player.connected) continue;
      // Credit-based consumption: sustained 1 input per tick (anti speed-hack), small
      // bursts allowed to catch up after network jitter.
      session.credit = Math.min(MAX_INPUT_CREDIT, session.credit + 1);
      const inputs = this.inputs.get(sessionId);
      let consumed = 0;
      while (session.credit >= 1) {
        const cmd = inputs.next();
        if (!cmd) break;
        stepCharacter(this.movement, session.body, player, cmd, dt);
        session.credit -= 1;
        consumed++;
      }
      if (consumed > 0) {
        session.ticksWithoutInput = 0;
      } else if (++session.ticksWithoutInput > STALL_TICKS) {
        // Stalled client: keep the world physical (not counted as a consumed input,
        // so the client's reconcile ack is unaffected).
        idleCommand.yaw = player.yaw;
        idleCommand.pitch = player.pitch;
        stepCharacter(this.movement, session.body, player, idleCommand, dt);
      }
      if (isBelowKillPlane(player) || Math.hypot(player.x, player.z) > MAX_DISTANCE_FROM_RAFT) {
        this.placeAtSpawn(player);
      }
    }
    this.updateWorld(dt);
    this.tickStats.record(performance.now() - started);
  }

  /** Debris spawning/despawning + per-client AOI. */
  private updateWorld(dt: number): void {
    const worldTime = this.worldTime();
    let connected = 0;
    for (const p of this.state.players.values()) if (p.connected) connected++;
    this.debris.update(worldTime, dt, connected);
    for (const r of this.hooks.update(worldTime, dt)) {
      this.clients.getById(r.sessionId)?.send("hook.retrieved", { items: r.items });
    }
    if (++this.tick % AOI_EVERY_N_TICKS !== 0) return;
    this.viewers.length = 0;
    for (const [sessionId, session] of this.sessions) {
      const p = this.state.players.get(sessionId);
      if (p) this.viewers.push({ view: session.view, x: p.x, z: p.z });
    }
    this.debris.updateViews(worldTime, this.viewers);
  }

  private rateLimit(client: Client, type: keyof typeof RATE_LIMITS): boolean {
    const session = this.sessions.get(client.sessionId);
    if (!session) return false;
    if (session.limiter.allow(type)) return true;
    if (session.limiter.violations === 1) client.send("server.notice", { kind: "rate-limited" });
    if (session.limiter.violations >= MAX_VIOLATIONS) client.leave(CloseCodes.ProtocolAbuse);
    return false;
  }

  private placeAtSpawn(player: PlayerState): void {
    const points = RAFT_SPAWN_POINTS;
    const [sx, sz] = points[this.spawnIndex++ % points.length] ?? [0, 0];
    player.x = Math.fround(sx);
    player.y = Math.fround(RAFT_DECK_Y + CHARACTER_CENTER_HEIGHT + 0.05);
    player.z = Math.fround(sz);
    player.vy = 0;
    player.mode = MoveMode.Airborne;
  }

  private removeSession(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (player && session) {
      this.records[session.playerId] = this.toRecord(player);
      if (this.clientByPlayer.get(session.playerId)?.sessionId === sessionId) {
        this.clientByPlayer.delete(session.playerId);
      }
    }
    if (session) this.movement.removeCharacter(session.body);
    this.hooks.removeOwner(sessionId, this.worldTime());
    this.sessions.delete(sessionId);
    this.state.players.delete(sessionId);
  }

  private toRecord(player: PlayerState): PlayerRecord {
    return {
      playerId: player.playerId,
      name: player.name,
      position: { x: player.x, y: player.y, z: player.z, yaw: player.yaw },
      carried: Object.fromEntries(player.carried.entries()),
      lastSeenAt: new Date().toISOString(),
    };
  }

  /** World time in seconds (also what clients compute from `timeOrigin` + room clock). */
  worldTime(): number {
    return this.state.timeOrigin + this.clock.elapsedTime / 1000;
  }

  private async save(reason: string): Promise<void> {
    for (const [sessionId, player] of this.state.players) {
      const session = this.sessions.get(sessionId);
      if (session) this.records[session.playerId] = this.toRecord(player);
    }
    const worldTime = this.worldTime();
    const [worldX, worldZ] = raftWorldPosition(this.state.raft, worldTime);
    const snapshot: WorldSnapshot = {
      formatVersion: SAVE_FORMAT_VERSION,
      worldId: this.state.worldId,
      worldTime,
      savedAt: new Date().toISOString(),
      players: this.records,
      raft: { worldX, worldZ, lanternOn: this.state.raft.lanternOn },
    };
    try {
      await services().repository.saveWorld(snapshot);
    } catch (e) {
      logger.error(`[world ${this.state.worldId}] save (${reason}) failed:`, e);
    }
  }

  private metrics() {
    const now = performance.now();
    const clients = [...this.sessions.entries()].map(([sessionId, s]) => {
      const seconds = s.bytes ? (now - s.bytes.since) / 1000 : 0;
      return {
        sessionId,
        playerId: s.playerId,
        bytesSent: s.bytes?.bytes ?? null,
        kbpsDown:
          s.bytes && seconds > 0
            ? Math.round(((s.bytes.bytes * 8) / 1000 / seconds) * 10) / 10
            : null,
      };
    });
    return {
      worldId: this.state.worldId,
      roomId: this.roomId,
      players: this.state.players.size,
      debris: this.state.debris.size,
      hooks: this.state.hooks.size,
      tick: this.tickStats.summary(),
      clients,
      memoryMB: Math.round(process.memoryUsage().rss / 1e6),
    };
  }
}
