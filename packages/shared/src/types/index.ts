export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  branchLocation?: string;
  iat: number;
  exp: number;
}

export interface TaxCalculationInput {
  items: TaxCalculationItem[];
  currency: string;
  exchangeRate: number;
  exemptionType: string;
  scanningFee: number;
}

export interface TaxCalculationItem {
  hsCode: HsCodeRecord;
  quantity: number;
  unitPriceForeign: number;
  freightForeign: number;
  insuranceForeign: number;
}

export interface HsCodeRecord {
  code: string;
  description_en: string;
  duty_rate: number;
  excise_rate: number;
  vat_rate: number;
  surtax_rate: number;
  withholding_rate: number;
  minimum_duty_floor: number | null;
  is_exempt_eligible: boolean;
  is_capital_goods: boolean;
  is_raw_material: boolean;
}

export interface ItemTaxResult {
  hsCode: string;
  description: string;
  cifEtb: number;
  dutyAmount: number;
  exciseAmount: number;
  vatAmount: number;
  surtaxAmount: number;
  withholdingAmount: number;
  totalItemTax: number;
  ratesApplied: {
    dutyRate: number;
    exciseRate: number;
    vatRate: number;
    surtaxRate: number;
    withholdingRate: number;
  };
}

export interface TaxSummary {
  totalCifEtb: number;
  totalDutyEtb: number;
  totalExciseEtb: number;
  totalVatEtb: number;
  totalSurtaxEtb: number;
  totalWithholdingEtb: number;
  scanningFee: number;
  grandTotalPayable: number;
}

export interface TaxCalculationOutput {
  items: ItemTaxResult[];
  summary: TaxSummary;
  appliedExemption: string;
}
