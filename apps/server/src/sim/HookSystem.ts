/**
 * Server-authoritative hook simulation (GAMEPLAY_SYSTEMS §C). One hook per player.
 *
 * Flying: analytic (hookFlightPosition) from replicated launch parameters.
 * In the water: drifts with WATER_FLOW (raft frame, ADR-0014); while the owner reels it
 * moves toward them at HOOK.reelSpeed. It catches free debris within HOOK.catchRadius
 * (max HOOK.maxCaught); a piece can be on only one hook. Reeled back within
 * HOOK.retrieveDistance → caught items go to the owner's bag.
 */
import {
  CELL_SIZE,
  DEBRIS_KINDS,
  eyePosition,
  HOOK,
  type HookLaunch,
  HookPhase,
  HookState,
  hookFlightPosition,
  hookLandingTime,
  hookLaunch,
  type PlayerState,
  raftWorldPosition,
  WATER_FLOW,
  WATER_LEVEL,
  type WorldState,
} from "@oceansurvival/shared";

export type ThrowResult = "ok" | "cooldown" | "busy" | "not-allowed";

export interface Retrieval {
  sessionId: string;
  /** Item ids collected (one per caught debris piece). */
  items: string[];
}

/** Half size of the raft footprint: a hook landing on the deck returns to the hand. */
const RAFT_HALF = CELL_SIZE + 0.1;
const ITEM_BY_KIND = new Map(DEBRIS_KINDS.map((k) => [k.kind as number, k.itemId]));

export class HookSystem {
  private readonly lastThrow = new Map<string, number>();
  private readonly reeling = new Set<string>();
  private readonly flight: [number, number, number] = [0, 0, 0];
  private readonly raftPos: [number, number] = [0, 0];

  constructor(private readonly state: WorldState) {}

  throw(sessionId: string, player: PlayerState, power: number, worldTime: number): ThrowResult {
    if (this.state.hooks.has(sessionId)) return "busy";
    const last = this.lastThrow.get(sessionId) ?? Number.NEGATIVE_INFINITY;
    if (worldTime - last < HOOK.throwCooldown) return "cooldown";
    const l = hookLaunch(eyePosition(player), player.yaw, player.pitch, power);
    const hook = new HookState();
    hook.phase = HookPhase.Flying;
    hook.launchX = l.x;
    hook.launchY = l.y;
    hook.launchZ = l.z;
    hook.launchVX = l.vx;
    hook.launchVY = l.vy;
    hook.launchVZ = l.vz;
    hook.launchTime = worldTime;
    hook.x = l.x;
    hook.y = l.y;
    hook.z = l.z;
    this.state.hooks.set(sessionId, hook);
    this.lastThrow.set(sessionId, worldTime);
    this.reeling.delete(sessionId);
    return "ok";
  }

  setReel(sessionId: string, active: boolean): void {
    if (active) this.reeling.add(sessionId);
    else this.reeling.delete(sessionId);
  }

  /** Cancels a hook: caught debris is released back into the water where the hook is. */
  cancel(sessionId: string, worldTime: number): void {
    const hook = this.state.hooks.get(sessionId);
    if (!hook) return;
    const [rx, rz] = raftWorldPosition(this.state.raft, worldTime, this.raftPos);
    hook.caught.forEach((id, i) => {
      const d = this.state.debris.get(id);
      if (!d) return;
      d.hookId = "";
      // Spread released pieces a little so they don't stack.
      d.worldX = rx + hook.x + (i - 1) * 0.4;
      d.worldZ = rz + hook.z;
      // Fresh lifetime (no fade-in again).
      d.spawnTime = worldTime - 2;
    });
    this.state.hooks.delete(sessionId);
    this.reeling.delete(sessionId);
  }

  /** Owner left the world. */
  removeOwner(sessionId: string, worldTime: number): void {
    this.cancel(sessionId, worldTime);
    this.lastThrow.delete(sessionId);
  }

