/**
 * PHASE 1 SPIKE room. Proves the Colyseus 0.18 building blocks we rely on:
 * - Schema builder state + StateView private field
 * - onAuth with zod-validated join options
 * - messages = { name: validate(zod, handler) }
 * - defineInput + setFixedTimestep (server-authoritative movement, ADR-0005)
 * - onDrop/allowReconnection
 * Replaced by WorldRoom in Phase 2.
 */
import { StateView } from "@colyseus/schema";
import {
  DEFAULT_MAX_PLAYERS,
  SIM_TICK_RATE,
  SpikeChatMessage,
  SpikeJoinOptions,
  SpikeMoveInput,
  stepSpikeMovement,
} from "@oceansurvival/shared";
import { type AuthContext, type Client, type CloseCode, Room, validate } from "colyseus";
import { SpikePlayer, SpikeState } from "../state/SpikeState";

export const RECONNECT_GRACE_SECONDS = 30;

export class SpikeRoom extends Room<{ state: SpikeState; input: SpikeMoveInput }> {
  override maxClients = DEFAULT_MAX_PLAYERS;
  override state = new SpikeState();

  override inputs = this.defineInput(SpikeMoveInput, {
    bufferMaxSize: 64,
    sanitize: { moveX: [-1, 1], moveZ: [-1, 1], yaw: [-Math.PI * 4, Math.PI * 4] },
  });

  override messages = {
    chat: validate(SpikeChatMessage, (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      this.broadcast("chat", { from: player.name, text: message.text });
    }),
  };

  override onCreate(): void {
    this.setFixedTimestep((ctx) => {
      for (const [sessionId, player] of this.state.players) {
        const cmd = this.inputs.get(sessionId).next();
        if (cmd) stepSpikeMovement(player, cmd, ctx.dt);
      }
      this.state.tick++;
    }, SIM_TICK_RATE);
  }

  override onAuth(_client: Client, options: unknown, _context: AuthContext): SpikeJoinOptions {
    const parsed = SpikeJoinOptions.safeParse(options);
    if (!parsed.success) throw new Error("Invalid join options");
    return parsed.data;
  }

  override onJoin(client: Client, _options: unknown, auth: SpikeJoinOptions): void {
    const player = new SpikePlayer();
    player.name = auth.name;
    player.secretNote = `private-to-${client.sessionId}`;
    this.state.players.set(client.sessionId, player);
    client.view = new StateView();
    client.view.add(player);
  }

  override async onDrop(client: Client): Promise<void> {
    await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
  }

  override onLeave(client: Client, _code?: CloseCode): void {
    this.state.players.delete(client.sessionId);
  }
}
