import type { Context } from "hono";
import { db, schema } from "../db/index.js";
import { AppError } from "./errors.js";
import type { AppVariables } from "../middleware/auth.js";

export interface AuditInput {
  userId?: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  durationMs?: number | null;
}

/**
 * Persist an audit-log entry. Failures are swallowed so auditing never breaks
 * an otherwise-successful request.
 */
export async function writeAudit(entry: AuditInput): Promise<void> {
  try {
    await db.insert(schema.auditLogs).values({
      user_id: entry.userId,
      action: entry.action,
      entity_name: entry.entityName,
      entity_id: entry.entityId,
      old_values: entry.oldValues,
      new_values: entry.newValues,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      request_id: entry.requestId,
      session_id: entry.sessionId,
      duration_ms: entry.durationMs,
    });
  } catch {
    // Audit must never break the primary request.
  }
}

/**
 * Build an audit entry from the current request context (user, request id, IP/UA).
 */
export function auditFromContext(
  c: Context<{ Variables: AppVariables }>,
  input: Omit<AuditInput, "userId" | "ipAddress" | "userAgent" | "requestId">
): AuditInput {
  return {
    ...input,
    userId: c.get("user")?.id,
    ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
    requestId: c.get("requestId") as string | undefined,
  };
}

export { AppError };
