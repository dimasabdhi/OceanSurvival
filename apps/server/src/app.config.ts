import { WORLD_ROOM_NAME } from "@oceansurvival/shared";
import { defineRoom, defineServer } from "colyseus";
import { metricsRegistry } from "./metrics/ServerMetrics";
import { WorldRoom } from "./rooms/WorldRoom";
import { services } from "./services";

/** Minimal response surface used by the debug route (avoids a @types/express dependency). */
interface MetricsResponse {
  json(body: unknown): void;
  status(code: number): { end(): void };
}

/**
 * Colyseus server definition. Network binding happens in index.ts so tests
 * (@colyseus/testing `boot`) can reuse this without opening a public port.
 * Call configureServices() before rooms are created.
 */
export const server = defineServer({
  rooms: {
    // One room per world id: joinOrCreate({ worldId }) finds or creates it.
    [WORLD_ROOM_NAME]: defineRoom(WorldRoom).filterBy(["worldId"]),
  },
  express: (app) => {
    // Development-only metrics endpoint (DEBUG_ROUTES; always off in production).
    app.get("/debug/metrics", (_req: unknown, res: MetricsResponse) => {
      if (!services().config.DEBUG_ROUTES) {
        res.status(404).end();
        return;
      }
      res.json({
        rooms: [...metricsRegistry.values()].map((fn) => fn()),
        at: new Date().toISOString(),
      });
    });
  },
});

export default server;
