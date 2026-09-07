import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { requestId } from "hono/request-id";
import { config } from "./lib/config.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./modules/auth/routes.js";
import { userRoutes } from "./modules/users/routes.js";
import { hsCodeRoutes } from "./modules/hs-codes/routes.js";
import { forexRoutes } from "./modules/forex/routes.js";
import { calcRoutes } from "./modules/calculator/routes.js";
import { assessmentRoutes } from "./modules/assessments/routes.js";
import { notifRoutes } from "./modules/notifications/routes.js";
import { verifyRoutes } from "./modules/verify/routes.js";
import { auditRoutes } from "./modules/audit/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { rateLimit } from "./middleware/rate-limit.js";

const app = new Hono();

// Global middleware
app.use("*", requestId());
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: config.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    credentials: true,
    maxAge: 86400,
  })
);

// Security headers
app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (config.NODE_ENV === "production") {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
});

// Global rate limiting (spec 4.2): authenticated 120/min, anonymous keyed by IP.
app.use("/api/v1/*", rateLimit({ limit: 120, windowMs: 60_000 }));

// Error handler
app.onError(errorHandler);

// Routes
app.route("/api/health", healthRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/hs-codes", hsCodeRoutes);
app.route("/api/v1/forex", forexRoutes);
app.route("/api/v1/calculate", calcRoutes);
app.route("/api/v1/assessments", assessmentRoutes);
app.route("/api/v1/notifications", notifRoutes);
app.route("/api/v1/verify", verifyRoutes);
app.route("/api/v1/audit", auditRoutes);
app.route("/api/v1/dashboard", dashboardRoutes);
app.route("/api/v1/reports", reportRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
    },
    404
  );
});

export { app };
