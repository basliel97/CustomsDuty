import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { calculateTax } from "../tax-engine/index.js";
import { AssessmentNumberGenerator } from "../tax-engine/index.js";
import { config } from "../../lib/config.js";
import { AppError } from "../../lib/errors.js";
import { signQrToken } from "../../lib/qr.js";
import type { UserRole, ExemptionType } from "@customs-duty-pro/shared";

export interface AssessmentItemInput {
  hs_code: string;
  item_description: string;
  quantity: number;
  unit_price_foreign: number;
  freight_foreign: number;
  insurance_foreign: number;
  country_of_origin?: string;
  notes?: string;
}

export interface CreateAssessmentInput {
  declarant_name: string;
  declarant_tin: string;
  declarant_passport_no?: string;
  declarant_phone?: string;
  declarant_email?: string;
  branch_id: string;
  port_of_entry_id?: string;
  consignment_id?: string;
  currency: string;
  exchange_rate_applied: number;
  exemption_type: ExemptionType;
  items: AssessmentItemInput[];
  idempotency_key?: string;
}

export interface AssessmentItemDto {
  id: string;
  line_number: number;
  hs_code_id: string;
  item_description: string;
  quantity: number;
  unit_price_foreign: number;
  total_fob_foreign: number;
  freight_foreign: number;
  insurance_foreign: number;
  cif_etb: number;
  duty_amount: number;
  excise_amount: number;
  vat_amount: number;
  surtax_amount: number;
  withholding_amount: number;
  total_item_tax_etb: number;
  notes?: string | null;
}

export interface AssessmentDto {
  id: string;
  assessment_number: string;
  created_by_user_id: string;
  declarant_name: string;
  declarant_tin: string;
  branch_id: string;
  currency: string;
  exchange_rate_applied: number;
  total_cif_etb: number;
  total_duty_etb: number;
  total_excise_etb: number;
  total_vat_etb: number;
  total_surtax_etb: number;
  total_withholding_etb: number;
  total_scanning_fee_etb: number;
  total_payable_etb: number;
  total_paid_etb: number;
  remaining_balance_etb: number;
  status: string;
  exemption_type: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  qr_verification_hash: string | null;
  created_at: string;
  items?: AssessmentItemDto[];
}

type AssessmentRow = typeof schema.assessments.$inferSelect;

function toDto(row: AssessmentRow): AssessmentDto {
  return {
    id: row.id,
    assessment_number: row.assessment_number,
    created_by_user_id: row.created_by_user_id,
    declarant_name: row.declarant_name,
    declarant_tin: row.declarant_tin,
    branch_id: row.branch_id,
    currency: row.currency,
    exchange_rate_applied: Number(row.exchange_rate_applied),
    total_cif_etb: Number(row.total_cif_etb),
    total_duty_etb: Number(row.total_duty_etb),
    total_excise_etb: Number(row.total_excise_etb),
    total_vat_etb: Number(row.total_vat_etb),
    total_surtax_etb: Number(row.total_surtax_etb),
    total_withholding_etb: Number(row.total_withholding_etb),
    total_scanning_fee_etb: Number(row.total_scanning_fee_etb),
    total_payable_etb: Number(row.total_payable_etb),
    total_paid_etb: Number(row.total_paid_etb),
    remaining_balance_etb: Number(row.remaining_balance_etb),
    status: row.status,
    exemption_type: row.exemption_type,
    submitted_at: row.submitted_at ? row.submitted_at.toISOString() : null,
    reviewed_at: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    rejection_reason: row.rejection_reason,
    paid_at: row.paid_at ? row.paid_at.toISOString() : null,
    qr_verification_hash: row.qr_verification_hash ?? null,
    created_at: row.created_at.toISOString(),
  };
}

function itemDto(row: typeof schema.assessmentItems.$inferSelect): AssessmentItemDto {
  return {
    id: row.id,
    line_number: row.line_number,
    hs_code_id: row.hs_code_id,
    item_description: row.item_description,
    quantity: Number(row.quantity),
    unit_price_foreign: Number(row.unit_price_foreign),
    total_fob_foreign: Number(row.total_fob_foreign),
    freight_foreign: Number(row.freight_foreign),
    insurance_foreign: Number(row.insurance_foreign),
    cif_etb: Number(row.cif_etb),
    duty_amount: Number(row.duty_amount),
    excise_amount: Number(row.excise_amount),
    vat_amount: Number(row.vat_amount),
    surtax_amount: Number(row.surtax_amount),
    withholding_amount: Number(row.withholding_amount),
    total_item_tax_etb: Number(row.total_item_tax_etb),
    notes: row.notes,
  };
}

