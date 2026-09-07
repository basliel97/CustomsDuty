import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "../../db/index.js";

export async function getDashboardStats() {
  const a = schema.assessments;

  const [counts, totals, today, pendingApproval, hs, forexRates, activeUsers] = await Promise.all([
    db
      .select({ status: a.status, count: sql<number>`count(*)::int` })
      .from(a)
      .where(isNull(a.deleted_at))
      .groupBy(a.status),
    db
      .select({
        totalPayable: sql<number>`coalesce(sum(${a.total_payable_etb}),0)`,
        totalPaid: sql<number>`coalesce(sum(${a.total_paid_etb}),0)`,
      })
      .from(a)
      .where(isNull(a.deleted_at)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(a)
      .where(and(isNull(a.deleted_at), gte(a.created_at, sql`now() - interval '1 day'`))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(a)
      .where(and(isNull(a.deleted_at), eq(a.status, "SUBMITTED"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.hsCodes)
      .where(and(eq(schema.hsCodes.is_active, true), isNull(schema.hsCodes.deleted_at))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.forexRates)
      .where(isNull(schema.forexRates.deleted_at)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users)
      .where(and(eq(schema.users.status, "ACTIVE"), isNull(schema.users.deleted_at))),
  ]);

  const statusBreakdown = counts.map((c) => ({ status: c.status, count: c.count }));
  const totalAssessments = statusBreakdown.reduce((sum, s) => sum + s.count, 0);

  return {
    totalAssessments,
    statusBreakdown,
    totalPayableEtb: Number(totals[0]?.totalPayable ?? 0),
    totalCollectedEtb: Number(totals[0]?.totalPaid ?? 0),
    submittedToday: today[0]?.count ?? 0,
    pendingApproval: pendingApproval[0]?.count ?? 0,
    activeHsCodes: hs[0]?.count ?? 0,
    activeForexRates: forexRates[0]?.count ?? 0,
    activeUsers: activeUsers[0]?.count ?? 0,
  };
}
