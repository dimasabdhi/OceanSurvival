import { Client, type Room } from "@colyseus/sdk";
import { SPIKE_ROOM_NAME } from "@oceansurvival/shared";
import { connection } from "../ui/store";

/**
 * PHASE 1 SPIKE: connect to the dev server's spike room and report status, player
 * count and RTT. Gameplay networking (prediction, interpolation) starts in Phase 2.
 */
export class SpikeConnection {
  private room: Room | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(private readonly serverUrl: string) {}

  async connect(): Promise<void> {
    connection.value = { status: "connecting", players: 0, rttMs: null };
    try {
      const client = new Client(this.serverUrl);
      const suffix = Math.floor(Math.random() * 9000 + 1000);
      const room = await client.joinOrCreate(SPIKE_ROOM_NAME, { name: `Pemain-${suffix}` });
      if (this.disposed) {
        await room.leave();
        return;
      }
      this.room = room;
      const update = (status = connection.value.status) => {
        const players =
          (room.state as { players?: { size: number } } | undefined)?.players?.size ?? 0;
        connection.value = { ...connection.value, status, players };
      };
      room.onStateChange(() => update("connected"));
      room.onDrop(() => update("reconnecting"));
      room.onReconnect(() => update("connected"));
      room.onLeave(() => {
        connection.value = { status: "offline", players: 0, rttMs: null };
      });
      update("connected");
      const ping = () =>
        room.ping((ms) => {
          connection.value = { ...connection.value, rttMs: ms };
        });
      ping();
      this.pingTimer = setInterval(ping, 2000);
    } catch (err) {
      console.warn("[net] spike connection failed:", err);
      connection.value = { status: "offline", players: 0, rttMs: null };
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    await this.room?.leave();
  }
}
