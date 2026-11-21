import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Server configuration from environment variables, validated at startup
 * (fail fast on bad config). See .env.example at the repository root.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SERVER_HOST: z.string().min(1).default("127.0.0.1"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(2567),
  CLIENT_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  MAX_PLAYERS_PER_WORLD: z.coerce.number().int().min(1).max(16).default(4),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  PERSISTENCE_DRIVER: z.enum(["memory", "file"]).default("file"),
  DEV_SAVE_DIR: z.string().min(1).default("./data/saves"),
  AUTOSAVE_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(3600).default(120),
  /** How long a dropped player stays in the world waiting to reconnect. */
  RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(1).max(300).default(30),
  /** Development aid: simulated round-trip latency in ms (0 = off). Ignored in production. */
  SIMULATED_LATENCY_MS: z.coerce.number().int().min(0).max(2000).default(0),
  /** Development aid: exposes GET /debug/metrics (bound to SERVER_HOST). Ignored in production. */
  DEBUG_ROUTES: z
    .enum(["0", "1"])
    .default("1")
    .transform((v) => v === "1"),
});

export type ServerConfig = z.infer<typeof EnvSchema>;

const repoRoot = resolve(import.meta.dirname, "../../..");

/** Loads `<repo>/.env` (if present) into process.env, then validates. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const envFile = resolve(repoRoot, ".env");
  if (env === process.env && existsSync(envFile)) process.loadEnvFile(envFile);
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const config = parsed.data;
  // Relative save paths are resolved against the repository root, not the CWD.
  config.DEV_SAVE_DIR = resolve(repoRoot, config.DEV_SAVE_DIR);
  if (config.NODE_ENV === "production") {
    config.SIMULATED_LATENCY_MS = 0;
    config.DEBUG_ROUTES = false;
  }
  return config;
}
