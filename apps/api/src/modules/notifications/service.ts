import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { AppError } from "../../lib/errors.js";

function toDto(row: typeof schema.notifications.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    subject: row.subject,
    body: row.body,
    metadata: row.metadata,
    readAt: row.read_at ? row.read_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listNotifications(userId: string, page: number, limit: number) {
  const base = and(eq(schema.notifications.user_id, userId), isNull(schema.notifications.deleted_at));
  const [totalRows, rows] = await Promise.all([
    db.select({ id: schema.notifications.id }).from(schema.notifications).where(base),
    db
      .select()
      .from(schema.notifications)
      .where(base)
      .orderBy(desc(schema.notifications.created_at))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  return { data: rows.map(toDto), total: totalRows.length };
}

export async function markNotificationRead(userId: string, id: string) {
  const rows = await db
    .update(schema.notifications)
    .set({ status: "READ", read_at: new Date() })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.user_id, userId)))
    .returning();
  const row = rows[0];
  if (!row) throw AppError.notFound("Notification not found");
  return toDto(row);
}

export async function markAllNotificationsRead(userId: string) {
  const now = new Date();
  const rows = await db
    .update(schema.notifications)
    .set({ status: "READ", read_at: now })
    .where(and(eq(schema.notifications.user_id, userId), eq(schema.notifications.status, "PENDING")))
    .returning();
  return { updated: rows.length };
}
