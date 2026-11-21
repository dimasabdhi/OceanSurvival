import { PlayerAuth } from "./auth/PlayerAuth";
import type { ServerConfig } from "./config";
import { FileWorldRepository } from "./persistence/FileWorldRepository";
import { MemoryWorldRepository, type WorldRepository } from "./persistence/WorldRepository";

/**
 * Process-wide services the rooms depend on. Configured once at startup (index.ts) or
 * by tests, so rooms stay free of environment/IO decisions.
 */
export interface Services {
  config: ServerConfig;
  repository: WorldRepository;
  auth: PlayerAuth;
}

let current: Services | null = null;

export function configureServices(config: ServerConfig, repository?: WorldRepository): Services {
  const repo =
    repository ??
    (config.PERSISTENCE_DRIVER === "file"
      ? new FileWorldRepository(config.DEV_SAVE_DIR)
      : new MemoryWorldRepository());
  current = { config, repository: repo, auth: new PlayerAuth(repo) };
  return current;
}

export function services(): Services {
  if (!current) throw new Error("configureServices() must be called before rooms are created");
  return current;
}
