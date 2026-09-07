import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { AppError } from "../../lib/errors.js";
import type { HsCodeRecord } from "@customs-duty-pro/shared";

export interface HsCodeDto extends HsCodeRecord {
  id: string;
  description_am: string | null;
  unit_of_measurement: string;
  is_active: boolean;
  created_at: Date;
}

export interface CreateHsCodeInput {
  code: string;
  description_en: string;
  description_am?: string;
  unit_of_measurement: string;
  category_id?: string;
  duty_rate: number;
  excise_rate: number;
  vat_rate: number;
  surtax_rate: number;
  withholding_rate: number;
  minimum_duty_floor?: number | null;
  is_exempt_eligible: boolean;
  is_capital_goods: boolean;
  is_raw_material: boolean;
}

export interface UpdateHsCodeInput {
  description_en?: string;
  description_am?: string;
  unit_of_measurement?: string;
  category_id?: string | null;
  duty_rate?: number;
  excise_rate?: number;
  vat_rate?: number;
  surtax_rate?: number;
  withholding_rate?: number;
  minimum_duty_floor?: number | null;
  is_exempt_eligible?: boolean;
  is_capital_goods?: boolean;
  is_raw_material?: boolean;
}

type HsRow = typeof schema.hsCodes.$inferSelect;

export function toDto(row: HsRow): HsCodeDto {
  return {
    id: row.id,
    code: row.code,
    description_en: row.description_en,
    description_am: row.description_am,
    unit_of_measurement: row.unit_of_measurement,
    duty_rate: Number(row.duty_rate),
    excise_rate: Number(row.excise_rate),
    vat_rate: Number(row.vat_rate),
    surtax_rate: Number(row.surtax_rate),
    withholding_rate: Number(row.withholding_rate),
    minimum_duty_floor: row.minimum_duty_floor == null ? null : Number(row.minimum_duty_floor),
    is_exempt_eligible: row.is_exempt_eligible,
    is_capital_goods: row.is_capital_goods,
    is_raw_material: row.is_raw_material,
    is_active: row.is_active,
    created_at: row.created_at,
  };
}

export interface HsListParams {
  q?: string;
  page: number;
  limit: number;
  dutyRateMin?: number;
  dutyRateMax?: number;
  sort?: string;
  order: "asc" | "desc";
}

/**
 * List/search HS codes. Searches by code/description (SQL), filters duty range
 * in memory (duty_rate is a decimal string column), then paginates.
 */
export async function listHsCodes(params: HsListParams) {
  const conditions = [isNull(schema.hsCodes.deleted_at)];
  if (params.q) {
    const like = `%${params.q}%`;
    const search = or(
      ilike(schema.hsCodes.code, like),
      ilike(schema.hsCodes.description_en, like),
      ilike(schema.hsCodes.description_am, like)
    );
    if (search) conditions.push(search);
  }

  const rows = await db
    .select()
    .from(schema.hsCodes)
    .where(and(...conditions));

  let dto = rows.map(toDto);
  if (params.dutyRateMin != null) dto = dto.filter((r) => r.duty_rate >= params.dutyRateMin!);
  if (params.dutyRateMax != null) dto = dto.filter((r) => r.duty_rate <= params.dutyRateMax!);

  const total = dto.length;
  const sortField = params.sort && params.sort in (dto[0] ?? {}) ? params.sort : "code";
  const dir = params.order === "asc" ? 1 : -1;
  dto = dto.sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortField];
    const bv = (b as unknown as Record<string, unknown>)[sortField];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  const start = (params.page - 1) * params.limit;
  const items = dto.slice(start, start + params.limit);

  return { data: items, total };
}

export async function getHsCodeByCode(code: string): Promise<HsCodeDto> {
  const rows = await db
    .select()
    .from(schema.hsCodes)
    .where(and(eq(schema.hsCodes.code, code), isNull(schema.hsCodes.deleted_at)))
    .limit(1);
  const row = rows[0];
  if (!row) throw AppError.notFound(`HS code ${code} not found`);
  return toDto(row);
}

/**
 * Autocomplete search returning compact matches (public).
 */
