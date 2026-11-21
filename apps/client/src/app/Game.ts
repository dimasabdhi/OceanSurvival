import {
  CALM_WAVES,
  DAY_LENGTH_SECONDS,
  eyePosition,
  type HookLaunch,
  HookPhase,
  hookFlightPosition,
  hookLaunch,
  LANTERN_ID,
  PlayerName,
  type PlayerState,
  RAFT_VELOCITY,
} from "@oceansurvival/shared";
import { effect } from "@preact/signals";
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Euler,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Timer,
  Vector3,
  WebGLRenderer,
} from "three";
import { OceanBench } from "../bench/OceanBench";
import { loadIdentity, savePlayerName } from "../net/identity";
import { type ConnectionEvent, type Pose, WorldConnection } from "../net/WorldConnection";
import { FlyCamera } from "../player/FlyCamera";
import { HookController } from "../player/HookController";
import { InputSampler } from "../player/InputSampler";
import { aimedInteractable } from "../player/InteractionAim";
import { Viewmodel } from "../player/Viewmodel";
import { DayNightCycle, phaseToClock } from "../render/DayNightCycle";
import { OceanRenderer } from "../render/ocean/OceanRenderer";
import { PerfMonitor } from "../render/PerfMonitor";
import { QUALITY_PRESETS, type QualityPreset, saveQualityPreset } from "../render/quality";
import { SkyDome } from "../render/SkyDome";
import * as store from "../ui/store";
import { DebrisRenderer } from "../world/DebrisRenderer";
import { HookRenderer } from "../world/HookRenderer";
import { LocalDebrisField } from "../world/localDebris";
import { PlayerViews } from "../world/PlayerViews";
import { Presentation } from "../world/Presentation";
import { RaftSway } from "../world/RaftSway";
import { RaftView } from "../world/RaftView";
import type { LaunchParams } from "./params";

const MAX_CHAT_LINES = 8;
const UNDERWATER_FOG = new Color(0x0f4c5c);

/**
 * Client shell. Two modes:
 * - online (default): join the world room, first-person player with server-authoritative
 *   movement + client prediction, other players interpolated (Phase 2);
 * - offline (`?net=0`) / benchmark: debug fly camera over the ocean (Phase 1 tools).
 */
