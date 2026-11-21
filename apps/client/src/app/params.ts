/** URL query parameters for dev/benchmark modes. */
export interface LaunchParams {
  /** `?bench=ocean` runs the deterministic ocean benchmark. */
  bench: "ocean" | null;
  /** Benchmark measurement duration in seconds (`?seconds=60`). */
  benchSeconds: number;
  /** `?spike=rapier` runs the Rapier determinism spike in the browser. */
  spike: "rapier" | null;
  /** `?net=0` disables the connection to the dev server. */
  net: boolean;
  /** `?quality=low|medium|high`. */
  quality: "low" | "medium" | "high" | null;
}

export function readLaunchParams(search: string): LaunchParams {
  const p = new URLSearchParams(search);
  const seconds = Number(p.get("seconds"));
  const quality = p.get("quality");
  return {
    bench: p.get("bench") === "ocean" ? "ocean" : null,
    benchSeconds: Number.isFinite(seconds) && seconds >= 5 && seconds <= 600 ? seconds : 60,
    spike: p.get("spike") === "rapier" ? "rapier" : null,
    net: p.get("net") !== "0",
    quality: quality === "low" || quality === "medium" || quality === "high" ? quality : null,
  };
}
