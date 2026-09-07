import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createForexRateSchema, correctForexRateSchema } from "@customs-duty-pro/shared";
import * as forexService from "./service.js";
import { parsePagination, ok, okList, paginationMeta } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { auditFromContext, writeAudit } from "../../lib/audit.js";

type ForexEnv = { Variables: AppVariables };

const forexRoutes = new Hono<ForexEnv>();

// Public: current/latest rates.
forexRoutes.get("/", async (c) => {
  const data = await forexService.getCurrentRates();
  return c.json(ok(data));
});

forexRoutes.get("/history", authMiddleware, async (c) => {
  const pq = parsePagination(c);
  const result = await forexService.getHistory({
    currency: c.req.query("currency"),
    from: c.req.query("from"),
    to: c.req.query("to"),
    page: pq.page,
    limit: pq.limit,
  });
  return c.json(okList(result.data, paginationMeta(result.total, pq.page, pq.limit)));
});

forexRoutes.post("/", authMiddleware, requirePermission("forex:set"), zValidator("json", createForexRateSchema), async (c) => {
  const body = c.req.valid("json");
  const data = await forexService.setRate(body, c.get("user").id);
  await writeAudit(
    auditFromContext(c, { action: "FOREX_RATE_SET", entityName: "forex_rates", entityId: data.id, newValues: { currency: data.currency, rate: data.exchangeRateToEtb, effectiveDate: data.effectiveDate } })
  );
  return c.json(ok(data), 201);
});

forexRoutes.put("/:id", authMiddleware, requirePermission("forex:set"), zValidator("json", correctForexRateSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const data = await forexService.correctRate(id, body);
  await writeAudit(
    auditFromContext(c, { action: "FOREX_RATE_CORRECTED", entityName: "forex_rates", entityId: data.id, newValues: { currency: data.currency, rate: data.exchangeRateToEtb, effectiveDate: data.effectiveDate } })
  );
  return c.json(ok(data));
});

export { forexRoutes };
