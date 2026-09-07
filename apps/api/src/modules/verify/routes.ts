import { Hono } from "hono";
import * as verifyService from "./service.js";
import { ok } from "../../lib/http.js";

const verifyRoutes = new Hono();

verifyRoutes.get("/:verificationHash", async (c) => {
  const hash = c.req.param("verificationHash")!;
  const result = await verifyService.verifyAssessment(hash);
  return c.json(ok(result));
});

export { verifyRoutes };
