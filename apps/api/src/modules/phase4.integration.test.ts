import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";

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
const createdAssessmentIds: string[] = [];
const createdHsCodeIds: string[] = [];

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

async function putJson(path: string, body: unknown, token: string): Promise<Response> {
  return app.request(path, {
    method: "PUT",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string): Promise<Response> {
  return app.request(path, {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function json<T>(res: Response): Promise<ApiResponse<T>> {
  return res.json() as Promise<ApiResponse<T>>;
}

async function cleanup() {
  for (const id of createdAssessmentIds) {
    try {
      await db.delete(schema.paymentRecords).where(eq(schema.paymentRecords.assessment_id, id));
      await db
        .delete(schema.assessmentStatusHistory)
        .where(eq(schema.assessmentStatusHistory.assessment_id, id));
      await db.delete(schema.assessmentItems).where(eq(schema.assessmentItems.assessment_id, id));
      await db.update(schema.assessments).set({ deleted_at: new Date() }).where(eq(schema.assessments.id, id));
    } catch {
      // ignore
    }
  }
  createdAssessmentIds.length = 0;

  for (const id of createdHsCodeIds) {
    try {
      await db.delete(schema.hsCodes).where(eq(schema.hsCodes.id, id));
    } catch {
      // ignore
    }
  }
  createdHsCodeIds.length = 0;

  for (const id of createdUserIds) {
    try {
      await db
        .update(schema.users)
        .set({ deleted_at: new Date() })
        .where(eq(schema.users.id, id));
      await db.delete(schema.userSessions).where(eq(schema.userSessions.user_id, id));
      await db.delete(schema.passwordHistory).where(eq(schema.passwordHistory.user_id, id));
    } catch {
      // ignore
    }
  }
  createdUserIds.length = 0;
}

async function getBranchId(): Promise<string> {
  const rows = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(isNull(schema.branches.deleted_at))
    .limit(1);
  return rows[0].id;
}

async function createUser(role: string, branchId?: string): Promise<{ email: string; token: string; id: string }> {
  const email = uniqueEmail(role.toLowerCase().slice(0, 3));
  const createRes = await postJson(
    `${base}/users`,
    { email, password: "Str0ng!Pass", full_name: `Test ${role}`, role, ...(branchId ? { branch_id: branchId } : {}) },
    adminToken
  );
  expect(createRes.status).toBe(201);
  const created = await json<{ id: string }>(createRes);
  createdUserIds.push(created.data!.id);

  const loginRes = await postJson(`${base}/auth/login`, { email, password: "Str0ng!Pass" });
  const login = await json<{ accessToken: string; user: { id: string } }>(loginRes);
  expect(loginRes.status).toBe(200);
  return { email, token: login.data!.accessToken, id: login.data!.user.id };
}

beforeAll(async () => {
  const res = await postJson(`${base}/auth/login`, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  const body = await json<{ accessToken: string }>(res);
  adminToken = body.data!.accessToken;
});

afterAll(async () => {
  await cleanup();
});

describe("HS codes reference endpoints", () => {
  it("lists HS codes publicly", async () => {
    const res = await get(`${base}/hs-codes`);
    expect(res.status).toBe(200);
    const body = await json<unknown[]>(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("searches HS codes by query", async () => {
    const res = await get(`${base}/hs-codes/search?q=phone`);
    expect(res.status).toBe(200);
    const body = await json<unknown[]>(res);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("fetches a single HS code by its code", async () => {
    const res = await get(`${base}/hs-codes/8517.13.00`);
    expect(res.status).toBe(200);
    const body = await json<{ code: string }>(res);
    expect(body.data!.code).toBe("8517.13.00");
  });

  it("returns 404 for an unknown HS code", async () => {
    const res = await get(`${base}/hs-codes/9999.99.99`);
    expect(res.status).toBe(404);
  });

  it("blocks an importer from creating HS codes", async () => {
    const importer = await createUser("IMPORTER");
    const res = await postJson(
      `${base}/hs-codes`,
      { code: "1111.11.11", description_en: "Test", duty_rate: 5, vat_rate: 15 },
      importer.token
    );
    expect(res.status).toBe(403);
  });

  it("allows a super-admin to create and update an HS code", async () => {
    const createRes = await postJson(
      `${base}/hs-codes`,
      { code: "1111.11.11", description_en: "Test Goods", unit_of_measurement: "UNIT", duty_rate: 0.05, excise_rate: 0, vat_rate: 0.15 },
      adminToken
    );
    expect(createRes.status).toBe(201);
    const created = await json<{ id: string }>(createRes);
    expect(created.data!.id).toBeTruthy();
    createdHsCodeIds.push(created.data!.id);

    const updateRes = await putJson(
      `${base}/hs-codes/${created.data!.id}`,
      { description_en: "Test Goods Updated", duty_rate: 0.1 },
      adminToken
    );
    expect(updateRes.status).toBe(200);
    const updated = await json<{ description_en: string }>(updateRes);
    expect(updated.data!.description_en).toBe("Test Goods Updated");
  });
});

describe("forex endpoints", () => {
  it("lists current forex rates publicly", async () => {
    const res = await get(`${base}/forex`);
    expect(res.status).toBe(200);
    const body = await json<unknown[]>(res);
    expect(Array.isArray(body.data)).toBe(true);
    expect((body.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("requires forex:set permission to set a rate", async () => {
    const importer = await createUser("IMPORTER");
    const res = await postJson(
      `${base}/forex`,
      { currency: "GBP", exchange_rate_to_etb: 79.5, effective_date: new Date().toISOString().slice(0, 10) },
      importer.token
    );
    expect(res.status).toBe(403);
  });

  it("allows an admin to set a forex rate and read history", async () => {
    const date = new Date().toISOString().slice(0, 10);
    const setRes = await postJson(
      `${base}/forex`,
      { currency: "GBP", exchange_rate_to_etb: 79.5, effective_date: date },
      adminToken
    );
    expect(setRes.status).toBe(201);

    const historyRes = await get(`${base}/forex/history?currency=GBP`, adminToken);
    expect(historyRes.status).toBe(200);
    const body = await json<unknown[]>(historyRes);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe("calculator endpoints", () => {
  const sample = {
    currency: "USD",
    exchange_rate: 57.5,
    exemption_type: "NONE",
    items: [
      { hs_code: "8517.13.00", quantity: 100, unit_price_foreign: 250, freight_foreign: 500, insurance_foreign: 100 },
    ],
  };

  it("computes a public quick estimate", async () => {
    const res = await postJson(`${base}/calculate`, sample);
    expect(res.status).toBe(200);
    const body = await json<{ summary: { grandTotalPayable: number } }>(res);
    expect(body.data!.summary.grandTotalPayable).toBeGreaterThan(0);
  });

  it("rejects an unknown HS code in the calculator", async () => {
    const res = await postJson(`${base}/calculate`, {
      ...sample,
      items: [{ hs_code: "9999.99.99", quantity: 1, unit_price_foreign: 10 }],
    });
    expect(res.status).toBe(422);
  });

  it("requires auth for the detailed preview", async () => {
    const anon = await postJson(`${base}/calculate/preview`, sample);
    expect(anon.status).toBe(401);

    const importer = await createUser("IMPORTER");
    const res = await postJson(`${base}/calculate/preview`, sample, importer.token);
    expect(res.status).toBe(200);
    const body = await json<{ items: unknown[] }>(res);
    expect(Array.isArray(body.data!.items)).toBe(true);
  });
});

describe("assessment lifecycle", () => {
  let importerToken = "";
  const branchIdPromise = getBranchId();

  beforeAll(async () => {
    const importer = await createUser("IMPORTER");
    importerToken = importer.token;
  });

  function draftBody(branchId: string) {
    return {
      declarant_name: "Integration Declarant",
      declarant_tin: "0012345678",
      declarant_phone: "+251911000000",
      branch_id: branchId,
      currency: "USD",
      exchange_rate_applied: 57.5,
      exemption_type: "NONE",
      items: [
        { hs_code: "8517.13.00", item_description: "Smartphones", quantity: 100, unit_price_foreign: 250, freight_foreign: 500, insurance_foreign: 100 },
      ],
    };
  }

  it("creates a draft, submits, approves, and marks as paid", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    expect(draftRes.status).toBe(201);
    const draft = await json<{ id: string; status: string; assessment_number: string; total_payable_etb: number }>(draftRes);
    expect(draft.data!.status).toBe("DRAFT");
    expect(draft.data!.assessment_number).toMatch(/^ECC-/);
    createdAssessmentIds.push(draft.data!.id);
    const assessmentId = draft.data!.id;

    const submitRes = await postJson(`${base}/assessments/${assessmentId}/submit`, {}, importerToken);
    expect(submitRes.status).toBe(200);
    expect((await json<{ status: string }>(submitRes)).data!.status).toBe("SUBMITTED");

    const approveRes = await postJson(`${base}/assessments/${assessmentId}/approve`, {}, adminToken);
    expect(approveRes.status).toBe(200);
    expect((await json<{ status: string }>(approveRes)).data!.status).toBe("APPROVED");

    const payRes = await postJson(
      `${base}/assessments/${assessmentId}/pay`,
      { amount_etb: draft.data!.total_payable_etb, payment_method: "BANK", bank_name: "CBE" },
      adminToken
    );
    expect(payRes.status).toBe(200);
    const paid = await json<{ assessment: { status: string }; payment_number: string }>(payRes);
    expect(paid.data!.assessment.status).toBe("PAID");
    expect(paid.data!.payment_number).toMatch(/^PAY-/);
  });

  it("rejects submitting without items (empty items are blocked by schema)", async () => {
    const branchId = await branchIdPromise;
    const res = await postJson(
      `${base}/assessments`,
      { ...draftBody(branchId), items: [] },
      importerToken
    );
    expect(res.status).toBe(400);
  });

  it("rejects approving before submission", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    expect(draftRes.status).toBe(201);
    const draft = await json<{ id: string }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    const approveRes = await postJson(`${base}/assessments/${draft.data!.id}/approve`, {}, adminToken);
    expect(approveRes.status).toBe(409);
  });

  it("rejects an assessment and cancels a draft", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    const draft = await json<{ id: string }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    await postJson(`${base}/assessments/${draft.data!.id}/submit`, {}, importerToken);

    const rejectRes = await postJson(
      `${base}/assessments/${draft.data!.id}/reject`,
      { reason: "Documentation incomplete" },
      adminToken
    );
    expect(rejectRes.status).toBe(200);
    expect((await json<{ status: string }>(rejectRes)).data!.status).toBe("REJECTED");
  });

  it("allows an importer to cancel their own draft", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    const draft = await json<{ id: string }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    const cancelRes = await postJson(`${base}/assessments/${draft.data!.id}/cancel`, {}, importerToken);
    expect(cancelRes.status).toBe(200);
    expect((await json<{ status: string }>(cancelRes)).data!.status).toBe("CANCELLED");

    // A rejected assessment cannot be cancelled.
    const subRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    const sub = await json<{ id: string }>(subRes);
    createdAssessmentIds.push(sub.data!.id);
    await postJson(`${base}/assessments/${sub.data!.id}/submit`, {}, importerToken);
    await postJson(`${base}/assessments/${sub.data!.id}/reject`, { reason: "Nope" }, adminToken);
    const cancelAgain = await postJson(`${base}/assessments/${sub.data!.id}/cancel`, {}, importerToken);
    expect(cancelAgain.status).toBe(409);
  });

  it("lists assessments with role filtering and pagination", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    const draft = await json<{ id: string }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    const listRes = await get(`${base}/assessments?limit=5`, adminToken);
    expect(listRes.status).toBe(200);
    const list = await json<unknown[]>(listRes);
    expect(Array.isArray(list.data)).toBe(true);
  });

  it("returns assessment details with items", async () => {
    const branchId = await branchIdPromise;
    const draftRes = await postJson(`${base}/assessments`, draftBody(branchId), importerToken);
    const draft = await json<{ id: string }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    const detailRes = await get(`${base}/assessments/${draft.data!.id}`, adminToken);
    expect(detailRes.status).toBe(200);
    const detail = await json<{ items: unknown[]; total_payable_etb: number }>(detailRes);
    expect(detail.data!.items).toHaveLength(1);
    expect(detail.data!.total_payable_etb).toBeGreaterThan(0);
  });
});

describe("QR verification", () => {
  it("returns green and PAID & CLEARED for a paid assessment", async () => {
    const branchId = await getBranchId();
    const importer = await createUser("IMPORTER");
    const draftBody = {
      declarant_name: "QR Declarant",
      declarant_tin: "0012345678",
      branch_id: branchId,
      currency: "USD",
      exchange_rate_applied: 57.5,
      exemption_type: "NONE",
      items: [
        { hs_code: "8517.13.00", item_description: "Smartphones", quantity: 10, unit_price_foreign: 250, freight_foreign: 100, insurance_foreign: 50 },
      ],
    };
    const draftRes = await postJson(`${base}/assessments`, draftBody, importer.token);
    const draft = await json<{ id: string; total_payable_etb: number }>(draftRes);
    createdAssessmentIds.push(draft.data!.id);

    await postJson(`${base}/assessments/${draft.data!.id}/submit`, {}, importer.token);
    const approveRes = await postJson(`${base}/assessments/${draft.data!.id}/approve`, {}, adminToken);
    const approved = await json<{ qr_verification_hash?: string }>(approveRes);

    // The hash is not part of the DTO; read it from the DB.
    const rows = await db
      .select({ hash: schema.assessments.qr_verification_hash })
      .from(schema.assessments)
      .where(eq(schema.assessments.id, draft.data!.id));
    const hash = rows[0].hash;
    expect(hash).toBeTruthy();
    expect(approved.data!.qr_verification_hash).toBeUndefined();

    const verifyAfterApprove = await get(`${base}/verify/${encodeURIComponent(hash!)}`);
    expect(verifyAfterApprove.status).toBe(200);
    expect((await json<{ color: string }>(verifyAfterApprove)).data!.color).toBe("yellow");

    await postJson(
      `${base}/assessments/${draft.data!.id}/pay`,
      { amount_etb: draft.data!.total_payable_etb, payment_method: "BANK" },
      adminToken
    );

    const verifyRes = await get(`${base}/verify/${encodeURIComponent(hash!)}`);
    expect(verifyRes.status).toBe(200);
    const body = await json<{ color: string; statusLabel: string; assessmentNumber: string }>(verifyRes);
    expect(body.data!.color).toBe("green");
    expect(body.data!.statusLabel).toBe("PAID & CLEARED");
    expect(body.data!.assessmentNumber).toMatch(/^ECC-/);
  });

  it("returns red for an invalid token", async () => {
    const res = await get(`${base}/verify/not.a.valid.token`);
    expect(res.status).toBe(200);
    const body = await json<{ color: string; reason: string }>(res);
    expect(body.data!.color).toBe("red");
  });
});

describe("notifications", () => {
  it("lists my notifications and marks them read", async () => {
    const importer = await createUser("IMPORTER");
    const listRes = await get(`${base}/notifications`, importer.token);
    expect(listRes.status).toBe(200);
    const list = await json<unknown[]>(listRes);
    expect(Array.isArray(list.data)).toBe(true);

    const readAllRes = await putJson(`${base}/notifications/read-all`, {}, importer.token);
    expect(readAllRes.status).toBe(200);
  });
});

describe("dashboard, reports and audit RBAC", () => {
  it("lets an admin view dashboard stats, reports, and audit logs", async () => {
    const statsRes = await get(`${base}/dashboard/stats`, adminToken);
    expect(statsRes.status).toBe(200);

    const revenueRes = await get(`${base}/reports/revenue`, adminToken);
    expect(revenueRes.status).toBe(200);

    const freqRes = await get(`${base}/reports/hs-frequency`, adminToken);
    expect(freqRes.status).toBe(200);

    const auditRes = await get(`${base}/audit?action=ASSESSMENT_CREATED`, adminToken);
    expect(auditRes.status).toBe(200);
    expect(Array.isArray((await json<unknown[]>(auditRes)).data)).toBe(true);
  });

  it("blocks an importer from dashboard, reports, and audit", async () => {
    const importer = await createUser("IMPORTER");
    expect((await get(`${base}/dashboard/stats`, importer.token)).status).toBe(403);
    expect((await get(`${base}/reports/revenue`, importer.token)).status).toBe(403);
    expect((await get(`${base}/audit`, importer.token)).status).toBe(403);
  });
});