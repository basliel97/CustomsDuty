import { describe, it, expect } from "vitest";
import { AssessmentNumberGenerator, formatAssessmentNumber, parseAssessmentNumber, ASSESSMENT_NUMBER_PATTERN } from "../assessment-number.js";

describe("formatAssessmentNumber", () => {
  it("formats ECC-{BRANCH}-{YYYY}-{SEQ} with zero-padded sequence", () => {
    expect(formatAssessmentNumber({ branchCode: "ADD", year: 2026, sequence: 1245 })).toBe("ECC-ADD-2026-001245");
  });

  it("handles maximum sequence", () => {
    expect(formatAssessmentNumber({ branchCode: "ADD", year: 2026, sequence: 999999 })).toBe("ECC-ADD-2026-999999");
  });

  it("uppercases branch code", () => {
    expect(formatAssessmentNumber({ branchCode: "add", year: 2026, sequence: 1 })).toBe("ECC-ADD-2026-000001");
  });

  it("throws for invalid branch code", () => {
    expect(() => formatAssessmentNumber({ branchCode: "A", year: 2026, sequence: 1 })).toThrow(/branch code/i);
  });

  it("throws for out-of-range year", () => {
    expect(() => formatAssessmentNumber({ branchCode: "ADD", year: 1999, sequence: 1 })).toThrow(/year/i);
  });

  it("throws for out-of-range sequence", () => {
    expect(() => formatAssessmentNumber({ branchCode: "ADD", year: 2026, sequence: 0 })).toThrow(/sequence/i);
    expect(() => formatAssessmentNumber({ branchCode: "ADD", year: 2026, sequence: 1000000 })).toThrow(/sequence/i);
  });
});

describe("parseAssessmentNumber", () => {
  it("parses a valid number", () => {
    expect(parseAssessmentNumber("ECC-ADD-2026-001245")).toEqual({ branchCode: "ADD", year: 2026, sequence: 1245 });
  });

  it("returns null for malformed input", () => {
    expect(parseAssessmentNumber("not-a-number")).toBeNull();
    expect(parseAssessmentNumber("ECC-ADD-2026")).toBeNull();
  });

  it("matches the documented pattern", () => {
    expect(ASSESSMENT_NUMBER_PATTERN.test("ECC-ADD-2026-001245")).toBe(true);
    expect(ASSESSMENT_NUMBER_PATTERN.test("ECC-BLT-2026-000001")).toBe(true);
  });
});

describe("AssessmentNumberGenerator", () => {
  it("generates using a sequence provider", async () => {
    const gen = new AssessmentNumberGenerator(({ branchCode, year }) => {
      expect(branchCode).toBe("ADD");
      expect(year).toBe(2026);
      return 42;
    });
    await expect(gen.generate("ADD", 2026)).resolves.toBe("ECC-ADD-2026-000042");
  });

  it("defaults year to current year", async () => {
    const gen = new AssessmentNumberGenerator(() => 1);
    const expected = formatAssessmentNumber({ branchCode: "MKL", year: new Date().getFullYear(), sequence: 1 });
    await expect(gen.generate("MKL")).resolves.toBe(expected);
  });

  it("supports async sequence providers", async () => {
    const gen = new AssessmentNumberGenerator(async () => 7);
    await expect(gen.generate("KAL", 2026)).resolves.toBe("ECC-KAL-2026-000007");
  });
});
