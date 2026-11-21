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
});

export type ServerConfig = z.infer<typeof EnvSchema>;

/** Loads `<repo>/.env` (if present) into process.env, then validates. */
export function loadConfig(): ServerConfig {
  const envFile = resolve(import.meta.dirname, "../../../.env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
