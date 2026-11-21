import { Callbacks, Client, Predict, type Room } from "@colyseus/sdk";
import {
  CHARACTER_STATE_FIELDS,
  type CharacterBody,
  type ChatBroadcast,
  CloseCodes,
  initPhysics,
  MovementWorld,
  type PlayerInput,
  type PlayerState,
  RAFT_COLLIDERS,
  REMOTE_INTERPOLATION_DELAY_MS,
  raftWorldPosition,
  type ServerNotice,
  stepCharacter,
  WORLD_ROOM_NAME,
  WorldState,
} from "@oceansurvival/shared";
import type { Identity } from "./identity";

/**
 * Client side of the world room (ADR-0005 / ADR-0013):
 * - local player: Colyseus `predict.reconciler` running the SHARED `stepCharacter`
 *   against a local Rapier world with the same static geometry as the server;
 * - remote players: `Predict` lerp interpolation, REMOTE_INTERPOLATION_DELAY_MS behind;
 * - world time from `state.timeOrigin` + the synced room clock.
 */
export type ConnectionEvent =
  | { type: "status"; status: "connected" | "reconnecting" }
  | { type: "closed"; code: number; reason: "duplicate" | "abuse" | "server" | "network" | "left" }
  | { type: "chat"; message: ChatBroadcast }
  | { type: "notice"; notice: ServerNotice }
  | { type: "interact-reject"; targetId: string; reason: string };

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  mode: number;
}

type InputData = { moveX: number; moveZ: number; yaw: number; pitch: number; buttons: number };

export class WorldConnection {
  private readonly predict: ReturnType<typeof Predict.get<Room<unknown, WorldState>>>;
  private readonly input: ReturnType<Room<unknown, WorldState>["input"]>;
  private reconciler: ReturnType<WorldConnection["predict"]["reconciler"]> | null = null;
  private self: PlayerState | null = null;
  private readonly body: CharacterBody;
  private corrections = { count: 0, sum: 0, max: 0 };
  private leftIntentionally = false;

  private constructor(
    readonly room: Room<unknown, WorldState>,
    private readonly movement: MovementWorld,
    onEvent: (e: ConnectionEvent) => void,
  ) {
    this.body = movement.createCharacter();
    this.predict = Predict.get(room, { mode: "lerp", delay: REMOTE_INTERPOLATION_DELAY_MS });
    this.predict.attachAll("players", { mode: "lerp", fields: ["x", "y", "z"] });
    this.predict.attachAll("players", { mode: "lerp", fields: ["yaw", "pitch"], angle: true });
    this.input = room.input<PlayerInput>();
    if (this.input.tickRate === undefined) {
      throw new Error("Server did not advertise a fixed tick rate (setFixedTimestep)");
    }

    const callbacks = Callbacks.get(room);
    callbacks.onAdd("players", (player, sessionId) => {
      if (sessionId === room.sessionId) this.attachSelf(player as PlayerState);
    });

    room.onDrop(() => onEvent({ type: "status", status: "reconnecting" }));
    room.onReconnect(() => onEvent({ type: "status", status: "connected" }));
    room.onLeave((code: number) => {
      const reason =
        code === CloseCodes.DuplicateSession
          ? "duplicate"
          : code === CloseCodes.ProtocolAbuse
            ? "abuse"
            : this.leftIntentionally
              ? "left"
              : code >= 4000
                ? "server"
                : "network";
      onEvent({ type: "closed", code, reason });
    });
    room.onMessage("chat", (m: ChatBroadcast) => onEvent({ type: "chat", message: m }));
    room.onMessage("server.notice", (n: ServerNotice) => onEvent({ type: "notice", notice: n }));
    room.onMessage("interact.reject", (m: { targetId: string; reason: string }) =>
      onEvent({ type: "interact-reject", ...m }),
    );
  }

  /** `server`: the server URL, or an existing SDK client (tests). */
  static async connect(
    server: string | Client,
    worldId: string,
    identity: Identity,
    name: string,
    onEvent: (e: ConnectionEvent) => void,
  ): Promise<WorldConnection> {
    await initPhysics();
    const movement = new MovementWorld(RAFT_COLLIDERS);
    const client = typeof server === "string" ? new Client(server) : server;
    const room = await client.joinOrCreate<WorldState>(
      WORLD_ROOM_NAME,
      { worldId, playerId: identity.playerId, token: identity.token, name },
      WorldState,
    );
    const connection = new WorldConnection(room, movement, onEvent);
    onEvent({ type: "status", status: "connected" });
    return connection;
  }

  get sessionId(): string {
    return this.room.sessionId;
  }

  /**
   * Once per render frame: advances prediction and sends exactly one input per fixed
   * step that is due (Colyseus contract: tick → send loop → read).
   */
  frame(now: number, sample: (out: InputData) => void): void {
    const steps = this.predict.tick(now);
    if (!this.self) return;
    const data = this.input.data as InputData;
    for (let i = 0; i < steps; i++) {
      sample(data);
      this.input.send();
    }
  }

  /** Smoothed, predicted pose of the local player (null until spawned). */
  localPose(out: Pose): Pose | null {
    if (!this.self) return null;
    return this.readPose(this.self, out);
  }

  /** Interpolated pose of any player (remote or local). */
  readPose(player: PlayerState, out: Pose): Pose {
    out.x = this.predict.value(player, "x");
    out.y = this.predict.value(player, "y");
    out.z = this.predict.value(player, "z");
    out.yaw = this.predict.value(player, "yaw");
    out.pitch = this.predict.value(player, "pitch");
    out.mode = player.mode;
    return out;
  }

  /** World time in seconds, shared by all clients (day/night, waves). */
  worldTime(): number {
    return this.room.state.timeOrigin + this.room.clock.serverNow() / 1000;
  }

  rttMs(): number {
    return this.room.clock.smoothedRtt();
  }

  /** Reconcile correction statistics since the last call (meters). */
  takeCorrectionStats(): { count: number; avg: number; max: number } {
    const c = this.corrections;
    const result = { count: c.count, avg: c.count ? c.sum / c.count : 0, max: c.max };
    this.corrections = { count: 0, sum: 0, max: 0 };
    return result;
  }

  /** The raft's position in the world now (rendering origin, ADR-0014). */
  raftWorld(worldTime: number, out: [number, number]): [number, number] {
    return raftWorldPosition(this.room.state.raft, worldTime, out);
  }

  get lanternOn(): boolean {
    return this.room.state.raft?.lanternOn ?? false;
  }

  sendInteract(targetId: string): void {
    this.room.send("interact.use", { targetId });
  }

  sendChat(text: string): void {
    this.room.send("chat.send", { text });
  }

  async leave(): Promise<void> {
    this.leftIntentionally = true;
    await this.room.leave();
  }

  dispose(): void {
    this.predict.dispose?.();
    this.movement.dispose();
  }

  private attachSelf(player: PlayerState): void {
    this.self = player;
    this.reconciler = this.predict.reconciler(player, {
      input: this.input,
      fields: [...CHARACTER_STATE_FIELDS],
      step: (ctx, state, cmd) =>
        stepCharacter(this.movement, this.body, state as PlayerState, cmd as InputData, ctx.dt),
      smoothMs: 65,
      // Respawns / teleports pop instead of gliding across the deck.
      snap: 3,
      warnOnDivergence: 0.05,
      onReconcile: () => {
        const mag = this.reconciler?.lastCorrectionMag ?? 0;
        this.corrections.count++;
        this.corrections.sum += mag;
        if (mag > this.corrections.max) this.corrections.max = mag;
      },
    });
  }
}
