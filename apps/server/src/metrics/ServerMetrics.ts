/**
 * In-process metrics for development & load tests (PERFORMANCE_BUDGET §3–4):
 * tick duration (avg / p95 / max) and bytes sent per client.
 */
const WINDOW = 3600; // last 60 s of ticks at 60 Hz

export class TickStats {
  private readonly samples = new Float64Array(WINDOW);
  private count = 0;
  private index = 0;
  private max = 0;

  record(ms: number): void {
    this.samples[this.index] = ms;
    this.index = (this.index + 1) % WINDOW;
    this.count = Math.min(this.count + 1, WINDOW);
    if (ms > this.max) this.max = ms;
  }

  summary(): { ticks: number; avgMs: number; p95Ms: number; maxMs: number } {
    const n = this.count;
    if (n === 0) return { ticks: 0, avgMs: 0, p95Ms: 0, maxMs: 0 };
    const values = Array.from(this.samples.subarray(0, n)).sort((a, b) => a - b);
    const avg = values.reduce((s, v) => s + v, 0) / n;
    const round = (v: number) => Math.round(v * 1000) / 1000;
    return {
      ticks: n,
      avgMs: round(avg),
      p95Ms: round(values[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0),
      maxMs: round(this.max),
    };
  }
}

export interface ByteCounter {
  bytes: number;
  since: number;
}

/**
 * Counts bytes the server sends to a client by wrapping the underlying `ws` socket's
 * `send`. Development-only instrumentation; a no-op if the transport differs.
 */
export function countOutgoingBytes(client: { ref?: unknown }): ByteCounter | null {
  const ws = client.ref as { send?: (data: unknown, ...rest: unknown[]) => unknown } | undefined;
  if (!ws || typeof ws.send !== "function") return null;
  const counter: ByteCounter = { bytes: 0, since: performance.now() };
  const original = ws.send.bind(ws);
  ws.send = (data: unknown, ...rest: unknown[]) => {
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) counter.bytes += data.byteLength;
    else if (typeof data === "string") counter.bytes += Buffer.byteLength(data);
    return original(data, ...rest);
  };
  return counter;
}

/** Process-wide registry read by GET /debug/metrics. */
export const metricsRegistry = new Map<string, () => unknown>();
