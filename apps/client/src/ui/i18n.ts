import id from "../locales/id.json";

/** UI text keys. The UI is Indonesian-only (owner decision 2026-11-21); keys keep it extensible. */
export type TextKey = keyof typeof id;

export function t(key: TextKey): string {
  return id[key];
}
