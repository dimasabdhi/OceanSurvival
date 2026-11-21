import {
  GOLDEN_RAPIER_HASH_600,
  runDeterminismScenario,
} from "@oceansurvival/shared/physics-spike";
import { rapierSpike } from "../ui/store";

declare global {
  interface Window {
    __RAPIER_SPIKE__?: unknown;
    __OCEAN_BENCH__?: unknown;
  }
}

/** PHASE 1 SPIKE (`?spike=rapier`): runs the shared Rapier scenario in the browser. */
export async function runRapierSpike(): Promise<void> {
  const r = await runDeterminismScenario(600);
  const result = {
    hash: r.hash,
    expected: GOLDEN_RAPIER_HASH_600,
    match: r.hash === GOLDEN_RAPIER_HASH_600,
    stepMs: Math.round(r.stepMs * 100) / 100,
    rapierVersion: r.rapierVersion,
  };
  rapierSpike.value = result;
  window.__RAPIER_SPIKE__ = result;
  console.info("[spike] rapier", JSON.stringify(result));
}
