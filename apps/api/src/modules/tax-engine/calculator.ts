import type {
  ExemptionType,
  HsCodeRecord,
  ItemTaxResult,
  TaxCalculationInput,
  TaxCalculationOutput,
} from "./types.js";
import { getExemptionMask } from "./exemptions.js";

/** Per-component override rates, keyed by HS code. Only provided components are overridden. */
export interface RateOverrides {
  [hsCode: string]: {
    dutyRate?: number;
    exciseRate?: number;
    vatRate?: number;
    surtaxRate?: number;
    withholdingRate?: number;
  };
}

/** The calculator input with an optional override map applied before computing. */
export type CalculateArgs = Omit<TaxCalculationInput, "exemptionType"> & {
  exemptionType: ExemptionType;
  overrides?: RateOverrides;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampNonNegative(value: number): number {
  return Math.max(0, round2(value));
}

export function calculateTax(input: CalculateArgs): TaxCalculationOutput {
  const { items, exchangeRate, exemptionType, scanningFee, overrides = {} } = input;

  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error("exchangeRate must be a positive number");
  }
  if (!Number.isFinite(scanningFee) || scanningFee < 0) {
    throw new Error("scanningFee must be a non-negative number");
  }

  const itemResults: ItemTaxResult[] = items.map((item) =>
    calculateItemTax(item.hsCode, item.quantity, item.unitPriceForeign, item.freightForeign, item.insuranceForeign, exchangeRate, exemptionType, overrides[item.hsCode.code])
  );

  const totalCifEtb = round2(itemResults.reduce((sum, r) => sum + r.cifEtb, 0));
  const totalDutyEtb = round2(itemResults.reduce((sum, r) => sum + r.dutyAmount, 0));
  const totalExciseEtb = round2(itemResults.reduce((sum, r) => sum + r.exciseAmount, 0));
  const totalVatEtb = round2(itemResults.reduce((sum, r) => sum + r.vatAmount, 0));
  const totalSurtaxEtb = round2(itemResults.reduce((sum, r) => sum + r.surtaxAmount, 0));
  const totalWithholdingEtb = round2(itemResults.reduce((sum, r) => sum + r.withholdingAmount, 0));
  const grandTotalPayable = round2(totalDutyEtb + totalExciseEtb + totalVatEtb + totalSurtaxEtb + totalWithholdingEtb + scanningFee);

  return {
    items: itemResults,
    appliedExemption: exemptionType,
    summary: {
      totalCifEtb,
      totalDutyEtb,
      totalExciseEtb,
      totalVatEtb,
      totalSurtaxEtb,
      totalWithholdingEtb,
      scanningFee,
      grandTotalPayable,
    },
  };
}

function calculateItemTax(
  hsCode: HsCodeRecord,
  quantity: number,
  unitPriceForeign: number,
  freightForeign: number,
  insuranceForeign: number,
  exchangeRate: number,
  exemptionType: ExemptionType,
  override?: RateOverrides[string]
): ItemTaxResult {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Invalid quantity for HS code ${hsCode.code}: must be > 0`);
  }
  if (!Number.isFinite(unitPriceForeign) || unitPriceForeign < 0) {
    throw new Error(`Invalid unit price for HS code ${hsCode.code}: must be >= 0`);
  }
  if (!Number.isFinite(freightForeign) || freightForeign < 0) {
    throw new Error(`Invalid freight for HS code ${hsCode.code}: must be >= 0`);
  }
  if (!Number.isFinite(insuranceForeign) || insuranceForeign < 0) {
    throw new Error(`Invalid insurance for HS code ${hsCode.code}: must be >= 0`);
  }

  // Effective rates: base HS code rate, overridden per component if an override is active.
  const dutyRate = override?.dutyRate ?? hsCode.duty_rate;
  const exciseRate = override?.exciseRate ?? hsCode.excise_rate;
  const vatRate = override?.vatRate ?? hsCode.vat_rate;
  const surtaxRate = override?.surtaxRate ?? hsCode.surtax_rate;
  const withholdingRate = override?.withholdingRate ?? hsCode.withholding_rate;

  const mask = getExemptionMask(exemptionType, hsCode);

  // Step 1: CIF calculation
  const fobEtb = quantity * unitPriceForeign * exchangeRate;
  const freightEtb = freightForeign * exchangeRate;
  const insuranceEtb = insuranceForeign * exchangeRate;
  const cifEtb = round2(fobEtb + freightEtb + insuranceEtb);

  // Step 2: Customs duty (with minimum duty floor)
  let dutyAmount = mask.dutyWaived ? 0 : cifEtb * dutyRate;
  if (!mask.dutyWaived && hsCode.minimum_duty_floor != null && dutyAmount < hsCode.minimum_duty_floor) {
    dutyAmount = hsCode.minimum_duty_floor;
  }
  dutyAmount = clampNonNegative(dutyAmount);

  // Step 3: Excise tax
  const exciseBase = cifEtb + dutyAmount;
  const exciseAmount = clampNonNegative(mask.exciseWaived ? 0 : exciseBase * exciseRate);

  // Step 4: VAT & Sur-Tax base
  const vatSurtaxBase = cifEtb + dutyAmount + exciseAmount;

  // Step 5: VAT
  const vatAmount = clampNonNegative(mask.vatWaived ? 0 : vatSurtaxBase * vatRate);

  // Step 6: Sur-Tax
  const surtaxAmount = clampNonNegative(mask.surtaxWaived ? 0 : vatSurtaxBase * surtaxRate);

  // Step 7: Withholding tax
  const withholdingAmount = clampNonNegative(mask.withholdingWaived ? 0 : cifEtb * withholdingRate);

  // Step 8: Item total
  const totalItemTax = round2(dutyAmount + exciseAmount + vatAmount + surtaxAmount + withholdingAmount);

  return {
    hsCode: hsCode.code,
    description: hsCode.description_en,
    cifEtb,
    dutyAmount,
    exciseAmount,
    vatAmount,
    surtaxAmount,
    withholdingAmount,
    totalItemTax,
    ratesApplied: {
      dutyRate,
      exciseRate,
      vatRate,
      surtaxRate,
      withholdingRate,
    },
  };
}