export async function searchHsCodes(q: string, limit = 10) {
  if (!q) return [];
  const like = `%${q}%`;
  const search = or(
    ilike(schema.hsCodes.code, like),
    ilike(schema.hsCodes.description_en, like),
    ilike(schema.hsCodes.description_am, like)
  );
  const rows = await db
    .select({
      code: schema.hsCodes.code,
      description_en: schema.hsCodes.description_en,
      unit_of_measurement: schema.hsCodes.unit_of_measurement,
    })
    .from(schema.hsCodes)
    .where(and(isNull(schema.hsCodes.deleted_at), search ?? undefined))
    .limit(limit);
  return rows;
}

export async function createHsCode(input: CreateHsCodeInput): Promise<HsCodeDto> {
  const existing = await db
    .select({ id: schema.hsCodes.id })
    .from(schema.hsCodes)
    .where(and(eq(schema.hsCodes.code, input.code), isNull(schema.hsCodes.deleted_at)))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict(`HS code ${input.code} already exists`);
  }
  const [row] = await db
    .insert(schema.hsCodes)
    .values({
      code: input.code,
      category_id: input.category_id,
      description_en: input.description_en,
      description_am: input.description_am,
      unit_of_measurement: input.unit_of_measurement,
      duty_rate: String(input.duty_rate),
      excise_rate: String(input.excise_rate),
      vat_rate: String(input.vat_rate),
      surtax_rate: String(input.surtax_rate),
      withholding_rate: String(input.withholding_rate),
      minimum_duty_floor: input.minimum_duty_floor != null ? String(input.minimum_duty_floor) : null,
      is_exempt_eligible: input.is_exempt_eligible,
      is_capital_goods: input.is_capital_goods,
      is_raw_material: input.is_raw_material,
    })
    .returning();
  return toDto(row!);
}

export async function updateHsCode(id: string, input: UpdateHsCodeInput): Promise<HsCodeDto> {
  const existing = await db
    .select({ version: schema.hsCodes.version })
    .from(schema.hsCodes)
    .where(and(eq(schema.hsCodes.id, id), isNull(schema.hsCodes.deleted_at)))
    .limit(1);
  if (existing.length === 0) throw AppError.notFound("HS code not found");

  const values: Record<string, unknown> = {};
  if (input.description_en !== undefined) values.description_en = input.description_en;
  if (input.description_am !== undefined) values.description_am = input.description_am;
  if (input.unit_of_measurement !== undefined) values.unit_of_measurement = input.unit_of_measurement;
  if (input.category_id !== undefined) values.category_id = input.category_id ?? null;
  if (input.duty_rate !== undefined) values.duty_rate = String(input.duty_rate);
  if (input.excise_rate !== undefined) values.excise_rate = String(input.excise_rate);
  if (input.vat_rate !== undefined) values.vat_rate = String(input.vat_rate);
  if (input.surtax_rate !== undefined) values.surtax_rate = String(input.surtax_rate);
  if (input.withholding_rate !== undefined) values.withholding_rate = String(input.withholding_rate);
  if (input.minimum_duty_floor !== undefined) values.minimum_duty_floor = input.minimum_duty_floor != null ? String(input.minimum_duty_floor) : null;
  if (input.is_exempt_eligible !== undefined) values.is_exempt_eligible = input.is_exempt_eligible;
  if (input.is_capital_goods !== undefined) values.is_capital_goods = input.is_capital_goods;
  if (input.is_raw_material !== undefined) values.is_raw_material = input.is_raw_material;
  values.version = existing[0].version + 1;

  const [row] = await db
    .update(schema.hsCodes)
    .set(values as never)
    .where(eq(schema.hsCodes.id, id))
    .returning();
  return toDto(row!);
}

export async function deleteHsCode(id: string): Promise<void> {
  const rows = await db
    .update(schema.hsCodes)
    .set({ deleted_at: new Date(), is_active: false })
    .where(and(eq(schema.hsCodes.id, id), isNull(schema.hsCodes.deleted_at)))
    .returning({ id: schema.hsCodes.id });
  if (rows.length === 0) throw AppError.notFound("HS code not found");
}
