import type { Context, Next } from "hono";
import type { UserRole } from "@customs-duty-pro/shared";
import { hasPermission } from "../lib/rbac.js";
import type { Permission } from "../lib/rbac.js";
import type { AuthUser } from "./auth.js";

function getUser(c: Context): AuthUser | undefined {
  return c.get("user") as AuthUser | undefined;
}

/**
 * Require an authenticated user to hold the given permission. 401 if not
 * authenticated, 403 if the role lacks the permission.
 *
 * NOTE: this middleware is typically composed AFTER authMiddleware.
 */
export function requirePermission(...permissions: Permission[]) {
  return async function requirePermissionMiddleware(c: Context, next: Next) {
    const user = getUser(c);
    if (!user) {
      return c.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401
      );
    }
    const ok = permissions.some((p) => hasPermission(user.role, p));
    if (!ok) {
      return c.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        403
      );
    }
    await next();
  };
}

/**
 * Require the user to hold one of the given roles.
 */
export function requireRole(...roles: UserRole[]) {
  return async function requireRoleMiddleware(c: Context, next: Next) {
    const user = getUser(c);
    if (!user) {
      return c.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        401
      );
    }
    if (!roles.includes(user.role)) {
      return c.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions" } },
        403
      );
    }
    await next();
  };
}

export { hasPermission };
export { getUser as getAuthUser };
