import { Hono } from "hono";
import * as notifService from "./service.js";
import { parsePagination, ok, okList, paginationMeta } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";

type NotifEnv = { Variables: AppVariables };

const notifRoutes = new Hono<NotifEnv>();

notifRoutes.get("/", authMiddleware, async (c) => {
  const pq = parsePagination(c);
  const user = c.get("user");
  const result = await notifService.listNotifications(user.id, pq.page, pq.limit);
  return c.json(okList(result.data, paginationMeta(result.total, pq.page, pq.limit)));
});

notifRoutes.put("/read-all", authMiddleware, async (c) => {
  const user = c.get("user");
  const result = await notifService.markAllNotificationsRead(user.id);
  return c.json(ok(result));
});

notifRoutes.put("/:id/read", authMiddleware, async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user");
  const data = await notifService.markNotificationRead(user.id, id);
  return c.json(ok(data));
});

export { notifRoutes };
