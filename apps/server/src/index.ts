import { logger } from "colyseus";
import { server } from "./app.config";
import { loadConfig } from "./config";

const config = loadConfig();

// Bind explicitly to SERVER_HOST (default 127.0.0.1) instead of @colyseus/tools'
// listen(), which binds every network interface. See docs/SECURITY_DESIGN.md T13.
await server.listen(config.SERVER_PORT, config.SERVER_HOST);
logger.info(
  `OceanSurvival server listening on ws://${config.SERVER_HOST}:${config.SERVER_PORT} (${config.NODE_ENV})`,
);
