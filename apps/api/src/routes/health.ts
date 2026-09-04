import { Hono } from "hono";
import { config } from "../lib/config.js";
import postgres from "postgres";

const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  const checks: Record<string, string> = {};

  // Database check
  try {
    const sql = postgres(config.DATABASE_URL, { max: 1 });
    await sql`SELECT 1`;
    await sql.end();
    checks.database = "connected";
  } catch {
    checks.database = "disconnected";
  }

  const allHealthy = Object.values(checks).every((v) => v === "connected");

  return c.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      checks,
    },
    allHealthy ? 200 : 503
  );
});

export { healthRoutes };
