import { serve } from "@hono/node-server";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";
import { app } from "./app.js";

const port = config.PORT;

logger.info(`Starting CustomsDuty Pro API`, {
  port,
  env: config.NODE_ENV,
});

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(`API server running on http://localhost:${info.port}`);
  }
);
