import { logger } from "colyseus";
import { server } from "./app.config";
import { loadConfig } from "./config";
import { configureServices } from "./services";

const config = loadConfig();
configureServices(config);

if (config.SIMULATED_LATENCY_MS > 0) {
  server.simulateLatency(config.SIMULATED_LATENCY_MS);
  logger.warn(`Simulating ${config.SIMULATED_LATENCY_MS} ms round-trip latency (development).`);
}

// Bind explicitly to SERVER_HOST (default 127.0.0.1) instead of @colyseus/tools'
// listen(), which binds every network interface. See docs/SECURITY_DESIGN.md T13.
await server.listen(config.SERVER_PORT, config.SERVER_HOST);
logger.info(
  `OceanSurvival server listening on ws://${config.SERVER_HOST}:${config.SERVER_PORT} (${config.NODE_ENV}, saves: ${config.PERSISTENCE_DRIVER === "file" ? config.DEV_SAVE_DIR : "memory"})`,
);
