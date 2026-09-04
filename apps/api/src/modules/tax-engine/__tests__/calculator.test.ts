import { describe, it, expect } from "vitest";
import { calculateTax } from "../calculator.js";
import { hsCode } from "./fixtures.js";

describe("calculateTax · CIF calculation", () => {
  it("computes CIF = FOB + freight + insurance", () => {
    const out = calculateTax({
      items: [
        {
          hsCode: hsCode(),
          quantity: 10,
          unitPriceForeign: 100,
          freightForeign: 50,
          insuranceForeign: 20,
        },
      ],
      currency: "USD",
      exchangeRate: 57.5,
      exemptionType: "NONE",
      scanningFee: 200,
    });

    expect(out.items[0].cifEtb).toBe(61525);
    expect(out.summary.totalCifEtb).toBe(61525);
  });

  it("handles zero freight and insurance", () => {
    const out = calculateTax({
      items: [
        { hsCode: hsCode(), quantity: 2, unitPriceForeign: 500, freightForeign: 0, insuranceForeign: 0 },
      ],
      currency: "USD",
      exchangeRate: 57.5,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].cifEtb).toBe(57500);
  });

  it("handles multiple items summed into totals", () => {
    const out = calculateTax({
      items: [
        { hsCode: hsCode({ code: "1111.11.11" }), quantity: 1, unitPriceForeign: 1000, freightForeign: 0, insuranceForeign: 0 },
        { hsCode: hsCode({ code: "2222.22.22", duty_rate: 0.05 }), quantity: 3, unitPriceForeign: 1000, freightForeign: 0, insuranceForeign: 0 },
      ],
      currency: "USD",
      exchangeRate: 10,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.summary.totalCifEtb).toBe(40000); // 10000 + 30000
    expect(out.summary.totalDutyEtb).toBe(3500); // 2000 + 1500
  });
});

describe("calculateTax · duty rates", () => {
  it.each([
    [0, 0],
    [0.05, 250],
    [0.1, 500],
    [0.2, 1000],
    [0.35, 1750],
  ])("applies duty rate %i on CIF 5000", (rate, expected) => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: rate }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 50,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].dutyAmount).toBe(expected);
  });
});

describe("calculateTax · excise tax", () => {
  it("applies excise on CIF + duty base", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: 0.35, excise_rate: 0.3 }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 50,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    // CIF=5000, duty=1750, base=6750, excise=2025
    expect(out.items[0].dutyAmount).toBe(1750);
    expect(out.items[0].exciseAmount).toBe(2025);
  });

  it("zero excise rate produces zero", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ excise_rate: 0 }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 50,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].exciseAmount).toBe(0);
  });
});

describe("calculateTax · VAT & Sur-Tax", () => {
  it("applies VAT and surtax on the CIF+duty+excise base", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: 0.2, excise_rate: 0.1 }), quantity: 1, unitPriceForeign: 1000, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    const item = out.items[0];
    // CIF=1000, duty=200, excise=(1200*0.1)=120, base=1320
    expect(item.cifEtb).toBe(1000);
    expect(item.dutyAmount).toBe(200);
    expect(item.exciseAmount).toBe(120);
    expect(item.vatAmount).toBe(1320 * 0.15); // 198
    expect(item.surtaxAmount).toBe(1320 * 0.1); // 132
  });

  it("supports zero-rated items (0% vat via rate)", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ vat_rate: 0, surtax_rate: 0 }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].vatAmount).toBe(0);
    expect(out.items[0].surtaxAmount).toBe(0);
  });
});

describe("calculateTax · withholding", () => {
  it("applies default 3% withholding on CIF", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode(), quantity: 1, unitPriceForeign: 1000, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].withholdingAmount).toBe(30);
  });
});

