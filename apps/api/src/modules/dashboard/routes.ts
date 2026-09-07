import { Hono } from "hono";
import * as dashboardService from "./service.js";
import { ok } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";

type DashboardEnv = { Variables: AppVariables };

const dashboardRoutes = new Hono<DashboardEnv>();

dashboardRoutes.get(
  "/stats",
  authMiddleware,
  requireRole("VALUATION_OFFICER", "TARIFF_SPECIALIST", "SUPER_ADMIN"),
  async (c) => {
    const data = await dashboardService.getDashboardStats();
    return c.json(ok(data));
  }
);

export { dashboardRoutes };