  update(worldTime: number, dt: number): Retrieval[] {
    const retrieved: Retrieval[] = [];
    const [rx, rz] = raftWorldPosition(this.state.raft, worldTime, this.raftPos);
    for (const [sessionId, hook] of this.state.hooks) {
      const owner = this.state.players.get(sessionId);
      if (!owner) {
        this.cancel(sessionId, worldTime);
        continue;
      }
      if (hook.phase === HookPhase.Flying) {
        if (!this.updateFlight(sessionId, hook, worldTime)) continue;
      } else {
        this.updateInWater(sessionId, hook, owner, dt);
      }
      if (hook.phase !== HookPhase.Flying) this.catchDebris(sessionId, hook, rx, rz);

      const [ex, , ez] = eyePosition(owner);
      const dist = Math.hypot(hook.x - ex, hook.z - ez);
      if (dist > HOOK.cancelDistance) {
        this.cancel(sessionId, worldTime);
      } else if (hook.phase === HookPhase.Reeling && dist <= HOOK.retrieveDistance) {
        retrieved.push({ sessionId, items: this.retrieve(sessionId, hook, owner) });
      }
    }
    return retrieved;
  }

  /** Returns false if the hook was removed. */
  private updateFlight(sessionId: string, hook: HookState, worldTime: number): boolean {
    const l = launchOf(hook);
    const t = worldTime - hook.launchTime;
    const tLand = hookLandingTime(l, WATER_LEVEL);
    if (t < tLand) {
      hookFlightPosition(l, t, this.flight);
      hook.x = this.flight[0];
      hook.y = this.flight[1];
      hook.z = this.flight[2];
      return true;
    }
    hookFlightPosition(l, tLand, this.flight);
    if (Math.abs(this.flight[0]) < RAFT_HALF && Math.abs(this.flight[2]) < RAFT_HALF) {
      // Landed on the deck: nothing to catch, it simply returns to the hand.
      this.state.hooks.delete(sessionId);
      return false;
    }
    hook.x = Math.fround(this.flight[0]);
    hook.y = WATER_LEVEL;
    hook.z = Math.fround(this.flight[2]);
    hook.phase = HookPhase.Floating;
    return true;
  }

  private updateInWater(sessionId: string, hook: HookState, owner: PlayerState, dt: number): void {
    let x = hook.x + WATER_FLOW[0] * dt;
    let z = hook.z + WATER_FLOW[1] * dt;
    if (this.reeling.has(sessionId)) {
      const [ex, , ez] = eyePosition(owner);
      const dx = ex - x;
      const dz = ez - z;
      const len = Math.hypot(dx, dz);
      const step = Math.min(len, HOOK.reelSpeed * dt);
      if (len > 1e-6) {
        x += (dx / len) * step;
        z += (dz / len) * step;
      }
      hook.phase = HookPhase.Reeling;
    } else {
      hook.phase = HookPhase.Floating;
    }
    hook.x = Math.fround(x);
    hook.z = Math.fround(z);
    hook.y = WATER_LEVEL;
  }

  private catchDebris(sessionId: string, hook: HookState, rx: number, rz: number): void {
    if (hook.caught.length >= HOOK.maxCaught) return;
    const r2 = HOOK.catchRadius * HOOK.catchRadius;
    for (const [id, d] of this.state.debris) {
      if (d.hookId !== "") continue; // already on a hook (one hook per piece)
      const dx = d.worldX - rx - hook.x;
      const dz = d.worldZ - rz - hook.z;
      if (dx * dx + dz * dz > r2) continue;
      d.hookId = sessionId;
      hook.caught.push(id);
      if (hook.caught.length >= HOOK.maxCaught) return;
    }
  }

  private retrieve(sessionId: string, hook: HookState, owner: PlayerState): string[] {
    const items: string[] = [];
    for (const id of hook.caught) {
      const d = this.state.debris.get(id);
      if (!d) continue;
      const item = ITEM_BY_KIND.get(d.kind);
      if (item) {
        items.push(item);
        owner.carried.set(item, (owner.carried.get(item) ?? 0) + 1);
      }
      this.state.debris.delete(id);
    }
    this.state.hooks.delete(sessionId);
    this.reeling.delete(sessionId);
    return items;
  }
}

export function launchOf(hook: HookState): HookLaunch {
  return {
    x: hook.launchX,
    y: hook.launchY,
    z: hook.launchZ,
    vx: hook.launchVX,
    vy: hook.launchVY,
    vz: hook.launchVZ,
  };
}
