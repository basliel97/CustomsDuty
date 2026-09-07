import { and, desc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db, schema } from "../../db/index.js";

export interface AuditQueryParams {
  userId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

function toDto(row: typeof schema.auditLogs.$inferSelect) {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityName: row.entity_name,
    entityId: row.entity_id,
    oldValues: row.old_values,
    newValues: row.new_values,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    requestId: row.request_id,
    durationMs: row.duration_ms,
    timestamp: row.timestamp.toISOString(),
  };
}

export async function queryAudit(params: AuditQueryParams) {
  const conditions = [isNotNull(schema.auditLogs.id)];
  if (params.userId) conditions.push(eq(schema.auditLogs.user_id, params.userId));
  if (params.action) conditions.push(eq(schema.auditLogs.action, params.action));
  if (params.entity) conditions.push(eq(schema.auditLogs.entity_name, params.entity));
  if (params.from) conditions.push(gte(schema.auditLogs.timestamp, new Date(params.from)));
  if (params.to) conditions.push(lte(schema.auditLogs.timestamp, new Date(params.to)));

  const where = and(...conditions);
  const [totalRows, rows] = await Promise.all([
    db.select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(where),
    db
      .select()
      .from(schema.auditLogs)
      .where(where)
      .orderBy(desc(schema.auditLogs.timestamp))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit),
  ]);

  return { data: rows.map(toDto), total: totalRows.length };
}
