import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { calculateSchema } from "@customs-duty-pro/shared";
import * as calcService from "./service.js";
import { ok } from "../../lib/http.js";
import { authMiddleware } from "../../middleware/auth.js";
import type { AppVariables } from "../../middleware/auth.js";

type CalcEnv = { Variables: AppVariables };

const calcRoutes = new Hono<CalcEnv>();

// Public quick estimate — returns summary only.
calcRoutes.post("/", zValidator("json", calculateSchema), async (c) => {
  const body = c.req.valid("json");
  const output = await calcService.compute({
    currency: body.currency,
    exchange_rate: body.exchange_rate,
    exemption_type: body.exemption_type,
    items: body.items,
  });
  return c.json(ok({ summary: output.summary, appliedExemption: output.appliedExemption }));
});

// Full preview with per-item details (authenticated).
calcRoutes.post("/preview", authMiddleware, zValidator("json", calculateSchema), async (c) => {
  const body = c.req.valid("json");
  const output = await calcService.compute({
    currency: body.currency,
    exchange_rate: body.exchange_rate,
    exemption_type: body.exemption_type,
    items: body.items,
  });
  return c.json(ok(output));
});

export { calcRoutes };