interface HsWithId extends Record<string, unknown> {
  id: string;
  code: string;
  description_en: string;
  duty_rate: string;
  excise_rate: string;
  vat_rate: string;
  surtax_rate: string;
  withholding_rate: string;
  minimum_duty_floor: string | null;
  is_exempt_eligible: boolean;
  is_capital_goods: boolean;
  is_raw_material: boolean;
}

async function resolveHsIds(codes: string[]): Promise<Map<string, HsWithId>> {
  const map = new Map<string, HsWithId>();
  for (const code of new Set(codes)) {
    const rows = await db
      .select()
      .from(schema.hsCodes)
      .where(and(eq(schema.hsCodes.code, code), isNull(schema.hsCodes.deleted_at)))
      .limit(1);
    const row = rows[0];
    if (!row || !row.is_active) {
      throw AppError.validation(`Unknown or inactive HS code: ${code}`);
    }
    map.set(code, row as unknown as HsWithId);
  }
  return map;
}

async function branchCodeFor(branchId: string): Promise<{ code: string; name_en: string }> {
  const rows = await db
    .select({ code: schema.branches.code, name_en: schema.branches.name_en })
    .from(schema.branches)
    .where(and(eq(schema.branches.id, branchId), isNull(schema.branches.deleted_at)))
    .limit(1);
  const row = rows[0];
  if (!row) throw AppError.validation(`Branch ${branchId} not found`);
  return row;
}

/** Compute item-level results for a set of item inputs (no persistence). */
export async function computeItems(items: AssessmentItemInput[], exchangeRate: number, exemptionType: ExemptionType) {
  const hsMap = await resolveHsIds(items.map((i) => i.hs_code));
  const output = calculateTax({
    currency: "ETB",
    items: items.map((item) => {
      const hs = hsMap.get(item.hs_code)!;
      return {
        hsCode: {
          code: hs.code,
          description_en: hs.description_en,
          duty_rate: Number(hs.duty_rate),
          excise_rate: Number(hs.excise_rate),
          vat_rate: Number(hs.vat_rate),
          surtax_rate: Number(hs.surtax_rate),
          withholding_rate: Number(hs.withholding_rate),
          minimum_duty_floor: hs.minimum_duty_floor == null ? null : Number(hs.minimum_duty_floor),
          is_exempt_eligible: hs.is_exempt_eligible,
          is_capital_goods: hs.is_capital_goods,
          is_raw_material: hs.is_raw_material,
        },
        quantity: item.quantity,
        unitPriceForeign: item.unit_price_foreign,
        freightForeign: item.freight_foreign,
        insuranceForeign: item.insurance_foreign,
      };
    }),
    exchangeRate,
    exemptionType,
    scanningFee: config.SCANNING_FEE_FLAT_ETB,
  });
  return { output, hsMap };
}

async function getAssessment(id: string): Promise<AssessmentRow> {
  const rows = await db
    .select()
    .from(schema.assessments)
    .where(and(eq(schema.assessments.id, id), isNull(schema.assessments.deleted_at)))
    .limit(1);
  const row = rows[0];
  if (!row) throw AppError.notFound("Assessment not found");
  return row;
}

async function loadItems(assessmentId: string): Promise<AssessmentItemDto[]> {
  const rows = await db
    .select()
    .from(schema.assessmentItems)
    .where(eq(schema.assessmentItems.assessment_id, assessmentId))
    .orderBy(asc(schema.assessmentItems.line_number));
  return rows.map(itemDto);
}

