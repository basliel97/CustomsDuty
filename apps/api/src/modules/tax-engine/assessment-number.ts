/**
 * Assessment number generation.
 *
 * Format: ECC-{BRANCH_CODE}-{YYYY}-{SEQUENCE}
 *   ECC          = Ethiopian Customs Commission
 *   BRANCH_CODE  = 3-letter branch code (e.g. ADD)
 *   YYYY         = year
 *   SEQUENCE     = 6-digit zero-padded auto-increment (per branch, per year)
 *
 * Example: ECC-ADD-2026-001245
 */

export interface AssessmentNumberParts {
  branchCode: string;
  year: number;
  sequence: number;
}

/** Shape of the parsed/candidate parts for validation. */
export interface AssessmentNumberCandidate {
  branchCode: string;
  year: number;
}

export const ASSESSMENT_NUMBER_PATTERN = /^ECC-[A-Z0-9]{2,5}-\d{4}-\d{6}$/;

export function formatAssessmentNumber(parts: AssessmentNumberParts): string {
  const branchCode = parts.branchCode.toUpperCase().trim();
  if (!/^[A-Z0-9]{2,5}$/.test(branchCode)) {
    throw new Error(`Invalid branch code: "${parts.branchCode}"`);
  }
  const year = Math.trunc(parts.year);
  if (year < 2000 || year > 9999) {
    throw new Error(`Invalid year: ${parts.year}`);
  }
  const sequence = Math.trunc(parts.sequence);
  if (sequence < 1 || sequence > 999999) {
    throw new Error(`Sequence out of range: ${parts.sequence}`);
  }
  return `ECC-${branchCode}-${year}-${sequence.toString().padStart(6, "0")}`;
}

export function parseAssessmentNumber(value: string): AssessmentNumberParts | null {
  const match = ASSESSMENT_NUMBER_PATTERN.exec(value.trim().toUpperCase());
  if (!match) return null;
  const [branchCode, yearStr, seqStr] = value.trim().toUpperCase().slice(4).split("-");
  return {
    branchCode,
    year: Number(yearStr),
    sequence: Number(seqStr),
  };
}

/**
 * Generates branch+year scoped assessment numbers.
 *
 * The `nextSequence` provider is supplied by the calling layer (DB sequence or a
 * per-branch-year counter) so this class stays pure and easily testable.
 */
export class AssessmentNumberGenerator {
  constructor(
    private readonly nextSequence: (candidate: AssessmentNumberCandidate) => Promise<number> | number
  ) {}

  async generate(branchCode: string, year = new Date().getFullYear()): Promise<string> {
    const sequence = await this.nextSequence({ branchCode, year });
    return formatAssessmentNumber({ branchCode, year, sequence });
  }
}
