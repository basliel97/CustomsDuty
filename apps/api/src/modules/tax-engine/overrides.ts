import type { RateOverrides } from "./calculator.js";

export type OverrideTaxComponent = "duty" | "excise" | "vat" | "surtax" | "withholding";

export interface RateOverrideRecord {
  /** HS code the override targets (e.g. "8703.23.90"). */
  hsCode: string;
  taxComponent: OverrideTaxComponent;
  overrideRate: number;
  validFrom: string; // YYYY-MM-DD
  validTo?: string | null; // YYYY-MM-DD | null = indefinite
  isActive: boolean;
  /** Used to break ties when overlapping overrides apply on the same date. */
  createdAt?: Date | string;
}

export interface ResolveOptions {
  /** Reference date (YYYY-MM-DD or Date). Defaults to today. */
  asOf?: string | Date;
}

const COMPONENT_SLOT = {
  duty: "dutyRate",
  excise: "exciseRate",
  vat: "vatRate",
  surtax: "surtaxRate",
  withholding: "withholdingRate",
} as const;

type SlotKey = (typeof COMPONENT_SLOT)[OverrideTaxComponent];

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  // Treat YYYY-MM-DD as local midnight to avoid UTC boundary issues.
  return new Date(`${value}T00:00:00`);
}

function recordTime(record: RateOverrideRecord): Date {
  return record.createdAt ? toDate(record.createdAt as string) : new Date(0);
}

function isEffective(record: RateOverrideRecord, asOf: Date): boolean {
  if (!record.isActive) return false;
  if (asOf < toDate(record.validFrom)) return false;
  if (record.validTo && asOf > toDate(record.validTo)) return false;
  return true;
}

/**
 * Produce the effective overrides map for the calculator, resolving:
 *   - only active overrides that overlap the `asOf` date
 *   - when multiple overrides for the same hsCode+component overlap, the most recent wins
 */
export function resolveOverrides(records: RateOverrideRecord[], options: ResolveOptions = {}): RateOverrides {
  const asOf = options.asOf ? toDate(options.asOf) : new Date();
  const result: RateOverrides = {};
  const latest: Record<string, Date> = {};

  for (const record of records) {
    if (!isEffective(record, asOf)) continue;

    const bucket = (result[record.hsCode] ??= {}) as Record<string, number>;
    const slot: SlotKey = COMPONENT_SLOT[record.taxComponent];
    const stampKey = `${record.hsCode}:${slot}`;
    const stamp = recordTime(record);

    // Most recent effective override for this hsCode+component wins.
    if (latest[stampKey] && stamp <= latest[stampKey]) continue;

    latest[stampKey] = stamp;
    bucket[slot] = record.overrideRate;
  }

  return result;
}
