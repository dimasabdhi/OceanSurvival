import { DEFAULT_WORLD_ID } from "@oceansurvival/shared";

/** URL query parameters for dev/benchmark modes. */
export interface LaunchParams {
  /**
   * `?bench=ocean`: ocean-only benchmark (Phase 1).
   * `?bench=full4p`: raft + 3 other players + 60 debris + ocean + lantern (Phase 4).
   */
  bench: "ocean" | "full4p" | null;
  /** Benchmark measurement duration in seconds (`?seconds=60`). */
  benchSeconds: number;
  /** `?spike=rapier` runs the Rapier determinism spike in the browser. */
  spike: "rapier" | null;
  /** `?net=0` disables the connection to the dev server. */
  net: boolean;
  /** `?quality=low|medium|high`. */
  quality: "low" | "medium" | "high" | null;
  /** `?world=<id>`: which world to join (dev/testing; default DEFAULT_WORLD_ID). */
  world: string;
}

export function readLaunchParams(search: string): LaunchParams {
  const p = new URLSearchParams(search);
  const seconds = Number(p.get("seconds"));
  const quality = p.get("quality");
  return {
    bench: p.get("bench") === "ocean" ? "ocean" : p.get("bench") === "full4p" ? "full4p" : null,
    benchSeconds: Number.isFinite(seconds) && seconds >= 5 && seconds <= 600 ? seconds : 60,
    spike: p.get("spike") === "rapier" ? "rapier" : null,
    net: p.get("net") !== "0",
    quality: quality === "low" || quality === "medium" || quality === "high" ? quality : null,
    world: /^[a-z0-9-]{1,32}$/.test(p.get("world") ?? "")
      ? (p.get("world") as string)
      : DEFAULT_WORLD_ID,
  };
}
