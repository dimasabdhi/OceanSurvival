import { CALM_WAVES, DAY_LENGTH_SECONDS } from "@oceansurvival/shared";
import { effect } from "@preact/signals";
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from "three";
import { OceanBench } from "../bench/OceanBench";
import { FlyCamera } from "../player/FlyCamera";
import { DayNightCycle, phaseToClock } from "../render/DayNightCycle";
import { DebugFloaters } from "../render/DebugFloaters";
import { OceanRenderer } from "../render/ocean/OceanRenderer";
import { PerfMonitor } from "../render/PerfMonitor";
import { QUALITY_PRESETS, type QualityPreset, saveQualityPreset } from "../render/quality";
import { SkyDome } from "../render/SkyDome";
import * as store from "../ui/store";
import type { LaunchParams } from "./params";

/**
 * Phase 1 client shell: renderer, ocean, sky, day/night, debug camera, perf overlay,
 * optional dev-server connection, benchmark and Rapier spike modes.
 * Gameplay systems arrive from Phase 2 onward.
 */
export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  private readonly timer = new Timer();
  private readonly cycle = new DayNightCycle();
  private readonly sky = new SkyDome();
  private readonly ocean: OceanRenderer;
  private readonly floaters = new DebugFloaters(CALM_WAVES);
  private readonly sun = new DirectionalLight();
  private readonly hemi = new HemisphereLight();
  private readonly flyCamera: FlyCamera;
  private readonly perfMonitor: PerfMonitor;
  private readonly bench: OceanBench | null;
  // TODO(Phase 2): WorldConnection (prediction + interpolation) replaces the Phase 1 spike connection.
  private worldTime: number;
  private rafHandle = 0;
  private readonly disposers: (() => void)[] = [];

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
    this.scene.add(this.sky.mesh, this.ocean.mesh, this.floaters.mesh, this.sun, this.hemi);
    this.scene.add(this.sun.target);

    this.flyCamera = new FlyCamera(this.camera);
    this.perfMonitor = new PerfMonitor(this.renderer, (s) => {
      store.perf.value = s;
    });
    this.bench = params.bench ? new OceanBench(params.benchSeconds, store.quality.value) : null;
    this.worldTime = this.bench
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
        this.flyCamera.sensitivity = 0.0022 * store.sensitivity.value;
      }),
    );
  }

  start(): void {
    if (this.params.spike === "rapier") {
      // Lazy-load: Rapier (WASM, ~2 MB) is not needed until gameplay physics (Phase 2+).
      void import("../spike/rapierSpike").then((m) => m.runRapierSpike());
    }
    if (this.bench) {
      store.bench.value = { running: true, result: null };
      store.started.value = true;
    }
    this.rafHandle = requestAnimationFrame(this.loop);
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

  /** Jump the day/night cycle to a phase (0 = sunrise). */
  setTimeOfDay(phase: number): void {
    this.worldTime = DAY_LENGTH_SECONDS * phase;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafHandle);
    for (const d of this.disposers) d();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("keydown", this.onKeyDown);

    this.flyCamera.dispose();
    this.ocean.dispose();
    this.sky.dispose();
    this.floaters.dispose();
    this.timer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly loop = (timestamp: number) => {
    this.rafHandle = requestAnimationFrame(this.loop);
    this.timer.update(timestamp);
    // Clamp huge deltas (tab switch, breakpoint) so the sim never jumps.
    const dt = Math.min(this.timer.getDelta(), 0.25);

    if (this.bench) {
      this.bench.driveCamera(this.camera);
    } else {
      this.worldTime += dt * store.timeSpeed.value;
      this.flyCamera.update(dt);
    }

    this.cycle.update(this.worldTime);
    this.sun.position.copy(this.cycle.lightDirection).multiplyScalar(100).add(this.camera.position);
    this.sun.target.position.copy(this.camera.position);
    this.sun.color.copy(this.cycle.current.light);
    this.sun.intensity = this.cycle.current.lightIntensity;
    this.hemi.color.copy(this.cycle.current.ambientSky);
    this.hemi.groundColor.copy(this.cycle.current.ambientGround);
    this.hemi.intensity = this.cycle.current.ambientIntensity;

    this.sky.update(this.camera.position, this.cycle);
    this.ocean.update(this.worldTime, this.camera, this.cycle);
    this.floaters.update(this.worldTime, this.camera.position);

    this.renderer.render(this.scene, this.camera);
    this.perfMonitor.frame(dt * 1000);

    const result = this.bench?.frame(dt, this.renderer) ?? null;
    if (result) {
      store.bench.value = { running: false, result };
      window.__OCEAN_BENCH__ = result;
      console.info("[bench] ocean", JSON.stringify(result));
    }
    store.clock.value = phaseToClock(this.cycle.phase);
  };

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
    this.flyCamera.setEnabled(locked);
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "F3") {
      e.preventDefault();
      store.showPerf.value = !store.showPerf.value;
    }
  };
}
