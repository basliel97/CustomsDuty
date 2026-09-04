import type { ExemptionType, HsCodeRecord } from "./types.js";

/**
 * Which tax components are waived for a given exemption type and HS code.
 *
 * Derived from spec 3.4 (Exemption Rules Matrix):
 *   - DIASPORA   : duty/excise/vat/surtax waived, but ONLY for is_exempt_eligible items.
 *   - INVESTMENT : duty + surtax waived for capital goods or raw materials.
 *   - DIPLOMATIC : everything waived except (possibly) the scanning fee.
 *   - NONE       : nothing waived.
 */
export interface ExemptionMask {
  dutyWaived: boolean;
  exciseWaived: boolean;
  vatWaived: boolean;
  surtaxWaived: boolean;
  withholdingWaived: boolean;
}

export function getExemptionMask(
  exemptionType: ExemptionType,
  hsCode: Pick<HsCodeRecord, "is_exempt_eligible" | "is_capital_goods" | "is_raw_material">
): ExemptionMask {
  switch (exemptionType) {
    case "DIPLOMATIC":
      return {
        dutyWaived: true,
        exciseWaived: true,
        vatWaived: true,
        surtaxWaived: true,
        withholdingWaived: true,
      };

    case "DIASPORA": {
      const waived = hsCode.is_exempt_eligible;
      return {
        dutyWaived: waived,
        exciseWaived: waived,
        vatWaived: waived,
        surtaxWaived: waived,
        // Withholding is NEVER waived for DIASPORA (spec matrix: Withholding = Full)
        withholdingWaived: false,
      };
    }

    case "INVESTMENT": {
      const capitalOrRawMaterial = hsCode.is_capital_goods || hsCode.is_raw_material;
      return {
        dutyWaived: capitalOrRawMaterial,
        exciseWaived: false,
        vatWaived: false,
        surtaxWaived: true, // investment always exempts sur-tax
        withholdingWaived: false,
      };
    }

    case "NONE":
    default:
      return {
        dutyWaived: false,
        exciseWaived: false,
        vatWaived: false,
        surtaxWaived: false,
        withholdingWaived: false,
      };
  }
}
