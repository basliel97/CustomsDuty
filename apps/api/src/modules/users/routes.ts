import { zValidator } from "@hono/zod-validator";
import { createUserSchema, updateUserSchema, updateUserRoleSchema, updateUserStatusSchema } from "@customs-duty-pro/shared";
import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as userService from "./service.js";
import type { UserRole } from "@customs-duty-pro/shared";

const userRoutes = new Hono();

// All user-management routes require authentication.
userRoutes.use("*", authMiddleware);

// Only SUPER_ADMIN can view/manage all users.
userRoutes.use("*", requirePermission("user:view_all"));

userRoutes.get("/", async (c) => {
  const role = c.req.query("role") as UserRole | undefined;
  const status = c.req.query("status");
  const page = Number(c.req.query("page") ?? 1);
  const limit = Number(c.req.query("limit") ?? 20);
  const result = await userService.listUsers({ page, limit, role, status });
  return c.json({ success: true, data: result });
});

userRoutes.post("/", requirePermission("user:create"), zValidator("json", createUserSchema), async (c) => {
  const body = c.req.valid("json");
  const user = await userService.createUser(body);
  return c.json({ success: true, data: user }, 201);
});

userRoutes.get("/:id", async (c) => {
  const user = await userService.getUserById(c.req.param("id")!);
  return c.json({ success: true, data: user });
});

userRoutes.patch("/:id", requirePermission("user:view_all"), async (c) => {
  const id = c.req.param("id")!;
  const parsed = updateUserSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ success: false, error: { code: "VALIDATION", message: parsed.error.message } }, 400);
  }
  const user = await userService.updateUser(id, parsed.data);
  return c.json({ success: true, data: user });
});

userRoutes.patch("/:id/role", requirePermission("user:change_role"), zValidator("json", updateUserRoleSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const user = await userService.updateUser(id, { role: body.role });
  return c.json({ success: true, data: user });
});

userRoutes.patch("/:id/status", requirePermission("user:suspend_activate"), zValidator("json", updateUserStatusSchema), async (c) => {
  const id = c.req.param("id")!;
  const body = c.req.valid("json");
  const user = await userService.setUserStatus(id, body.status);
  return c.json({ success: true, data: user });
});

export { userRoutes };

