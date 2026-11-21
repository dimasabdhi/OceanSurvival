import { signal } from "@preact/signals";
import type { QualityPreset } from "../render/quality";

/**
 * Client UI store. Written by the game/net layers, read by Preact components.
 * Hot values (perf) are throttled by their writers (≤ 4 Hz) — never per frame.
 */
export interface PerfSnapshot {
  fps: number;
  frameMsAvg: number;
  frameMsMax: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export type ConnectionStatus = "disabled" | "offline" | "connecting" | "connected" | "reconnecting";

export interface BenchResult {
  scene: string;
  seconds: number;
  frames: number;
  fpsAvg: number;
  fps1Low: number;
  frameMsP50: number;
  frameMsP95: number;
  frameMsP99: number;
  frameMsMax: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  resolution: string;
  quality: QualityPreset;
  userAgent: string;
}

export interface RapierSpikeResult {
  hash: string;
  expected: string;
  match: boolean;
  stepMs: number;
  rapierVersion: string;
}

export const perf = signal<PerfSnapshot | null>(null);
export const showPerf = signal(true);
export const pointerLocked = signal(false);
export const started = signal(false);
export const clock = signal("06:00");
export const timeOfDayPhase = signal(0.25);
export const timeSpeed = signal(1);
export const quality = signal<QualityPreset>("high");
export const fov = signal(75);
export const sensitivity = signal(1);
export const connection = signal<{
  status: ConnectionStatus;
  players: number;
  rttMs: number | null;
}>({ status: "disabled", players: 0, rttMs: null });
export const bench = signal<{ running: boolean; result: BenchResult | null }>({
  running: false,
  result: null,
});
export const rapierSpike = signal<RapierSpikeResult | null>(null);

// --- Phase 2: world session -------------------------------------------------

export type SessionPhase = "menu" | "joining" | "in-world" | "lost";
export type LostReason =
  | "duplicate"
  | "abuse"
  | "server"
  | "network"
  | "error"
  | "shutdown"
  | "full";

export const session = signal<{ phase: SessionPhase; reason: LostReason | null; detail: string }>({
  phase: "menu",
  reason: null,
  detail: "",
});
export const playerName = signal("");
export const chatOpen = signal(false);
export const chatLog = signal<{ id: number; from: string; text: string; at: number }[]>([]);
/** Network telemetry, refreshed ~2 Hz: RTT and reconcile corrections (cm). */
export const netStats = signal<{ rttMs: number; corrAvgCm: number; corrMaxCm: number } | null>(
  null,
);
/** Player profile of this tab (see net/identity.ts acquireProfile). */
export const profile = signal(1);
