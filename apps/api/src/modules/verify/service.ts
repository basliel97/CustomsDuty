import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { verifyQrToken } from "../../lib/qr.js";

export interface VerifyResult {
  valid: boolean;
  status?: string;
  statusLabel?: string;
  color?: string;
  assessmentNumber?: string;
  declarantName?: string;
  declarantTin?: string;
  totalTaxPaid?: number;
  currency?: string;
  approvedAt?: string | null;
  branchLocation?: string | null;
  reason?: string;
}

export async function verifyAssessment(hash: string): Promise<VerifyResult> {
  const payload = verifyQrToken(hash);
  if (!payload) {
    return { valid: false, color: "red", reason: "Invalid QR token" };
  }

  const rows = await db
    .select({
      assessment: schema.assessments,
      branch: schema.branches,
    })
    .from(schema.assessments)
    .innerJoin(schema.branches, eq(schema.assessments.branch_id, schema.branches.id))
    .where(
      and(
        eq(schema.assessments.id, payload.assessmentId),
        isNull(schema.assessments.deleted_at)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.assessment.assessment_number !== payload.assessmentNumber) {
    return { valid: false, color: "red", reason: "Assessment not found" };
  }

  const a = row.assessment;
  if (a.expires_at && a.expires_at.getTime() < Date.now()) {
    return { valid: false, color: "red", reason: "Assessment QR token has expired" };
  }

  const status = a.status;
  const paid = (Number(a.total_paid_etb) || 0) >= Number(a.total_payable_etb);

  let color = "red";
  let statusLabel = status;
  if (status === "PAID" || paid) {
    color = "green";
    statusLabel = "PAID & CLEARED";
  } else if (status === "SUBMITTED" || status === "APPROVED") {
    color = "yellow";
    statusLabel = status === "APPROVED" ? "APPROVED - PENDING PAYMENT" : status;
  }

  return {
    valid: color !== "red",
    status,
    statusLabel,
    color,
    assessmentNumber: a.assessment_number,
    declarantName: a.declarant_name,
    declarantTin: a.declarant_tin,
    totalTaxPaid: Number(a.total_paid_etb),
    currency: a.currency,
    approvedAt: a.reviewed_at ? a.reviewed_at.toISOString() : null,
    branchLocation: row.branch.name_en,
  };
}
