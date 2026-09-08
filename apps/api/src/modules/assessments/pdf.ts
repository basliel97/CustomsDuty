import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { AppError } from "../../lib/errors.js";
import { config } from "../../lib/config.js";
import { buildAssessmentPdf } from "../../lib/pdf.js";
import type { PdfData, PdfItem, PdfSummary } from "../../lib/pdf.js";

export async function generateAssessmentPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
  const [assessment] = await db
    .select()
    .from(schema.assessments)
    .where(and(eq(schema.assessments.id, id), isNull(schema.assessments.deleted_at)))
    .limit(1);
  if (!assessment) throw AppError.notFound("Assessment not found");

  const [branch] = await db
    .select()
    .from(schema.branches)
    .where(eq(schema.branches.id, assessment.branch_id))
    .limit(1);

  let officer: { full_name: string | null; badge_number: string | null } | null = null;
  if (assessment.reviewed_by_officer_id) {
    const [o] = await db
      .select({ full_name: schema.users.full_name, badge_number: schema.users.badge_number })
      .from(schema.users)
      .where(eq(schema.users.id, assessment.reviewed_by_officer_id))
      .limit(1);
    officer = o ?? null;
  }

  const itemRows = await db
    .select()
    .from(schema.assessmentItems)
    .where(eq(schema.assessmentItems.assessment_id, id))
    .orderBy(asc(schema.assessmentItems.line_number));

  const hsIds = itemRows.map((r) => r.hs_code_id);
  const hsCodes = hsIds.length
    ? await db.select().from(schema.hsCodes).where(inArray(schema.hsCodes.id, hsIds))
    : [];
  const hsMap = new Map(hsCodes.map((h) => [h.id, h.code]));

  const items: PdfItem[] = itemRows.map((r) => ({
    line_number: r.line_number,
    hsCode: hsMap.get(r.hs_code_id) ?? "-",
    item_description: r.item_description,
    quantity: Number(r.quantity),
    unit_price_foreign: Number(r.unit_price_foreign),
    cif_etb: Number(r.cif_etb),
    duty_amount: Number(r.duty_amount),
    excise_amount: Number(r.excise_amount),
    vat_amount: Number(r.vat_amount),
    surtax_amount: Number(r.surtax_amount),
    withholding_amount: Number(r.withholding_amount),
  }));

  const summary: PdfSummary = {
    totalCifEtb: Number(assessment.total_cif_etb),
    totalDutyEtb: Number(assessment.total_duty_etb),
    totalExciseEtb: Number(assessment.total_excise_etb),
    totalVatEtb: Number(assessment.total_vat_etb),
    totalSurtaxEtb: Number(assessment.total_surtax_etb),
    totalWithholdingEtb: Number(assessment.total_withholding_etb),
    scanningFee: Number(assessment.total_scanning_fee_etb),
    grandTotalPayable: Number(assessment.total_payable_etb),
    totalPaidEtb: Number(assessment.total_paid_etb),
    remainingBalanceEtb: Number(assessment.remaining_balance_etb),
  };

  const verifyBase = config.CORS_ORIGIN.replace(/\/$/, "");
  const data: PdfData = {
    assessmentNumber: assessment.assessment_number,
    issuedAt: assessment.created_at,
    status: assessment.status,
    exemptionType: assessment.exemption_type,
    officerBadge: officer?.badge_number ?? null,
    officerName: officer?.full_name ?? null,
    declarantName: assessment.declarant_name,
    declarantTin: assessment.declarant_tin,
    declarantPassportNo: assessment.declarant_passport_no,
    branchNameEn: branch?.name_en ?? "-",
    branchNameAm: branch?.name_am ?? "",
    branchCity: branch?.city ?? null,
    currency: assessment.currency,
    exchangeRate: Number(assessment.exchange_rate_applied),
    qrPayload: assessment.qr_verification_hash
      ? `${verifyBase}/verify/${assessment.qr_verification_hash}`
      : "",
    items,
    summary,
  };

  const buffer = await buildAssessmentPdf(data);
  return { buffer, filename: `${assessment.assessment_number}.pdf` };
}
