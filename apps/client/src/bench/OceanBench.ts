import { type PerspectiveCamera, Vector2, type WebGLRenderer } from "three";
import type { QualityPreset } from "../render/quality";
import type { BenchResult } from "../ui/store";

/**
 * Deterministic ocean benchmark (`?bench=ocean&seconds=60`), PERFORMANCE_BUDGET §7.
 * Fixed camera path + fixed time of day; 2 s warm-up, then frame deltas are recorded.
 * Results: on screen, in the console, and on `window.__OCEAN_BENCH__` (for automation).
 */
export const BENCH_WARMUP_SECONDS = 2;

export class OceanBench {
  private elapsed = 0;
  private readonly deltasMs: number[] = [];
  private maxCalls = 0;
  private maxTriangles = 0;
  done = false;

  constructor(
    private readonly seconds: number,
    private readonly quality: QualityPreset,
  ) {}

  /** Fixed noon-ish world time for comparable results. */
  readonly worldTime = 24 * 60 * 0.3;

  /** Moves the camera along the fixed path. */
  driveCamera(camera: PerspectiveCamera): void {
    const t = this.elapsed;
    const radius = 40;
    const a = t * 0.12;
    camera.position.set(Math.cos(a) * radius, 3 + Math.sin(t * 0.3) * 1.5, Math.sin(a) * radius);
    camera.lookAt(Math.cos(a + 0.6) * radius * 1.6, 0, Math.sin(a + 0.6) * radius * 1.6);
  }

  /** Returns a result once finished, otherwise null. */
  frame(deltaSeconds: number, renderer: WebGLRenderer): BenchResult | null {
    if (this.done) return null;
    this.elapsed += deltaSeconds;
    if (this.elapsed < BENCH_WARMUP_SECONDS) return null;
    this.deltasMs.push(deltaSeconds * 1000);
    this.maxCalls = Math.max(this.maxCalls, renderer.info.render.calls);
    this.maxTriangles = Math.max(this.maxTriangles, renderer.info.render.triangles);
    if (this.elapsed < BENCH_WARMUP_SECONDS + this.seconds) return null;
    this.done = true;
    return this.summarize(renderer);
  }

  private summarize(renderer: WebGLRenderer): BenchResult {
    const sorted = [...this.deltasMs].sort((a, b) => a - b);
    const pct = (p: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
    const totalMs = this.deltasMs.reduce((s, v) => s + v, 0);
    // "1% low": average FPS of the slowest 1% of frames.
    const slowest = sorted.slice(Math.floor(sorted.length * 0.99));
    const slowAvgMs = slowest.reduce((s, v) => s + v, 0) / Math.max(1, slowest.length);
    const size = renderer.getDrawingBufferSize(new Vector2());
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      scene: "ocean",
      seconds: this.seconds,
      frames: this.deltasMs.length,
      fpsAvg: round((this.deltasMs.length * 1000) / totalMs),
      fps1Low: round(1000 / slowAvgMs),
      frameMsP50: round(pct(50)),
      frameMsP95: round(pct(95)),
      frameMsP99: round(pct(99)),
      frameMsMax: round(sorted[sorted.length - 1] ?? 0),
      drawCalls: this.maxCalls,
      triangles: this.maxTriangles,
      pixelRatio: renderer.getPixelRatio(),
      resolution: `${size.x}x${size.y}`,
      quality: this.quality,
      userAgent: navigator.userAgent,
    };
  }
}
