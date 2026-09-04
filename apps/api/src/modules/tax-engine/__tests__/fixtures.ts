import type { HsCodeRecord } from "@customs-duty-pro/shared";

export function hsCode(partial: Partial<HsCodeRecord> = {}): HsCodeRecord {
  return {
    code: "9999.99.99",
    description_en: "Test HS code",
    duty_rate: 0.2,
    excise_rate: 0,
    vat_rate: 0.15,
    surtax_rate: 0.1,
    withholding_rate: 0.03,
    minimum_duty_floor: null,
    is_exempt_eligible: false,
    is_capital_goods: false,
    is_raw_material: false,
    ...partial,
  };
}
