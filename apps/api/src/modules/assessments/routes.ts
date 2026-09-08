import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { createAssessmentSchema } from "@customs-duty-pro/shared";
import * as assessmentService from "./service.js";
import { generateAssessmentPdf } from "./pdf.js";
import { parsePagination, ok, okList, paginationMeta } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { auditFromContext, writeAudit } from "../../lib/audit.js";
import { rateLimit } from "../../middleware/rate-limit.js";

type AssessmentEnv = { Variables: AppVariables };

const assessmentRoutes = new Hono<AssessmentEnv>();

const rejectSchema = z.object({
  reason: z.string().min(3, "Rejection reason is required").max(1000),
});

const markPaidSchema = z.object({
  amount_etb: z.number().positive(),
  payment_method: z.string().min(1).max(30),
  bank_name: z.string().max(100).optional(),
  bank_reference: z.string().max(100).optional(),
  receipt_number: z.string().max(100).optional(),
});

// Create draft assessment.
assessmentRoutes.post(
  "/",
  authMiddleware,
  requirePermission("assessment:create"),
  zValidator("json", createAssessmentSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");
    const data = await assessmentService.createDraft(body, user.id);
    await writeAudit(
      auditFromContext(c, {
        action: "ASSESSMENT_CREATED",
        entityName: "assessments",
        entityId: data.id,
        newValues: { assessment_number: data.assessment_number, status: data.status },
      })
    );
    return c.json(ok(data), 201);
  }
);

assessmentRoutes.post(
  "/:id/submit",
  authMiddleware,
  requirePermission("assessment:submit"),
  rateLimit({ limit: 10, windowMs: 60_000, message: "Assessment submit limit reached, try again later" }),
  async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user");
  const data = await assessmentService.submitAssessment(id, { id: user.id, role: user.role });
  await writeAudit(
    auditFromContext(c, { action: "ASSESSMENT_SUBMITTED", entityName: "assessments", entityId: id, newValues: { status: data.status } })
  );
  return c.json(ok(data));
});

assessmentRoutes.post("/:id/approve", authMiddleware, requirePermission("assessment:approve_reject"), async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user");
  const data = await assessmentService.approveAssessment(id, { id: user.id, role: user.role });
  await writeAudit(
    auditFromContext(c, { action: "ASSESSMENT_APPROVED", entityName: "assessments", entityId: id, newValues: { status: data.status } })
  );
  return c.json(ok(data));
});

assessmentRoutes.post(
  "/:id/reject",
  authMiddleware,
  requirePermission("assessment:approve_reject"),
  zValidator("json", rejectSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const body = c.req.valid("json");
    const data = await assessmentService.rejectAssessment(id, body.reason, { id: user.id, role: user.role });
    await writeAudit(
      auditFromContext(c, {
        action: "ASSESSMENT_REJECTED",
        entityName: "assessments",
        entityId: id,
        newValues: { status: data.status, reason: body.reason },
      })
    );
    return c.json(ok(data));
  }
);

assessmentRoutes.post("/:id/cancel", authMiddleware, requirePermission("assessment:cancel"), async (c) => {
  const id = c.req.param("id")!;
  const user = c.get("user");
  const data = await assessmentService.cancelAssessment(id, { id: user.id, role: user.role });
  await writeAudit(
    auditFromContext(c, { action: "ASSESSMENT_CANCELLED", entityName: "assessments", entityId: id, newValues: { status: data.status } })
  );
  return c.json(ok(data));
});

assessmentRoutes.post(
  "/:id/pay",
  authMiddleware,
  requirePermission("assessment:mark_paid"),
  zValidator("json", markPaidSchema),
  async (c) => {
    const id = c.req.param("id")!;
    const user = c.get("user");
    const body = c.req.valid("json");
    const data = await assessmentService.markPaid(id, body, { id: user.id, role: user.role });
    await writeAudit(
      auditFromContext(c, {
        action: "ASSESSMENT_PAID",
        entityName: "assessments",
        entityId: id,
        newValues: { status: data.assessment.status, payment_number: data.payment_number },
      })
    );
    return c.json(ok(data));
  }
);

// List assessments (role-filtered).
assessmentRoutes.get("/", authMiddleware, async (c) => {
  const pq = parsePagination(c);
  const user = c.get("user");
  const result = await assessmentService.listAssessments(
    { id: user.id, role: user.role },
    {
      status: c.req.query("status"),
      branch: c.req.query("branch"),
      from: c.req.query("from"),
      to: c.req.query("to"),
      page: pq.page,
      limit: pq.limit,
    }
  );
  return c.json(okList(result.data, paginationMeta(result.total, pq.page, pq.limit)));
});

assessmentRoutes.get("/:id", authMiddleware, async (c) => {
  const id = c.req.param("id")!;
  const data = await assessmentService.getAssessmentDetail(id);
  return c.json(ok(data));
});

assessmentRoutes.get("/:id/pdf", authMiddleware, requirePermission("assessment:download_pdf"), async (c) => {
  const id = c.req.param("id")!;
  const { buffer, filename } = await generateAssessmentPdf(id);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  c.header("Content-Length", String(buffer.byteLength));
  return c.body(arrayBuffer);
});

export { assessmentRoutes };
