import { effect } from "@preact/signals";
import * as store from "./store";

/**
 * Per-browser player settings (ACCEPTANCE_CRITERIA Phase 3): restored at boot and saved
 * whenever they change. Quality has its own key (render/quality.ts).
 */
const KEY = "oceansurvival.settings.v1";

interface Saved {
  fov: number;
  sensitivity: number;
  headBob: boolean;
  raftSway: boolean;
}

function clamp(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

export function initSettings(): () => void {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    if (raw) {
      store.fov.value = clamp(raw.fov, 60, 100, store.fov.value);
      store.sensitivity.value = clamp(raw.sensitivity, 0.2, 3, store.sensitivity.value);
      if (typeof raw.headBob === "boolean") store.headBob.value = raw.headBob;
      if (typeof raw.raftSway === "boolean") store.raftSway.value = raw.raftSway;
    }
  } catch {
    // unavailable or corrupt: keep defaults
  }
  return effect(() => {
    const saved: Saved = {
      fov: store.fov.value,
      sensitivity: store.sensitivity.value,
      headBob: store.headBob.value,
      raftSway: store.raftSway.value,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      // ignore: settings simply won't persist
    }
  });
}
