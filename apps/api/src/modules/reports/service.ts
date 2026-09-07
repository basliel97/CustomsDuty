import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db, schema } from "../../db/index.js";

export interface PeriodParams {
  from?: string;
  to?: string;
  branch?: string;
}

export async function revenueReport(params: PeriodParams) {
  const a = schema.assessments;
  const b = schema.branches;
  const conditions = [isNull(a.deleted_at)];
  if (params.from) conditions.push(gte(a.reviewed_at, new Date(params.from)));
  if (params.to) conditions.push(lte(a.reviewed_at, new Date(params.to)));
  if (params.branch) conditions.push(eq(a.branch_id, params.branch));

  const rows = await db
    .select({
      branchId: a.branch_id,
      branch: b.name_en,
      totalPayable: sql<number>`coalesce(sum(${a.total_payable_etb}),0)`,
      totalCollected: sql<number>`coalesce(sum(${a.total_paid_etb}),0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(a)
    .innerJoin(b, eq(a.branch_id, b.id))
    .where(and(...conditions))
    .groupBy(a.branch_id, b.name_en)
    .orderBy(desc(sql`coalesce(sum(${a.total_payable_etb}),0)`));

  return rows.map((r) => ({
    branchId: r.branchId,
    branch: r.branch,
    totalPayableEtb: Number(r.totalPayable),
    totalCollectedEtb: Number(r.totalCollected),
    assessmentCount: r.count,
  }));
}

export async function hsFrequencyReport() {
  const item = schema.assessmentItems;
  const hs = schema.hsCodes;
  const rows = await db
    .select({
      hsCodeId: item.hs_code_id,
      code: hs.code,
      description: hs.description_en,
      totalQuantity: sql<number>`coalesce(sum(${item.quantity}),0)`,
      totalCifEtb: sql<number>`coalesce(sum(${item.cif_etb}),0)`,
      occurrenceCount: sql<number>`count(*)::int`,
    })
    .from(item)
    .innerJoin(hs, eq(item.hs_code_id, hs.id))
    .groupBy(item.hs_code_id, hs.code, hs.description_en)
    .orderBy(desc(sql`coalesce(sum(${item.cif_etb}),0)`))
    .limit(20);

  return rows.map((r) => ({
    hsCode: r.code,
    description: r.description,
    totalQuantity: Number(r.totalQuantity),
    totalCifEtb: Number(r.totalCifEtb),
    occurrenceCount: r.occurrenceCount,
  }));
}

export async function officerPerformanceReport() {
  const a = schema.assessments;
  const u = schema.users;
  const rows = await db
    .select({
      officerId: a.reviewed_by_officer_id,
      officerName: u.full_name,
      reviewedCount: sql<number>`count(*)::int`,
    })
    .from(a)
    .innerJoin(u, eq(a.reviewed_by_officer_id, u.id))
    .where(isNotNull(a.reviewed_by_officer_id))
    .groupBy(a.reviewed_by_officer_id, u.full_name)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => ({
    officerId: r.officerId,
    officerName: r.officerName,
    reviewedCount: r.reviewedCount,
  }));
}