async function persistAssessment(
  input: CreateAssessmentInput,
  createdBy: string,
  now: Date
): Promise<{ row: AssessmentRow; items: AssessmentItemDto[] }> {
  const { output, hsMap } = await computeItems(input.items, input.exchange_rate_applied, input.exemption_type);
  const branch = await branchCodeFor(input.branch_id);

  const generator = new AssessmentNumberGenerator(async (candidate) => {
    const prefix = `ECC-${candidate.branchCode}-${candidate.year}-`;
    const rows = await db.select({ assessment_number: schema.assessments.assessment_number }).from(schema.assessments);
    let maxSeq = 0;
    for (const r of rows) {
      if (r.assessment_number.startsWith(prefix)) {
        const seq = Number(r.assessment_number.slice(prefix.length));
        if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return maxSeq + 1;
  });
  const assessmentNumber = await generator.generate(branch.code, now.getFullYear());

  return await db.transaction(async (tx) => {
    const summary = output.summary;
    const totalPayable = summary.grandTotalPayable;
    const [assessment] = await tx
      .insert(schema.assessments)
      .values({
        assessment_number: assessmentNumber,
        created_by_user_id: createdBy,
        declarant_name: input.declarant_name,
        declarant_tin: input.declarant_tin,
        declarant_passport_no: input.declarant_passport_no,
        declarant_phone: input.declarant_phone,
        declarant_email: input.declarant_email,
        branch_id: input.branch_id,
        port_of_entry_id: input.port_of_entry_id,
        consignment_id: input.consignment_id,
        currency: input.currency,
        exchange_rate_applied: String(input.exchange_rate_applied),
        total_cif_etb: String(summary.totalCifEtb),
        total_duty_etb: String(summary.totalDutyEtb),
        total_excise_etb: String(summary.totalExciseEtb),
        total_vat_etb: String(summary.totalVatEtb),
        total_surtax_etb: String(summary.totalSurtaxEtb),
        total_withholding_etb: String(summary.totalWithholdingEtb),
        total_scanning_fee_etb: String(summary.scanningFee),
        total_payable_etb: String(totalPayable),
        total_paid_etb: "0",
        remaining_balance_etb: String(totalPayable),
        status: "DRAFT",
        exemption_type: input.exemption_type,
        idempotency_key: input.idempotency_key,
      })
      .returning();

    const itemRows: AssessmentItemDto[] = [];
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      const hs = hsMap.get(item.hs_code)!;
      const result = output.items[i];
      const inserted = await tx
        .insert(schema.assessmentItems)
        .values({
          assessment_id: assessment!.id,
          line_number: i + 1,
          hs_code_id: hs.id,
          item_description: item.item_description,
          quantity: String(item.quantity),
          unit_price_foreign: String(item.unit_price_foreign),
          total_fob_foreign: String(item.quantity * item.unit_price_foreign),
          freight_foreign: String(item.freight_foreign),
          insurance_foreign: String(item.insurance_foreign),
          cif_etb: String(result.cifEtb),
          duty_amount: String(result.dutyAmount),
          excise_amount: String(result.exciseAmount),
          vat_amount: String(result.vatAmount),
          surtax_amount: String(result.surtaxAmount),
          withholding_amount: String(result.withholdingAmount),
          total_item_tax_etb: String(result.totalItemTax),
          notes: item.notes,
        })
        .returning();
      itemRows.push(itemDto(inserted[0]!));
    }

    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: assessment!.id,
      from_status: "DRAFT",
      to_status: "DRAFT",
      changed_by_id: createdBy,
    });

    return { row: assessment!, items: itemRows };
  });
}

export async function createDraft(input: CreateAssessmentInput, createdBy: string) {
  const { row, items } = await persistAssessment(input, createdBy, new Date());
  const dto = toDto(row);
  dto.items = items;
  return dto;
}

export async function getAssessmentDetail(id: string) {
  const row = await getAssessment(id);
  const dto = toDto(row);
  dto.items = await loadItems(id);
  return dto;
}

export interface ListParams {
  status?: string;
  branch?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export async function listAssessments(user: { id: string; role: UserRole }, params: ListParams) {
  const conditions = [isNull(schema.assessments.deleted_at)];
  if (params.status) conditions.push(eq(schema.assessments.status, params.status));
  if (params.from) conditions.push(gte(schema.assessments.created_at, new Date(params.from)));
  if (params.to) conditions.push(lte(schema.assessments.created_at, new Date(params.to)));

  if (user.role === "IMPORTER") {
    conditions.push(eq(schema.assessments.created_by_user_id, user.id));
  } else if (user.role === "VALUATION_OFFICER") {
    const u = await db
      .select({ branch_id: schema.users.branch_id })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);
    if (u[0]?.branch_id) {
      conditions.push(eq(schema.assessments.branch_id, u[0].branch_id));
    }
  }

  const [totalRows, rows] = await Promise.all([
    db.select({ id: schema.assessments.id }).from(schema.assessments).where(and(...conditions)),
    db
      .select()
      .from(schema.assessments)
      .where(and(...conditions))
      .orderBy(desc(schema.assessments.created_at))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit),
  ]);

  return { data: rows.map(toDto), total: totalRows.length };
}

export async function submitAssessment(id: string, user: { id: string; role: UserRole }) {
  const row = await getAssessment(id);
  await assertOwnerOrBranch(id, row, user);
  if (row.status !== "DRAFT") throw AppError.conflict("Only draft assessments can be submitted");
  const items = await loadItems(id);
  if (items.length === 0) throw AppError.validation("Assessment has no items");

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.assessments)
      .set({ status: "SUBMITTED", submitted_at: new Date() })
      .where(eq(schema.assessments.id, id))
      .returning();
    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: id,
      from_status: "DRAFT",
      to_status: "SUBMITTED",
      changed_by_id: user.id,
    });
    return toDto(updated!);
  });
}

