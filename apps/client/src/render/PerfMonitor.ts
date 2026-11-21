import type { WebGLRenderer } from "three";
import type { PerfSnapshot } from "../ui/store";

/**
 * Collects frame timing + renderer.info and publishes a snapshot every
 * `publishIntervalMs` (default 250 ms) to avoid per-frame UI updates.
 */
export class PerfMonitor {
  private frames = 0;
  private sumMs = 0;
  private maxMs = 0;
  private windowStart = performance.now();

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly publish: (snapshot: PerfSnapshot) => void,
    private readonly publishIntervalMs = 250,
  ) {}

  /** Call once per rendered frame with the frame delta in ms. */
  frame(deltaMs: number): void {
    this.frames++;
    this.sumMs += deltaMs;
    if (deltaMs > this.maxMs) this.maxMs = deltaMs;
    const now = performance.now();
    const elapsed = now - this.windowStart;
    if (elapsed < this.publishIntervalMs) return;
    const info = this.renderer.info;
    this.publish({
      fps: (this.frames * 1000) / elapsed,
      frameMsAvg: this.sumMs / this.frames,
      frameMsMax: this.maxMs,
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    });
    this.frames = 0;
    this.sumMs = 0;
    this.maxMs = 0;
    this.windowStart = now;
  }
}
