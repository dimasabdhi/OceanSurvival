import { createHash, timingSafeEqual } from "node:crypto";
import type { WorldRepository } from "../persistence/WorldRepository";

/**
 * Guest identity (SECURITY_DESIGN T1): the client keeps a random 32-byte token; the
 * server stores only SHA-256(token). First use of a playerId registers it
 * ("trust on first use"); later joins must present the same token.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class PlayerAuth {
  constructor(private readonly repo: WorldRepository) {}

  /** Returns true if the token is valid for this playerId (registering new ids). */
  async verify(playerId: string, token: string): Promise<boolean> {
    const tokenHash = hashToken(token);
    let identity = await this.repo.getIdentity(playerId);
    if (!identity) {
      const created = await this.repo.createIdentity({
        playerId,
        tokenHash,
        createdAt: new Date().toISOString(),
      });
      if (created) return true;
      identity = await this.repo.getIdentity(playerId); // lost a registration race
      if (!identity) return false;
    }
    const a = Buffer.from(identity.tokenHash, "hex");
    const b = Buffer.from(tokenHash, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
