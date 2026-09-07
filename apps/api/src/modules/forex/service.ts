import { and, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { AppError } from "../../lib/errors.js";

export interface ForexDto {
  id: string;
  currency: string;
  exchangeRateToEtb: number;
  previousRate: number | null;
  changeAmount: number | null;
  changePercentage: number | null;
  effectiveDate: string;
  source: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface SetForexInput {
  currency: string;
  exchange_rate_to_etb: number;
  effective_date: string;
  source?: string;
  notes?: string;
}

export interface CorrectForexInput {
  exchange_rate_to_etb?: number;
  effective_date?: string;
  source?: string;
  notes?: string | null;
}

type ForexRow = typeof schema.forexRates.$inferSelect;

export function toDto(row: ForexRow): ForexDto {
  return {
    id: row.id,
    currency: row.currency,
    exchangeRateToEtb: Number(row.exchange_rate_to_etb),
    previousRate: row.previous_rate == null ? null : Number(row.previous_rate),
    changeAmount: row.change_amount == null ? null : Number(row.change_amount),
    changePercentage: row.change_percentage == null ? null : Number(row.change_percentage),
    effectiveDate: row.effective_date,
    source: row.source,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

async function latestRateForCurrency(currency: string, effectiveDate?: string) {
  const conds = [
    eq(schema.forexRates.currency, currency),
    isNull(schema.forexRates.deleted_at),
  ];
  if (effectiveDate) conds.push(lte(schema.forexRates.effective_date, effectiveDate));
  const rows = await db
    .select()
    .from(schema.forexRates)
    .where(and(...conds))
    .orderBy(desc(schema.forexRates.effective_date))
    .limit(1);
  return rows[0];
}

/**
 * Latest active exchange rate per currency (public).
 */
export async function getCurrentRates(): Promise<ForexDto[]> {
  const rows = await db
    .select()
    .from(schema.forexRates)
    .where(isNull(schema.forexRates.deleted_at));

  const byCurrency = new Map<string, ForexRow>();
  for (const row of rows) {
    const existing = byCurrency.get(row.currency);
    if (!existing || row.effective_date > existing.effective_date) {
      byCurrency.set(row.currency, row);
    }
  }
  return Array.from(byCurrency.values()).map(toDto);
}

export interface ForexHistoryParams {
  currency?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

/**
 * Rate history with optional currency/date filters (authenticated).
 */
export async function getHistory(params: ForexHistoryParams) {
  const conditions = [isNull(schema.forexRates.deleted_at)];
  if (params.currency) conditions.push(ilike(schema.forexRates.currency, params.currency));
  if (params.from) conditions.push(gte(schema.forexRates.effective_date, params.from));
  if (params.to) conditions.push(lte(schema.forexRates.effective_date, params.to));

  const [totalRows, rows] = await Promise.all([
    db
      .select({ id: schema.forexRates.id })
      .from(schema.forexRates)
      .where(and(...conditions)),
    db
      .select()
      .from(schema.forexRates)
      .where(and(...conditions))
      .orderBy(desc(schema.forexRates.effective_date))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit),
  ]);

  return { data: rows.map(toDto), total: totalRows.length };
}

/**
 * Set a new daily rate for a currency (TARIFF_SPECIALIST / SUPER_ADMIN).
 * Records previous rate and computes change; upserts by (currency, effective_date).
 */
export async function setRate(
  input: SetForexInput,
  setByUserId: string
): Promise<ForexDto> {
  const previous = await latestRateForCurrency(input.currency, input.effective_date);
  const previousRate = previous ? Number(previous.exchange_rate_to_etb) : null;
  const exchangeRate = input.exchange_rate_to_etb;
  const changeAmount = previousRate != null ? Number((exchangeRate - previousRate).toFixed(4)) : null;
  const changePercentage =
    previousRate != null && previousRate !== 0
      ? Number((((exchangeRate - previousRate) / previousRate) * 100).toFixed(4))
      : null;

  const existing = await db
    .select({ id: schema.forexRates.id })
    .from(schema.forexRates)
    .where(
      and(
        eq(schema.forexRates.currency, input.currency),
        eq(schema.forexRates.effective_date, input.effective_date),
        isNull(schema.forexRates.deleted_at)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const [row] = await db
      .update(schema.forexRates)
      .set({
        exchange_rate_to_etb: String(exchangeRate),
        previous_rate: previousRate != null ? String(previousRate) : null,
        change_amount: changeAmount != null ? String(changeAmount) : null,
        change_percentage: changePercentage != null ? String(changePercentage) : null,
        source: input.source ?? "NBE",
        notes: input.notes,
        set_by_user_id: setByUserId,
      })
      .where(eq(schema.forexRates.id, existing[0].id))
      .returning();
    return toDto(row!);
  }

  const [row] = await db
    .insert(schema.forexRates)
    .values({
      currency: input.currency,
      exchange_rate_to_etb: String(exchangeRate),
      previous_rate: previousRate != null ? String(previousRate) : null,
      change_amount: changeAmount != null ? String(changeAmount) : null,
      change_percentage: changePercentage != null ? String(changePercentage) : null,
      effective_date: input.effective_date,
      source: input.source ?? "NBE",
      notes: input.notes,
      set_by_user_id: setByUserId,
    })
    .returning();
  return toDto(row!);
}

/**
 * Correct an existing rate entry (audited).
 */
export async function correctRate(id: string, input: CorrectForexInput): Promise<ForexDto> {
  const existing = await db
    .select()
    .from(schema.forexRates)
    .where(and(eq(schema.forexRates.id, id), isNull(schema.forexRates.deleted_at)))
    .limit(1);
  const row = existing[0];
  if (!row) throw AppError.notFound("Forex rate not found");

  const values: Record<string, unknown> = {};
  if (input.exchange_rate_to_etb !== undefined) values.exchange_rate_to_etb = String(input.exchange_rate_to_etb);
  if (input.effective_date !== undefined) values.effective_date = input.effective_date;
  if (input.source !== undefined) values.source = input.source;
  if (input.notes !== undefined) values.notes = input.notes;

  // Recompute change vs the stored previous rate when the rate changes.
  if (input.exchange_rate_to_etb !== undefined) {
    const previousRate = row.previous_rate == null ? null : Number(row.previous_rate);
    const exchangeRate = input.exchange_rate_to_etb;
    if (previousRate != null) {
      values.change_amount = String(Number((exchangeRate - previousRate).toFixed(4)));
      values.change_percentage =
        previousRate !== 0
          ? String(Number((((exchangeRate - previousRate) / previousRate) * 100).toFixed(4)))
          : null;
    }
  }

  const [updated] = await db
    .update(schema.forexRates)
    .set(values as never)
    .where(eq(schema.forexRates.id, id))
    .returning();
  return toDto(updated!);
}
