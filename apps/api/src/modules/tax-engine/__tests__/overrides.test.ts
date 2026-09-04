import { describe, it, expect } from "vitest";
import { resolveOverrides, type RateOverrideRecord } from "../overrides.js";

function rec(partial: Partial<RateOverrideRecord> & { hsCode: string; taxComponent: RateOverrideRecord["taxComponent"]; overrideRate: number }): RateOverrideRecord {
  return {
    validFrom: "2026-01-01",
    validTo: null,
    isActive: true,
    ...partial,
  };
}

describe("resolveOverrides", () => {
  it("returns empty map when no records", () => {
    expect(resolveOverrides([])).toEqual({});
  });

  it("includes only active records overlapping the asOf date", () => {
    const res = resolveOverrides(
      [
        rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.1, validFrom: "2026-01-01", validTo: "2026-12-31" }),
        rec({ hsCode: "1111.11.11", taxComponent: "excise", overrideRate: 0.2, validFrom: "2026-01-01", validTo: null }),
        rec({ hsCode: "2222.22.22", taxComponent: "duty", overrideRate: 0.5, validFrom: "2027-01-01", validTo: "2027-12-31" }),
      ],
      { asOf: "2026-06-15" }
    );
    expect(res["1111.11.11"]).toEqual({ dutyRate: 0.1, exciseRate: 0.2 });
    // 2222 not effective yet
    expect(res["2222.22.22"]).toBeUndefined();
  });

  it("excludes expired overrides", () => {
    const res = resolveOverrides(
      [rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.1, validFrom: "2020-01-01", validTo: "2020-12-31" })],
      { asOf: "2026-01-01" }
    );
    expect(res["1111.11.11"]).toBeUndefined();
  });

  it("excludes inactive overrides", () => {
    const res = resolveOverrides(
      [rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.1, isActive: false })],
      { asOf: "2026-01-01" }
    );
    expect(res["1111.11.11"]).toBeUndefined();
  });

  it("most recent effective override wins for overlapping windows", () => {
    const res = resolveOverrides(
      [
        rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.05, validFrom: "2026-01-01", createdAt: "2026-01-01T00:00:00" }),
        rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.08, validFrom: "2026-03-01", createdAt: "2026-03-01T00:00:00" }),
      ],
      { asOf: "2026-06-15" }
    );
    expect(res["1111.11.11"].dutyRate).toBe(0.08);
  });

  it("older record wins if the more recent one has not started yet (non-overlapping by date)", () => {
    // 0.05 from Jan-Jun, 0.08 starts Jul. On Apr, only 0.05 is effective.
    const res = resolveOverrides(
      [
        rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.05, validFrom: "2026-01-01", validTo: "2026-06-30", createdAt: "2026-01-01" }),
        rec({ hsCode: "1111.11.11", taxComponent: "duty", overrideRate: 0.08, validFrom: "2026-07-01", validTo: null, createdAt: "2026-06-01" }),
      ],
      { asOf: "2026-04-01" }
    );
    expect(res["1111.11.11"].dutyRate).toBe(0.05);
  });

  it("handles null validTo as indefinite", () => {
    const res = resolveOverrides(
      [rec({ hsCode: "1111.11.11", taxComponent: "vat", overrideRate: 0, validFrom: "2020-01-01", validTo: null })],
      { asOf: "2026-06-15" }
    );
    expect(res["1111.11.11"].vatRate).toBe(0);
  });
});
