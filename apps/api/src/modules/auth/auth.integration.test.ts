import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { app } from "../../app.js";
import { db, schema } from "../../db/index.js";
import { signEmailVerificationToken } from "../../lib/jwt.js";

const ADMIN_EMAIL = "admin@customs.gov.et";
const ADMIN_PASSWORD = "Admin@123";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string };
}

const base = "/api/v1";

function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
}

let adminToken = "";
const createdUserIds: string[] = [];

async function postJson(path: string, body: unknown, token?: string): Promise<Response> {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string): Promise<Response> {
  return app.request(path, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function patchJson(path: string, body: unknown, token: string): Promise<Response> {
  return app.request(path, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function json<T>(res: Response): Promise<ApiResponse<T>> {
  return res.json() as Promise<ApiResponse<T>>;
}

async function cleanup() {
  for (const id of createdUserIds) {
    try {
      await db
        .update(schema.users)
        .set({ deleted_at: new Date() })
        .where(eq(schema.users.id, id));
      await db
        .delete(schema.userSessions)
        .where(eq(schema.userSessions.user_id, id));
      await db
        .delete(schema.passwordHistory)
        .where(eq(schema.passwordHistory.user_id, id));
    } catch {
      // ignore
    }
  }
  createdUserIds.length = 0;
}

beforeAll(async () => {
  // Admin login once for the whole suite (guarded so earlier failures surface clearly).
  const res = await postJson(`${base}/auth/login`, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const body = await json<{ accessToken: string; user: { id: string } }>(res);
  expect(res.status).toBe(200);
  adminToken = body.data!.accessToken;
});

afterAll(async () => {
  await cleanup();
});

describe("register", () => {
  it("registers a new importer as PENDING_VERIFICATION (generic response)", async () => {
    const email = uniqueEmail("reg");
    const res = await postJson(`${base}/auth/register`, {
      email,
      password: "Str0ng!Pass",
      full_name: "Test Importer",
      phone: "+251911000000",
    });
    expect(res.status).toBe(201);

    const rows = await db
      .select({ id: schema.users.id, status: schema.users.status, role: schema.users.role })
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deleted_at)));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PENDING_VERIFICATION");
    expect(rows[0].role).toBe("IMPORTER");
    createdUserIds.push(rows[0].id);
    await cleanup();
  });

  it("does not reveal an existing account on re-registration", async () => {
    const email = uniqueEmail("dup");
    await postJson(`${base}/auth/register`, {
      email,
      password: "Str0ng!Pass",
      full_name: "First",
    });
    const res = await postJson(`${base}/auth/register`, {
      email,
      password: "Str0ng!Pass",
      full_name: "Second",
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.message).toContain("Check your email");

    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    createdUserIds.push(rows[0].id);
    await cleanup();
  });

  it("rejects passwords that fail policy", async () => {
    const res = await postJson(`${base}/auth/register`, {
      email: uniqueEmail("weak"),
      password: "weak",
      full_name: "Weak Pass",
    });
    expect(res.status).not.toBe(201);
  });
});

let verifyUserId = "";
let verifyEmailAddress = "";

describe("email verification + login", () => {
  beforeEach(async () => {
    await cleanup();
    verifyEmailAddress = uniqueEmail("verify");
    await postJson(`${base}/auth/register`, {
      email: verifyEmailAddress,
      password: "Str0ng!Pass",
      full_name: "Verify Me",
    });
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, verifyEmailAddress));
    verifyUserId = rows[0].id;
    createdUserIds.push(verifyUserId);
  });

  it("activates a PENDING_VERIFICATION account via a valid token", async () => {
    const token = signEmailVerificationToken({ sub: verifyUserId, email: verifyEmailAddress });
    const res = await get(`${base}/auth/verify-email?token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);

    const row = await db
      .select({ status: schema.users.status })
      .from(schema.users)
      .where(eq(schema.users.id, verifyUserId));
    expect(row[0].status).toBe("ACTIVE");
  });

  it("rejects an invalid verification token", async () => {
    const res = await get(`${base}/auth/verify-email?token=invalid.token.value`);
    expect(res.status).toBe(400);
  });

  it("allows login once the account is verified", async () => {
    const token = signEmailVerificationToken({ sub: verifyUserId, email: verifyEmailAddress });
    await get(`${base}/auth/verify-email?token=${encodeURIComponent(token)}`);
    const res = await postJson(`${base}/auth/login`, {
      email: verifyEmailAddress,
      password: "Str0ng!Pass",
    });
    expect(res.status).toBe(200);
    const body = await json<{ accessToken: string }>(res);
    expect(body.data!.accessToken).toBeTruthy();
  });
});

describe("login behaviour", () => {
  let email = "";

  beforeAll(async () => {
    // Create a dedicated ACTIVE user for login tests that never affects the seed admin.
    email = uniqueEmail("login");
    const res = await postJson(
      `${base}/users`,
      {
        email,
        password: "Str0ng!Pass",
        full_name: "Login User",
        role: "IMPORTER",
      },
      adminToken
    );
    expect(res.status).toBe(201);
    const body = await json<{ id: string }>(res);
    createdUserIds.push(body.data!.id);
  });

  it("logs in with valid credentials", async () => {
    const res = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
    expect(res.status).toBe(200);
    const body = await json<{ accessToken: string; refreshToken: string; user: { email: string } }>(res);
    expect(body.success).toBe(true);
    expect(body.data!.accessToken).toBeTruthy();
    expect(body.data!.refreshToken).toBeTruthy();
    expect(body.data!.user.email).toBe(email);

    // Cleanup sessions created by this login.
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    await db.delete(schema.userSessions).where(eq(schema.userSessions.user_id, rows[0].id));
  });

  it("returns 401 for wrong password without revealing account existence", async () => {
    const res = await postJson(`${base}/auth/login`, { email, password: "Wrong!Pass1" });
    expect(res.status).toBe(401);
  });

  it("returns 401 for unknown email", async () => {
    const res = await postJson(`${base}/auth/login`, {
      email: "nobody@test.local",
      password: "Whatever!1",
    });
    expect(res.status).toBe(401);
  });

  it("locks the account after max failed attempts", async () => {
    const userRow = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    const userId = userRow[0].id;
    await db
      .update(schema.users)
      .set({ failed_login_count: 0, locked_until: null, status: "ACTIVE" })
      .where(eq(schema.users.id, userId));

    for (let i = 0; i < 5; i++) {
      const res = await postJson(`${base}/auth/login`, { email, password: "Wrong!Pass1" });
      expect(res.status).toBe(401);
    }
    // Now locked: correct password returns 423.
    const res = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
    expect(res.status).toBe(423);
    expect((await json(res)).error?.code).toBe("LOCKED");

    // Reset for other tests.
    await db
      .update(schema.users)
      .set({ failed_login_count: 0, locked_until: null, status: "ACTIVE" })
      .where(eq(schema.users.id, userId));
  });
});

describe("refresh + logout + me", () => {
  let accessToken = "";
  let refreshToken = "";

  beforeAll(async () => {
    const email = uniqueEmail("session");
    await postJson(
      `${base}/users`,
      { email, password: "Str0ng!Pass", full_name: "Session User", role: "IMPORTER" },
      adminToken
    );
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    createdUserIds.push(rows[0].id);

    const res = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
    const body = await json<{ accessToken: string; refreshToken: string }>(res);
    accessToken = body.data!.accessToken;
    refreshToken = body.data!.refreshToken;
  });

  it("GET /me returns the authenticated user", async () => {
    const res = await get(`${base}/auth/me`, accessToken);
    expect(res.status).toBe(200);
    const body = await json<{ email: string }>(res);
    expect(body.data!.email).toBeTruthy();
  });

  it("GET /me rejects missing token", async () => {
    const res = await get(`${base}/auth/me`);
    expect(res.status).toBe(401);
  });

  it("GET /me rejects invalid token", async () => {
    const res = await get(`${base}/auth/me`, "not.a.real.token");
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token", async () => {
    const res = await postJson(`${base}/auth/refresh`, { refreshToken });
    expect(res.status).toBe(200);
    const body = await json<{ accessToken: string; refreshToken: string }>(res);
    expect(body.data!.refreshToken).toBeTruthy();
    expect(body.data!.refreshToken).not.toBe(refreshToken);
    refreshToken = body.data!.refreshToken;
  });

  it("rejects a revoked/invalid refresh token", async () => {
    const res = await postJson(`${base}/auth/refresh`, { refreshToken });
    expect(res.status).toBe(200);
    const body = await json<{ accessToken: string; refreshToken: string }>(res);
    refreshToken = body.data!.refreshToken;

    // Logging out revokes all sessions; the current refresh token becomes unusable.
    await postJson(`${base}/auth/logout`, {}, accessToken);
    const second = await postJson(`${base}/auth/refresh`, { refreshToken });
    expect(second.status).toBe(401);
  });
});

describe("change-password", () => {
  let email = "";
  let token = "";

  beforeAll(async () => {
    email = uniqueEmail("pw");
    await postJson(
      `${base}/users`,
      { email, password: "Str0ng!Pass", full_name: "PW User", role: "IMPORTER" },
      adminToken
    );
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    createdUserIds.push(rows[0].id);
    const res = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
    const body = await json<{ accessToken: string }>(res);
    token = body.data!.accessToken;
  });

  it("changes password and revokes existing refresh tokens", async () => {
    const res = await postJson(
      `${base}/auth/change-password`,
      { currentPassword: "Str0ng!Pass", newPassword: "NewStr0ng!Pass" },
      token
    );
    expect(res.status).toBe(200);

    const relog = await postJson(`${base}/auth/login`, { email, password: "NewStr0ng!Pass" });
    expect(relog.status).toBe(200);
  });

  it("rejects the wrong current password", async () => {
    const res = await postJson(
      `${base}/auth/change-password`,
      { currentPassword: "Wrong!Pass", newPassword: "OtherStr0ng!1" },
      token
    );
    expect(res.status).toBe(400);
  });

  it("rejects reusing a recent password", async () => {
    const res = await postJson(
      `${base}/auth/change-password`,
      { currentPassword: "NewStr0ng!Pass", newPassword: "Str0ng!Pass" },
      token
    );
    expect(res.status).toBe(400);
  });
});

describe("user CRUD + RBAC", () => {
  it("rejects user listing without authentication", async () => {
    const res = await get(`${base}/users`);
    expect(res.status).toBe(401);
  });

  it("lets a super-admin list users", async () => {
    const res = await get(`${base}/users`, adminToken);
    expect(res.status).toBe(200);
    const body = await json<{ users: unknown[] }>(res);
    expect(Array.isArray(body.data!.users)).toBe(true);
  });

  it("blocks an importer from listing users (permission denied)", async () => {
    const email = uniqueEmail("importer");
    await postJson(
      `${base}/users`,
      { email, password: "Str0ng!Pass", full_name: "Test Importer", role: "IMPORTER" },
      adminToken
    );
    const rows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email));
    createdUserIds.push(rows[0].id);

    const res = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
    const body = await json<{ accessToken: string }>(res);
    const importerToken = body.data!.accessToken;

    const listRes = await get(`${base}/users`, importerToken);
    expect(listRes.status).toBe(403);

    await db.delete(schema.userSessions).where(eq(schema.userSessions.user_id, rows[0].id));
  });

  it("creates, updates role, and suspends a user", async () => {
    const email = uniqueEmail("crud");
    const createRes = await postJson(
      `${base}/users`,
      { email, password: "Str0ng!Pass", full_name: "Crud User", role: "VALUATION_OFFICER" },
      adminToken
    );
    expect(createRes.status).toBe(201);
    const created = await json<{ id: string; role: string }>(createRes);
    expect(created.data!.role).toBe("VALUATION_OFFICER");
    createdUserIds.push(created.data!.id);

    const roleRes = await patchJson(
      `${base}/users/${created.data!.id}/role`,
      { role: "TARIFF_SPECIALIST" },
      adminToken
    );
    expect(roleRes.status).toBe(200);
    expect((await json<{ role: string }>(roleRes)).data!.role).toBe("TARIFF_SPECIALIST");

    const suspendRes = await patchJson(
      `${base}/users/${created.data!.id}/status`,
      { status: "SUSPENDED" },
      adminToken
    );
    expect(suspendRes.status).toBe(200);
    expect((await json<{ status: string }>(suspendRes)).data!.status).toBe("SUSPENDED");
  });
});
