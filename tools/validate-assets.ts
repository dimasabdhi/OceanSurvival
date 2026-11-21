/**
 * Validates assets/manifest.json against the files in assets/ (ADR-0010,
 * docs/ASSET_PIPELINE.md §4). Exit code 1 on any error. Placeholders are warnings.
 *
 *   pnpm validate:assets
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { z } from "zod";

export const ACCEPTED_LICENSES = [
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "OFL-1.1",
  "Original",
] as const;

const SourceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("original") }).strict(),
  z
    .object({
      type: z.literal("third_party"),
      url: z.url(),
      author: z.string().min(1),
      retrievedAt: z.iso.date(),
    })
    .strict(),
]);

export const AssetEntrySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+(\/[a-z0-9_]+)+$/, "id must be snake_case path segments"),
    name: z.string().min(1),
    category: z.enum(["model", "texture", "audio", "icon", "hdri", "font", "vfx"]),
    file: z.string().min(1),
    format: z.string().min(1),
    source: SourceSchema,
    license: z.enum(ACCEPTED_LICENSES),
    attribution: z.string().min(1).nullable(),
    modified: z.boolean(),
    bytes: z.number().int().nonnegative(),
    stats: z.record(z.string(), z.number()).optional(),
    usage: z.array(z.string().min(1)).min(1),
    placeholder: z.boolean(),
    notes: z.string().optional(),
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.license.startsWith("CC-BY") && !a.attribution) {
      ctx.addIssue({ code: "custom", message: `${a.id}: CC-BY requires attribution` });
    }
    if (a.license === "Original" && a.source.type !== "original") {
      ctx.addIssue({
        code: "custom",
        message: `${a.id}: license Original requires source.type original`,
      });
    }
    if (a.source.type === "third_party" && a.license === "Original") {
      ctx.addIssue({ code: "custom", message: `${a.id}: third-party asset cannot be Original` });
    }
  });

export const ManifestSchema = z
  .object({
    $comment: z.string().optional(),
    manifestVersion: z.literal(1),
    acceptedLicenses: z.array(z.string()),
    assets: z.array(AssetEntrySchema),
  })
  .strict();

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  assetCount: number;
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

export function validateAssets(assetsDir: string): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const manifestPath = join(assetsDir, "manifest.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (e) {
    return {
      errors: [`Cannot read ${manifestPath}: ${(e as Error).message}`],
      warnings,
      assetCount: 0,
    };
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: [z.prettifyError(parsed.error)], warnings, assetCount: 0 };
  }
  const manifest = parsed.data;

  const seenIds = new Set<string>();
  const declaredFiles = new Set<string>();
  for (const a of manifest.assets) {
    if (seenIds.has(a.id)) errors.push(`Duplicate asset id: ${a.id}`);
    seenIds.add(a.id);
    const normalized = a.file.split("/").join(sep);
    declaredFiles.add(normalized);
    const full = join(assetsDir, normalized);
    try {
      const size = statSync(full).size;
      if (size !== a.bytes) errors.push(`${a.id}: bytes ${a.bytes} != actual ${size}`);
    } catch {
      errors.push(`${a.id}: file not found: ${a.file}`);
    }
    if (a.placeholder) warnings.push(`${a.id}: PLACEHOLDER asset (must be replaced before final)`);
  }

  for (const file of listFiles(assetsDir)) {
    const rel = relative(assetsDir, file);
    if (rel === "manifest.json") continue;
    if (!declaredFiles.has(rel))
      errors.push(`File without manifest entry: assets/${rel.split(sep).join("/")}`);
  }

  return { errors, warnings, assetCount: manifest.assets.length };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  const assetsDir = resolve(import.meta.dirname, "..", "assets");
  const report = validateAssets(assetsDir);
  for (const w of report.warnings) console.warn(`WARN  ${w}`);
  for (const e of report.errors) console.error(`ERROR ${e}`);
  console.log(
    `validate-assets: ${report.assetCount} asset(s), ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  );
  process.exitCode = report.errors.length > 0 ? 1 : 0;
}
