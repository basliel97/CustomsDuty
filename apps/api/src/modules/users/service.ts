import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../lib/errors.js";
import { isValidRole } from "../../lib/rbac.js";
import type { UserRole } from "@customs-duty-pro/shared";

export interface CreateUserInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  badge_number?: string;
  branch_id?: string;
  role: UserRole;
}

export interface UpdateUserInput {
  full_name?: string;
  phone?: string;
  badge_number?: string;
  branch_id?: string;
  status?: string;
  role?: UserRole;
}

export interface UserDto {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  badge_number: string | null;
  branch_id: string | null;
  role: UserRole;
  status: string;
  created_at: Date;
}

function toDto(row: typeof schema.users.$inferSelect): UserDto {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    phone: row.phone ?? null,
    badge_number: row.badge_number ?? null,
    branch_id: row.branch_id ?? null,
    role: row.role as UserRole,
    status: row.status,
    created_at: row.created_at,
  };
}

function requireValidRole(role?: string): role is UserRole {
  if (role === undefined) return true;
  return isValidRole(role);
}

export async function createUser(input: CreateUserInput): Promise<UserDto> {
  if (!requireValidRole(input.role)) {
    throw AppError.validation("Invalid role");
  }
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), isNull(schema.users.deleted_at)))
    .limit(1);
  if (existing.length > 0) {
    throw AppError.conflict("A user with this email already exists");
  }
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(schema.users)
    .values({
      email,
      password_hash: passwordHash,
      full_name: input.full_name.trim(),
      phone: input.phone?.trim(),
      badge_number: input.badge_number?.trim(),
      branch_id: input.branch_id,
      role: input.role,
      status: "ACTIVE",
      password_changed_at: new Date(),
    })
    .returning();
  return toDto(row!);
}

export async function listUsers(params: { page?: number; limit?: number; role?: UserRole; status?: string } = {}): Promise<{ users: UserDto[]; total: number }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const conditions = [isNull(schema.users.deleted_at)];
  if (params.role) conditions.push(eq(schema.users.role, params.role));
  if (params.status) conditions.push(eq(schema.users.status, params.status));

  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(schema.users)
      .where(and(...conditions))
      .orderBy(desc(schema.users.created_at))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: schema.users.id })
      .from(schema.users)
      .where(and(...conditions)),
  ]);

  return { users: rows.map(toDto), total: counts.length };
}

export async function getUserById(id: string): Promise<UserDto> {
  const rows = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, id), isNull(schema.users.deleted_at)))
    .limit(1);
  const row = rows[0];
  if (!row) throw AppError.notFound("User not found");
  return toDto(row);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserDto> {
  const current = await getUserById(id);
  if (input.role !== undefined && !isValidRole(input.role)) {
    throw AppError.validation("Invalid role");
  }

  const [row] = await db
    .update(schema.users)
    .set({
      full_name: input.full_name?.trim(),
      phone: input.phone?.trim(),
      badge_number: input.badge_number?.trim(),
      branch_id: input.branch_id,
      status: input.status ?? current.status,
      role: input.role ?? current.role,
    })
    .where(eq(schema.users.id, id))
    .returning();
  if (!row) throw AppError.notFound("User not found");
  return toDto(row);
}

export async function setUserStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "LOCKED"): Promise<UserDto> {
  const current = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, id), isNull(schema.users.deleted_at)))
    .limit(1);
  const currentRow = current[0];
  if (!currentRow) throw AppError.notFound("User not found");
  const [row] = await db
    .update(schema.users)
    .set({
      status,
      // Unlock when reactivating/suspending explicitly.
      locked_until: status === "ACTIVE" ? null : currentRow.locked_until,
    })
    .where(eq(schema.users.id, id))
    .returning();
  if (!row) throw AppError.notFound("User not found");
  return toDto(row);
}
