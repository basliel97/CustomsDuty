import { Hono } from "hono";
import * as auditService from "./service.js";
import { parsePagination, okList, paginationMeta } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

type AuditEnv = { Variables: AppVariables };

const auditRoutes = new Hono<AuditEnv>();

auditRoutes.get("/", authMiddleware, requirePermission("audit:view"), async (c) => {
  const pq = parsePagination(c);
  const result = await auditService.queryAudit({
    userId: c.req.query("user_id"),
    action: c.req.query("action"),
    entity: c.req.query("entity"),
    from: c.req.query("from"),
    to: c.req.query("to"),
    page: pq.page,
    limit: pq.limit,
  });
  return c.json(okList(result.data, paginationMeta(result.total, pq.page, pq.limit)));
});

export { auditRoutes };
