import type { Context, Next } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import type { UserRole } from "@customs-duty-pro/shared";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  branchLocation?: string | null;
}

/**
 * Hono context variable map shared across routes.
 */
export interface AppVariables {
  user: AuthUser;
  requestId: string;
}

/**
 * Extract a Bearer token from the Authorization header or return null.
 */
function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1] : null;
}

/**
 * Authentication middleware: requires a valid access token.
 * On success, sets `c.set("user", AuthUser)`.
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = extractBearer(c.req.header("Authorization"));
  if (!token) {
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Missing authentication token" } },
      401
    );
  }

  const claims = verifyAccessToken(token);
  if (!claims) {
    return c.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
      401
    );
  }

  c.set("user", {
    id: claims.sub,
    email: claims.email,
    role: claims.role as UserRole,
    branchLocation: claims.branchLocation ?? null,
  } satisfies AuthUser);

  await next();
}

/**
 * Optional authentication middleware: sets the user if a valid token is present,
 * but does not reject anonymous requests.
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = extractBearer(c.req.header("Authorization"));
  if (token) {
    const claims = verifyAccessToken(token);
    if (claims) {
      c.set("user", {
        id: claims.sub,
        email: claims.email,
        role: claims.role as UserRole,
        branchLocation: claims.branchLocation ?? null,
      } satisfies AuthUser);
    }
  }
  await next();
}
