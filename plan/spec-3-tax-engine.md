# Technical Specification — Part 3: Tax Engine & Business Logic

## 3.1 Core Calculation Pipeline

The tax engine is a **pure function** — given inputs, it deterministically produces outputs with no side effects. This makes it easy to test, audit, and reason about.

### Input Types

```typescript
interface TaxCalculationInput {
  items: TaxCalculationItem[];
  currency: string;                // USD, EUR, GBP, etc.
  exchangeRate: number;            // NBE rate for that currency->ETB
  exemptionType: ExemptionType;    // NONE | DIASPORA | INVESTMENT | DIPLOMATIC
  scanningFee: number;             // Flat fee (default 200 ETB)
}

interface TaxCalculationItem {
  hsCode: HsCodeRecord;           // Full HS code record with all rates
  quantity: number;
  unitPriceForeign: number;
  freightForeign: number;          // Allocated freight for this item
  insuranceForeign: number;        // Allocated insurance for this item
}
```

### Output Types

```typescript
interface TaxCalculationOutput {
  items: ItemTaxResult[];
  summary: TaxSummary;
  appliedExemption: ExemptionType;
}

interface ItemTaxResult {
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

interface TaxSummary {
  totalCifEtb: number;
  totalDutyEtb: number;
  totalExciseEtb: number;
  totalVatEtb: number;
  totalSurtaxEtb: number;
  totalWithholdingEtb: number;
  scanningFee: number;
  grandTotalPayable: number;
}
```

## 3.2 Calculation Steps (Per Item)

```
Step 1: CIF Calculation
  FOB_Etb      = quantity * unitPriceForeign * exchangeRate
  Freight_Etb  = freightForeign * exchangeRate
  Insurance_Etb = insuranceForeign * exchangeRate
  CIF_Etb      = FOB_Etb + Freight_Etb + Insurance_Etb

Step 2: Customs Duty
  IF exemption == DIPLOMATIC:
    dutyAmount = 0
  ELIF exemption == INVESTMENT AND hsCode is capital_goods OR raw_material:
    dutyAmount = 0
  ELIF exemption == DIASPORA AND hsCode.is_exempt_eligible:
    dutyAmount = 0
  ELSE:
    dutyAmount = CIF_Etb * hsCode.duty_rate

Step 3: Excise Tax
  exciseBase   = CIF_Etb + dutyAmount
  IF exemption == DIPLOMATIC:
    exciseAmount = 0
  ELIF exemption == DIASPORA AND hsCode.is_exempt_eligible:
    exciseAmount = 0
  ELSE:
    exciseAmount = exciseBase * hsCode.excise_rate

Step 4: VAT & Sur-Tax Base
  vatSurtaxBase = CIF_Etb + dutyAmount + exciseAmount

Step 5: VAT
  IF exemption == DIPLOMATIC:
    vatAmount = 0
  ELIF exemption == DIASPORA:
    vatAmount = 0  (diaspora exempts VAT for eligible items)
  ELSE:
    vatAmount = vatSurtaxBase * hsCode.vat_rate  (default 0.15)

Step 6: Sur-Tax
  IF exemption == DIPLOMATIC:
    surtaxAmount = 0
  ELIF exemption == INVESTMENT:
    surtaxAmount = 0  (investment exempts sur-tax)
  ELIF exemption == DIASPORA AND hsCode.is_exempt_eligible:
    surtaxAmount = 0
  ELSE:
    surtaxAmount = vatSurtaxBase * hsCode.surtax_rate  (default 0.10)

Step 7: Withholding Tax
  IF exemption == DIPLOMATIC:
    withholdingAmount = 0
  ELSE:
    withholdingAmount = CIF_Etb * hsCode.withholding_rate  (default 0.03)

Step 8: Item Total
  totalItemTax = dutyAmount + exciseAmount + vatAmount + surtaxAmount + withholdingAmount
```

## 3.3 Grand Total (All Items)

```
totalCifEtb       = SUM of all item CIF values
totalDutyEtb      = SUM of all item duty amounts
totalExciseEtb    = SUM of all item excise amounts
totalVatEtb       = SUM of all item VAT amounts
totalSurtaxEtb    = SUM of all item sur-tax amounts
totalWithholdingEtb = SUM of all item withholding amounts
grandTotalPayable = totalDuty + totalExcise + totalVat + totalSurtax + totalWithholding + scanningFee
```

## 3.4 Exemption Rules Matrix

