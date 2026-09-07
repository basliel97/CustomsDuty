import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { calculateTax } from "../tax-engine/index.js";
import { config } from "../../lib/config.js";
import { AppError } from "../../lib/errors.js";
import type { HsCodeRecord, TaxCalculationOutput, ExemptionType } from "@customs-duty-pro/shared";

export interface CalcItemInput {
  hs_code: string;
  quantity: number;
  unit_price_foreign: number;
  freight_foreign: number;
  insurance_foreign: number;
}

export interface CalcInput {
  currency: string;
  exchange_rate: number;
  exemption_type: ExemptionType;
  items: CalcItemInput[];
}

/**
 * Load HS-code records from the DB by code. Throws if any code is unknown/inactive.
 */
export async function resolveHsRecords(codes: string[]): Promise<HsCodeRecord[]> {
  const byCode = new Map<string, (typeof schema.hsCodes.$inferSelect)>();
  for (const code of new Set(codes)) {
    const single = await db
      .select()
      .from(schema.hsCodes)
      .where(and(eq(schema.hsCodes.code, code), isNull(schema.hsCodes.deleted_at)))
      .limit(1);
    const row = single[0];
    if (!row || !row.is_active) {
      throw AppError.validation(`Unknown or inactive HS code: ${code}`);
    }
    byCode.set(code, row);
  }

  return codes.map((code) => {
    const row = byCode.get(code)!;
    return {
      code: row.code,
      description_en: row.description_en,
      duty_rate: Number(row.duty_rate),
      excise_rate: Number(row.excise_rate),
      vat_rate: Number(row.vat_rate),
      surtax_rate: Number(row.surtax_rate),
      withholding_rate: Number(row.withholding_rate),
      minimum_duty_floor: row.minimum_duty_floor == null ? null : Number(row.minimum_duty_floor),
      is_exempt_eligible: row.is_exempt_eligible,
      is_capital_goods: row.is_capital_goods,
      is_raw_material: row.is_raw_material,
    };
  });
}

/**
 * Full tax computation from a validated request body.
 */
export async function compute(input: CalcInput): Promise<TaxCalculationOutput> {
  const hsRecords = await resolveHsRecords(input.items.map((i) => i.hs_code));
  return calculateTax({
    currency: input.currency,
    items: input.items.map((item, idx) => ({
      hsCode: hsRecords[idx],
      quantity: item.quantity,
      unitPriceForeign: item.unit_price_foreign,
      freightForeign: item.freight_foreign,
      insuranceForeign: item.insurance_foreign,
    })),
    exchangeRate: input.exchange_rate,
    exemptionType: input.exemption_type,
    scanningFee: config.SCANNING_FEE_FLAT_ETB,
  });
}

export { AppError };
