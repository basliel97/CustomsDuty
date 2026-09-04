import { describe, it, expect } from "vitest";
import { calculateTax } from "../calculator.js";
import { hsCode } from "./fixtures.js";
import type { ExemptionType, HsCodeRecord } from "@customs-duty-pro/shared";

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomHsCode(): HsCodeRecord {
  return hsCode({
    code: `${Math.floor(randomBetween(1000, 9999))}.${Math.floor(randomBetween(0, 99))}.${Math.floor(randomBetween(0, 99))}`,
    duty_rate: randomBetween(0, 0.5),
    excise_rate: randomBetween(0, 1.5),
    vat_rate: randomBetween(0, 0.15),
    surtax_rate: randomBetween(0, 0.1),
    withholding_rate: randomBetween(0, 0.03),
    minimum_duty_floor: Math.random() < 0.3 ? randomBetween(100, 5000) : null,
    is_exempt_eligible: Math.random() < 0.5,
    is_capital_goods: Math.random() < 0.5,
    is_raw_material: Math.random() < 0.3,
  });
}

const EXEMPTIONS: ExemptionType[] = ["NONE", "DIASPORA", "INVESTMENT", "DIPLOMATIC"];

describe("property-based invariants", () => {
  for (let i = 0; i < 200; i++) {
    it(`iteration ${i}: satisfies all core invariants`, () => {
      const exemptionType = EXEMPTIONS[Math.floor(Math.random() * EXEMPTIONS.length)];
      const itemCount = Math.floor(randomBetween(1, 4));
      const items = Array.from({ length: itemCount }, () => ({
        hsCode: randomHsCode(),
        quantity: Math.floor(randomBetween(1, 1000)),
        unitPriceForeign: randomBetween(0, 1000),
        freightForeign: randomBetween(0, 200),
        insuranceForeign: randomBetween(0, 200),
      }));
      const exchangeRate = randomBetween(0.01, 60);
      const scanningFee = 200;

      const out = calculateTax({
        items,
        currency: "USD",
        exchangeRate,
        exemptionType,
        scanningFee,
      });

      const s = out.summary;
      const itemTotals = out.items.reduce((acc, r) => ({
        cif: acc.cif + r.cifEtb,
        duty: acc.duty + r.dutyAmount,
        excise: acc.excise + r.exciseAmount,
        vat: acc.vat + r.vatAmount,
        surtax: acc.surtax + r.surtaxAmount,
        withh: acc.withh + r.withholdingAmount,
      }), { cif: 0, duty: 0, excise: 0, vat: 0, surtax: 0, withh: 0 });

      // No tax component can be negative
      for (const r of out.items) {
        expect(r.cifEtb).toBeGreaterThanOrEqual(0);
        expect(r.dutyAmount).toBeGreaterThanOrEqual(0);
        expect(r.exciseAmount).toBeGreaterThanOrEqual(0);
        expect(r.vatAmount).toBeGreaterThanOrEqual(0);
        expect(r.surtaxAmount).toBeGreaterThanOrEqual(0);
        expect(r.withholdingAmount).toBeGreaterThanOrEqual(0);
        expect(r.totalItemTax).toBeGreaterThanOrEqual(0);
        expect(r.totalItemTax).toBeCloseTo(r.dutyAmount + r.exciseAmount + r.vatAmount + r.surtaxAmount + r.withholdingAmount, 2);
      }

      // Summary sums match item aggregates
      expect(s.totalCifEtb).toBeCloseTo(itemTotals.cif, 2);
      expect(s.totalDutyEtb).toBeCloseTo(itemTotals.duty, 2);
      expect(s.totalExciseEtb).toBeCloseTo(itemTotals.excise, 2);
      expect(s.totalVatEtb).toBeCloseTo(itemTotals.vat, 2);
      expect(s.totalSurtaxEtb).toBeCloseTo(itemTotals.surtax, 2);
      expect(s.totalWithholdingEtb).toBeCloseTo(itemTotals.withh, 2);

      // Grand total >= scanning fee, and equals sum of components + fee
      expect(s.grandTotalPayable).toBeGreaterThanOrEqual(s.scanningFee);
      expect(s.grandTotalPayable).toBeCloseTo(s.totalDutyEtb + s.totalExciseEtb + s.totalVatEtb + s.totalSurtaxEtb + s.totalWithholdingEtb + s.scanningFee, 2);

      // Every amount rounded to 2 decimals
      const allValues = [
        ...out.items.flatMap((r) => [r.cifEtb, r.dutyAmount, r.exciseAmount, r.vatAmount, r.surtaxAmount, r.withholdingAmount, r.totalItemTax]),
        s.totalCifEtb, s.totalDutyEtb, s.totalExciseEtb, s.totalVatEtb, s.totalSurtaxEtb, s.totalWithholdingEtb, s.grandTotalPayable,
      ];
      for (const v of allValues) {
        const cents = v * 100;
        // A value rounded to 2 decimals has an integer cent count; allow only float-representation
        // noise (bounded by Number.EPSILON * magnitude), NOT a genuine fractional cent.
        expect(Math.abs(cents - Math.round(cents))).toBeLessThanOrEqual(4 * Number.EPSILON * Math.abs(cents) + 1e-9);
      }
    });
  }
});
