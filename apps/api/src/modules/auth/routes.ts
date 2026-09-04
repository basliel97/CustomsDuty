import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { loginSchema, registerSchema, changePasswordSchema, refreshTokenSchema } from "@customs-duty-pro/shared";
import * as authService from "./service.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";

type AuthEnv = { Variables: AppVariables };

const authRoutes = new Hono<AuthEnv>();

/**
 * POST /api/v1/auth/register
 * Body: { email, password, full_name, phone? }
 */
authRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.register(body);
  return c.json({ success: true, message: result.message }, 201);
});

/**
 * GET /api/v1/auth/verify-email?token=xxx
 * Activates a PENDING_VERIFICATION account.
 */
authRoutes.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Missing verification token" } },
      400
    );
  }
  await authService.verifyEmail(token);
  return c.json({ success: true, message: "Email verified. You can now log in." });
});

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.login({
    email: body.email,
    password: body.password,
    ip: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  });
  return c.json({ success: true, data: result });
});

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 */
authRoutes.post("/refresh", zValidator("json", refreshTokenSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authService.refresh(
    body.refreshToken,
    c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    c.req.header("user-agent")
  );
  return c.json({ success: true, data: result });
});

/**
 * POST /api/v1/auth/logout
 * Authorization: Bearer <accessToken>
 */
authRoutes.post("/logout", authMiddleware, async (c) => {
  const user = c.get("user");
  await authService.logout(user.id);
  return c.json({ success: true, message: "Logged out" });
});

/**
 * POST /api/v1/auth/change-password
 * Authorization: Bearer <accessToken>
 * Body: { currentPassword, newPassword }
 */
authRoutes.post(
  "/change-password",
  authMiddleware,
  zValidator("json", changePasswordSchema),
  async (c) => {
    const user = c.get("user");
    const body = c.req.valid("json");
    await authService.changePassword(user.id, body.currentPassword, body.newPassword);
    return c.json({ success: true, message: "Password changed. Please log in again." });
  }
);

/**
 * GET /api/v1/auth/me
 * Return the currently authenticated user info.
 */
authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ success: true, data: { id: user.id, email: user.email, role: user.role, branchLocation: user.branchLocation } });
});

export { authRoutes };

