import type { Context, Next } from "hono";
import type { AppVariables } from "./auth.js";

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

/**
 * In-memory fixed-window rate limiter. Suitable for single-instance deployments;
 * for multi-instance HA a shared store (e.g. Redis) would be used instead.
 *
 * Options:
 *   - limit: max requests per window
 *   - windowMs: window length in milliseconds
 *   - key: custom key builder (default: IP for anonymous, userId when authed)
 */
export interface RateLimitOptions {
  limit: number;
  windowMs?: number;
  key?: (c: Context<{ Variables: AppVariables }>) => string;
  message?: string;
}

function defaultKey(c: Context<{ Variables: AppVariables }>): string {
  const user = c.get("user");
  if (user) return `u:${user.id}`;
  return `ip:${c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown"}`;
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs ?? 60_000;
  const buildKey = opts.key ?? defaultKey;
  const message = opts.message ?? "Too many requests, please try again later";

  return async function rateLimitMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
    const key = buildKey(c);
    const now = Date.now();
    let bucket = store.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, opts.limit - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    c.header("X-RateLimit-Limit", String(opts.limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > opts.limit) {
      c.header("Retry-After", String(resetSeconds));
      return c.json(
        { success: false, error: { code: "RATE_LIMITED", message } },
        429
      );
    }

    await next();
  };
}
