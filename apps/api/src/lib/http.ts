import type { Context } from "hono";
import { AppError } from "./errors.js";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginationQuery {
  page: number;
  limit: number;
  sort?: string;
  order: "asc" | "desc";
}

/**
 * Parse and validate common pagination/sort query params from a request.
 * Falls back to page=1, limit=20, order=desc on missing/invalid values.
 */
export function parsePagination(
  c: Context,
  opts: { maxLimit?: number; defaultSort?: string } = {}
): PaginationQuery {
  const maxLimit = opts.maxLimit ?? 100;
  const rawPage = Number(c.req.query("page") ?? 1);
  const rawLimit = Number(c.req.query("limit") ?? 20);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limitRaw = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 20;
  const limit = Math.min(limitRaw, maxLimit);
  const orderRaw = c.req.query("order");
  const order = orderRaw === "asc" ? "asc" : "desc";
  const sort = c.req.query("sort") || opts.defaultSort;
  return { page, limit, sort, order };
}

export function paginationMeta(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    pages: limit === 0 ? 0 : Math.max(1, Math.ceil(total / limit)),
  };
}

interface AnyRow {
  id?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
}

/**
 * Sort an in-memory array of rows by a field with direction. Used for the
 * lightweight reference endpoints; heavier lists sort in SQL.
 */
export function applySort<T extends AnyRow>(rows: T[], sort?: string, order: "asc" | "desc" = "desc"): T[] {
  if (!sort || rows.length === 0) return rows;
  const dir = order === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export function paginate<T>(rows: T[], page: number, limit: number): T[] {
  return rows.slice((page - 1) * limit, page * limit);
}

/**
 * Build the standard list envelope with pagination meta.
 */
export function okList<T>(data: T[], meta: PaginationMeta) {
  return { success: true as const, data, meta };
}

/**
 * Build the standard single-resource envelope.
 */
export function ok(data: unknown, meta?: PaginationMeta) {
  return meta ? { success: true as const, data, meta } : { success: true as const, data };
}

export { AppError };