export async function approveAssessment(id: string, user: { id: string; role: UserRole }) {
  const row = await getAssessment(id);
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(row.status)) {
    throw AppError.conflict(`Assessment cannot be approved from status ${row.status}`);
  }
  const now = new Date();
  const qrHash = signQrToken({
    assessmentId: id,
    assessmentNumber: row.assessment_number,
    status: "APPROVED",
    totalPayable: Number(row.total_payable_etb),
    issuedAt: Math.floor(now.getTime() / 1000),
    expiresAt: Math.floor(now.getTime() / 1000) + 365 * 24 * 60 * 60,
  });
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.assessments)
      .set({
        status: "APPROVED",
        reviewed_by_officer_id: user.id,
        reviewed_at: now,
        rejection_reason: null,
        expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        qr_verification_hash: qrHash,
      })
      .where(eq(schema.assessments.id, id))
      .returning();
    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: id,
      from_status: row.status,
      to_status: "APPROVED",
      changed_by_id: user.id,
    });
    return toDto(updated!);
  });
}

export async function rejectAssessment(id: string, reason: string, user: { id: string; role: UserRole }) {
  const row = await getAssessment(id);
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(row.status)) {
    throw AppError.conflict(`Assessment cannot be rejected from status ${row.status}`);
  }
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.assessments)
      .set({
        status: "REJECTED",
        reviewed_by_officer_id: user.id,
        reviewed_at: new Date(),
        rejection_reason: reason,
      })
      .where(eq(schema.assessments.id, id))
      .returning();
    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: id,
      from_status: row.status,
      to_status: "REJECTED",
      changed_by_id: user.id,
      reason,
    });
    return toDto(updated!);
  });
}

export async function cancelAssessment(id: string, user: { id: string; role: UserRole }) {
  const row = await getAssessment(id);
  if (!["DRAFT", "SUBMITTED"].includes(row.status)) {
    throw AppError.conflict(`Only draft or submitted assessments can be cancelled`);
  }
  if (row.created_by_user_id !== user.id && user.role !== "SUPER_ADMIN") {
    throw AppError.forbidden("Only the owner or an admin can cancel this assessment");
  }
  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(schema.assessments)
      .set({ status: "CANCELLED" })
      .where(eq(schema.assessments.id, id))
      .returning();
    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: id,
      from_status: row.status,
      to_status: "CANCELLED",
      changed_by_id: user.id,
    });
    return toDto(updated!);
  });
}

export interface MarkPaidInput {
  amount_etb: number;
  payment_method: string;
  bank_name?: string;
  bank_reference?: string;
  receipt_number?: string;
}

export async function markPaid(id: string, input: MarkPaidInput, user: { id: string; role: UserRole }) {
  const row = await getAssessment(id);
  if (row.status !== "APPROVED") {
    throw AppError.conflict("Only approved assessments can be marked as paid");
  }
  if (input.amount_etb <= 0) throw AppError.validation("Payment amount must be positive");

  const totalPaid = (Number(row.total_paid_etb) || 0) + input.amount_etb;
  const totalPayable = Number(row.total_payable_etb);
  const outstanding = totalPayable - totalPaid;
  const newStatus = outstanding <= 0 ? "PAID" : "PARTIALLY_PAID";

  return await db.transaction(async (tx) => {
    const paymentNumber = `PAY-${id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const [payment] = await tx
      .insert(schema.paymentRecords)
      .values({
        assessment_id: id,
        payment_number: paymentNumber,
        amount_etb: String(input.amount_etb),
        payment_method: input.payment_method,
        payment_status: "CONFIRMED",
        bank_name: input.bank_name,
        bank_reference: input.bank_reference,
        receipt_number: input.receipt_number,
        paid_at: new Date(),
        confirmed_by_id: user.id,
        confirmed_at: new Date(),
      })
      .returning();

    const [updated] = await tx
      .update(schema.assessments)
      .set({
        status: newStatus,
        total_paid_etb: String(totalPaid),
        remaining_balance_etb: String(Math.max(0, outstanding)),
        paid_at: new Date(),
        payment_reference: payment!.payment_number,
      })
      .where(eq(schema.assessments.id, id))
      .returning();

    await tx.insert(schema.assessmentStatusHistory).values({
      assessment_id: id,
      from_status: row.status,
      to_status: newStatus,
      changed_by_id: user.id,
    });

    return { assessment: toDto(updated!), payment_number: payment!.payment_number };
  });
}

async function assertOwnerOrBranch(id: string, row: AssessmentRow, user: { id: string; role: UserRole }) {
  if (user.role === "SUPER_ADMIN") return;
  if (row.created_by_user_id === user.id) return;
  throw AppError.forbidden("Not authorized to modify this assessment");
}
