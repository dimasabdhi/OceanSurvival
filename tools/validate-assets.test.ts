import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAssets } from "./validate-assets";

const dirs: string[] = [];
function fixture(manifest: unknown, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "os-assets-"));
  dirs.push(dir);
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const base = { manifestVersion: 1, acceptedLicenses: [] };
const entry = (over: Record<string, unknown> = {}) => ({
  id: "models/test/crate",
  name: "Crate",
  category: "model",
  file: "models/test/crate.glb",
  format: "glb",
  source: { type: "original" },
  license: "Original",
  attribution: null,
  modified: false,
  bytes: 5,
  usage: ["test"],
  placeholder: false,
  ...over,
});

describe("validate-assets", () => {
  it("passes the real (empty) repository manifest", () => {
    const report = validateAssets(join(import.meta.dirname, "..", "assets"));
    expect(report.errors).toEqual([]);
  });

  it("accepts a correct entry", () => {
    const dir = fixture({ ...base, assets: [entry()] }, { "models/test/crate.glb": "12345" });
    expect(validateAssets(dir).errors).toEqual([]);
  });

  it("rejects files without a manifest entry and wrong sizes", () => {
    const dir = fixture(
      { ...base, assets: [entry({ bytes: 99 })] },
      { "models/test/crate.glb": "12345", "audio/stray.ogg": "x" },
    );
    const { errors } = validateAssets(dir);
    expect(errors.some((e) => e.includes("bytes 99"))).toBe(true);
    expect(errors.some((e) => e.includes("assets/audio/stray.ogg"))).toBe(true);
  });

  it("rejects non-accepted licenses and CC-BY without attribution", () => {
    const nc = fixture({ ...base, assets: [entry({ license: "CC-BY-NC-4.0" })] });
    expect(validateAssets(nc).errors.length).toBeGreaterThan(0);
    const by = fixture(
      {
        ...base,
        assets: [
          entry({
            license: "CC-BY-4.0",
            source: {
              type: "third_party",
              url: "https://example.com/a",
              author: "A",
              retrievedAt: "2026-11-21",
            },
          }),
        ],
      },
      { "models/test/crate.glb": "12345" },
    );
    expect(validateAssets(by).errors.join("\n")).toMatch(/attribution/);
  });

  it("reports placeholders as warnings, not errors", () => {
    const dir = fixture(
      { ...base, assets: [entry({ placeholder: true })] },
      { "models/test/crate.glb": "12345" },
    );
    const report = validateAssets(dir);
    expect(report.errors).toEqual([]);
    expect(report.warnings[0]).toMatch(/PLACEHOLDER/);
  });
});