| Tax Component   | NONE | DIASPORA | INVESTMENT | DIPLOMATIC |
|-----------------|------|----------|------------|------------|
| Customs Duty    | Full | Exempt*  | Exempt**   | Exempt     |
| Excise Tax      | Full | Exempt*  | Full       | Exempt     |
| VAT             | Full | Exempt*  | Full       | Exempt     |
| Sur-Tax         | Full | Exempt*  | Exempt     | Exempt     |
| Withholding     | Full | Full     | Full       | Exempt     |
| Scanning Fee    | Full | Full     | Full       | Full***    |

\* DIASPORA: Only for `is_exempt_eligible` items. Not all items qualify.
\** INVESTMENT: Only for approved capital goods and manufacturing raw materials (requires EIC certificate).
\*** DIPLOMATIC: Scanning fee may still apply depending on bilateral agreements.

## 3.5 Edge Cases & Business Rules

1. **Zero-rate items**: Some HS codes (e.g., medicines, wheat) have 0% duty but may still have VAT. The engine must handle mixed zero/non-zero rates correctly.

2. **Freight/Insurance allocation**: When a consignment has multiple items, freight and insurance can be:
   - Proportional to FOB value of each item (default)
   - Explicitly allocated per item (manual override)

3. **Minimum duty floor**: Some categories may have a minimum duty amount in ETB (to be configured per HS code). If `dutyAmount < minimumFloor`, use `minimumFloor`.

4. **Rounding**: All calculations use `Math.round(amount * 100) / 100` (2 decimal places) at each intermediate step to avoid floating-point drift.

5. **Negative protection**: No tax amount can be negative. If calculation produces negative (e.g., due to exemption), clamp to 0.

6. **Validation invariants**:
   - `cifEtb >= 0`
   - `quantity > 0`
   - `unitPriceForeign >= 0`
   - `exchangeRate > 0`
   - Each tax component `>= 0`
   - `grandTotalPayable >= scanningFee` (at minimum, scanning fee is always charged)

## 3.6 Temporary Rate Overrides

Government may temporarily:
- **Suspend sur-tax** for specific goods (e.g., during holidays)
- **Reduce duty** for humanitarian imports
- **Increase excise** for luxury goods

Implementation:
- Add a `rate_overrides` table with `hs_code_id`, `tax_component`, `override_rate`, `valid_from`, `valid_to`, `government_decree_ref`.
- The tax engine checks for active overrides before applying default HS code rates.
- Override applicability is date-range bounded.

### Table: `rate_overrides`

| Column          | Type            | Constraints                       | Description                  |
|-----------------|-----------------|-----------------------------------|------------------------------|
| id              | UUID            | PK                                |                              |
| hs_code_id      | UUID            | FK -> hs_codes.id, NOT NULL       | Target HS code               |
| tax_component   | VARCHAR(20)     | NOT NULL                          | duty, excise, vat, surtax    |
| override_rate   | DECIMAL(6,4)    | NOT NULL                          | New rate (can be 0)          |
| valid_from      | DATE            | NOT NULL                          | Start date                   |
| valid_to        | DATE            | NULL                              | End date (NULL = indefinite) |
| decree_reference| VARCHAR(200)    | NOT NULL                          | Legal reference              |
| created_by      | UUID            | FK -> users.id, NOT NULL          | Who created it               |
| created_at      | TIMESTAMP       | NOT NULL, DEFAULT NOW()           |                              |

## 3.7 Assessment Number Generation

Format: `ECC-{BRANCH_CODE}-{YYYY}-{SEQUENCE}`

- `ECC` = Ethiopian Customs Commission
- `BRANCH_CODE` = 3-letter branch code (e.g., `ADD` for Addis Ababa, `BLT` for Bole)
- `YYYY` = Year
- `SEQUENCE` = 6-digit zero-padded auto-increment (per branch, per year)

Example: `ECC-ADD-2026-001245`

Implementation: Use PostgreSQL sequence per branch-year combination, or a single sequence with branch-year prefix.

## 3.8 Draft Expiry

- When an importer creates a draft assessment, it auto-expires after **48 hours** if not submitted.
- Expired drafts are marked `EXPIRED` and cannot be submitted.
- A cron job / scheduled task runs every hour to expire stale drafts.

## 3.9 Idempotency

- Every `POST /api/assessments/submit` request must include an `Idempotency-Key` header.
- The server stores the key with the response. If the same key is received again, it returns the cached response without reprocessing.
- Keys expire after 24 hours.
- Stored in a Redis hash: `idempotency:{key} -> {status, response, timestamp}`.