export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private readonly timer = new Timer();
  private readonly cycle = new DayNightCycle();
  private readonly sky = new SkyDome();
  private readonly ocean: OceanRenderer;
  private readonly debrisRenderer = new DebrisRenderer();
  /** Offline/menu/bench debris (online uses the replicated state). */
  private readonly localDebris = new LocalDebrisField();
  private readonly raft = new RaftView();
  private readonly sway = new RaftSway();
  private readonly presentation = new Presentation(this.sway);
  private readonly fog = new FogExp2(0xcfe6ee, 0.001);
  private readonly raftWorld: [number, number] = [0, 0];
  private readonly renderPos = new Vector3();
  private readonly lookQuat = new Quaternion();
  private readonly hookRenderer = new HookRenderer();
  private readonly viewmodel: Viewmodel;
  private readonly hookController: HookController;
  /** Local "ghost" of a throw until the server's hook arrives (instant feedback). */
  private pendingThrow: { launch: HookLaunch; worldTime: number; since: number } | null = null;
  private readonly hookPositions = new Map<string, Vector3>();
  private readonly remoteHands = new Map<string, Vector3>();
  private readonly handPos = new Vector3();
  private readonly flight: [number, number, number] = [0, 0, 0];
  private lastBagUpdate = 0;
  private pickupId = 0;
  private readonly playerViews: PlayerViews;
  private readonly sun = new DirectionalLight();
  private readonly hemi = new HemisphereLight();
  private readonly flyCamera: FlyCamera;
  private readonly sampler = new InputSampler();
  private readonly perfMonitor: PerfMonitor;
  private readonly bench: OceanBench | null;
  private connection: WorldConnection | null = null;
  private localWorldTime: number;
  private lastNetStats = 0;
  private chatId = 0;
  private rafHandle = 0;
  private readonly disposers: (() => void)[] = [];
  private readonly pose: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 0 };
  private readonly look = new Euler(0, 0, 0, "YXZ");
  private readonly alive = new Set<string>();

  constructor(
    private readonly container: HTMLElement,
    private readonly params: LaunchParams,
    private readonly serverUrl: string,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.id = "game-canvas";
    // Right mouse = cancel hook; never open the browser's context menu over the game.
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
    container.appendChild(this.renderer.domElement);

    const preset = QUALITY_PRESETS[store.quality.value];
    this.camera = new PerspectiveCamera(store.fov.value, 1, 0.1, preset.viewDistance);
    this.camera.position.set(0, 3, 12);
    this.camera.lookAt(0, 1, 0);

    this.ocean = new OceanRenderer(CALM_WAVES, {
      segments: preset.oceanSegments,
      innerSpacing: preset.oceanInnerSpacing,
      radius: preset.viewDistance,
    });
    this.playerViews = new PlayerViews(this.scene);
    this.scene.add(this.sky.mesh, this.ocean.mesh, this.debrisRenderer.group, this.sun, this.hemi);
    this.scene.add(this.sun.target, this.raft.group, this.hookRenderer.group);
    // The camera is in the scene so its children (the first-person viewmodel) render.
    this.scene.add(this.camera);
    this.viewmodel = new Viewmodel(this.camera);
    this.hookController = new HookController({
      hasHook: () => !!this.connection?.room.state.hooks.has(this.connection.sessionId),
      throwHook: (power) => this.throwHook(power),
      reel: (active) => this.connection?.sendHookReel(active),
      cancel: () => {
        this.pendingThrow = null;
        this.connection?.sendHookCancel();
      },
    });
    this.raft.group.matrixAutoUpdate = false;
    this.scene.fog = this.fog;

    this.flyCamera = new FlyCamera(this.camera);
    this.perfMonitor = new PerfMonitor(this.renderer, (s) => {
      store.perf.value = s;
    });
    this.bench = params.bench
      ? new OceanBench(params.benchSeconds, store.quality.value, params.bench)
      : null;
    if (params.bench === "full4p") this.addBenchPlayers();
    this.localWorldTime = this.bench
      ? this.bench.worldTime
      : DAY_LENGTH_SECONDS * store.timeOfDayPhase.value;
    this.timer.connect(document);

    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("keydown", this.onKeyDown);

    this.disposers.push(
      effect(() => {
        this.applyQuality(store.quality.value);
      }),
      effect(() => {
        this.camera.fov = store.fov.value;
        this.camera.updateProjectionMatrix();
      }),
      effect(() => {
        const s = 0.0022 * store.sensitivity.value;
        this.flyCamera.sensitivity = s;
        this.sampler.sensitivity = s;
      }),
      effect(() => {
        this.sway.enabled = store.raftSway.value;
        this.presentation.headBobEnabled = store.headBob.value;
      }),
      effect(() => {
        // Movement keys are ignored while typing in chat or when the mouse is free.
        this.sampler.setActive(store.pointerLocked.value && !store.chatOpen.value);
      }),
    );
  }

  get online(): boolean {
    return this.params.net && !this.bench;
  }

  start(): void {
    if (this.params.spike === "rapier") {
      void import("../spike/rapierSpike").then((m) => m.runRapierSpike());
    }
    if (this.bench) {
      store.bench.value = { running: true, result: null };
      store.started.value = true;
    }
    this.rafHandle = requestAnimationFrame(this.loop);
  }

  /** Online: join the world (called from a click, so pointer lock is allowed). */
  join(name: string): void {
    const parsed = PlayerName.safeParse(name);
    if (!parsed.success) {
      store.session.value = {
        phase: "menu",
        reason: "error",
        detail: "Nama tidak valid (2–24 huruf/angka).",
      };
      return;
    }
    savePlayerName(parsed.data, store.profile.value);
    store.playerName.value = parsed.data;
    this.requestPointerLock();
    store.session.value = { phase: "joining", reason: null, detail: "" };
    store.connection.value = { status: "connecting", players: 0, rttMs: null };
    WorldConnection.connect(
      this.serverUrl,
      this.params.world,
      loadIdentity(store.profile.value),
      parsed.data,
      this.onNetEvent,
    )
      .then((conn) => {
        this.connection = conn;
        store.session.value = { phase: "in-world", reason: null, detail: "" };
      })
      .catch((err: unknown) => {
        console.warn("[net] join failed:", err);
        store.connection.value = { status: "offline", players: 0, rttMs: null };
        const message = err instanceof Error ? err.message : String(err);
        store.session.value = {
          phase: "lost",
          reason: message.includes("WORLD_FULL") ? "full" : "error",
          detail: message,
        };
        document.exitPointerLock();
      });
  }

  /** Leave the world and return to the menu. */
  async leaveWorld(): Promise<void> {
    const conn = this.connection;
    this.connection = null;
    if (conn) {
      await conn.leave().catch(() => undefined);
      conn.dispose();
    }
    this.playerViews.prune(new Set());
    store.session.value = { phase: "menu", reason: null, detail: "" };
    store.connection.value = { status: "offline", players: 0, rttMs: null };
    store.netStats.value = null;
  }

  sendChat(text: string): void {
    const trimmed = text.trim();
    if (trimmed) this.connection?.sendChat(trimmed.slice(0, 200));
  }

  /** User asked to start/resume: request pointer lock (needs a user gesture). */
  requestPointerLock(): void {
    const canvas = this.renderer.domElement;
    const req = canvas.requestPointerLock({ unadjustedMovement: true }) as unknown as
      | Promise<void>
      | undefined;
    // Some platforms reject unadjustedMovement; retry without it.
    req?.catch(() => canvas.requestPointerLock());
    store.started.value = true;
  }

  /** Offline only: jump the day/night cycle to a phase (0 = sunrise). */
  setTimeOfDay(phase: number): void {
    this.localWorldTime = DAY_LENGTH_SECONDS * phase;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    for (const d of this.disposers) d();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("keydown", this.onKeyDown);
    void this.connection?.leave();
    this.connection?.dispose();
    this.flyCamera.dispose();
    this.sampler.dispose();
    this.playerViews.dispose();
    this.raft.dispose();
    this.hookController.dispose();
    this.hookRenderer.dispose();
    this.viewmodel.dispose();
    this.ocean.dispose();
    this.sky.dispose();
    this.debrisRenderer.dispose();
    this.timer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly onNetEvent = (e: ConnectionEvent) => {
    switch (e.type) {
      case "status":
        store.connection.value = { ...store.connection.value, status: e.status };
        break;
      case "closed": {
        if (e.reason === "left") break;
        this.connection?.dispose();
        this.connection = null;
        this.playerViews.prune(new Set());
        store.connection.value = { status: "offline", players: 0, rttMs: null };
        const wasShutdown = store.session.value.reason === "shutdown";
        store.session.value = {
          phase: "lost",
          reason: wasShutdown ? "shutdown" : e.reason,
          detail: `kode ${e.code}`,
        };
        document.exitPointerLock();
        break;
      }
      case "chat": {
        const line = { id: ++this.chatId, ...e.message, at: Date.now() };
        store.chatLog.value = [...store.chatLog.value, line].slice(-MAX_CHAT_LINES);
        break;
      }
      case "hook-retrieved": {
        const now = Date.now();
        const lines = e.items.map((item) => ({ id: ++this.pickupId, item, at: now }));
        store.pickups.value = [...store.pickups.value, ...lines].slice(-6);
        break;
      }
      case "hook-reject":
        this.pendingThrow = null;
        break;
      case "interact-reject":
        // The server disagreed (moved out of range / blocked); the prompt will update.
        break;
      case "notice":
        if (e.notice.kind === "shutdown") {
          store.session.value = { ...store.session.value, reason: "shutdown" };
        }
        break;
    }
  };

  private readonly loop = (timestamp: number) => {
    this.rafHandle = requestAnimationFrame(this.loop);
    this.timer.update(timestamp);
    // Clamp huge deltas (tab switch, breakpoint) so the sim never jumps.
    const dt = Math.min(this.timer.getDelta(), 0.25);

    const conn = this.connection;
    let worldTime: number;
    if (this.bench) {
      this.bench.driveCamera(this.camera);
      // Time runs during the benchmark so waves, debris and sway really animate.
      this.localWorldTime += dt;
      worldTime = this.localWorldTime;
      this.raftWorld[0] = RAFT_VELOCITY[0] * worldTime;
      this.raftWorld[1] = RAFT_VELOCITY[1] * worldTime;
      this.sway.update(worldTime, this.raftWorld[0], this.raftWorld[1]);
    } else if (conn) {
      // Contract: tick → send loop → read (WorldConnection.frame does tick + sends).
      conn.frame(timestamp, (out) => this.sampler.sample(out));
      worldTime = conn.worldTime();
      conn.raftWorld(worldTime, this.raftWorld);
      this.sway.update(worldTime, this.raftWorld[0], this.raftWorld[1]);
      this.raft.setLantern(conn.lanternOn);
      this.updatePlayers(conn, dt, worldTime);
      this.updateHooks(conn, worldTime);
    } else {
      if (this.online) this.orbitMenuCamera(timestamp);
      else this.flyCamera.update(dt);
      this.localWorldTime += dt * store.timeSpeed.value;
      worldTime = this.localWorldTime;
      // Offline/menu: the raft drifts from the world origin.
      this.raftWorld[0] = RAFT_VELOCITY[0] * worldTime;
      this.raftWorld[1] = RAFT_VELOCITY[1] * worldTime;
      this.sway.update(worldTime, this.raftWorld[0], this.raftWorld[1]);
    }
    this.raft.group.matrix.copy(this.sway.matrix);
    this.raft.group.matrixWorldNeedsUpdate = true;
    const [rx, rz] = this.raftWorld;
    const isUnder = this.presentation.isUnderwater(this.camera.position, worldTime, rx, rz);
    if (isUnder !== store.underwater.value) store.underwater.value = isUnder;

    this.cycle.update(worldTime);
    this.sun.position.copy(this.cycle.lightDirection).multiplyScalar(100).add(this.camera.position);
    this.sun.target.position.copy(this.camera.position);
    this.sun.color.copy(this.cycle.current.light);
    this.sun.intensity = this.cycle.current.lightIntensity;
    this.hemi.color.copy(this.cycle.current.ambientSky);
    this.hemi.groundColor.copy(this.cycle.current.ambientGround);
    this.hemi.intensity = this.cycle.current.ambientIntensity;

    if (isUnder) {
      this.fog.color
        .copy(UNDERWATER_FOG)
        .multiplyScalar(0.35 + 0.65 * Math.min(1, this.cycle.current.lightIntensity / 3));
      this.fog.density = 0.07;
    } else {
      this.fog.color.copy(this.cycle.current.fog);
      this.fog.density = this.cycle.current.fogDensity;
    }

    // Under water the sky is not visible: the fog color fills the background instead.
    this.sky.mesh.visible = !isUnder;
    this.scene.background = isUnder ? this.fog.color : null;
    this.sky.update(this.camera.position, this.cycle);
    this.ocean.update(worldTime, this.camera, this.cycle, rx, rz, isUnder);
    const debris = conn ? conn.room.state.debris.values() : this.localDebris.update(worldTime);
    this.debrisRenderer.update(debris, worldTime, rx, rz, this.camera.position, this.hookPositions);
    const playing = !!conn && store.pointerLocked.value && !store.chatOpen.value;
    this.hookController.setActive(playing);
    const charge = this.hookController.charge();
    if (charge !== store.hookCharge.value) store.hookCharge.value = charge;
    this.viewmodel.update(
      !!conn?.room.state.hooks.has(conn.sessionId) || this.pendingThrow !== null,
      charge,
      !!conn && !isUnder,
    );

    this.renderer.render(this.scene, this.camera);
    this.perfMonitor.frame(dt * 1000);

    const result = this.bench?.frame(dt, this.renderer) ?? null;
    if (result) {
      store.bench.value = { running: false, result };
      window.__OCEAN_BENCH__ = result;
      console.info(`[bench] ${result.scene}`, JSON.stringify(result));
    }
    store.clock.value = phaseToClock(this.cycle.phase);
  };

  /** Camera = predicted local player; remotes = interpolated capsules (raft frame). */
  private updatePlayers(conn: WorldConnection, dt: number, worldTime: number): void {
    const [rx, rz] = this.raftWorld;
    const local = conn.localPose(this.pose);
    if (local) {
      // Look direction comes straight from the mouse (no network delay).
      this.look.set(this.sampler.pitch, this.sampler.yaw, 0);
      this.lookQuat.setFromEuler(this.look);
      this.presentation.camera(
        local,
        this.lookQuat,
        dt,
        worldTime,
        rx,
        rz,
        this.camera.position,
        this.camera.quaternion,
      );
      // Interaction prompt (UX hint only; the server validates).
      const target = store.pointerLocked.value
        ? aimedInteractable(local, this.sampler.yaw, this.sampler.pitch)
        : null;
      const prompt =
        target?.id === LANTERN_ID
          ? {
              targetId: target.id,
              action: conn.lanternOn ? "Padamkan lentera" : "Nyalakan lentera",
            }
          : null;
      if (
        prompt?.targetId !== store.interactPrompt.value?.targetId ||
        prompt?.action !== store.interactPrompt.value?.action
      ) {
        store.interactPrompt.value = prompt;
      }
    }
    this.alive.clear();
    for (const [sessionId, player] of conn.room.state.players) {
      if (sessionId === conn.sessionId) continue;
      this.alive.add(sessionId);
      const p = player as PlayerState;
      const pose = conn.readPose(p, this.pose);
      this.presentation.bodyPosition(pose, worldTime, rx, rz, this.renderPos);
      // Remote right hand (rope start): body center + eye height + 0.3 m to the right.
      let hand = this.remoteHands.get(sessionId);
      if (!hand) {
        hand = new Vector3();
        this.remoteHands.set(sessionId, hand);
      }
      hand.set(
        this.renderPos.x + Math.cos(pose.yaw) * 0.3,
        this.renderPos.y + 0.45,
        this.renderPos.z - Math.sin(pose.yaw) * 0.3,
      );
      pose.x = this.renderPos.x;
      pose.y = this.renderPos.y;
      pose.z = this.renderPos.z;
      this.playerViews.update(sessionId, p.name, p.playerId, pose, p.connected);
    }
    this.playerViews.prune(this.alive);

    const now = performance.now();
    if (now - this.lastNetStats > 500) {
      this.lastNetStats = now;
      const c = conn.takeCorrectionStats();
      store.netStats.value = {
        rttMs: Math.round(conn.rttMs()),
        corrAvgCm: Math.round(c.avg * 1000) / 10,
        corrMaxCm: Math.round(c.max * 1000) / 10,
      };
      store.connection.value = {
        ...store.connection.value,
        players: conn.room.state.players.size,
        rttMs: conn.rttMs(),
      };
    }
  }

  private throwHook(power: number): void {
    const conn = this.connection;
    const local = conn?.localPose(this.pose);
    if (!conn || !local || conn.room.state.hooks.has(conn.sessionId)) return;
    conn.sendHookThrow(power);
    // Same launch the server will compute (predicted pose + current look).
    this.pendingThrow = {
      launch: hookLaunch(eyePosition(local), this.sampler.yaw, this.sampler.pitch, power),
      worldTime: conn.worldTime(),
      since: performance.now(),
    };
  }

  /** Hooks + ropes for everyone; also the positions caught debris hangs from. */
  private updateHooks(conn: WorldConnection, worldTime: number): void {
    const [rx, rz] = this.raftWorld;
    this.hookRenderer.beginFrame();
    this.hookPositions.clear();
    const self = conn.sessionId;
    for (const [owner, hook] of conn.room.state.hooks) {
      const pos = this.hookVector(owner);
      if (hook.phase === HookPhase.Flying) {
        hookFlightPosition(
          {
            x: hook.launchX,
            y: hook.launchY,
            z: hook.launchZ,
            vx: hook.launchVX,
            vy: hook.launchVY,
            vz: hook.launchVZ,
          },
          worldTime - hook.launchTime,
          this.flight,
        );
        pos.set(this.flight[0], this.flight[1], this.flight[2]);
      } else {
        pos.x = conn.hookValue(hook, "x");
        pos.z = conn.hookValue(hook, "z");
        pos.y = this.presentation.waveHeight(pos.x, pos.z, worldTime, rx, rz);
      }
      const hand =
        owner === self ? this.viewmodel.handWorld(this.handPos) : this.remoteHands.get(owner);
      if (!hand) continue;
      this.hookPositions.set(owner, pos);
      this.hookRenderer.set(owner, pos, hand, hook.phase !== HookPhase.Flying);
      if (owner === self) this.pendingThrow = null;
    }
    // Instant local feedback until the authoritative hook shows up (≤ 1 RTT).
    const ghost = this.pendingThrow;
    if (ghost && performance.now() - ghost.since < 1000) {
      hookFlightPosition(ghost.launch, worldTime - ghost.worldTime, this.flight);
      const pos = this.hookVector("local-ghost");
      pos.set(this.flight[0], Math.max(this.flight[1], 0), this.flight[2]);
      this.hookRenderer.set("local-ghost", pos, this.viewmodel.handWorld(this.handPos), false);
    } else {
      this.pendingThrow = null;
    }
    this.hookRenderer.endFrame();

    const now = performance.now();
    if (now - this.lastBagUpdate > 250) {
      this.lastBagUpdate = now;
      const bag = [...conn.carried().entries()]
        .filter(([, n]) => n > 0)
        .map(([item, count]) => ({ item, count }))
        .sort((a, b) => a.item.localeCompare(b.item));
      if (JSON.stringify(bag) !== JSON.stringify(store.bag.value)) store.bag.value = bag;
    }
  }

  private readonly hookVectors = new Map<string, Vector3>();
  private hookVector(id: string): Vector3 {
    let v = this.hookVectors.get(id);
    if (!v) {
      v = new Vector3();
      this.hookVectors.set(id, v);
    }
    return v;
  }

  /** Benchmark "full4p": three other players standing on the raft + lantern on. */
  private addBenchPlayers(): void {
    const spots: [number, number][] = [
      [-0.6, -0.6],
      [0.6, -0.6],
      [-0.6, 0.6],
    ];
    spots.forEach(([x, z], i) => {
      this.playerViews.update(
        `bench-${i}`,
        `Pemain ${i + 2}`,
        `benchplayer000${i}`,
        { x, y: 1.15, z, yaw: i * 2, pitch: 0, mode: 0 },
        true,
      );
    });
    this.raft.setLantern(true);
  }

  /** Slow orbit around the deck while in the menu. */
  private orbitMenuCamera(timestamp: number): void {
    const a = timestamp * 0.00005;
    this.camera.position.set(Math.cos(a) * 9, 3, Math.sin(a) * 9);
    this.camera.lookAt(0, 0.6, 0);
  }

  private applyQuality(preset: QualityPreset): void {
    const q = QUALITY_PRESETS[preset];
    saveQualityPreset(preset);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * q.maxPixelRatio);
    this.camera.far = q.viewDistance;
    this.camera.updateProjectionMatrix();
    this.ocean.setMeshOptions({
      segments: q.oceanSegments,
      innerSpacing: q.oceanInnerSpacing,
      radius: q.viewDistance,
    });
  }

  private readonly resize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private readonly onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    store.pointerLocked.value = locked;
    if (!locked) store.chatOpen.value = false;
    this.flyCamera.setEnabled(locked && !this.online);
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "F3") {
      e.preventDefault();
      store.showPerf.value = !store.showPerf.value;
    } else if (
      (e.code === "Enter" || e.code === "KeyT") &&
      this.connection &&
      store.pointerLocked.value &&
      !store.chatOpen.value
    ) {
      e.preventDefault();
      store.chatOpen.value = true;
    } else if (
      e.code === "KeyE" &&
      this.connection &&
      store.pointerLocked.value &&
      !store.chatOpen.value
    ) {
      const prompt = store.interactPrompt.value;
      if (prompt) this.connection.sendInteract(prompt.targetId);
    }
  };
}