describe("calculateTax · exemptions", () => {
  it("DIASPORA waives duty+excise+vat+surtax for eligible items, keeps withholding + all for non-eligible", () => {
    const eligible = hsCode({ code: "3004.90.00", is_exempt_eligible: true });
    const notEligible = hsCode({ code: "8517.13.00", is_exempt_eligible: false });

    const out = calculateTax({
      items: [
        { hsCode: eligible, quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 },
        { hsCode: notEligible, quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 },
      ],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "DIASPORA",
      scanningFee: 200,
    });

    const elig = out.items[0];
    // eligible: all waived -> cif 100, duty/excise/vat/surtax 0, withholding still 3
    expect(elig.dutyAmount).toBe(0);
    expect(elig.exciseAmount).toBe(0);
    expect(elig.vatAmount).toBe(0);
    expect(elig.surtaxAmount).toBe(0);
    expect(elig.withholdingAmount).toBe(3);

    const notElig = out.items[1];
    // not eligible -> full tax applies
    expect(notElig.dutyAmount).toBe(20);
    expect(notElig.withholdingAmount).toBe(3);
  });

  it("INVESTMENT waives duty+surtax for capital goods / raw materials but keeps excise+vat+withholding", () => {
    const capital = hsCode({ code: "8471.30.00", is_capital_goods: true });
    const normal = hsCode({ code: "6110.30.00", is_capital_goods: false });

    const out = calculateTax({
      items: [
        { hsCode: capital, quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 },
        { hsCode: normal, quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 },
      ],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "INVESTMENT",
      scanningFee: 200,
    });

    const cap = out.items[0];
    expect(cap.cifEtb).toBe(100);
    expect(cap.dutyAmount).toBe(0);
    expect(cap.surtaxAmount).toBe(0);
    // excise + vat + withholding still apply
    expect(cap.vatAmount).toBe(100 * 0.15); // 15
    expect(cap.withholdingAmount).toBe(3);

    const norm = out.items[1];
    // Per spec matrix: INVESTMENT surtax is Exempt for ALL items, but duty only for capital/raw.
    expect(norm.surtaxAmount).toBe(0);
    expect(norm.dutyAmount).toBe(20);
  });

  it("DIPLOMATIC waives everything except scanning fee", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode(), quantity: 1, unitPriceForeign: 1000, freightForeign: 100, insuranceForeign: 50 }],
      currency: "USD",
      exchangeRate: 57.5,
      exemptionType: "DIPLOMATIC",
      scanningFee: 200,
    });
    const item = out.items[0];
    expect(item.dutyAmount).toBe(0);
    expect(item.exciseAmount).toBe(0);
    expect(item.vatAmount).toBe(0);
    expect(item.surtaxAmount).toBe(0);
    expect(item.withholdingAmount).toBe(0);
    expect(item.cifEtb).toBe(1000 * 57.5 + 100 * 57.5 + 50 * 57.5);
    expect(out.summary.grandTotalPayable).toBe(200); // only scanning fee
    expect(out.summary.scanningFee).toBe(200);
  });
});

describe("calculateTax · minimum duty floor", () => {
  it("bumps duty below the floor up to the floor", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: 0.2, minimum_duty_floor: 100 }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1, // CIF=100, duty=20 -> below floor 100
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].dutyAmount).toBe(100);
  });

  it("keeps duty above the floor unchanged", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: 0.2, minimum_duty_floor: 100 }), quantity: 10, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1, // CIF=1000, duty=200
      exemptionType: "NONE",
      scanningFee: 200,
    });
    expect(out.items[0].dutyAmount).toBe(200);
  });
});

describe("calculateTax · rounding", () => {
  it("rounds each amount to 2 decimal places", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode(), quantity: 3, unitPriceForeign: 999.99, freightForeign: 1.11, insuranceForeign: 0.99 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "NONE",
      scanningFee: 0,
    });
    const item = out.items[0];
    for (const v of [item.cifEtb, item.dutyAmount, item.vatAmount, item.surtaxAmount, item.withholdingAmount, item.totalItemTax]) {
      expect(Number.isInteger(Math.round(v * 100))).toBe(true);
    }
  });
});

describe("calculateTax · validation & edge cases", () => {
  it("throws for zero quantity", () => {
    expect(() =>
      calculateTax({
        items: [{ hsCode: hsCode(), quantity: 0, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
        currency: "USD",
        exchangeRate: 1,
        exemptionType: "NONE",
        scanningFee: 200,
      })
    ).toThrow(/quantity/i);
  });

  it("throws for negative unit price", () => {
    expect(() =>
      calculateTax({
        items: [{ hsCode: hsCode(), quantity: 1, unitPriceForeign: -1, freightForeign: 0, insuranceForeign: 0 }],
        currency: "USD",
        exchangeRate: 1,
        exemptionType: "NONE",
        scanningFee: 200,
      })
    ).toThrow(/unit price/i);
  });

  it("throws for non-positive exchange rate", () => {
    expect(() =>
      calculateTax({
        items: [{ hsCode: hsCode(), quantity: 1, unitPriceForeign: 1, freightForeign: 0, insuranceForeign: 0 }],
        currency: "USD",
        exchangeRate: 0,
        exemptionType: "NONE",
        scanningFee: 200,
      })
    ).toThrow(/exchangeRate/i);
  });

  it("handles very large amounts (100M+) without precision loss", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode(), quantity: 1000000, unitPriceForeign: 100000, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 57.5,
      exemptionType: "NONE",
      scanningFee: 200,
    });
    // CIF = 1,000,000 * 100,000 * 57.5 = 5,750,000,000,000
    expect(out.summary.totalCifEtb).toBe(5750000000000);
    expect(out.summary.totalDutyEtb).toBe(1150000000000);
  });

  it("grand total >= scanning fee", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ duty_rate: 0 }), quantity: 1, unitPriceForeign: 1, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "DIPLOMATIC",
      scanningFee: 200,
    });
    expect(out.summary.grandTotalPayable).toBeGreaterThanOrEqual(200);
  });
});

describe("calculateTax · rate overrides via calculator", () => {
  it("applies an active override rate", () => {
    const out = calculateTax({
      items: [{ hsCode: hsCode({ code: "8703.23.90", duty_rate: 0.35 }), quantity: 1, unitPriceForeign: 100, freightForeign: 0, insuranceForeign: 0 }],
      currency: "USD",
      exchangeRate: 1,
      exemptionType: "NONE",
      scanningFee: 200,
      overrides: { "8703.23.90": { dutyRate: 0.1 } },
    });
    expect(out.items[0].dutyAmount).toBe(10);
    expect(out.items[0].ratesApplied.dutyRate).toBe(0.1);
  });
});
