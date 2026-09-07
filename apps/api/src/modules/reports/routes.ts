import { Hono } from "hono";
import * as reportService from "./service.js";
import { ok } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";

type ReportEnv = { Variables: AppVariables };

const reportRoutes = new Hono<ReportEnv>();

reportRoutes.get(
  "/revenue",
  authMiddleware,
  requireRole("TARIFF_SPECIALIST", "SUPER_ADMIN"),
  async (c) => {
    const data = await reportService.revenueReport({
      from: c.req.query("from"),
      to: c.req.query("to"),
      branch: c.req.query("branch"),
    });
    return c.json(ok(data));
  }
);

reportRoutes.get(
  "/hs-frequency",
  authMiddleware,
  requireRole("TARIFF_SPECIALIST", "SUPER_ADMIN"),
  async (c) => {
    const data = await reportService.hsFrequencyReport();
    return c.json(ok(data));
  }
);

reportRoutes.get(
  "/officer-performance",
  authMiddleware,
  requireRole("SUPER_ADMIN"),
  async (c) => {
    const data = await reportService.officerPerformanceReport();
    return c.json(ok(data));
  }
);

export { reportRoutes };
