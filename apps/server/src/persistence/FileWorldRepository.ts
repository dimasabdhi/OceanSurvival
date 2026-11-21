import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  type PlayerIdentity,
  PlayerIdentity as PlayerIdentitySchema,
  parseSnapshot,
  type WorldRepository,
  type WorldSnapshot,
  WorldSnapshotV2,
} from "./WorldRepository";

/**
 * Development persistence: one JSON file per world + one identities file
 * (DATABASE_DESIGN §1). Writes are atomic (temp file + rename) and serialized per
 * file, so a crash mid-write never leaves a truncated save.
 */
export class FileWorldRepository implements WorldRepository {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly dir: string) {}

  async loadWorld(worldId: string): Promise<WorldSnapshot | null> {
    const raw = await this.readJson(this.worldPath(worldId));
    if (raw === null) return null;
    try {
      return parseSnapshot(raw);
    } catch (e) {
      const detail = e instanceof z.ZodError ? z.prettifyError(e) : (e as Error).message;
      throw new Error(`Corrupt or incompatible save for world "${worldId}": ${detail}`);
    }
  }

  saveWorld(snapshot: WorldSnapshot): Promise<void> {
    const valid = WorldSnapshotV2.parse(snapshot);
    return this.writeJson(this.worldPath(valid.worldId), valid);
  }

  async getIdentity(playerId: string): Promise<PlayerIdentity | null> {
    const all = await this.readIdentities();
    return all[playerId] ?? null;
  }

  createIdentity(identity: PlayerIdentity): Promise<boolean> {
    const path = join(this.dir, "identities.json");
    return this.enqueue(path, async () => {
      const all = await this.readIdentities();
      if (all[identity.playerId]) return false;
      all[identity.playerId] = PlayerIdentitySchema.parse(identity);
      await this.atomicWrite(path, all);
      return true;
    });
  }

  private worldPath(worldId: string): string {
    if (!/^[a-z0-9-]{1,32}$/.test(worldId)) throw new Error("invalid worldId");
    return join(this.dir, "worlds", `${worldId}.json`);
  }

  private async readIdentities(): Promise<Record<string, PlayerIdentity>> {
    const raw = await this.readJson(join(this.dir, "identities.json"));
    return raw === null ? {} : z.record(z.string(), PlayerIdentitySchema).parse(raw);
  }

  private async readJson(path: string): Promise<unknown | null> {
    try {
      return JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  private writeJson(path: string, value: unknown): Promise<void> {
    return this.enqueue(path, () => this.atomicWrite(path, value));
  }

  private async atomicWrite(path: string, value: unknown): Promise<void> {
    await mkdir(join(path, ".."), { recursive: true });
    const tmp = `${path}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tmp, path);
  }

  /** Serializes operations per file path. */
  private enqueue<T>(path: string, op: () => Promise<T>): Promise<T> {
    const prev = this.queues.get(path) ?? Promise.resolve();
    const next = prev.then(op, op);
    this.queues.set(
      path,
      next.catch(() => undefined),
    );
    return next;
  }
}
