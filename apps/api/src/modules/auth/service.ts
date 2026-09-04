import { and, eq, isNull, gte } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import {
  hashPassword,
  comparePassword,
  validatePassword,
} from "../../lib/password.js";
import {
  createTokenPair,
  hashRefreshToken,
  verifyEmailVerificationToken,
} from "../../lib/jwt.js";
import { AppError } from "../../lib/errors.js";
import type { UserRole } from "@customs-duty-pro/shared";

export const AUTH_DEFAULTS = {
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  refreshTokenDays: 7,
  passwordHistoryLimit: 5,
} as const;

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthUserDto {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  status: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

function publicUser(row: {
  id: string;
  email: string;
  role: string;
  full_name: string;
  status: string;
}): AuthUserDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    full_name: row.full_name,
    status: row.status,
  };
}

async function storeRefreshToken(userId: string, token: string, ip?: string, userAgent?: string) {
  await db.insert(schema.userSessions).values({
    user_id: userId,
    token_hash: hashRefreshToken(token),
    ip_address: ip,
    user_agent: userAgent,
    status: "ACTIVE",
    expires_at: new Date(Date.now() + AUTH_DEFAULTS.refreshTokenDays * 24 * 60 * 60 * 1000),
  }).onConflictDoNothing();
}

async function revokeAllUserSessions(userId: string) {
  await db
    .update(schema.userSessions)
    .set({ status: "REVOKED" })
    .where(and(eq(schema.userSessions.user_id, userId), eq(schema.userSessions.status, "ACTIVE")));
}

export async function register(input: RegisterInput): Promise<{ message: string }> {
  const email = input.email.trim().toLowerCase();

  const passwordViolations = validatePassword(input.password);
  if (passwordViolations.length > 0) {
    throw AppError.validation("Invalid password", passwordViolations);
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), isNull(schema.users.deleted_at)))
    .limit(1);

  if (existing.length > 0) {
    // Do not reveal that the account exists; just return the generic success.
    return { message: "Check your email to verify your account" };
  }

  const passwordHash = await hashPassword(input.password);
  await db.insert(schema.users).values({
    email,
    password_hash: passwordHash,
    full_name: input.full_name.trim(),
    phone: input.phone?.trim(),
    role: "IMPORTER",
    status: "PENDING_VERIFICATION",
    password_changed_at: new Date(),
  });

  // TODO(phase-4): queue verification email with signed link.
  return { message: "Check your email to verify your account" };
}

export async function verifyEmail(token: string): Promise<void> {
  const claims = verifyEmailVerificationToken(token);
  if (!claims || !claims.sub) {
    throw AppError.badRequest("Invalid or expired verification token");
  }
  const updated = await db
    .update(schema.users)
    .set({ status: "ACTIVE" })
    .where(and(eq(schema.users.id, claims.sub), eq(schema.users.status, "PENDING_VERIFICATION")))
    .returning({ id: schema.users.id });
  if (updated.length === 0) {
    throw AppError.badRequest("Unable to verify email");
  }
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();

  const users = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, email), isNull(schema.users.deleted_at)))
    .limit(1);

  const user = users[0];

  // Generic failure — do not reveal whether the email exists.
  if (!user) {
    throw AppError.unauthorized("Invalid credentials");
  }

  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Account suspended");
  }

  if (user.status === "LOCKED" || (user.locked_until && new Date(user.locked_until) > new Date())) {
    throw new AppError(423, "LOCKED", "Account locked, try again later");
  }

  const passwordOk = await comparePassword(input.password, user.password_hash);
  if (!passwordOk) {
    const attempts = (user.failed_login_count ?? 0) + 1;
    const shouldLock = attempts >= AUTH_DEFAULTS.maxLoginAttempts;
    await db
      .update(schema.users)
      .set({
        failed_login_count: attempts,
        locked_until: shouldLock
          ? new Date(Date.now() + AUTH_DEFAULTS.lockoutMinutes * 60 * 1000)
          : user.locked_until,
        status: shouldLock ? "LOCKED" : user.status,
      })
      .where(eq(schema.users.id, user.id));
    throw AppError.unauthorized("Invalid credentials");
  }

  // Success: reset lockout counters.
  await db
    .update(schema.users)
    .set({
      failed_login_count: 0,
      locked_until: null,
      status: user.status === "LOCKED" ? "ACTIVE" : user.status,
      last_login_at: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  const pair = createTokenPair({
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  await storeRefreshToken(user.id, pair.refreshToken, input.ip, input.userAgent);

  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, user: publicUser(user) };
}

export async function refresh(
  refreshToken: string,
  ip?: string,
  userAgent?: string
): Promise<LoginResult> {
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await db
    .select({
      sessionId: schema.userSessions.id,
      userId: schema.userSessions.user_id,
      user: schema.users,
    })
    .from(schema.userSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.userSessions.user_id))
    .where(
      and(
        eq(schema.userSessions.token_hash, tokenHash),
        eq(schema.userSessions.status, "ACTIVE"),
        isNull(schema.userSessions.deleted_at),
        isNull(schema.users.deleted_at),
        gte(schema.userSessions.expires_at, new Date())
      )
    )
    .limit(1);

  const found = session[0];
  if (!found) {
    throw AppError.unauthorized("Invalid refresh token");
  }
  const user = found.user;

  // Rotate: revoke the used refresh token.
  await db
    .update(schema.userSessions)
    .set({ status: "REVOKED" })
    .where(eq(schema.userSessions.id, found.sessionId));

  const pair = createTokenPair({
    sub: user.id,
    email: user.email,
    role: user.role as UserRole,
  });
  await storeRefreshToken(user.id, pair.refreshToken, ip, userAgent);

  return { accessToken: pair.accessToken, refreshToken: pair.refreshToken, user: publicUser(user) };
}

export async function logout(userId: string): Promise<void> {
  await revokeAllUserSessions(userId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const passwordViolations = validatePassword(newPassword);
  if (passwordViolations.length > 0) {
    throw AppError.validation("Invalid password", passwordViolations);
  }

  const users = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deleted_at)))
    .limit(1);
  const user = users[0];
  if (!user) {
    throw AppError.notFound("User not found");
  }

  const currentOk = await comparePassword(currentPassword, user.password_hash);
  if (!currentOk) {
    throw AppError.badRequest("Current password is incorrect");
  }

  // Enforce password history (cannot reuse last N passwords).
  const history = await db
    .select({ password_hash: schema.passwordHistory.password_hash })
    .from(schema.passwordHistory)
    .where(eq(schema.passwordHistory.user_id, userId))
    .orderBy(schema.passwordHistory.created_at);
  const recentHashes = history
    .slice(-AUTH_DEFAULTS.passwordHistoryLimit)
    .map((h) => h.password_hash);

  for (const oldHash of recentHashes) {
    if (await comparePassword(newPassword, oldHash)) {
      throw AppError.badRequest(`Password was used recently and cannot be reused`);
    }
  }

  const newHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    // Record the outgoing password so it cannot be immediately reused.
    await tx
      .insert(schema.passwordHistory)
      .values({ user_id: userId, password_hash: user.password_hash });
    await tx
      .update(schema.users)
      .set({ password_hash: newHash, password_changed_at: new Date() })
      .where(eq(schema.users.id, userId));
    // Revoke all refresh tokens on password change (spec 5.3).
    await tx
      .update(schema.userSessions)
      .set({ status: "REVOKED" })
      .where(and(eq(schema.userSessions.user_id, userId), eq(schema.userSessions.status, "ACTIVE")));
  });
}

export type { UserRole };
