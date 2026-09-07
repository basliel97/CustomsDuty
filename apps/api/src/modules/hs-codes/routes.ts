import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createHsCodeSchema, updateHsCodeSchema } from "@customs-duty-pro/shared";
import * as hsService from "./service.js";
import { parsePagination, ok, okList, paginationMeta } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { auditFromContext, writeAudit } from "../../lib/audit.js";

type HsEnv = { Variables: AppVariables };

const hsCodeRoutes = new Hono<HsEnv>();

// Autocomplete (must be declared before /:code)
hsCodeRoutes.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const limit = Number(c.req.query("limit") ?? 10);
  const data = await hsService.searchHsCodes(q, limit);
  return c.json(ok(data));
});

hsCodeRoutes.get("/", async (c) => {
  const pq = parsePagination(c, { defaultSort: "code" });
  const dutyRateMinRaw = c.req.query("duty_rate_min");
  const dutyRateMaxRaw = c.req.query("duty_rate_max");
  const result = await hsService.listHsCodes({
    q: c.req.query("q"),
    page: pq.page,
    limit: pq.limit,
    sort: pq.sort,
    order: pq.order,
    dutyRateMin: dutyRateMinRaw ? Number(dutyRateMinRaw) : undefined,
    dutyRateMax: dutyRateMaxRaw ? Number(dutyRateMaxRaw) : undefined,
  });
  return c.json(okList(result.data, paginationMeta(result.total, pq.page, pq.limit)));
});

hsCodeRoutes.get("/:code", async (c) => {
  const data = await hsService.getHsCodeByCode(c.req.param("code")!);
  return c.json(ok(data));
});

hsCodeRoutes.post("/", authMiddleware, requirePermission("hs_code:create"), zValidator("json", createHsCodeSchema), async (c) => {
  const body = c.req.valid("json");
  const data = await hsService.createHsCode(body);
  await writeAudit(
    auditFromContext(c, { action: "HS_CODE_CREATED", entityName: "hs_codes", entityId: data.id, newValues: { code: data.code } })
  );
  return c.json(ok(data), 201);
});

hsCodeRoutes.put("/:id", authMiddleware, requirePermission("hs_code:edit"), zValidator("json", updateHsCodeSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const data = await hsService.updateHsCode(id, body);
  await writeAudit(
    auditFromContext(c, { action: "HS_CODE_UPDATED", entityName: "hs_codes", entityId: data.id, newValues: { code: data.code } })
  );
  return c.json(ok(data));
});

hsCodeRoutes.delete("/:id", authMiddleware, requirePermission("hs_code:delete"), async (c) => {
  const id = c.req.param("id")!;
  await hsService.deleteHsCode(id);
  await writeAudit(auditFromContext(c, { action: "HS_CODE_DELETED", entityName: "hs_codes", entityId: id }));
  return c.body(null, 204);
});

export { hsCodeRoutes };
