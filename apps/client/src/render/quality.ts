export type QualityPreset = "low" | "medium" | "high";

export interface QualitySettings {
  /** Upper bound for renderer pixel ratio (multiplied by devicePixelRatio, capped). */
  maxPixelRatio: number;
  /** Radial segments of the ocean mesh. */
  oceanSegments: number;
  /** Spacing of the first ocean ring (m); smaller = denser near the camera. */
  oceanInnerSpacing: number;
  /** Far plane / view distance (m). */
  viewDistance: number;
}

export const QUALITY_PRESETS: Record<QualityPreset, QualitySettings> = {
  low: { maxPixelRatio: 0.75, oceanSegments: 160, oceanInnerSpacing: 1.0, viewDistance: 1500 },
  medium: { maxPixelRatio: 1.0, oceanSegments: 256, oceanInnerSpacing: 0.7, viewDistance: 3000 },
  high: { maxPixelRatio: 1.0, oceanSegments: 384, oceanInnerSpacing: 0.5, viewDistance: 4000 },
};

const STORAGE_KEY = "oceansurvival.quality";

export function loadQualityPreset(): QualityPreset {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "low" || v === "medium" || v === "high") return v;
  } catch {
    // storage unavailable (private mode etc.) — fall through to default
  }
  return "high";
}

export function saveQualityPreset(preset: QualityPreset): void {
  try {
    localStorage.setItem(STORAGE_KEY, preset);
  } catch {
    // ignore: preference simply won't persist
  }
}
